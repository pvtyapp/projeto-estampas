import uuid
import os
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.job_queue import queue
from backend.jobs import process_render
from backend.auth import get_current_user
from backend.supabase_client import supabase
from backend.limits import check_and_consume_limits, LimitExceeded

DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "false").lower() == "true"

app = FastAPI(title="Projeto Estampas API", version="7.6")

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://pvty.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.options("/{path:path}")
async def preflight_handler(path: str, request: Request):
    return {}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("🔥 Unhandled exception:", repr(exc))
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error","detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        },
    )

# =========================
# MODELOS
# =========================

class Slot(BaseModel):
    type: str
    width_cm: float
    height_cm: float
    url: Optional[str] = None

class PrintCreate(BaseModel):
    name: str
    sku: str
    slots: List[Slot]

class PrintJobItem(BaseModel):
    print_id: str
    qty: int

class PrintJobRequest(BaseModel):
    items: List[PrintJobItem]

class PrintNoteIn(BaseModel):
    print_id: str
    note: str

class SettingsIn(BaseModel):
    price_per_meter: float

# =========================
# AUTH
# =========================

def dev_user():
    return {"sub": "00000000-0000-0000-0000-000000000001"}

def current_user(user=Depends(get_current_user)):
    if DEV_NO_AUTH:
        return dev_user()
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user

# =========================
# HELPERS
# =========================

def validate_slots(slots: List[Slot]):
    types = [s.type for s in slots]

    if "front" not in types:
        raise HTTPException(status_code=400, detail="Slot 'front' é obrigatório")

    if "extra" in types and "back" not in types:
        raise HTTPException(status_code=400, detail="Slot 'extra' só pode existir se 'back' existir")

    invalid = set(types) - {"front", "back", "extra"}
    if invalid:
        raise HTTPException(status_code=400, detail=f"Tipos inválidos: {invalid}")

def load_slots(print_id: str):
    return supabase.table("print_slots").select("*").eq("print_id", print_id).execute().data or []

# =========================
# ROOT
# =========================

@app.get("/")
def root():
    return {"status": "ok"}

# =========================
# PRINT NOTES
# =========================

@app.get("/print-notes")
def list_print_notes(user=Depends(current_user)):
    return supabase.table("print_notes").select("print_id,note").eq("user_id", user["sub"]).execute().data or []

@app.post("/print-notes")
def save_print_note(data: PrintNoteIn, user=Depends(current_user)):
    supabase.table("print_notes").upsert({
        "id": str(uuid.uuid4()),
        "user_id": user["sub"],
        "print_id": data.print_id,
        "note": data.note,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id,print_id").execute()
    return {"ok": True}

# =========================
# PRINTS
# =========================

@app.get("/prints")
def list_prints(user=Depends(current_user)):
    prints = supabase.table("prints").select("*").eq("user_id", user["sub"]).order("created_at", desc=True).execute().data or []
    for p in prints:
        p["slots"] = load_slots(p["id"])
    return prints

@app.get("/prints/{print_id}")
def get_print(print_id: str, user=Depends(current_user)):
    p = supabase.table("prints").select("*").eq("id", print_id).eq("user_id", user["sub"]).single().execute().data
    if not p:
        raise HTTPException(status_code=404, detail="Print não encontrado")
    p["slots"] = load_slots(p["id"])
    return p

@app.post("/prints")
def create_print(payload: PrintCreate, user=Depends(current_user)):
    validate_slots(payload.slots)
    print_id = str(uuid.uuid4())

    supabase.table("prints").insert({
        "id": print_id,
        "user_id": user["sub"],
        "name": payload.name,
        "sku": payload.sku,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    for s in payload.slots:
        supabase.table("print_slots").upsert({
            "id": str(uuid.uuid4()),
            "print_id": print_id,
            "type": s.type,
            "width_cm": s.width_cm,
            "height_cm": s.height_cm,
            "url": s.url,
        }, on_conflict="print_id,type").execute()

    return get_print(print_id, user)

@app.patch("/prints/{print_id}")
def update_print(print_id: str, payload: Dict[str, Any], user=Depends(current_user)):
    slots = payload.get("slots")
    if not isinstance(slots, list):
        raise HTTPException(status_code=400, detail="slots inválido")

    validate_slots([Slot(**s) for s in slots])

    supabase.table("print_slots").delete().eq("print_id", print_id).execute()

    for s in slots:
        supabase.table("print_slots").insert({
            "id": str(uuid.uuid4()),
            "print_id": print_id,
            "type": s["type"],
            "width_cm": s["width_cm"],
            "height_cm": s["height_cm"],
            "url": s.get("url"),
        }).execute()

    return get_print(print_id, user)

@app.delete("/prints/{print_id}")
def delete_print(print_id: str, user=Depends(current_user)):
    supabase.table("print_slots").delete().eq("print_id", print_id).execute()
    supabase.table("prints").delete().eq("id", print_id).eq("user_id", user["sub"]).execute()
    return {"status": "deleted"}

@app.post("/prints/{print_id}/upload")
def upload_print_file(
    print_id: str,
    file: UploadFile = File(...),
    type: str = Form(...),
    width_cm: float = Form(...),
    height_cm: float = Form(...),
    user=Depends(current_user),
):
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    path = f"{user['sub']}/{print_id}/{type}.png"
    supabase.storage.from_("prints").upload(path, content, {"upsert": "true"})
    public_url = supabase.storage.from_("prints").get_public_url(path)

    supabase.table("print_slots").upsert({
        "id": str(uuid.uuid4()),
        "print_id": print_id,
        "type": type,
        "width_cm": width_cm,
        "height_cm": height_cm,
        "url": public_url,
    }, on_conflict="print_id,type").execute()

    return {"url": public_url}

# =========================
# JOBS
# =========================

def build_pieces(print_obj, qty: int):
    return [
        {
            "width": s["width_cm"],
            "height": s["height_cm"],
            "type": s["type"],
            "print_id": print_obj["id"],
            "url": s.get("url"),
        }
        for _ in range(qty)
        for s in print_obj["slots"]
    ]

@app.get("/jobs/history")
def list_job_history(from_: Optional[str] = None, to: Optional[str] = None, user=Depends(current_user)):
    q = supabase.table("jobs").select("id,status,created_at,finished_at,zip_url,payload").eq("user_id", user["sub"])
    if from_:
        q = q.gte("created_at", from_)
    if to:
        q = q.lte("created_at", to)

    jobs = q.order("created_at", desc=True).limit(50).execute().data or []
    if not jobs:
        return []

    job_ids = [j["id"] for j in jobs]

    files = (
    supabase
    .table("print_files")
    .select("job_id")
    .eq("preview", False)
    .in_("job_id", job_ids)
    .execute()
    .data
    or []
)

    file_count_map = {}
    for f in files:
        file_count_map[f["job_id"]] = file_count_map.get(f["job_id"], 0) + 1

    result = []
    for j in jobs:
        payload = j.get("payload") or {}
        kits = payload.get("kits") or 0
        sheets = payload.get("sheets") or 0
        result.append({
            "id": j["id"],
            "status": j["status"],
            "created_at": j["created_at"],
            "finished_at": j.get("finished_at"),
            "zip_url": j.get("zip_url"),
            "file_count": file_count_map.get(j["id"], 0),
            "print_count": sheets or kits,
        })

    return result

@app.get("/jobs/{job_id}")
def get_job(job_id: str, user=Depends(current_user)):
    job = supabase.table("jobs").select("*").eq("id", job_id).eq("user_id", user["sub"]).single().execute().data
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    payload = job.get("payload") or {}
    sheets = payload.get("sheets") or 0
    kits = payload.get("kits") or 0

    files = supabase.table("print_files").select("id").eq("job_id", job_id).execute().data or []

    return {
        "id": job["id"],
        "status": job["status"],
        "created_at": job["created_at"],
        "finished_at": job.get("finished_at"),
        "zip_url": job.get("zip_url"),
        "file_count": len(files),
        "print_count": sheets or kits,
    }

@app.get("/jobs/{job_id}/files")
def get_job_files(job_id: str, user=Depends(current_user)):
    uuid.UUID(job_id)

    job = supabase.table("jobs").select("id").eq("id", job_id).eq("user_id", user["sub"]).single().execute().data
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    files = (
        supabase
        .table("print_files")
        .select("id, public_url, page_index, created_at, preview")
        .eq("job_id", job_id)
        .order("page_index")
        .execute()
        .data
        or []
    )

    return [
        {
            "id": f["id"],
            "url": f["public_url"],
            "page_index": f.get("page_index", 0),
            "created_at": f.get("created_at"),
            "preview": f.get("preview", False),
        }
        for f in files
    ]

@app.post("/print-jobs")
def create_print_job(payload: PrintJobRequest, user=Depends(current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Nenhum item enviado")

    total_kits = sum(max(i.qty, 0) for i in payload.items)

    pieces = []
    for item in payload.items:
        print_obj = get_print(item.print_id, user)
        pieces.extend(build_pieces(print_obj, item.qty))

    if not pieces:
        raise HTTPException(status_code=400, detail="Nenhuma peça gerada")

    job_id = str(uuid.uuid4())

    supabase.table("jobs").insert({
        "id": job_id,
        "user_id": user["sub"],
        "status": "preview",
        "payload": {"pieces": pieces, "kits": total_kits, "sheets": None},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    queue.enqueue(process_render, job_id, preview=True, job_timeout=600)
    return {"job_id": job_id, "total_kits": total_kits}

@app.post("/print-jobs/{job_id}/confirm")
def confirm_print_job(job_id: str, user=Depends(current_user)):
    uuid.UUID(job_id)

    updated = supabase.table("jobs").update({"status": "confirming"}).eq("id", job_id).eq("status", "preview_done").execute()
    if not updated.data:
        raise HTTPException(status_code=409, detail="Job já foi confirmado ou está em processamento")

    job = supabase.table("jobs").select("*").eq("id", job_id).eq("user_id", user["sub"]).single().execute().data

    sheets = (job.get("payload") or {}).get("sheets") or 0
    if sheets <= 0:
        raise HTTPException(status_code=400, detail="Nenhum kit no job")

    try:
        check_and_consume_limits(supabase, user["sub"], sheets, job_id=job_id)

    except LimitExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))

    supabase.table("jobs").update({"status": "queued"}).eq("id", job_id).execute()
    queue.enqueue(process_render, job_id, preview=False, job_timeout=600)

    return {"status": "confirmed", "sheets": sheets}

# =========================
# STATS
# =========================

@app.get("/stats/prints")
def get_print_stats(from_: Optional[str] = None, to: Optional[str] = None, user=Depends(current_user)):
    since_45d = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()

    prints = (
        supabase
        .table("prints")
        .select("id,name")
        .eq("user_id", user["sub"])
        .execute()
        .data or []
    )

    q = supabase.table("jobs").select("payload,created_at").eq("user_id", user["sub"])
    if from_:
        q = q.gte("created_at", from_)
    if to:
        q = q.lte("created_at", to)

    jobs = q.execute().data or []

    # Contar uso por estampa no período
    counts = {}
    used_recently = set()
    total_sheets = 0

    for j in jobs:
        payload = j.get("payload") or {}
        pieces = payload.get("pieces") or []
        sheets = payload.get("sheets") or 0
        total_sheets += sheets

        for p in pieces:
            pid = p.get("print_id")
            if pid:
                counts[pid] = counts.get(pid, 0) + 1
                used_recently.add(pid)

    # Top usadas no período
    top_used = []
    for p in prints:
        c = counts.get(p["id"], 0)
        if c > 0:
            top_used.append({"name": p["name"], "count": c})

    top_used.sort(key=lambda x: x["count"], reverse=True)

    # Esquecidas = não usadas nos últimos 45 dias
    forgotten = []
    if since_45d:
        q45 = (
            supabase
            .table("jobs")
            .select("payload")
            .eq("user_id", user["sub"])
            .gte("created_at", since_45d)
            .execute()
            .data or []
        )

        used_45 = set()
        for j in q45:
            for p in (j.get("payload") or {}).get("pieces", []):
                pid = p.get("print_id")
                if pid:
                    used_45.add(pid)

        for p in prints:
            if p["id"] not in used_45:
                forgotten.append({"name": p["name"]})

    files = (
        supabase
        .table("print_files")
        .select("id")
        .eq("preview", False)
        .execute()
        .data or []
    )

    return {
        "top_used": top_used[:15],
        "not_used": forgotten[:15],
        "costs": {
            "files": len(files),
            "prints": total_sheets,
            "total_cost": 0,
        },
    }


# =========================
# ACCOUNT
# =========================

@app.get("/me/usage")
def get_my_usage(user=Depends(current_user)):
    profile = supabase.table("profiles").select("*").eq("id", user["sub"]).execute().data
    plan_id = profile[0]["plan_id"] if profile else "free"

    plan = supabase.table("plans").select("*").eq("id", plan_id).execute().data
    plan = plan[0] if plan else {}

    now = datetime.now(timezone.utc)

    if plan.get("daily_limit"):
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        limit = plan["daily_limit"]
        remaining_days = 0
    else:
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        limit = plan.get("monthly_limit") or 100
        import calendar
        days_in_month = calendar.monthrange(now.year, now.month)[1]
        remaining_days = days_in_month - now.day

    rows = supabase.table("usage").select("amount").eq("user_id", user["sub"]).gte("created_at", start.isoformat()).execute().data or []
    used = sum(r["amount"] or 0 for r in rows)

    credits = supabase.table("credit_packs").select("remaining").eq("user_id", user["sub"]).execute().data or []
    total_credits = sum(c["remaining"] or 0 for c in credits)

    status = "ok"
    if used > limit:
        status = "using_credits" if total_credits > 0 else "blocked"
    elif used > limit * 0.8:
        status = "warning"

    return {
        "plan": plan_id,
        "used": used,
        "limit": limit,
        "credits": total_credits,
        "remaining_days": remaining_days,
        "status": status,
        "library_limit": plan.get("library_limit"),
    }

# =========================
# SETTINGS
# =========================

@app.get("/me/settings")
def get_settings(user=Depends(current_user)):
    res = (
        supabase
        .table("user_settings")
        .select("*")
        .eq("user_id", user["sub"])
        .execute()
    )

    data = res.data if res and hasattr(res, "data") else None

    if not data:
        return {"price_per_meter": 0}

    return data[0]

@app.post("/me/settings")
def save_settings(data: SettingsIn, user=Depends(current_user)):
    supabase.table("user_settings").upsert({
        "user_id": user["sub"],
        "price_per_meter": data.price_per_meter,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    return {"ok": True}


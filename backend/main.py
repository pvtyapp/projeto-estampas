import uuid
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from backend.job_queue import queue
from backend.jobs import process_render
from backend.auth import get_current_user
from backend.supabase_client import supabase
from backend.limits import check_and_consume_limits, LimitExceeded

DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "false").lower() == "true"

app = FastAPI(title="Projeto Estampas API", version="5.1")

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

# =========================
# MODELOS
# =========================

class PrintCreate(BaseModel):
    name: str
    sku: str
    width_cm: float
    height_cm: float
    is_composite: bool = False

class PrintJobItem(BaseModel):
    print_id: str
    qty: int

class PrintJobRequest(BaseModel):
    items: List[PrintJobItem]

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

def build_slots_from_print(p: dict) -> Dict[str, dict]:
    return {
        "front": {
            "url": p.get("front_url") or "",
            "width_cm": p.get("front_width_cm") or 0,
            "height_cm": p.get("front_height_cm") or 0,
        },
        "back": {
            "url": p.get("back_url") or "",
            "width_cm": p.get("back_width_cm") or 0,
            "height_cm": p.get("back_height_cm") or 0,
        },
        "extra": {
            "url": p.get("extra_url") or "",
            "width_cm": p.get("extra_width_cm") or 0,
            "height_cm": p.get("extra_height_cm") or 0,
        },
    }

def load_assets(print_id: str):
    return supabase.table("print_assets") \
        .select("id, public_url, width_cm, height_cm, quantity") \
        .eq("print_id", print_id) \
        .execute().data or []

# =========================
# ROTAS
# =========================

@app.get("/")
def root():
    return {"status": "ok"}

# =========================
# PRINTS
# =========================

@app.get("/prints")
def list_prints(user=Depends(current_user)):
    rows = supabase.table("prints") \
        .select("*") \
        .eq("user_id", user["sub"]) \
        .order("created_at", desc=True) \
        .execute().data or []

    result = []
    for p in rows:
        p["slots"] = build_slots_from_print(p)
        p["assets"] = load_assets(p["id"])
        for k in (
            "front_url","front_width_cm","front_height_cm",
            "back_url","back_width_cm","back_height_cm",
            "extra_url","extra_width_cm","extra_height_cm"
        ):
            p.pop(k, None)
        result.append(p)

    return result

@app.get("/prints/{print_id}")
def get_print(print_id: str, user=Depends(current_user)):
    p = supabase.table("prints") \
        .select("*") \
        .eq("id", print_id) \
        .eq("user_id", user["sub"]) \
        .single() \
        .execute().data

    if not p:
        raise HTTPException(status_code=404, detail="Print não encontrado")

    p["slots"] = build_slots_from_print(p)
    p["assets"] = load_assets(p["id"])
    for k in (
        "front_url","front_width_cm","front_height_cm",
        "back_url","back_width_cm","back_height_cm",
        "extra_url","extra_width_cm","extra_height_cm"
    ):
        p.pop(k, None)

    return p

@app.post("/prints")
def create_print(payload: PrintCreate, user=Depends(current_user)):
    data = payload.dict()
    data.update({
        "id": str(uuid.uuid4()),
        "user_id": user["sub"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    res = supabase.table("prints").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erro ao criar estampa")

    return res.data[0]

@app.patch("/prints/{print_id}")
def update_print(print_id: str, payload: Dict[str, Any], user=Depends(current_user)):
    exists = supabase.table("prints") \
        .select("id") \
        .eq("id", print_id) \
        .eq("user_id", user["sub"]) \
        .single() \
        .execute().data

    if not exists:
        raise HTTPException(status_code=404, detail="Print não encontrado")

    update = {}

    if "width_cm" in payload:
        update["width_cm"] = float(payload["width_cm"])
    if "height_cm" in payload:
        update["height_cm"] = float(payload["height_cm"])

    slots = payload.get("slots")
    if isinstance(slots, dict):
        for key in ("front","back","extra"):
            slot = slots.get(key)
            if not isinstance(slot, dict):
                continue
            if "width_cm" in slot:
                update[f"{key}_width_cm"] = float(slot.get("width_cm") or 0)
            if "height_cm" in slot:
                update[f"{key}_height_cm"] = float(slot.get("height_cm") or 0)

    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")

    supabase.table("prints") \
        .update(update) \
        .eq("id", print_id) \
        .eq("user_id", user["sub"]) \
        .execute()

    return get_print(print_id, user)

@app.delete("/prints/{print_id}")
def delete_print(print_id: str, user=Depends(current_user)):
    supabase.table("prints").delete().eq("id", print_id).eq("user_id", user["sub"]).execute()
    return {"status": "deleted"}

@app.post("/prints/{print_id}/upload")
def upload_print_file(
    print_id: str,
    file: UploadFile = File(...),
    type: str = "front",
    width_cm: float = 0,
    height_cm: float = 0,
    user=Depends(current_user)
):
    p = supabase.table("prints") \
        .select("id") \
        .eq("id", print_id) \
        .eq("user_id", user["sub"]) \
        .single() \
        .execute().data

    if not p:
        raise HTTPException(status_code=404, detail="Print não encontrado")

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    path = f"{user['sub']}/{print_id}/{type}.png".lstrip("/")

    supabase.storage.from_("prints").upload(
        path,
        content,
        {
            "content-type": file.content_type or "application/octet-stream",
            "upsert": "true",
        },
    )

    public_url = supabase.storage.from_("prints").get_public_url(path).get("publicUrl")

    asset_id = str(uuid.uuid4())

    supabase.table("print_assets").insert({
        "id": asset_id,
        "print_id": print_id,
        "slot": type,
        "type": "print",
        "file_path": path,
        "public_url": public_url,
        "width_cm": float(width_cm or 0),
        "height_cm": float(height_cm or 0),
        "quantity": 1,
        "user_id": user["sub"],
    }).execute()

    supabase.table("prints").update({
        f"{type}_url": public_url,
        f"{type}_width_cm": float(width_cm or 0),
        f"{type}_height_cm": float(height_cm or 0),
    }).eq("id", print_id).execute()

    return {"url": public_url}


# =========================
# PRINT ASSETS
# =========================

@app.patch("/print-assets/{asset_id}")
def update_asset(asset_id: str, payload: Dict[str, Any], user=Depends(current_user)):
    update = {}
    if "width_cm" in payload:
        update["width_cm"] = float(payload["width_cm"])
    if "height_cm" in payload:
        update["height_cm"] = float(payload["height_cm"])
    if "quantity" in payload:
        update["quantity"] = int(payload["quantity"])

    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")

    res = supabase.table("print_assets").update(update).eq("id", asset_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Asset não encontrado")

    return res.data[0]

# =========================
# JOBS
# =========================

@app.post("/print-jobs")
def create_print_job(payload: PrintJobRequest, user=Depends(current_user)):
    total_units = sum(max(item.qty, 0) for item in payload.items)

    if total_units <= 0:
        raise HTTPException(status_code=400, detail="Nenhuma unidade informada.")
    if total_units > 100:
        raise HTTPException(status_code=400, detail="Limite máximo de 100 unidades.")

    print_ids = [i.print_id for i in payload.items]

    prints = supabase.table("prints") \
        .select("id,width_cm,height_cm") \
        .in_("id", print_ids) \
        .execute().data or []

    dim_map = {p["id"]: p for p in prints}

    items = []
    for i in payload.items:
        p = dim_map.get(i.print_id)
        if not p:
            raise HTTPException(status_code=400, detail=f"Print {i.print_id} inválido")

        items.append({
            "print_id": i.print_id,
            "qty": i.qty,
            "width_cm": p["width_cm"],
            "height_cm": p["height_cm"],
        })

    job_id = str(uuid.uuid4())

    supabase.table("jobs").insert({
        "id": job_id,
        "user_id": user["sub"],
        "status": "preview",
        "payload": {"items": items},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    queue.enqueue(process_render, job_id, preview=True, job_timeout=600)

    return {"job_id": job_id, "total_units": total_units}

@app.post("/print-jobs/{job_id}/confirm")
def confirm_print_job(job_id: str, user=Depends(current_user)):
    job = supabase.table("jobs").select("*").eq("id", job_id).eq("user_id", user["sub"]).single().execute().data
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    if job["status"] != "preview":
        raise HTTPException(status_code=400, detail="Job não está em preview")

    total_units = sum(i["qty"] for i in job["payload"]["items"])

    try:
        check_and_consume_limits(supabase, user["sub"], total_units)
    except LimitExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))

    supabase.table("jobs").update({"status": "queued"}).eq("id", job_id).execute()
    queue.enqueue(process_render, job_id, preview=False, job_timeout=600)

    return {"status": "confirmed"}

@app.get("/jobs/{job_id}/files")
def get_job_files(job_id: str, user=Depends(current_user)):
    return supabase.table("generated_files").select("*").eq("job_id", job_id).execute().data or []

# =========================
# HISTORY
# =========================

@app.get("/jobs/history")
def jobs_history(user=Depends(current_user)):
    return supabase.table("jobs") \
        .select("*") \
        .eq("user_id", user["sub"]) \
        .order("created_at", desc=True) \
        .limit(50) \
        .execute().data or []

@app.get("/jobs/{job_id}")
def get_job(job_id: str, user=Depends(current_user)):
    job = supabase.table("jobs") \
        .select("*") \
        .eq("id", job_id) \
        .eq("user_id", user["sub"]) \
        .single() \
        .execute().data

    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    return job

@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, user=Depends(current_user)):
    job = supabase.table("jobs") \
        .select("*") \
        .eq("id", job_id) \
        .eq("user_id", user["sub"]) \
        .single() \
        .execute().data

    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    if job["status"] in ("queued", "done"):
        supabase.table("jobs").update({"status": "canceled"}).eq("id", job_id).execute()
        return {"status": "canceled"}

    raise HTTPException(status_code=400, detail="Job não pode ser cancelado nesse estado")

# =========================
# USAGE
# =========================

@app.get("/me/usage")
def get_usage(user=Depends(current_user)):
    user_id = user["sub"]
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month

    usage = supabase.table("usage_monthly") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("year", year) \
        .eq("month", month) \
        .execute().data or []

    usage = usage[0] if usage else None

    plan = supabase.table("plans").select("*").eq("user_id", user_id).execute().data or []
    plan = plan[0] if plan else {"plan": "free", "monthly_limit": 2}

    packages = supabase.table("extra_packages") \
        .select("remaining") \
        .eq("user_id", user_id) \
        .gt("remaining", 0) \
        .execute().data or []

    credits = sum(int(p["remaining"]) for p in packages)

    if not usage:
        used_plan = 0
        used_extra = 0
        limit = int(plan["monthly_limit"])
    else:
        used_plan = int(usage.get("used_plan", 0))
        used_extra = int(usage.get("used_extra", 0))
        limit = int(usage.get("limit_snapshot") or plan["monthly_limit"])

    used = used_plan + used_extra
    percent = round((used_plan / limit) * 100, 1) if limit else 0

    renew_at = datetime(year + (month == 12), (month % 12) + 1, 1, tzinfo=timezone.utc)
    remaining_days = max((renew_at - now).days, 0)

    if used_plan >= limit and credits <= 0:
        status = "blocked"
    elif used_plan >= limit:
        status = "using_credits"
    elif percent >= 90:
        status = "warning"
    else:
        status = "ok"

    return {
        "plan": plan["plan"],
        "used": used,
        "limit": limit,
        "credits": credits,
        "percent": percent,
        "remaining_days": remaining_days,
        "status": status,
    }

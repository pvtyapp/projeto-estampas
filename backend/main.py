import uuid
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.job_queue import queue
from backend.jobs import process_render
from backend.auth import get_current_user
from backend.supabase_client import supabase
from backend.limits import check_and_consume_limits, LimitExceeded

DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "false").lower() == "true"

app = FastAPI(title="Projeto Estampas API", version="6.4")

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://pvty.vercel.app"],
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
        raise ValueError("Slot 'front' é obrigatório")
    if "extra" in types and "back" not in types:
        raise ValueError("Slot 'extra' só pode existir se 'back' existir")
    invalid = set(types) - {"front", "back", "extra"}
    if invalid:
        raise ValueError(f"Tipos inválidos: {invalid}")

def load_slots(print_id: str):
    return supabase.table("print_slots").select("*").eq("print_id", print_id).execute().data or []

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
    try:
        validate_slots(payload.slots)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    print_id = str(uuid.uuid4())

    try:
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar print: {e}")

    return get_print(print_id, user)

@app.patch("/prints/{print_id}")
def update_print(print_id: str, payload: Dict[str, Any], user=Depends(current_user)):
    slots = payload.get("slots")
    if not isinstance(slots, list):
        raise HTTPException(status_code=400, detail="slots inválido")

    try:
        validate_slots([Slot(**s) for s in slots])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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

    if width_cm <= 0 or height_cm <= 0:
        raise HTTPException(status_code=400, detail="width_cm e height_cm devem ser > 0")

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

def build_pieces(print_obj, qty):
    pieces = []
    for _ in range(qty):
        for s in print_obj["slots"]:
            pieces.append({
                "width": s["width_cm"],
                "height": s["height_cm"],
                "type": s["type"],
                "print_id": print_obj["id"],
            })
    return pieces

@app.post("/print-jobs")
def create_print_job(payload: PrintJobRequest, user=Depends(current_user)):
    total = sum(max(i.qty, 0) for i in payload.items)
    if total <= 0 or total > 100:
        raise HTTPException(status_code=400, detail="Quantidade inválida")

    pieces = []
    for item in payload.items:
        p = get_print(item.print_id, user)
        pieces.extend(build_pieces(p, item.qty))

    job_id = str(uuid.uuid4())

    supabase.table("jobs").insert({
        "id": job_id,
        "user_id": user["sub"],
        "status": "preview",
        "payload": {"pieces": pieces},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    queue.enqueue(process_render, job_id, preview=True, job_timeout=600)
    return {"job_id": job_id, "total_units": total}

@app.post("/print-jobs/{job_id}/confirm")
def confirm_print_job(job_id: str, user=Depends(current_user)):
    job = supabase.table("jobs").select("*").eq("id", job_id).eq("user_id", user["sub"]).single().execute().data
    if not job or job["status"] != "preview":
        raise HTTPException(status_code=400, detail="Job inválido")

    total_units = len(job["payload"]["pieces"])

    try:
        check_and_consume_limits(supabase, user["sub"], total_units)
    except LimitExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))

    supabase.table("jobs").update({"status": "queued"}).eq("id", job_id).execute()
    queue.enqueue(process_render, job_id, preview=False, job_timeout=600)
    return {"status": "confirmed"}

@app.get("/jobs/{job_id}")
def get_job(job_id: str, user=Depends(current_user)):
    job = supabase.table("jobs").select("*").eq("id", job_id).eq("user_id", user["sub"]).single().execute().data
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return job

@app.get("/jobs/{job_id}/files")
def get_job_files(job_id: str, user=Depends(current_user)):
    files = supabase.table("job_files").select("*").eq("job_id", job_id).order("page_index").execute().data or []
    return files


@app.get("/me/usage")
def get_my_usage(user=Depends(current_user)):
    # Busca limites do usuário
    row = supabase.table("usage").select("*").eq("user_id", user["sub"]).single().execute().data

    if not row:
        return {
            "used": 0,
            "limit": 100,
            "remaining": 100,
        }

    used = row.get("used", 0)
    limit = row.get("limit", 100)

    return {
        "used": used,
        "limit": limit,
        "remaining": max(limit - used, 0),
    }

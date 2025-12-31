import uuid
import os
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

from backend.job_queue import queue
from backend.jobs import process_render
from backend.auth import get_current_user
from backend.supabase_client import supabase
from backend.limits import check_and_consume_limits, LimitExceeded

# ---------- ENV ----------
DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "false").lower() == "true"

# ---------- APP ----------
app = FastAPI(title="Projeto Estampas API", version="3.7")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://pvty.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- MODELS ----------
class PrintCreate(BaseModel):
    name: str
    sku: str
    width_cm: float
    height_cm: float
    is_composite: bool = False

class PrintJobItem(BaseModel):
    print_id: UUID
    qty: int
    width_cm: float
    height_cm: float

class PrintJobRequest(BaseModel):
    items: List[PrintJobItem]

# ---------- HELPERS ----------
def dev_user():
    return {"sub": "00000000-0000-0000-0000-000000000001"}

def current_user(user=Depends(get_current_user)):
    if DEV_NO_AUTH:
        return dev_user()
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user

# ---------- ROOT ----------
@app.get("/")
def root():
    return {"status": "ok"}

# ---------- PRINTS ----------
@app.get("/prints")
def list_prints(user=Depends(current_user)):
    res = supabase.table("prints") \
        .select("""
            id,
            name,
            sku,
            is_composite,
            created_at,
            print_files:print_files(
                id,
                type,
                public_url,
                width_cm,
                height_cm
            )
        """) \
        .eq("user_id", user["sub"]) \
        .order("created_at", desc=True) \
        .execute().data or []

    for p in res:
        p["slots"] = {}
        for f in p.get("print_files", []):
            p["slots"][f["type"]] = {
                "id": f["id"],
                "url": f["public_url"],
                "width_cm": f.get("width_cm"),
                "height_cm": f.get("height_cm"),
            }
        p.pop("print_files", None)

    return res

@app.post("/prints")
def create_print(payload: PrintCreate, user=Depends(current_user)):
    data = payload.dict()
    data["id"] = str(uuid.uuid4())
    data["user_id"] = user["sub"]
    data["created_at"] = datetime.utcnow().isoformat()

    res = supabase.table("prints").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erro ao criar estampa")

    return res.data[0]

@app.patch("/prints/{print_id}")
def update_print(print_id: str, payload: PrintCreate, user=Depends(current_user)):
    supabase.table("prints") \
        .update(payload.dict()) \
        .eq("id", print_id) \
        .eq("user_id", user["sub"]) \
        .execute()
    return {"ok": True}

@app.delete("/prints/{print_id}")
def delete_print(print_id: str, user=Depends(current_user)):
    supabase.table("print_files").delete().eq("print_id", print_id).execute()
    supabase.table("prints").delete().eq("id", print_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}

@app.post("/prints/{print_id}/upload")
async def upload_print_file(
    print_id: str,
    file: UploadFile = File(...),
    type: str = Form("front"),
    width_cm: Optional[float] = Form(None),
    height_cm: Optional[float] = Form(None),
    user=Depends(current_user)
):
    if type not in ("front", "back", "extra"):
        raise HTTPException(status_code=400, detail="Tipo inválido")

    owner = supabase.table("prints").select("id").eq("id", print_id).eq("user_id", user["sub"]).execute().data
    if not owner:
        raise HTTPException(status_code=404, detail="Estampa não encontrada")

    content = await file.read()
    filename = f"{print_id}/{uuid.uuid4()}-{file.filename}"

    storage = supabase.storage.from_("prints-library")
    upload = storage.upload(filename, content, {"content-type": file.content_type})

    if hasattr(upload, "error") and upload.error:
        raise HTTPException(status_code=500, detail=str(upload.error))

    supabase.table("print_files").insert({
        "print_id": print_id,
        "type": type,
        "file_path": filename,
        "public_url": storage.get_public_url(filename),
        "width_cm": width_cm,
        "height_cm": height_cm
    }).execute()

    return {"status": "ok"}

@app.patch("/print-files/{file_id}")
def update_print_file(file_id: str, width_cm: float, height_cm: float, user=Depends(current_user)):
    pf = supabase.table("print_files").select("print_id").eq("id", file_id).execute().data
    if not pf:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    owner = supabase.table("prints").select("id").eq("id", pf[0]["print_id"]).eq("user_id", user["sub"]).execute().data
    if not owner:
        raise HTTPException(status_code=403, detail="Sem permissão")

    supabase.table("print_files") \
        .update({"width_cm": width_cm, "height_cm": height_cm}) \
        .eq("id", file_id) \
        .execute()
    return {"ok": True}

# ---------- PRINT JOB ----------
@app.post("/print-jobs")
def create_print_job(payload: PrintJobRequest, user=Depends(current_user)):
    total_units = sum(max(item.qty, 0) for item in payload.items)

    if total_units <= 0:
        raise HTTPException(status_code=400, detail="Nenhuma unidade informada.")
    if total_units > 100:
        raise HTTPException(status_code=400, detail="Limite máximo de 100 unidades.")

    try:
        check_and_consume_limits(supabase, user["sub"], total_units)
    except LimitExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))

    job_id = str(uuid.uuid4())

    clean_payload = {
        "items": [
            {
                "print_id": str(item.print_id),
                "qty": int(item.qty),
                "width_cm": float(item.width_cm),
                "height_cm": float(item.height_cm),
            }
            for item in payload.items
        ]
    }

    supabase.table("jobs").insert({
        "id": job_id,
        "user_id": user["sub"],
        "status": "queued",
        "payload": clean_payload
    }).execute()

    queue.enqueue(process_render, job_id, job_timeout=600)

    return {"job_id": job_id, "total_units": total_units}

# ---------- JOB STATUS ----------
@app.get("/jobs/{job_id}")
def get_job(job_id: str, user=Depends(current_user)):
    job = supabase.table("jobs").select("*").eq("id", job_id).eq("user_id", user["sub"]).single().execute().data
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    return {
        "id": job["id"],
        "status": job["status"],
        "result_urls": job.get("result_urls"),
        "error": job.get("error"),
        "created_at": job.get("created_at"),
        "finished_at": job.get("finished_at")
    }

# ---------- ME / USAGE ----------
@app.get("/me/usage")
def me_usage(user=Depends(current_user)):
    uid = user["sub"]
    now = datetime.utcnow()
    year, month = now.year, now.month

    plan = (
        supabase.table("plans")
        .select("*")
        .eq("user_id", uid)
        .single()
        .execute()
        .data
    )

    if not plan:
        plan_name = "free"
        limit = 2
    else:
        plan_name = plan.get("plan", "free")
        limit = plan.get("monthly_limit", 2)

    usage = (
        supabase.table("usage_monthly")
        .select("used")
        .eq("user_id", uid)
        .eq("year", year)
        .eq("month", month)
        .single()
        .execute()
        .data
    )

    used = usage.get("used", 0) if usage else 0

    credit_rows = (
        supabase.table("extra_packages")
        .select("remaining")
        .eq("user_id", uid)
        .gt("remaining", 0)
        .execute()
        .data
    ) or []

    credits = sum(c.get("remaining", 0) for c in credit_rows)

    return {
        "plan": plan_name,
        "used": used,
        "limit": limit,
        "remaining": max(limit - used, 0),
        "credits": credits,
        "status": "Bloqueado" if used >= limit and credits == 0 else "Ativo"
    }

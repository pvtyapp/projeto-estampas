import uuid
import os
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

from job_queue import queue
from jobs import process_render
from auth import get_current_user
from supabase_client import supabase
from limits import check_limits, LimitExceeded

# ---------- ENV ----------
DEV_NO_AUTH = True
# ---------- APP ----------
app = FastAPI(title="Projeto Estampas API", version="3.6")

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
        check_limits(supabase, user["sub"], total_units)
    except LimitExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))

    job_id = str(uuid.uuid4())

    # 🔥 converter UUIDs para string no payload
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

    queue.enqueue(process_render, job_id)

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

    sub_res = supabase.table("subscriptions").select("plan_id, renew_at").eq("user_id", uid).limit(1).execute()
    sub = sub_res.data[0] if sub_res.data else None

    if not sub:
        plan_name = "Free"
        limit = 2
        used = 0
        renew_at = now + timedelta(days=30)
    else:
        plan = supabase.table("plans").select("name, max_jobs_per_month").eq("id", sub["plan_id"]).limit(1).execute().data[0]
        used = sum(r["qty"] for r in supabase.table("usage_logs").select("qty").eq("user_id", uid).gte("created_at", now.replace(day=1).isoformat()).execute().data)
        limit = plan["max_jobs_per_month"]
        renew_at = datetime.fromisoformat(sub["renew_at"])
        plan_name = plan["name"]

    credits = sum(c["remaining"] for c in supabase.table("user_credits").select("remaining").eq("user_id", uid).gt("remaining", 0).execute().data)

    return {
        "plan": plan_name,
        "used": used,
        "limit": limit,
        "remaining_days": max((renew_at - now).days, 0),
        "percent": min(round((used / limit) * 100), 100) if limit else 0,
        "credits": credits,
        "status": "Bloqueado" if used >= limit and credits == 0 else "Ativo"
    }

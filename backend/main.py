import uuid
import os
from datetime import datetime, timedelta, timezone
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

DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "false").lower() == "true"

app = FastAPI(title="Projeto Estampas API", version="3.8")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://pvty.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def dev_user():
    return {"sub": "00000000-0000-0000-0000-000000000001"}


def current_user(user=Depends(get_current_user)):
    if DEV_NO_AUTH:
        return dev_user()
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/prints")
def list_prints(user=Depends(current_user)):
    res = supabase.table("prints").select("""
        id, name, sku, is_composite, created_at,
        print_files:print_files(id, type, public_url, width_cm, height_cm)
    """).eq("user_id", user["sub"]).order("created_at", desc=True).execute().data or []

    for p in res:
        p["slots"] = {
            f["type"]: {
                "id": f["id"],
                "url": f["public_url"],
                "width_cm": f.get("width_cm"),
                "height_cm": f.get("height_cm"),
            }
            for f in p.get("print_files", [])
        }
        p.pop("print_files", None)

    return res


@app.post("/prints")
def create_print(payload: PrintCreate, user=Depends(current_user)):
    data = payload.dict()
    data.update({
        "id": str(uuid.uuid4()),
        "user_id": user["sub"],
        "created_at": datetime.utcnow().isoformat()
    })
    res = supabase.table("prints").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erro ao criar estampa")
    return res.data[0]


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
    payload_clean = {"items": [{
        "print_id": str(i.print_id),
        "qty": int(i.qty),
        "width_cm": float(i.width_cm),
        "height_cm": float(i.height_cm),
    } for i in payload.items]}

    supabase.table("jobs").insert({
        "id": job_id,
        "user_id": user["sub"],
        "status": "queued",
        "payload": payload_clean,
        "created_at": datetime.utcnow().isoformat()
    }).execute()

    queue.enqueue(process_render, job_id, job_timeout=600)

    return {"job_id": job_id, "total_units": total_units}


@app.get("/jobs/{job_id}")
def get_job(job_id: str, user=Depends(current_user)):
    res = supabase.table("jobs").select("*").eq("id", job_id).eq("user_id", user["sub"]).execute()
    job = res.data[0] if res.data else None
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return job


@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, user=Depends(current_user)):
    res = supabase.table("jobs").select("*").eq("id", job_id).eq("user_id", user["sub"]).execute()
    job = res.data[0] if res.data else None
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    if job["status"] in ("queued", "done"):
        supabase.table("jobs").update({"status": "canceled"}).eq("id", job_id).execute()
        return {"status": "canceled"}

    raise HTTPException(status_code=400, detail="Job não pode ser cancelado nesse estado")


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
        .single() \
        .execute().data

    plan = supabase.table("plans") \
        .select("*") \
        .eq("user_id", user_id) \
        .single() \
        .execute().data

    packages = supabase.table("extra_packages") \
        .select("remaining") \
        .eq("user_id", user_id) \
        .gt("remaining", 0) \
        .execute().data or []

    credits = sum(int(p["remaining"]) for p in packages)

    if not plan:
        plan = {"plan": "free", "monthly_limit": 2}

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

    if month == 12:
        renew_at = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        renew_at = datetime(year, month + 1, 1, tzinfo=timezone.utc)

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
        "status": status
    }

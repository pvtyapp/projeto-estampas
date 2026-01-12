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

try:
    from backend.stripe_routes import router as stripe_router
    STRIPE_ENABLED = True
except Exception as e:
    print("⚠️ Stripe desativado:", e)
    STRIPE_ENABLED = False

DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "false").lower() == "true"

app = FastAPI(title="Projeto Estampas API", version="7.7")

if STRIPE_ENABLED:
    app.include_router(stripe_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://pvty.vercel.app",
        "https://pvty.com.br",
        "https://www.pvty.com.br",
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
        content={"error": "internal_server_error", "detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        },
    )

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
    sheet_size: str = "30x100"

class PrintNoteIn(BaseModel):
    print_id: str
    note: str

class SettingsIn(BaseModel):
    price_per_meter: float

def dev_user():
    return {"sub": "00000000-0000-0000-0000-000000000001"}

def current_user(user=Depends(get_current_user)):
    if DEV_NO_AUTH:
        return dev_user()
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user

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

@app.get("/")
def root():
    return {"status": "ok"}

# -----------------------------
# STATS CORRIGIDO
# -----------------------------

def parse_date(d: str) -> str:
    if "T" in d:
        return d
    dt = datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")

@app.get("/stats/prints")
def get_print_stats(from_: Optional[str] = None, to: Optional[str] = None, user=Depends(current_user)):
    if from_:
        from_ = parse_date(from_)
    if to:
        to = parse_date(to)

    prints = supabase.table("prints").select("id,name").eq("user_id", user["sub"]).execute().data or []

    q = supabase.table("jobs").select("payload,finished_at,created_at").eq("user_id", user["sub"]).eq("status", "done")

    if from_:
        q = q.gte("finished_at", from_)
    if to:
        q = q.lte("finished_at", to)

    jobs = q.execute().data or []

    counts: Dict[str, int] = {}
    used_recently = set()
    total_kits = 0
    total_sheets = 0

    for j in jobs:
        payload = j.get("payload") or {}
        items = payload.get("items") or []
        sheets = payload.get("sheets") or 0
        total_sheets += sheets

        for item in items:
            pid = item.get("print_id")
            qty = item.get("qty") or 0
            if pid and qty > 0:
                counts[pid] = counts.get(pid, 0) + qty
                total_kits += qty
                used_recently.add(pid)

    top_used = [{"name": p["name"], "count": counts[p["id"]]} for p in prints if p["id"] in counts]
    top_used.sort(key=lambda x: x["count"], reverse=True)

    since_45d = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat().replace("+00:00", "Z")

    q45 = supabase.table("jobs").select("payload").eq("user_id", user["sub"]).eq("status", "done").gte("finished_at", since_45d).execute().data or []

    used_45 = set()
    for j in q45:
        for item in (j.get("payload") or {}).get("items", []):
            pid = item.get("print_id")
            if pid:
                used_45.add(pid)

    forgotten = [{"name": p["name"]} for p in prints if p["id"] not in used_45]

    return {
        "top_used": top_used[:15],
        "not_used": forgotten[:15],
        "costs": {
            "files": total_sheets,
            "prints": total_kits,
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

    if used >= limit:
        if total_credits > 0:
            status = "using_credits"
        else:
            status = "blocked"
    elif used >= limit * 0.8:
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
    res = supabase.table("user_settings").select("*").eq("user_id", user["sub"]).execute()
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

# =========================
# Planos
# =========================

@app.get("/plans")
def get_plans(user=Depends(current_user)):
    plans = supabase.table("plans").select("*").execute().data or []

    profile = (
        supabase.table("profiles")
        .select("plan_id")
        .eq("id", user["sub"])
        .limit(1)
        .execute()
        .data
    )

    current_plan = profile[0]["plan_id"] if profile else "free"

    return {
        "plans": plans,
        "current_plan": current_plan,
    }

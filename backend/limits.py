from datetime import datetime
from typing import Optional


class LimitExceeded(Exception):
    pass


def _current_period():
    now = datetime.utcnow()
    return now.year, now.month


def check_and_consume_limits(supabase, user_id: str, units: int):
    units = int(units or 0)
    if units <= 0:
        return

    year, month = _current_period()

    plan = supabase.table("plans").select("*").eq("user_id", user_id).single().execute().data
    if not plan:
        plan = {"plan": "free", "monthly_limit": 2}

    monthly_limit = int(plan.get("monthly_limit") or 0)

    usage = supabase.table("usage_monthly") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("year", year) \
        .eq("month", month) \
        .single() \
        .execute().data or {
            "used_plan": 0,
            "used_extra": 0,
        }

    used_plan = int(usage.get("used_plan", 0))
    used_extra = int(usage.get("used_extra", 0))

    available_plan = max(monthly_limit - used_plan, 0)
    from_plan = min(available_plan, units)
    overflow = units - from_plan

    # Buscar pacotes extras
    packages = supabase.table("extra_packages") \
        .select("*") \
        .eq("user_id", user_id) \
        .gt("remaining", 0) \
        .order("created_at") \
        .execute().data or []

    total_remaining = sum(int(p["remaining"]) for p in packages)

    if overflow > total_remaining:
        raise LimitExceeded("Limite do plano e pacotes extras esgotados.")

    # Consumo atômico manual
    # (Supabase não suporta transações multi-step nativamente via REST)

    # 1️⃣ Atualiza pacotes
    remaining = overflow
    for p in packages:
        if remaining <= 0:
            break

        take = min(int(p["remaining"]), remaining)
        supabase.table("extra_packages") \
            .update({"remaining": int(p["remaining"]) - take}) \
            .eq("id", p["id"]) \
            .execute()

        remaining -= take

    # 2️⃣ Atualiza usage
    new_used_plan = used_plan + from_plan
    new_used_extra = used_extra + overflow

    supabase.table("usage_monthly").upsert({
        "user_id": user_id,
        "year": year,
        "month": month,
        "used_plan": new_used_plan,
        "used_extra": new_used_extra,
        "limit_snapshot": monthly_limit,
    }, on_conflict="user_id,year,month").execute()

from datetime import datetime
from typing import Optional


class LimitExceeded(Exception):
    pass


def _current_period():
    now = datetime.utcnow()
    return now.year, now.month


def check_and_consume_limits(supabase, user_id: str, units: int):
    """
    units = quantidade de arquivos/folhas que serão gerados agora.
    """

    units = int(units or 0)
    if units <= 0:
        return

    year, month = _current_period()

    # Buscar plano
    plan_res = supabase.table("plans").select("*").eq("user_id", user_id).single().execute()
    plan = plan_res.data

    if not plan:
        # fallback free
        plan = {"plan": "free", "monthly_limit": 2}

    monthly_limit = int(plan.get("monthly_limit") or 0)

    # Buscar uso do mês
    usage_res = supabase.table("usage_monthly") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("year", year) \
        .eq("month", month) \
        .single() \
        .execute()

    usage = usage_res.data
    used = int(usage["used"]) if usage else 0

    # Dentro do plano?
    if used + units <= monthly_limit:
        _consume_usage(supabase, user_id, year, month, used + units)
        return

    # Quanto falta?
    overflow = (used + units) - monthly_limit

    # Buscar pacotes extras (ordem FIFO)
    packages_res = supabase.table("extra_packages") \
        .select("*") \
        .eq("user_id", user_id) \
        .gt("remaining", 0) \
        .order("created_at") \
        .execute()

    packages = packages_res.data or []
    total_remaining = sum(int(p["remaining"]) for p in packages)

    if overflow > total_remaining:
        raise LimitExceeded("Limite do plano e pacotes extras esgotados.")

    # Consumir pacotes
    for p in packages:
        if overflow <= 0:
            break
        r = int(p["remaining"])
        take = min(r, overflow)

        supabase.table("extra_packages") \
            .update({"remaining": r - take}) \
            .eq("id", p["id"]) \
            .execute()

        overflow -= take

    _consume_usage(supabase, user_id, year, month, used + units)


def _consume_usage(supabase, user_id: str, year: int, month: int, new_used: int):
    # cria ou atualiza usage_monthly
    exists = supabase.table("usage_monthly") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("year", year) \
        .eq("month", month) \
        .single() \
        .execute()

    if exists.data:
        supabase.table("usage_monthly") \
            .update({"used": new_used}) \
            .eq("id", exists.data["id"]) \
            .execute()
    else:
        supabase.table("usage_monthly").insert({
            "user_id": user_id,
            "year": year,
            "month": month,
            "used": new_used
        }).execute()

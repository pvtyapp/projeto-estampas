from datetime import datetime, timezone


class LimitExceeded(Exception):
    pass


def check_limits(supabase, user_id: str, units: int):
    """
    units = quantidade de SKUs/unidades a serem processadas agora
    """

    try:
        units = int(units)
    except Exception:
        units = 0

    if units <= 0:
        return

    # --- Buscar plano do usuário ---
    profile_res = supabase.table("user_profiles") \
        .select("plan_id, plans(name, max_jobs_per_month)") \
        .eq("user_id", user_id) \
        .limit(1) \
        .execute()

    profile = profile_res.data[0] if profile_res.data else None

    if not profile or not profile.get("plans"):
        # fallback para Free
        plan = {"name": "free", "max_jobs_per_month": 2}
    else:
        plan = profile["plans"]

    plan_name = str(plan.get("name", "")).lower()
    limit = int(plan.get("max_jobs_per_month") or 0)

    now = datetime.now(timezone.utc)

    # Free = diário, pago = mensal
    if plan_name == "free":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # --- Buscar uso ---
    usage_res = supabase.table("usage_logs") \
        .select("*") \
        .eq("user_id", user_id) \
        .gte("created_at", start.isoformat()) \
        .execute()

    usage = usage_res.data or []

    # Tenta somar "qty", se não existir soma 1 por registro
    used = 0
    for u in usage:
        if "qty" in u:
            try:
                used += int(u.get("qty") or 0)
            except Exception:
                pass
        else:
            used += 1

    # Dentro do plano
    if used + units <= limit:
        return

    # --- Buscar créditos extras ---
    credits_res = supabase.table("user_credits") \
        .select("remaining") \
        .eq("user_id", user_id) \
        .gt("remaining", 0) \
        .execute()

    credits = credits_res.data or []
    credit_total = sum(int(c.get("remaining") or 0) for c in credits)

    if used + units <= limit + credit_total:
        return

    raise LimitExceeded("Limite do plano e créditos atingidos.")

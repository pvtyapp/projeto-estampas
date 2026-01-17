from datetime import datetime, timezone

class LimitExceeded(Exception):
    pass


def check_and_consume_limits(supabase, user_id: str, amount: int, job_id: str = None):
    now = datetime.now(timezone.utc)

    # =========================
    # SUBSCRIPTION = FONTE ÚNICA
    # =========================

    sub_res = (
        supabase
        .table("subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .limit(1)
        .execute()
        .data
        or []
    )

    if not sub_res:
        raise LimitExceeded("Nenhuma assinatura ativa.")

    sub = sub_res[0]

    period_start = datetime.fromtimestamp(sub["current_period_start"], tz=timezone.utc)
    period_end = datetime.fromtimestamp(sub["current_period_end"], tz=timezone.utc)

    if now >= period_end:
        raise LimitExceeded("Período da assinatura expirado.")

    # =========================
    # PLANO PELO PRICE_ID
    # =========================

    plan_res = (
        supabase
        .table("plans")
        .select("*")
        .eq("price_id", sub["price_id"])
        .limit(1)
        .execute()
        .data
        or []
    )

    if not plan_res:
        raise LimitExceeded("Plano não encontrado para esta assinatura.")

    plan = plan_res[0]
    limit = plan.get("monthly_limit", 0)

    # =========================
    # USAGE NO PERÍODO STRIPE
    # =========================

    used_rows = (
        supabase
        .table("usage")
        .select("amount")
        .eq("user_id", user_id)
        .gte("created_at", period_start.isoformat())
        .lt("created_at", period_end.isoformat())
        .execute()
        .data
        or []
    )

    used = sum(r.get("amount", 0) for r in used_rows)

    if limit and used + amount > limit:
        raise LimitExceeded("Limite do plano atingido.")

    # =========================
    # REGISTRA USAGE
    # =========================

    row = {
        "user_id": user_id,
        "amount": amount,
        "created_at": now.isoformat(),
    }

    if job_id:
        row["job_id"] = job_id

    supabase.table("usage").insert(row).execute()

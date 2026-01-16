from datetime import datetime, timezone, timedelta

class LimitExceeded(Exception):
    pass


def check_and_consume_limits(supabase, user_id: str, amount: int, job_id: str = None):
    profile_res = (
        supabase
        .table("profiles")
        .select(
            "id, plan_id, stripe_current_period_start, stripe_current_period_end"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    if not profile_res.data:
        supabase.table("profiles").insert({
            "id": user_id,
            "plan_id": "free",
        }).execute()
        profile = {
            "plan_id": "free",
            "stripe_current_period_start": None,
            "stripe_current_period_end": None,
        }
    else:
        profile = profile_res.data[0]

    plan_id = profile.get("plan_id") or "free"

    plan_res = (
        supabase
        .table("plans")
        .select("*")
        .eq("id", plan_id)
        .limit(1)
        .execute()
    )

    if not plan_res.data:
        raise LimitExceeded("Plano inválido.")

    plan = plan_res.data[0]
    now = datetime.now(timezone.utc)

    def insert_usage(amount, used_credits=False):
        row = {
            "user_id": user_id,
            "kind": "print",
            "amount": amount,
            "created_at": now.isoformat(),
            "used_credits": used_credits,
        }
        if job_id:
            row["job_id"] = job_id

        supabase.table("usage").insert(row).execute()

    # =========================
    # Define usage window + limit
    # =========================

    # DAILY PLAN (FREE / DAILY)
    if plan.get("daily_limit") is not None:
        period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        period_end = period_start + timedelta(days=1)
        limit = plan.get("daily_limit", 0)

    # SUBSCRIPTION PLAN (30 dias corridos via Stripe)
    else:
        try:
            period_start = datetime.fromisoformat(profile["stripe_current_period_start"])
            period_end = datetime.fromisoformat(profile["stripe_current_period_end"])
        except Exception:
            raise LimitExceeded("Período do plano inválido ou inexistente.")

        if now >= period_end:
            raise LimitExceeded("Plano expirado. Renovação pendente.")

        limit = plan.get("monthly_limit", 0)

    used_rows = (
        supabase
        .table("usage")
        .select("amount")
        .eq("user_id", user_id)
        .eq("kind", "print")
        .gte("created_at", period_start.isoformat())
        .lt("created_at", period_end.isoformat())
        .execute()
        .data or []
    )

    used = sum(r.get("amount") or 0 for r in used_rows)

    if limit and used + amount <= limit:
        insert_usage(amount)
        return

    needed = amount
    if limit:
        needed = max(0, (used + amount) - limit)

    packs = (
        supabase
        .table("credit_packs")
        .select("*")
        .eq("user_id", user_id)
        .gt("remaining", 0)
        .order("created_at")
        .execute()
        .data or []
    )

    for pack in packs:
        if needed <= 0:
            break

        remaining = pack.get("remaining") or 0
        take = min(remaining, needed)
        needed -= take

        supabase.table("credit_packs").update({
            "remaining": remaining - take
        }).eq("id", pack["id"]).execute()

    if needed > 0:
        raise LimitExceeded("Limite do plano e créditos esgotados.")

    insert_usage(amount, used_credits=True)

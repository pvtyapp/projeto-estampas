from datetime import datetime, timezone

class LimitExceeded(Exception):
    pass


def check_and_consume_limits(supabase, user_id: str, amount: int, job_id: str = None):
    # =========================
    # Get or create profile
    # =========================
    profile_res = (
        supabase
        .table("profiles")
        .select("id, plan_id")
        .eq("id", user_id)
        .execute()
    )

    if not profile_res.data:
        supabase.table("profiles").insert({
            "id": user_id,
            "plan_id": "free",
        }).execute()
        plan_id = "free"
    else:
        plan_id = profile_res.data[0].get("plan_id") or "free"

    # =========================
    # Get plan
    # =========================
    plan_res = (
        supabase
        .table("plans")
        .select("*")
        .eq("id", plan_id)
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
    # DAILY limit
    # =========================
    if plan.get("daily_limit") is not None:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        used_today = (
            supabase
            .table("usage")
            .select("amount")
            .eq("user_id", user_id)
            .eq("kind", "print")
            .gte("created_at", start.isoformat())
            .execute()
            .data or []
        )

        total_today = sum(r.get("amount") or 0 for r in used_today)

        if total_today + amount <= plan["daily_limit"]:
            insert_usage(amount)
            return

        # 🔥 Estourou DAILY → tentar créditos
        needed = (total_today + amount) - plan["daily_limit"]
        needed = min(needed, amount)


    else:
        needed = 0

    # =========================
    # MONTHLY limit
    # =========================
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    used_month = (
        supabase
        .table("usage")
        .select("amount")
        .eq("user_id", user_id)
        .eq("kind", "print")
        .gte("created_at", start.isoformat())
        .execute()
        .data or []
    )

    total_month = sum(r.get("amount") or 0 for r in used_month)

    if needed == 0 and plan.get("monthly_limit") is not None:
        if total_month + amount <= plan["monthly_limit"]:
            insert_usage(amount)
            return

        needed = (total_month + amount) - plan["monthly_limit"]
        needed = min(needed, amount)


    # =========================
    # Credit packs
    # =========================
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

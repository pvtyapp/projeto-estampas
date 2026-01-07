from datetime import datetime, timezone, timedelta

class LimitExceeded(Exception):
    pass


def check_and_consume_limits(supabase, user_id: str, amount: int):
    profile = supabase.table("profiles").select("plan_id").eq("id", user_id).single().execute().data
    plan_id = profile.get("plan_id") if profile else "free"

    plan = supabase.table("plans").select("*").eq("id", plan_id).single().execute().data
    if not plan:
        raise LimitExceeded("Plano inválido.")

    now = datetime.now(timezone.utc)

    # DAILY limit (Free)
    if plan.get("daily_limit"):
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
        total_today = sum(r["amount"] or 0 for r in used_today)
        if total_today + amount > plan["daily_limit"]:
            raise LimitExceeded("Limite diário atingido.")

        supabase.table("usage").insert({
            "user_id": user_id,
            "kind": "print",
            "amount": amount,
            "created_at": now.isoformat(),
        }).execute()
        return

    # MONTHLY limit
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
    total_month = sum(r["amount"] or 0 for r in used_month)

    if total_month + amount <= plan["monthly_limit"]:
        supabase.table("usage").insert({
            "user_id": user_id,
            "kind": "print",
            "amount": amount,
            "created_at": now.isoformat(),
        }).execute()
        return

    # Use credit packs
    needed = total_month + amount - plan["monthly_limit"]

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
        take = min(pack["remaining"], needed)
        needed -= take
        supabase.table("credit_packs").update({
            "remaining": pack["remaining"] - take
        }).eq("id", pack["id"]).execute()
        if needed <= 0:
            break

    if needed > 0:
        raise LimitExceeded("Limite do plano e pacotes extras esgotados.")

    supabase.table("usage").insert({
        "user_id": user_id,
        "kind": "print",
        "amount": amount,
        "created_at": now.isoformat(),
    }).execute()

# backend/services/usage_service.py
from datetime import datetime, timezone, timedelta
from math import ceil


class UsageStatus:
    OK = "ok"
    WARNING = "warning"
    BLOCKED = "blocked"


def get_usage(supabase, user_id: str):
    now = datetime.now(timezone.utc)

    # =========================
    # BUSCA ASSINATURA ATIVA
    # =========================
    sub_res = (
        supabase
        .table("subscriptions")
        .select("price_id,status,current_period_start,current_period_end,monthly_limit")
        .eq("user_id", user_id)
        .eq("status", "active")
        .limit(1)
        .execute()
        .data
        or []
    )

    # =========================
    # FREE USER (RENOVA DIARIAMENTE)
    # =========================
    if not sub_res:
        period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        period_end = period_start + timedelta(days=1)

        plan = (
            supabase
            .table("plans")
            .select("daily_limit")
            .eq("price_id", "free")
            .limit(1)
            .execute()
            .data
            or [{}]
        )[0]

        limit = plan.get("daily_limit", 0) or 0

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

        status = UsageStatus.OK
        if limit and used >= limit:
            status = UsageStatus.BLOCKED
        elif limit and used >= limit * 0.8:
            status = UsageStatus.WARNING

        return {
            "plan": "free",
            "used": used,
            "limit": limit,
            "remaining_days": 0,
            "status": status,
            "period_start": period_start,
            "period_end": period_end,
        }

    # =========================
    # PAID USER (MENSAL)
    # =========================
    sub = sub_res[0]

    period_start = datetime.fromtimestamp(
        sub["current_period_start"],
        tz=timezone.utc,
    )
    period_end = datetime.fromtimestamp(
        sub["current_period_end"],
        tz=timezone.utc,
    )

    if now >= period_end:
        return {
            "plan": sub.get("price_id"),
            "used": 0,
            "limit": 0,
            "remaining_days": 0,
            "status": UsageStatus.BLOCKED,
            "period_start": period_start,
            "period_end": period_end,
        }

    limit = sub.get("monthly_limit", 0) or 0

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

    remaining_days = max(
        0,
        ceil((period_end - now).total_seconds() / 86400)
    )

    status = UsageStatus.OK
    if limit and used >= limit:
        status = UsageStatus.BLOCKED
    elif limit and used >= limit * 0.8:
        status = UsageStatus.WARNING

    return {
        "plan": sub.get("price_id"),
        "used": used,
        "limit": limit,
        "remaining_days": remaining_days,
        "status": status,
        "period_start": period_start,
        "period_end": period_end,
    }


def consume_usage(
    supabase,
    user_id: str,
    amount: int,
    job_id: str | None = None,
):
    """
    Consumo idempotente:
    - Se job_id existir, nao duplica consumo
    """

    if job_id:
        exists = (
            supabase
            .table("usage")
            .select("id")
            .eq("job_id", job_id)
            .limit(1)
            .execute()
            .data
            or []
        )

        if exists:
            return

    row = {
        "user_id": user_id,
        "amount": amount,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if job_id:
        row["job_id"] = job_id

    supabase.table("usage").insert(row).execute()

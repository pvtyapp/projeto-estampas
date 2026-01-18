# backend/limits.py
from backend.services.usage_service import get_usage, consume_usage


class LimitExceeded(Exception):
    pass


def check_and_consume_limits(
    supabase,
    user_id: str,
    amount: int,
    job_id: str | None = None,
):
    """
    ATENCAO:
    Esta funcao e EXCLUSIVA para usuarios PAID.
    FREE NUNCA deve chamar este metodo.

    Blindagem:
    - Idempotente por job_id
    """

    if not job_id:
        raise LimitExceeded("job_id obrigatorio para consumo PAID")

    # =========================
    # IDEMPOTENCIA (job_id)
    # =========================
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
        # consumo ja registrado
        return

    usage = get_usage(supabase, user_id)

    # Somente PAID
    if usage.get("plan") == "free":
        raise LimitExceeded("Usuario FREE nao deve passar por check_and_consume_limits.")

    if usage.get("status") == "blocked":
        raise LimitExceeded("Limite do plano atingido ou assinatura expirada.")

    limit = usage.get("limit", 0) or 0
    used = usage.get("used", 0) or 0

    if limit and used + amount > limit:
        raise LimitExceeded("Limite do plano atingido.")

    consume_usage(
        supabase=supabase,
        user_id=user_id,
        amount=amount,
        job_id=job_id,
    )

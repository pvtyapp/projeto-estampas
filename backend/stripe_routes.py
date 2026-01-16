import os
import stripe
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from supabase import create_client
import httpx

# =====================================================
# CONFIG
# =====================================================

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

FRONTEND_URL = os.getenv("FRONTEND_URL", "")

router = APIRouter(prefix="/stripe", tags=["stripe"])


# =====================================================
# SUPABASE
# =====================================================

def get_supabase():
    return create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        http_client=httpx.Client(http2=False, timeout=30.0),
    )


# =====================================================
# AUTH
# =====================================================
# ⚠️ IMPORTANTE:
# Essa função deve vir do seu auth central (Supabase / NextAuth / etc)
# Ela DEVE retornar algo assim:
# { "id": "...", "email": "..." }

from backend.auth import get_current_user


# =====================================================
# PLANOS / PRICES
# =====================================================

PRICE_MAP = {
    "start": os.getenv("STRIPE_PRICE_START"),
    "pro": os.getenv("STRIPE_PRICE_PRO"),
    "ent": os.getenv("STRIPE_PRICE_ENT"),
}

PRICE_TO_PLAN = {v: k for k, v in PRICE_MAP.items() if v}
VALID_PLANS = set(PRICE_MAP.keys())


# =====================================================
# CHECKOUT
# =====================================================

@router.post("/checkout")
def create_checkout(
    plan: str,
    user: dict = Depends(get_current_user),
):
    if plan not in VALID_PLANS:
        raise HTTPException(status_code=400, detail="Plano inválido")

    price_id = PRICE_MAP.get(plan)
    if not price_id:
        raise HTTPException(status_code=500, detail="Price não configurado")

    session = stripe.checkout.Session.create(
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        customer_email=user["email"],
        client_reference_id=user["id"],
        metadata={
            "user_id": user["id"],
            "plan": plan,
        },
        success_url=f"{FRONTEND_URL}/work?checkout=success",
        cancel_url=f"{FRONTEND_URL}/plans?checkout=cancel",
    )

    return {"url": session.url}


# =====================================================
# WEBHOOK
# =====================================================

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        print("❌ Webhook inválido:", e)
        raise HTTPException(status_code=400, detail="Invalid webhook")

    supabase = get_supabase()
    event_type = event["type"]
    obj = event["data"]["object"]

    print("📨 Stripe event recebido:", event_type)

    # -------------------------------------------------
    # CHECKOUT FINALIZADO
    # -------------------------------------------------
    if event_type == "checkout.session.completed":
        user_id = obj.get("client_reference_id") or obj.get("metadata", {}).get("user_id")
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")

        if user_id and customer_id:
            supabase.table("profiles").update({
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", user_id).execute()

        return {"status": "ok"}

    # -------------------------------------------------
    # FATURA PAGA → ATIVA / RENOVA PLANO
    # -------------------------------------------------
    if event_type == "invoice.payment_succeeded":
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")
        lines = obj.get("lines", {}).get("data", [])

        if not customer_id or not subscription_id or not lines:
            return {"status": "ok"}

        price_id = lines[0]["price"]["id"]
        plan_id = PRICE_TO_PLAN.get(price_id)
        if not plan_id:
            return {"status": "ok"}

        profiles = (
            supabase.table("profiles")
            .select("id")
            .eq("stripe_customer_id", customer_id)
            .limit(1)
            .execute()
            .data
        )

        if not profiles:
            return {"status": "ok"}

        subscription = stripe.Subscription.retrieve(subscription_id)

        supabase.table("profiles").update({
            "plan_id": plan_id,
            "stripe_subscription_id": subscription_id,
            "stripe_current_period_start": datetime.fromtimestamp(
                subscription["current_period_start"], tz=timezone.utc
            ).isoformat(),
            "stripe_current_period_end": datetime.fromtimestamp(
                subscription["current_period_end"], tz=timezone.utc
            ).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", profiles[0]["id"]).execute()

        print("✅ Plano aplicado:", plan_id)
        return {"status": "ok"}

    # -------------------------------------------------
    # ALTERAÇÃO DE ASSINATURA
    # -------------------------------------------------
    if event_type == "customer.subscription.updated":
        subscription_id = obj["id"]

        profiles = (
            supabase.table("profiles")
            .select("id")
            .eq("stripe_subscription_id", subscription_id)
            .limit(1)
            .execute()
            .data
        )

        if profiles:
            supabase.table("profiles").update({
                "stripe_current_period_start": datetime.fromtimestamp(
                    obj["current_period_start"], tz=timezone.utc
                ).isoformat(),
                "stripe_current_period_end": datetime.fromtimestamp(
                    obj["current_period_end"], tz=timezone.utc
                ).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", profiles[0]["id"]).execute()

        return {"status": "ok"}

    # -------------------------------------------------
    # CANCELAMENTO → VOLTA PARA FREE
    # -------------------------------------------------
    if event_type == "customer.subscription.deleted":
        subscription_id = obj["id"]

        supabase.table("profiles").update({
            "plan_id": "free",
            "stripe_subscription_id": None,
            "stripe_current_period_start": None,
            "stripe_current_period_end": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("stripe_subscription_id", subscription_id).execute()

        print("⚠️ Assinatura cancelada → plano free")
        return {"status": "ok"}

    return {"status": "ok"}

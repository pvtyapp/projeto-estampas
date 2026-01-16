import os
import stripe
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from supabase import create_client

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

router = APIRouter(prefix="/stripe", tags=["stripe"])

def get_supabase():
    return create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
    )

from backend.auth import get_current_user

PRICE_MAP = {
    "start": os.getenv("STRIPE_PRICE_START"),
    "pro": os.getenv("STRIPE_PRICE_PRO"),
    "ent": os.getenv("STRIPE_PRICE_ENT"),
}

PRICE_TO_PLAN = {v: k for k, v in PRICE_MAP.items() if v}
VALID_PLANS = set(PRICE_MAP.keys())

@router.post("/checkout")
def create_checkout(
    plan: str,
    user: dict = Depends(get_current_user),
):
    if plan not in VALID_PLANS:
        raise HTTPException(status_code=400, detail="Plano inválido")

    price_id = PRICE_MAP.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Price não configurado")

    user_id = user.get("sub") or user.get("id")

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        customer_email=user["email"],
        client_reference_id=user_id,
        success_url=f"{FRONTEND_URL}/work?checkout=success",
        cancel_url=f"{FRONTEND_URL}/plans?checkout=cancel",
    )

    return {"url": session.url}

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook")

    supabase = get_supabase()
    event_type = event["type"]
    obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = obj.get("client_reference_id")
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")

        if user_id and customer_id:
            supabase.table("profiles").update({
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", user_id).execute()

        return {"status": "ok"}

    if event_type == "invoice.payment_succeeded":
        subscription_id = obj.get("subscription")
        customer_id = obj.get("customer")

        if not subscription_id or not customer_id:
            return {"status": "ok"}

        subscription = stripe.Subscription.retrieve(subscription_id)
        price_id = subscription["items"]["data"][0]["price"]["id"]
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

        return {"status": "ok"}

    if event_type == "customer.subscription.deleted":
        subscription_id = obj["id"]

        supabase.table("profiles").update({
            "plan_id": "free",
            "stripe_subscription_id": None,
            "stripe_current_period_start": None,
            "stripe_current_period_end": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("stripe_subscription_id", subscription_id).execute()

        return {"status": "ok"}

    return {"status": "ok"}

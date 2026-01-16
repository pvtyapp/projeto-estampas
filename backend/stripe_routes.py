
import os
import stripe
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from backend.auth import get_current_user
from supabase import create_client
import httpx

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_supabase():
    return create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        http_client=httpx.Client(http2=False, timeout=30.0),
    )

router = APIRouter(prefix="/stripe", tags=["stripe"])

PRICE_MAP = {
    "start": "price_1So5VLIcNQlLzrcJU7Hja5BU",
    "pro": "price_1So5WLIcNQlLzrcJnthHWSto",
    "ent": "price_1So5WrIcNQlLzrcJldLXVh3C",
}

PRICE_TO_PLAN = {v: k for k, v in PRICE_MAP.items()}
SUBSCRIPTION_PLANS = set(PRICE_MAP.keys())

@router.post("/checkout")
def create_checkout(plan: str, user=Depends(get_current_user)):
    if plan not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Plano inválido")

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": PRICE_MAP[plan], "quantity": 1}],
        customer_email=user["email"],
        metadata={"user_id": user["sub"]},
        success_url=f"{os.getenv('FRONTEND_URL')}/plans?success=1",
        cancel_url=f"{os.getenv('FRONTEND_URL')}/plans?canceled=1",
    )

    return {"url": session.url}

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
    except Exception as e:
        print("❌ Webhook inválido:", e)
        raise HTTPException(status_code=400, detail="Invalid webhook")

    supabase = get_supabase()
    event_type = event["type"]
    obj = event["data"]["object"]

    print("📨 Stripe event recebido:", event_type)

    if event_type == "checkout.session.completed":
        user_id = obj.get("metadata", {}).get("user_id")
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
        lines = obj.get("lines", {}).get("data", [])

        if not subscription_id or not customer_id or not lines:
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

        user_id = profiles[0]["id"]
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
        }).eq("id", user_id).execute()

        return {"status": "ok"}

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

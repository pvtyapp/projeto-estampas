import stripe
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from backend.auth import get_current_user
from backend.supabase_client import supabase

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

router = APIRouter(prefix="/stripe", tags=["stripe"])

PRICE_MAP = {
    "start": "price_1So5VLIcNQlLzrcJU7Hja5BU",
    "pro": "price_1So5WLIcNQlLzrcJnthHWSto",
    "ent": "price_1So5WrIcNQlLzrcJldLXVh3C",
    "extra20": "price_1So5XwIcNQlLzrcJRCRtjXvM",
    "extra50": "price_1So5YbIcNQlLzrcJPgjlBSpj",
}

SUBSCRIPTION_PLANS = {"start", "pro", "ent"}


@router.post("/checkout")
def create_checkout(plan: str, user=Depends(get_current_user)):
    if plan not in PRICE_MAP:
        raise HTTPException(status_code=400, detail="Plano inválido")

    session = stripe.checkout.Session.create(
        mode="subscription" if plan in SUBSCRIPTION_PLANS else "payment",
        line_items=[{"price": PRICE_MAP[plan], "quantity": 1}],
        success_url=f"{os.getenv('FRONTEND_URL')}/plans?success=1",
        cancel_url=f"{os.getenv('FRONTEND_URL')}/plans?canceled=1",
        customer_email=user["email"],
        metadata={"user_id": user["sub"], "plan": plan},
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

    event_type = event["type"]
    print("📨 Stripe event recebido:", event_type)

    obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = obj.get("metadata", {}).get("user_id")
        plan = obj.get("metadata", {}).get("plan")
        subscription_id = obj.get("subscription")
        customer_id = obj.get("customer")

        if user_id and plan in SUBSCRIPTION_PLANS and subscription_id:
            stripe.Subscription.modify(subscription_id, metadata={"user_id": user_id})

            supabase.table("profiles").update({
                "plan_id": plan,
                "stripe_subscription_id": subscription_id,
                "stripe_customer_id": customer_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", user_id).execute()

    if event_type == "invoice.payment_succeeded":
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")

        if not customer_id or not subscription_id:
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
        stripe_sub = stripe.Subscription.retrieve(subscription_id)

        period_start = stripe_sub.get("current_period_start")
        period_end = stripe_sub.get("current_period_end")

        if not period_start or not period_end:
            return {"status": "ok"}

        supabase.table("profiles").update({
            "stripe_subscription_id": stripe_sub.id,
            "stripe_current_period_start": datetime.fromtimestamp(
                period_start, tz=timezone.utc
            ).isoformat(),
            "stripe_current_period_end": datetime.fromtimestamp(
                period_end, tz=timezone.utc
            ).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", user_id).execute()

    if event_type == "customer.subscription.updated":
        customer_id = obj.get("customer")
        subscription_id = obj.get("id")

        if not customer_id or not subscription_id:
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
        stripe_sub = stripe.Subscription.retrieve(subscription_id)

        period_start = stripe_sub.get("current_period_start")
        period_end = stripe_sub.get("current_period_end")

        if not period_start or not period_end:
            return {"status": "ok"}

        supabase.table("profiles").update({
            "stripe_subscription_id": stripe_sub.id,
            "stripe_current_period_start": datetime.fromtimestamp(
                period_start, tz=timezone.utc
            ).isoformat(),
            "stripe_current_period_end": datetime.fromtimestamp(
                period_end, tz=timezone.utc
            ).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", user_id).execute()

    if event_type == "customer.subscription.deleted":
        customer_id = obj.get("customer")

        if customer_id:
            supabase.table("profiles").update({
                "plan_id": "free",
                "stripe_subscription_id": None,
                "stripe_current_period_start": None,
                "stripe_current_period_end": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("stripe_customer_id", customer_id).execute()

    return {"status": "ok"}

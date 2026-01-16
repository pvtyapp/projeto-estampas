# stripe_routes.py
# FINAL – robust, production-safe Stripe integration for plans, subscriptions and credits

import os
import json
import logging
from typing import Optional

import stripe
from fastapi import APIRouter, Request, HTTPException
from supabase import create_client, Client

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

STRIPE_PRICE_START = os.getenv("STRIPE_PRICE_START")
STRIPE_PRICE_PRO = os.getenv("STRIPE_PRICE_PRO")
STRIPE_PRICE_ENT = os.getenv("STRIPE_PRICE_ENT")

STRIPE_PRICE_EXTRA_20 = os.getenv("STRIPE_PRICE_EXTRA_20")
STRIPE_PRICE_EXTRA_50 = os.getenv("STRIPE_PRICE_EXTRA_50")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY not set")

if not STRIPE_WEBHOOK_SECRET:
    raise RuntimeError("STRIPE_WEBHOOK_SECRET not set")

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter()
logger = logging.getLogger("stripe")
logger.setLevel(logging.INFO)

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


PRICE_TO_PLAN = {
    STRIPE_PRICE_START: "start",
    STRIPE_PRICE_PRO: "pro",
    STRIPE_PRICE_ENT: "ent",
}


EXTRA_PRICE_TO_CREDITS = {
    STRIPE_PRICE_EXTRA_20: 20,
    STRIPE_PRICE_EXTRA_50: 50,
}


def resolve_plan_from_price(price_id: Optional[str]) -> Optional[str]:
    if not price_id:
        return None
    return PRICE_TO_PLAN.get(price_id)


# -----------------------------------------------------------------------------
# Checkout
# -----------------------------------------------------------------------------

@router.post("/stripe/checkout")
def stripe_checkout(plan: str, request: Request):
    if plan not in ("start", "pro", "ent", "extra20", "extra50"):
        raise HTTPException(status_code=400, detail="Invalid plan")

    user = request.state.user
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    supabase = get_supabase()

    profile = (
        supabase.table("profiles")
        .select("*")
        .eq("id", user["id"])
        .single()
        .execute()
        .data
    )

    customer_id = profile.get("stripe_customer_id")

    if not customer_id:
        customer = stripe.Customer.create(
            email=user.get("email"),
            metadata={"user_id": user["id"]},
        )
        customer_id = customer.id

        supabase.table("profiles").update(
            {"stripe_customer_id": customer_id}
        ).eq("id", user["id"]).execute()

    if plan in ("start", "pro", "ent"):
        price_id = {
            "start": STRIPE_PRICE_START,
            "pro": STRIPE_PRICE_PRO,
            "ent": STRIPE_PRICE_ENT,
        }[plan]

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{os.getenv('FRONTEND_URL')}/work?checkout=success",
            cancel_url=f"{os.getenv('FRONTEND_URL')}/plans",
        )

    else:
        price_id = {
            "extra20": STRIPE_PRICE_EXTRA_20,
            "extra50": STRIPE_PRICE_EXTRA_50,
        }[plan]

        session = stripe.checkout.Session.create(
            mode="payment",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{os.getenv('FRONTEND_URL')}/work?checkout=success",
            cancel_url=f"{os.getenv('FRONTEND_URL')}/plans",
        )

    return {"url": session.url}


# -----------------------------------------------------------------------------
# Webhook
# -----------------------------------------------------------------------------

@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        logger.error(f"Webhook signature error: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    supabase = get_supabase()

    # ------------------------------------------------------------------
    # Subscription CREATED / UPDATED  -> apply plan
    # ------------------------------------------------------------------
    if event["type"] in (
        "customer.subscription.created",
        "customer.subscription.updated",
    ):
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")

        items = subscription["items"]["data"]
        price_id = items[0]["price"]["id"] if items else None

        plan_id = resolve_plan_from_price(price_id)

        if plan_id:
            supabase.table("profiles").update(
                {
                    "plan_id": plan_id,
                    "stripe_subscription_id": subscription["id"],
                }
            ).eq("stripe_customer_id", customer_id).execute()

    # ------------------------------------------------------------------
    # Subscription DELETED -> back to free
    # ------------------------------------------------------------------
    if event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")

        supabase.table("profiles").update(
            {
                "plan_id": "free",
                "stripe_subscription_id": None,
            }
        ).eq("stripe_customer_id", customer_id).execute()

    # ------------------------------------------------------------------
    # Invoice paid -> monthly renewal (credits / limits)
    # ------------------------------------------------------------------
    if event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")

        # renewal logic is handled elsewhere (limits reset by date)
        logger.info(f"Invoice paid for customer {customer_id}")

    # ------------------------------------------------------------------
    # One-time payments (extra credits)
    # ------------------------------------------------------------------
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]

        if session.get("mode") == "payment":
            customer_id = session.get("customer")
            line_items = stripe.checkout.Session.list_line_items(session["id"])

            total_credits = 0
            for item in line_items["data"]:
                price_id = item["price"]["id"]
                credits = EXTRA_PRICE_TO_CREDITS.get(price_id, 0)
                total_credits += credits

            if total_credits > 0:
                profile = (
                    supabase.table("profiles")
                    .select("extra_credits")
                    .eq("stripe_customer_id", customer_id)
                    .single()
                    .execute()
                    .data
                )

                new_credits = (profile.get("extra_credits") or 0) + total_credits

                supabase.table("profiles").update(
                    {"extra_credits": new_credits}
                ).eq("stripe_customer_id", customer_id).execute()

    return {"status": "ok"}

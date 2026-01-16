# stripe_routes.py
# FINAL – production-safe Stripe integration aligned with project auth (JWT via Authorization header)

import os
import json
import logging
from typing import Optional

import stripe
from fastapi import APIRouter, Request, HTTPException
from supabase import create_client, Client
import jwt

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
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter()
logger = logging.getLogger("stripe")
logger.setLevel(logging.INFO)

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_user_from_request(request: Request) -> dict:
    auth = request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = auth.split(" ", 1)[1]

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {
        "id": payload.get("sub"),
        "email": payload.get("email"),
    }


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
    return PRICE_TO_PLAN.get(price_id)

# -----------------------------------------------------------------------------
# Checkout
# -----------------------------------------------------------------------------

@router.post("/stripe/checkout")
def stripe_checkout(plan: str, request: Request):
    if plan not in ("start", "pro", "ent", "extra20", "extra50"):
        raise HTTPException(status_code=400, detail="Invalid plan")

    user = get_user_from_request(request)
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
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    supabase = get_supabase()

    if event["type"] in (
        "customer.subscription.created",
        "customer.subscription.updated",
    ):
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        items = sub["items"]["data"]
        price_id = items[0]["price"]["id"] if items else None
        plan_id = resolve_plan_from_price(price_id)

        if plan_id:
            supabase.table("profiles").update(
                {
                    "plan_id": plan_id,
                    "stripe_subscription_id": sub["id"],
                }
            ).eq("stripe_customer_id", customer_id).execute()

    if event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")

        supabase.table("profiles").update(
            {
                "plan_id": "free",
                "stripe_subscription_id": None,
            }
        ).eq("stripe_customer_id", customer_id).execute()

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        if session.get("mode") == "payment":
            customer_id = session.get("customer")
            items = stripe.checkout.Session.list_line_items(session["id"])

            credits = 0
            for item in items["data"]:
                credits += EXTRA_PRICE_TO_CREDITS.get(item["price"]["id"], 0)

            if credits > 0:
                profile = (
                    supabase.table("profiles")
                    .select("extra_credits")
                    .eq("stripe_customer_id", customer_id)
                    .single()
                    .execute()
                    .data
                )
                supabase.table("profiles").update(
                    {"extra_credits": (profile.get("extra_credits") or 0) + credits}
                ).eq("stripe_customer_id", customer_id).execute()

    return {"status": "ok"}

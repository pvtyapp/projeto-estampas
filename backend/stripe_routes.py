# backend/stripe_routes.py

import os
import stripe
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse

from backend.supabase_client import supabase

# ======================================================
# STRIPE CONFIG
# ======================================================

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

if not STRIPE_SECRET_KEY or not STRIPE_WEBHOOK_SECRET:
    raise RuntimeError("Stripe env vars não configuradas")

stripe.api_key = STRIPE_SECRET_KEY

# ======================================================
# ROUTER
# ======================================================

router = APIRouter(
    prefix="/stripe",
    tags=["stripe"],
)

# ======================================================
# HELPERS
# ======================================================

def get_plan_by_price_id(price_id: str):
    res = (
        supabase
        .table("plans")
        .select("id")
        .eq("stripe_price_id", price_id)
        .single()
        .execute()
    )
    return res.data if res and res.data else None


def upsert_subscription(user_id: str, plan_id: str, stripe_sub: dict):
    supabase.table("subscriptions").upsert(
        {
            "user_id": user_id,
            "plan_id": plan_id,
            "stripe_subscription_id": stripe_sub["id"],
            "status": stripe_sub["status"],
            "current_period_end": datetime.fromtimestamp(
                stripe_sub["current_period_end"]
            ).isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).execute()


def update_user_plan(user_id: str, plan_id: str):
    supabase.table("profiles").update(
        {
            "current_plan_id": plan_id,
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("id", user_id).execute()

# ======================================================
# CHECKOUT
# ======================================================

@router.post("/checkout")
async def create_checkout(payload: dict):
    """
    payload:
    {
      "user_id": "...",
      "email": "...",
      "plan_id": "...",
      "success_url": "...",
      "cancel_url": "..."
    }
    """

    plan = (
        supabase
        .table("plans")
        .select("stripe_price_id")
        .eq("id", payload["plan_id"])
        .single()
        .execute()
        .data
    )

    if not plan or not plan.get("stripe_price_id"):
        raise HTTPException(400, "Plano inválido")

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            customer_email=payload["email"],
            line_items=[
                {
                    "price": plan["stripe_price_id"],
                    "quantity": 1,
                }
            ],
            success_url=payload["success_url"],
            cancel_url=payload["cancel_url"],
            metadata={
                "user_id": payload["user_id"],
                "plan_id": payload["plan_id"],
            },
        )

        return {"checkout_url": session.url}

    except Exception as e:
        raise HTTPException(400, str(e))

# ======================================================
# CUSTOMER PORTAL
# ======================================================

@router.post("/portal")
async def customer_portal(payload: dict):
    """
    payload:
    {
      "customer_id": "...",
      "return_url": "..."
    }
    """

    try:
        portal = stripe.billing_portal.Session.create(
            customer=payload["customer_id"],
            return_url=payload["return_url"],
        )
        return {"url": portal.url}
    except Exception as e:
        raise HTTPException(400, str(e))

# ======================================================
# WEBHOOK
# ======================================================

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(400, "Webhook inválido")

    event_type = event["type"]
    obj = event["data"]["object"]

    # ==================================================
    # CHECKOUT COMPLETED
    # ==================================================

    if event_type == "checkout.session.completed":
        user_id = obj["metadata"]["user_id"]
        plan_id = obj["metadata"]["plan_id"]

        sub = stripe.Subscription.retrieve(obj["subscription"])

        upsert_subscription(user_id, plan_id, sub)
        update_user_plan(user_id, plan_id)

    # ==================================================
    # SUBSCRIPTION UPDATED
    # ==================================================

    elif event_type == "customer.subscription.updated":
        sub = obj
        price_id = sub["items"]["data"][0]["price"]["id"]

        plan = get_plan_by_price_id(price_id)
        if not plan:
            return JSONResponse({"ignored": True})

        res = (
            supabase
            .table("subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", sub["id"])
            .single()
            .execute()
        )

        if res.data:
            upsert_subscription(res.data["user_id"], plan["id"], sub)
            update_user_plan(res.data["user_id"], plan["id"])

    # ==================================================
    # SUBSCRIPTION DELETED
    # ==================================================

    elif event_type == "customer.subscription.deleted":
        sub = obj

        res = (
            supabase
            .table("subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", sub["id"])
            .single()
            .execute()
        )

        if res.data:
            # plano free = NULL ou ID do free
            update_user_plan(res.data["user_id"], None)

            supabase.table("subscriptions").update(
                {
                    "status": "canceled",
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("stripe_subscription_id", sub["id"]).execute()

    return JSONResponse({"status": "ok"})

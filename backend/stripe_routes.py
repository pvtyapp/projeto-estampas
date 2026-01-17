# backend/stripe_routes.py

import os
import json
import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from supabase import create_client, Client

from auth import get_current_user  # IMPORTANTE: já existe no seu projeto

router = APIRouter(prefix="/stripe", tags=["stripe"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


PRICE_BY_PLAN = {
    "start": os.getenv("STRIPE_PRICE_START"),
    "pro": os.getenv("STRIPE_PRICE_PRO"),
    "ent": os.getenv("STRIPE_PRICE_ENT"),
}


@router.post("/checkout")
def stripe_checkout(
    request: Request,
    plan: str,
    user: dict = Depends(get_current_user),
):
    if plan not in PRICE_BY_PLAN:
        raise HTTPException(status_code=400, detail="Plano inválido")

    price_id = PRICE_BY_PLAN.get(plan)
    if not price_id:
        raise HTTPException(status_code=500, detail="Price ID não configurado")

    supabase = get_supabase()

    profile = (
        supabase.table("profiles")
        .select("id, email, stripe_customer_id")
        .eq("id", user["id"])
        .single()
        .execute()
        .data
    )

    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    customer_id = profile.get("stripe_customer_id")

    if not customer_id:
        customer = stripe.Customer.create(
            email=profile["email"],
            metadata={"user_id": user["id"]},
        )

        customer_id = customer.id

        supabase.table("profiles").update(
            {"stripe_customer_id": customer_id}
        ).eq("id", user["id"]).execute()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[
            {
                "price": price_id,
                "quantity": 1,
            }
        ],
        success_url=f"{FRONTEND_URL}/work?checkout=success",
        cancel_url=f"{FRONTEND_URL}/plans",
    )

    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=STRIPE_WEBHOOK_SECRET,
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook inválido")

    supabase = get_supabase()

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type in [
        "checkout.session.completed",
        "invoice.payment_succeeded",
    ]:
        subscription_id = data.get("subscription")
        customer_id = data.get("customer")

        if not subscription_id or not customer_id:
            return JSONResponse({"status": "ignored"})

        subscription = stripe.Subscription.retrieve(subscription_id)
        price_id = subscription["items"]["data"][0]["price"]["id"]

        plan_id = None
        for key, value in PRICE_BY_PLAN.items():
            if value == price_id:
                plan_id = key
                break

        if not plan_id:
            return JSONResponse({"status": "unknown_plan"})

        supabase.table("profiles").update(
            {
                "plan_id": plan_id,
                "stripe_subscription_id": subscription_id,
            }
        ).eq("stripe_customer_id", customer_id).execute()

    if event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")

        supabase.table("profiles").update(
            {
                "plan_id": "free",
                "stripe_subscription_id": None,
            }
        ).eq("stripe_customer_id", customer_id).execute()

    return JSONResponse({"status": "ok"})

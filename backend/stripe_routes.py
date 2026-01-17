import os
import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client

from auth import get_current_user

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


class CheckoutPayload(BaseModel):
    plan: str


@router.post("/checkout")
def stripe_checkout(
    payload: CheckoutPayload,
    user: dict = Depends(get_current_user),
):
    if payload.plan not in PRICE_BY_PLAN:
        raise HTTPException(status_code=400, detail="Plano inválido")

    price_id = PRICE_BY_PLAN[payload.plan]
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
        line_items=[{"price": price_id, "quantity": 1}],
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

    if event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
    ):
        customer_id = data["customer"]
        subscription_id = data["id"]
        status = data["status"]
        period_start = data["current_period_start"]
        period_end = data["current_period_end"]

        items = data.get("items", {}).get("data", [])
        if not items:
            return JSONResponse({"status": "ignored"})

        price_id = items[0]["price"]["id"]

        supabase.table("subscriptions").upsert(
            {
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id,
                "price_id": price_id,
                "status": status,
                "current_period_start": period_start,
                "current_period_end": period_end,
            },
            on_conflict="stripe_subscription_id",
        ).execute()

    if event_type == "customer.subscription.deleted":
        subscription_id = data["id"]

        supabase.table("subscriptions").update(
            {"status": "canceled"}
        ).eq("stripe_subscription_id", subscription_id).execute()

    return JSONResponse({"status": "ok"})

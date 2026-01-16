import os
import json
import stripe
from fastapi import APIRouter, Request, HTTPException
from supabase import create_client
from datetime import datetime, timezone

router = APIRouter()

# =====================
# CONFIG
# =====================

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Supabase env vars missing")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# =====================
# HELPERS
# =====================

PRICE_TO_PLAN = {
    "price_start": "start",
    "price_pro": "pro",
    "price_ent": "ent",
}

def plan_from_invoice(invoice):
    for line in invoice["lines"]["data"]:
        price_id = line["price"]["id"]
        if price_id in PRICE_TO_PLAN:
            return PRICE_TO_PLAN[price_id]
    return None

# =====================
# CHECKOUT
# =====================

@router.post("/stripe/checkout")
def stripe_checkout(plan: str, request: Request):
    user = request.state.user
    if not user:
        raise HTTPException(status_code=401)

    price_id = os.getenv(f"STRIPE_PRICE_{plan.upper()}")
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid plan")

    session = stripe.checkout.Session.create(
        mode="subscription",
        payment_method_types=["card"],
        customer_email=user["email"],
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{os.getenv('FRONTEND_URL')}/work",
        cancel_url=f"{os.getenv('FRONTEND_URL')}/plans",
    )

    return {"url": session.url}

# =====================
# WEBHOOK
# =====================

@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    supabase = get_supabase()
    event_type = event["type"]
    data = event["data"]["object"]

    print(f"📨 Stripe event recebido: {event_type}")

    # ---------------------------------
    # 1️⃣ CUSTOMER + SUBSCRIPTION CREATED
    # ---------------------------------
    if event_type == "customer.subscription.created":
        customer_id = data["customer"]
        subscription_id = data["id"]

        # Apenas salvar vínculo se existir profile
        supabase.table("profiles").update({
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": subscription_id,
        }).eq("stripe_customer_id", customer_id).execute()

    # ---------------------------------
    # 2️⃣ CHECKOUT COMPLETED (garante customer)
    # ---------------------------------
    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        email = data.get("customer_details", {}).get("email")

        if customer_id and email:
            supabase.table("profiles").update({
                "stripe_customer_id": customer_id
            }).eq("email", email).execute()

    # ---------------------------------
    # 3️⃣ INVOICE PAID → AQUI MUDA O PLANO
    # ---------------------------------
    if event_type == "invoice.payment_succeeded":
        customer_id = data["customer"]
        subscription_id = data["subscription"]

        plan_id = plan_from_invoice(data)
        if not plan_id:
            return {"ok": True}

        period_start = datetime.fromtimestamp(
            data["period_start"], tz=timezone.utc
        ).isoformat()

        period_end = datetime.fromtimestamp(
            data["period_end"], tz=timezone.utc
        ).isoformat()

        res = supabase.table("profiles").select("id").eq(
            "stripe_customer_id", customer_id
        ).execute()

        if not res.data:
            print("⚠️ Profile não encontrado para customer:", customer_id)
            return {"ok": True}

        supabase.table("profiles").update({
            "plan_id": plan_id,
            "stripe_subscription_id": subscription_id,
            "stripe_current_period_start": period_start,
            "stripe_current_period_end": period_end,
        }).eq("stripe_customer_id", customer_id).execute()

        print("✅ Plano atualizado:", plan_id)

    return {"ok": True}

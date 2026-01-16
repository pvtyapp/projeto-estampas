import os
import stripe
import jwt
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
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

FRONTEND_URL = os.getenv("FRONTEND_URL")

def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# =====================
# AUTH HELPER
# =====================

def get_user_from_request(request: Request):
    auth = request.headers.get("authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")

    token = auth.replace("Bearer ", "")
    payload = jwt.decode(
        token,
        SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )

    return {
        "id": payload["sub"],
        "email": payload.get("email"),
    }

# =====================
# PRICE → PLAN
# =====================

PRICE_TO_PLAN = {
    os.getenv("STRIPE_PRICE_START"): "start",
    os.getenv("STRIPE_PRICE_PRO"): "pro",
    os.getenv("STRIPE_PRICE_ENT"): "ent",
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
    user = get_user_from_request(request)

    price_id = os.getenv(f"STRIPE_PRICE_{plan.upper()}")
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid plan")

    session = stripe.checkout.Session.create(
        mode="subscription",
        payment_method_types=["card"],
        customer_email=user["email"],
        client_reference_id=user["id"],
        metadata={
            "user_id": user["id"]
        },
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{FRONTEND_URL}/work",
        cancel_url=f"{FRONTEND_URL}/plans",
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

    # -------------------------
    # CHECKOUT COMPLETED
    # -------------------------
    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        user_id = data.get("client_reference_id") or data.get("metadata", {}).get("user_id")

        if customer_id and user_id:
            supabase.table("profiles").update({
                "stripe_customer_id": customer_id
            }).eq("id", user_id).execute()

    # -------------------------
    # SUBSCRIPTION CREATED
    # -------------------------
    if event_type == "customer.subscription.created":
        supabase.table("profiles").update({
            "stripe_subscription_id": data["id"]
        }).eq("stripe_customer_id", data["customer"]).execute()

    # -------------------------
    # INVOICE PAID → AQUI MUDA PLANO
    # -------------------------
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

        supabase.table("profiles").update({
            "plan_id": plan_id,
            "stripe_subscription_id": subscription_id,
            "stripe_current_period_start": period_start,
            "stripe_current_period_end": period_end,
        }).eq("stripe_customer_id", customer_id).execute()

        print("✅ Plano aplicado:", plan_id)

    return {"ok": True}

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
    # Assinaturas
    "start": "price_1So5VLIcNQlLzrcJU7Hja5BU",
    "pro": "price_1So5WLIcNQlLzrcJnthHWSto",
    "ent": "price_1So5WrIcNQlLzrcJldLXVh3C",

    # Pacotes avulsos
    "extra20": "price_1So5XwIcNQlLzrcJRCRtjXvM",
    "extra50": "price_1So5YbIcNQlLzrcJPgjlBSpj",
}

SUBSCRIPTION_PLANS = {"start", "pro", "ent"}


@router.post("/checkout")
def create_checkout(plan: str, user=Depends(get_current_user)):
    if plan not in PRICE_MAP:
        raise HTTPException(status_code=400, detail="Plano inválido")

    price_id = PRICE_MAP[plan]
    mode = "subscription" if plan in SUBSCRIPTION_PLANS else "payment"

    session = stripe.checkout.Session.create(
        mode=mode,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{os.getenv('FRONTEND_URL')}/plans?success=1",
        cancel_url=f"{os.getenv('FRONTEND_URL')}/plans?canceled=1",
        customer_email=user["email"],
        metadata={"user_id": user["sub"], "plan": plan},
    )

    return {"url": session.url}


# =========================
# WEBHOOK STRIPE
# =========================

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=WEBHOOK_SECRET,
        )
    except Exception as e:
        print("❌ Webhook inválido:", e)
        raise HTTPException(status_code=400, detail="Invalid webhook")

    print("📨 Stripe event recebido:", event["type"])

    # Checkout finalizado (assinatura criada ou pagamento feito)
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]

        user_id = session.get("metadata", {}).get("user_id")
        plan = session.get("metadata", {}).get("plan")

        if user_id and plan:
            print(f"✅ Ativando plano '{plan}' para usuário {user_id}")

            supabase.table("profiles").update({
                "plan_id": plan,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", user_id).execute()

    # Assinatura cancelada
    if event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        user_id = subscription.get("metadata", {}).get("user_id")

        if user_id:
            print(f"⚠️ Assinatura cancelada — voltando para plano free ({user_id})")

            supabase.table("profiles").update({
                "plan_id": "free",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", user_id).execute()

    return {"status": "ok"}

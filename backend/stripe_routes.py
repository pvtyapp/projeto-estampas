import stripe
import os
from fastapi import APIRouter, Depends, HTTPException
from backend.auth import get_current_user

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

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

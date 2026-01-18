# backend/auth_routes.py

import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from backend.supabase_client import supabase_admin

# ======================================================
# ROUTER
# ======================================================

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

# ======================================================
# VALIDATIONS
# ======================================================

EMAIL_REGEX = re.compile(r"[^@]+@[^@]+\.[^@]+")


def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Senha deve ter no mínimo 8 caracteres",
        )


# ======================================================
# PAYLOAD
# ======================================================

class RegisterPayload(BaseModel):
    email: EmailStr
    password: str


# ======================================================
# REGISTER
# ======================================================

@router.post("/register")
def register(payload: RegisterPayload):
    validate_password(payload.password)

    # --------------------------------------------------
    # 1️⃣ Criar usuário no Supabase Auth
    # --------------------------------------------------
    try:
        user = supabase_admin.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Erro ao criar usuário: {str(e)}",
        )

    user_id = user.user.id

    # --------------------------------------------------
    # 2️⃣ Criar profile (trigger seta plano free)
    # --------------------------------------------------
    res = (
        supabase_admin
        .table("profiles")
        .insert(
            {
                "id": user_id,
                "email": payload.email,
            }
        )
        .execute()
    )

    if not res.data:
        # rollback auth user
        supabase_admin.auth.admin.delete_user(user_id)
        raise HTTPException(
            status_code=500,
            detail="Erro ao criar profile",
        )

    # --------------------------------------------------
    # 3️⃣ Resposta
    # --------------------------------------------------
    return {
        "id": user_id,
        "email": payload.email,
        "status": "created",
    }

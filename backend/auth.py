import os
from fastapi import Header, HTTPException, status
from jose import jwt, JWTError, ExpiredSignatureError
from typing import Optional

# ---------------- CONFIG ----------------

SUPABASE_PROJECT_URL = os.getenv("SUPABASE_URL")
if not SUPABASE_PROJECT_URL:
    raise RuntimeError("SUPABASE_URL não configurada")

SUPABASE_PROJECT_URL = SUPABASE_PROJECT_URL.rstrip("/")
SUPABASE_ISSUER = f"{SUPABASE_PROJECT_URL}/auth/v1"

DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "false").lower() == "true"
DEV_USER_ID = os.getenv("DEV_USER_ID", "00000000-0000-0000-0000-000000000001")

# ---------------- DEPENDENCY ----------------

async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_authorization: Optional[str] = Header(None, alias="X-Authorization"),
):
    if DEV_NO_AUTH:
        print("⚠️ DEV_NO_AUTH ativo — ignorando auth")
        return {"sub": DEV_USER_ID, "email": "dev@local"}

    token_header = authorization or x_authorization
    if not token_header:
        print("❌ Header Authorization ausente")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Header Authorization ausente")

    if not token_header.startswith("Bearer "):
        print("❌ Header Authorization inválido:", token_header)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Formato de token inválido")

    token = token_header.split(" ", 1)[1]

    try:
        payload = jwt.decode(
            token,
            key="",
            options={
                "verify_signature": False,
                "verify_aud": False,  # evita erro se aud existir
            },
            issuer=SUPABASE_ISSUER,
        )

        print("✅ Token válido:", payload.get("sub"), payload.get("email"))
        return payload

    except ExpiredSignatureError:
        print("❌ Token expirado")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")

    except JWTError as e:
        print("❌ Token inválido:", str(e))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token inválido: {str(e)}")

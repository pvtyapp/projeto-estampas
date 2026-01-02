import os
import logging
from fastapi import Header, HTTPException, status
from jose import jwt, JWTError, ExpiredSignatureError
from typing import Optional

logger = logging.getLogger(__name__)

SUPABASE_PROJECT_URL = os.getenv("SUPABASE_URL")
if not SUPABASE_PROJECT_URL:
    raise RuntimeError("SUPABASE_URL não configurada")

SUPABASE_PROJECT_URL = SUPABASE_PROJECT_URL.rstrip("/")
SUPABASE_ISSUER = f"{SUPABASE_PROJECT_URL}/auth/v1"

DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "false").lower() == "true"
DEV_USER_ID = os.getenv("DEV_USER_ID", "00000000-0000-0000-0000-000000000001")


async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_authorization: Optional[str] = Header(None, alias="X-Authorization"),
):
    if DEV_NO_AUTH:
        logger.warning("DEV_NO_AUTH ativo — ignorando autenticação")
        return {"sub": DEV_USER_ID, "email": "dev@local"}

    token_header = authorization or x_authorization
    if not token_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Header Authorization ausente")

    if not token_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Formato de token inválido")

    token = token_header.split(" ", 1)[1]

    try:
        payload = jwt.decode(
            token,
            key="",
            options={
                "verify_signature": False,
                "verify_aud": False,
            },
            issuer=SUPABASE_ISSUER,
            leeway=10,  # tolerância de relógio
        )

        return payload

    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")

    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

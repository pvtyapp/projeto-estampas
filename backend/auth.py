import os
import requests
from functools import lru_cache
from fastapi import Header, HTTPException, status
from jose import jwt
from typing import Optional

# ---------------- CONFIG ----------------

SUPABASE_PROJECT_URL = os.getenv("SUPABASE_URL")
if not SUPABASE_PROJECT_URL:
    raise RuntimeError("SUPABASE_URL não configurada")

SUPABASE_ISSUER = f"{SUPABASE_PROJECT_URL}/auth/v1"
JWKS_URL = f"{SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json"

DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "false").lower() == "true"
DEV_USER_ID = os.getenv("DEV_USER_ID", "00000000-0000-0000-0000-000000000001")

# ---------------- JWKS ----------------

@lru_cache(maxsize=1)
def get_jwks():
    r = requests.get(JWKS_URL, timeout=5)
    if r.status_code != 200:
        raise RuntimeError(f"Erro ao buscar JWKS: {r.text}")
    return r.json()

def get_signing_key(token: str):
    jwks = get_jwks()
    headers = jwt.get_unverified_header(token)
    kid = headers.get("kid")

    if not kid:
        raise HTTPException(status_code=401, detail="Token sem kid")

    for key in jwks["keys"]:
        if key["kid"] == kid:
            return key

    # possível rotação de chave → limpa cache e tenta novamente
    get_jwks.cache_clear()
    jwks = get_jwks()

    for key in jwks["keys"]:
        if key["kid"] == kid:
            return key

    raise HTTPException(status_code=401, detail="Chave pública não encontrada")

# ---------------- DEPENDENCY ----------------

async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_authorization: Optional[str] = Header(None, alias="X-Authorization")
):
    if DEV_NO_AUTH:
        return {"sub": DEV_USER_ID, "email": "dev@local"}

    token_header = authorization or x_authorization
    if not token_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Header Authorization ausente")

    if not token_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Formato de token inválido")

    token = token_header.split(" ", 1)[1]

    try:
        key = get_signing_key(token)

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience="authenticated",
            issuer=SUPABASE_ISSUER,
        )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")

    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

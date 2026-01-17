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
        return {"id": DEV_USER_ID, "sub": DEV_USER_ID, "email": "dev@local"}

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
        )

        # normaliza id para o backend inteiro
        user_id = payload.get("sub")
        payload["id"] = user_id

        return payload

    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")

    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


def _only_digits(v: str) -> str:
    return "".join([c for c in (v or "") if c.isdigit()])


def is_valid_cpf(cpf: str) -> bool:
    cpf = _only_digits(cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    s1 = sum(int(cpf[i]) * (10 - i) for i in range(9))
    d1 = (s1 * 10) % 11
    d1 = 0 if d1 == 10 else d1
    s2 = sum(int(cpf[i]) * (11 - i) for i in range(10))
    d2 = (s2 * 10) % 11
    d2 = 0 if d2 == 10 else d2
    return cpf[-2:] == f"{d1}{d2}"


def is_valid_cnpj(cnpj: str) -> bool:
    cnpj = _only_digits(cnpj)
    if len(cnpj) != 14:
        return False
    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6] + w1

    def calc(nums, weights):
        s = sum(int(n) * w for n, w in zip(nums, weights))
        r = s % 11
        return "0" if r < 2 else str(11 - r)

    return cnpj[-2:] == calc(cnpj[:12], w1) + calc(cnpj[:13], w2)


def validate_document(person_type: str, doc: str):
    if person_type == "cpf" and not is_valid_cpf(doc):
        raise HTTPException(status_code=400, detail="CPF inválido")
    if person_type == "cnpj" and not is_valid_cnpj(doc):
        raise HTTPException(status_code=400, detail="CNPJ inválido")

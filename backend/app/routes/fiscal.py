from fastapi import APIRouter, Depends
from backend.auth import get_current_user
from backend.app.services.fiscal_service import (
    get_fiscal_data,
    update_fiscal_data,
)
from backend.utils.validators import validate_document

router = APIRouter(prefix="/me/fiscal", tags=["Fiscal"])


@router.get("")
def get_my_fiscal(user=Depends(get_current_user)):
    data = get_fiscal_data(user["sub"])
    return data or {}


@router.put("")
def update_my_fiscal(payload: dict, user=Depends(get_current_user)):
    person_type = payload.get("person_type")
    document = payload.get("document")

    if person_type and document:
        payload["document"] = validate_document(person_type, document)

    update_fiscal_data(user["sub"], payload)
    return {"ok": True}

import re

def validate_document(person_type: str, document: str) -> str:
    doc = re.sub(r"\D", "", document or "")

    if person_type == "cpf" and len(doc) != 11:
        raise ValueError("CPF deve ter 11 dígitos")

    if person_type == "cnpj" and len(doc) != 14:
        raise ValueError("CNPJ deve ter 14 dígitos")

    return doc

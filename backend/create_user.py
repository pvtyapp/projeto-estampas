import os
import re
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise RuntimeError("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env")

# ========================
# Configurações Supabase
# ========================

AUTH_URL = f"{SUPABASE_URL}/auth/v1/admin/users"
REST_URL = f"{SUPABASE_URL}/rest/v1"

HEADERS = {
    "Authorization": f"Bearer {SERVICE_KEY}",
    "apikey": SERVICE_KEY,
    "Content-Type": "application/json"
}

# ========================
# Utilidades
# ========================

def clean_document(doc: str) -> str:
    return re.sub(r"\D", "", doc or "")

def validate_document(person_type: str, document: str) -> str:
    doc = clean_document(document)

    if person_type == "cpf" and len(doc) != 11:
        raise ValueError("CPF deve ter exatamente 11 dígitos")
    if person_type == "cnpj" and len(doc) != 14:
        raise ValueError("CNPJ deve ter exatamente 14 dígitos")

    return doc

# ========================
# Entrada de dados
# ========================

email = input("Email do usuário: ")
password = input("Senha inicial: ")

person_type = input("Tipo de pessoa (cpf/cnpj ou enter para pular): ").strip().lower()
document = None

if person_type in ("cpf", "cnpj"):
    document = input(f"Digite o {person_type.upper()}: ")
    document = validate_document(person_type, document)
else:
    person_type = None

full_name = input("Nome completo / Razão social (opcional): ")
phone = input("Telefone (opcional): ")
street = input("Rua (opcional): ")
number = input("Número (opcional): ")
complement = input("Complemento (opcional): ")
neighborhood = input("Bairro (opcional): ")
city = input("Cidade (opcional): ")
state = input("Estado (opcional): ")
zip_code = input("CEP (opcional): ")

# ========================
# Criar usuário no Auth
# ========================

payload = {
    "email": email,
    "password": password,
    "email_confirm": True
}

r = requests.post(AUTH_URL, json=payload, headers=HEADERS)

print("Status:", r.status_code)
print("Resposta:", r.text)

if r.status_code != 200:
    print("Erro ao criar usuário.")
    exit(1)

data = r.json()
user_id = data.get("id")

print("Usuário criado:", user_id)

# ========================
# Criar plano default
# ========================

requests.post(
    f"{REST_URL}/plans",
    headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    },
    json={
        "user_id": user_id,
        "plan": "free",
        "monthly_limit": 2
    }
)

print("Plano free criado.")

# ========================
# Criar dados fiscais
# ========================

if person_type and document:
    fiscal_payload = {
        "user_id": user_id,
        "person_type": person_type,
        "document": document,
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "street": street,
        "number": number,
        "complement": complement,
        "neighborhood": neighborhood,
        "city": city,
        "state": state,
        "zip": zip_code
    }

    # remove campos vazios
    fiscal_payload = {k: v for k, v in fiscal_payload.items() if v}

    r = requests.post(
        f"{REST_URL}/user_fiscal_data",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        json=fiscal_payload
    )

    if r.status_code not in (200, 201):
        print("Erro ao criar dados fiscais:", r.text)
    else:
        print("Dados fiscais criados.")

else:
    print("Dados fiscais não informados — pulando criação.")

print("Processo finalizado com sucesso.")

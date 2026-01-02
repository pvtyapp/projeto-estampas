import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise RuntimeError("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env")

url = f"{SUPABASE_URL}/auth/v1/admin/users"

headers = {
    "Authorization": f"Bearer {SERVICE_KEY}",
    "apikey": SERVICE_KEY,
    "Content-Type": "application/json"
}

email = input("Email do usuário: ")
password = input("Senha inicial: ")

payload = {
    "email": email,
    "password": password,
    "email_confirm": True
}

r = requests.post(url, json=payload, headers=headers)

print("Status:", r.status_code)
print("Resposta:", r.text)

if r.status_code == 200:
    data = r.json()
    user_id = data.get("id")

    print("Usuário criado:", user_id)

    # Criar plano default
    requests.post(
        f"{SUPABASE_URL}/rest/v1/plans",
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

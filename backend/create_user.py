import requests

SUPABASE_URL = "https://bpclxgvvepgzvtbzzqsn.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwY2x4Z3Z2ZXBnenZ0Ynp6cXNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQzNTk0MiwiZXhwIjoyMDgyMDExOTQyfQ.YjIM9jz9HGlEoDwZSjbHM-m0a0AP0CutROe9S8vn-r0"

url = f"{SUPABASE_URL}/auth/v1/admin/users"

headers = {
    "Authorization": f"Bearer {SERVICE_KEY}",
    "apikey": SERVICE_KEY,
    "Content-Type": "application/json"
}

payload = {
    "email": "devpiv@pvty.app",
    "password": "123456",
    "email_confirm": True
}

r = requests.post(url, json=payload, headers=headers)

print("Status:", r.status_code)
print("Resposta:", r.text)

import requests

SUPABASE_URL = "https://bpclxgvvepgzvtbzzqsn.supabase.co"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwY2x4Z3Z2ZXBnenZ0Ynp6cXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MzU5NDIsImV4cCI6MjA4MjAxMTk0Mn0.36IVqsW8Uhx_R7iB9GN9GvDaF0a_gKU46AkOrT8KAg0"

res = requests.post(
    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
    headers={
        "apikey": API_KEY,
        "Content-Type": "application/json"
    },
    json={
        "email": "devpiv@pvty.app",
        "password": "123456"
    }
)

print(res.status_code)
print(res.json())

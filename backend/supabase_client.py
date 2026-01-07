import os
from supabase import create_client, Client
from dotenv import load_dotenv

if os.getenv("ENV") != "production":
    load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL não configurada")

# Garante barra final para evitar erros no Storage
if not SUPABASE_URL.endswith("/"):
    SUPABASE_URL += "/"

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY não configurada (NÃO use anon key no backend)")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

import os
import httpx
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing Supabase env vars")

http_client = httpx.Client(
    http2=False,
    timeout=httpx.Timeout(10.0),
    limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
)

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
    options={
        "http_client": http_client,
    },
)

import os
from redis import Redis
from rq import Queue

REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    raise RuntimeError("REDIS_URL não configurada")

# Log simples para debug (sem expor senha)
print(f"🔌 Conectando no Redis: {REDIS_URL.split('@')[-1]}")

redis_conn = Redis.from_url(
    REDIS_URL,
    decode_responses=False,
    socket_timeout=5,
    socket_connect_timeout=5,
    retry_on_timeout=True,
)

queue = Queue(
    "default",
    connection=redis_conn,
    default_timeout=int(os.getenv("RQ_DEFAULT_TIMEOUT", "900")),  # 15 minutos
)

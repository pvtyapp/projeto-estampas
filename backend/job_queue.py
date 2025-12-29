import os
from redis import Redis
from rq import Queue

REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    raise RuntimeError("REDIS_URL não configurada")

redis_conn = Redis.from_url(REDIS_URL)
queue = Queue("default", connection=redis_conn)

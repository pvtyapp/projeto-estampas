import logging
import os
from rq import Worker, Connection
from redis import Redis
from backend.job_queue import queue

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    raise RuntimeError("REDIS_URL não configurada")

if __name__ == "__main__":
    redis_conn = Redis.from_url(REDIS_URL, decode_responses=False)

    with Connection(redis_conn):
        worker = Worker(
            [queue],
            connection=redis_conn,
            default_worker_ttl=300,
            job_timeout=600
        )

        logger.info("🚀 Worker iniciado e aguardando jobs...")
        worker.work(burst=False, logging_level=logging.INFO)

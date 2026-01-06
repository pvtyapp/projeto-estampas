import uuid
import time
import logging
from datetime import datetime, timezone
from typing import List

from backend.supabase_client import supabase
from backend.render_engine import process_print_job

logger = logging.getLogger(__name__)


def process_render(job_id: str, preview: bool = False):
    """
    Worker principal que gera os arquivos do job.
    Se preview=True, gera apenas as prévias com watermark e marca o job como preview_done.
    """

    logger.info("🚀 Iniciando processamento do job %s (preview=%s)", job_id, preview)

    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute().data
    if not job:
        raise RuntimeError(f"Job {job_id} não encontrado")

    # Marca como processing
    supabase.table("jobs").update({
        "status": "processing",
        "started_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", job_id).execute()

    pieces = supabase.table("job_pieces").select("*").eq("job_id", job_id).execute().data or []

    if not pieces:
        raise RuntimeError(f"Job {job_id} não tem peças para processar")

    try:
        urls = process_print_job(job_id, pieces, preview=preview)

        if preview:
            # Aguarda os arquivos realmente existirem antes de marcar preview_done
            for _ in range(10):  # até ~5s
                res = supabase.table("generated_files") \
                    .select("id", count="exact") \
                    .eq("job_id", job_id) \
                    .eq("preview", True) \
                    .execute()

                if res.count and res.count > 0:
                    break

                time.sleep(0.5)

            if not res.count or res.count == 0:
                raise RuntimeError(f"Preview do job {job_id} terminou sem arquivos gerados")

            supabase.table("jobs").update({
                "status": "preview_done",
                "finished_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", job_id).execute()

            logger.info("✅ Preview finalizado: %s arquivos gerados — job=%s", res.count, job_id)
            return

        # Caso não seja preview, finaliza como done
        supabase.table("jobs").update({
            "status": "done",
            "finished_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

        logger.info("✅ Job %s finalizado com sucesso", job_id)

    except Exception as e:
        logger.exception("❌ Erro ao processar job %s", job_id)

        supabase.table("jobs").update({
            "status": "error",
            "error": str(e),
            "finished_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

        raise

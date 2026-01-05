import logging
from datetime import datetime, timezone
from backend.supabase_client import supabase
from backend.render_engine import process_print_job
from backend.zip_utils import create_zip_from_urls

logger = logging.getLogger(__name__)


def process_render(job_id: str, preview: bool = False):
    logger.info("▶️ Iniciando process_render job=%s preview=%s", job_id, preview)

    job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_res.data

    if not job:
        logger.warning("❌ Job não encontrado: %s", job_id)
        return

    logger.info("📦 Job status atual: %s", job["status"])

    # valida estado do job
    if preview and job["status"] != "preview":
        logger.info("⏭ Ignorado (preview=True, status=%s)", job["status"])
        return

    if not preview and job["status"] != "queued":
        logger.info("⏭ Ignorado (preview=False, status=%s)", job["status"])
        return

    try:
        payload = job.get("payload") or {}
        pieces = payload.get("pieces")

        if not pieces or not isinstance(pieces, list):
            raise ValueError("Payload inválido: 'pieces' ausente ou inválido")

        logger.info("🧩 Renderizando %d peças", len(pieces))

        urls = process_print_job(job_id, pieces, preview=preview)

        logger.info("🖼 Render finalizado (%d imagens)", len(urls))

        # FINALIZA PREVIEW
        if preview:
            supabase.table("jobs").update({
                "status": "preview_done",
                "finished_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", job_id).execute()

            logger.info("✅ Preview finalizado job=%s", job_id)
            return

        # INICIA PROCESSAMENTO FINAL
        supabase.table("jobs").update({
            "status": "processing",
            "started_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

        zip_bytes = create_zip_from_urls(urls)
        if hasattr(zip_bytes, "getvalue"):
            zip_bytes = zip_bytes.getvalue()

        zip_name = f"{job_id}.zip"

        supabase.storage.from_("jobs-output").upload(
            zip_name,
            zip_bytes,
            {
                "content-type": "application/zip",
                "upsert": "true",
            }
        )

        zip_url = supabase.storage.from_("jobs-output").get_public_url(zip_name)

        supabase.table("jobs").update({
            "zip_url": zip_url,
            "status": "done",
            "finished_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

        logger.info("🎉 Job finalizado job=%s", job_id)

    except Exception as e:
        logger.exception("💥 Erro ao processar job %s", job_id)

        supabase.table("jobs").update({
            "status": "error",
            "error": str(e),
            "finished_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

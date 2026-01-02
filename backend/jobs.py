import logging
from datetime import datetime
from backend.supabase_client import supabase
from backend.render_engine import process_print_job
from backend.zip_utils import create_zip_from_urls

logger = logging.getLogger(__name__)


def process_render(job_id: str):
    job_res = supabase.table("jobs").select("*").eq("id", job_id).execute()
    job = job_res.data[0] if job_res.data else None

    if not job or job["status"] != "queued":
        return

    # lock otimista
    updated = supabase.table("jobs").update({
        "status": "processing",
        "started_at": datetime.utcnow().isoformat()
    }).eq("id", job_id).eq("status", "queued").execute()

    if not updated.data:
        return

    try:
        urls = process_print_job(job["payload"])

        # ============================
        # Gera ZIP das folhas
        # ============================
        zip_bytes = create_zip_from_urls(urls)
        zip_name = f"jobs/{job_id}.zip"

        supabase.storage.from_("jobs-output").upload(
            zip_name,
            zip_bytes,
            {"content-type": "application/zip"}
        )

        zip_url = supabase.storage.from_("jobs-output").get_public_url(zip_name)

        # ============================
        # Atualiza job como concluído
        # ============================
        supabase.table("jobs").update({
            "status": "done",
            "result_urls": urls,
            "zip_url": zip_url,
            "finished_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.exception("Erro ao processar job %s", job_id)

        supabase.table("jobs").update({
            "status": "error",
            "error": str(e),
            "finished_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

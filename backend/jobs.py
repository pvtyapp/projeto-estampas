import logging
from datetime import datetime
from backend.supabase_client import supabase
from backend.render_engine import process_print_job

logger = logging.getLogger(__name__)


def process_render(job_id: str):
    job_res = supabase.table("jobs").select("*").eq("id", job_id).execute()
    job = job_res.data[0] if job_res.data else None

    if not job or job["status"] != "queued":
        return

    updated = supabase.table("jobs").update({
        "status": "processing",
        "started_at": datetime.utcnow().isoformat()
    }).eq("id", job_id).eq("status", "queued").execute()

    if not updated.data:
        return

    try:
        urls = process_print_job(job["payload"])

        supabase.table("jobs").update({
            "status": "done",
            "result_urls": urls,
            "finished_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.exception("Erro ao processar job %s", job_id)

        supabase.table("jobs").update({
            "status": "error",
            "error": str(e),
            "finished_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

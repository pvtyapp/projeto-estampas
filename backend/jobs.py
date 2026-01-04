import logging
from datetime import datetime, timezone
from backend.supabase_client import supabase
from backend.render_engine import process_print_job
from backend.zip_utils import create_zip_from_urls

logger = logging.getLogger(__name__)


def process_render(job_id: str, preview: bool = False):
    job_res = supabase.table("jobs").select("*").eq("id", job_id).execute()
    job = job_res.data[0] if job_res.data else None

    if not job:
        return

    # Preview pode rodar mesmo se status=preview
    if preview:
        if job["status"] != "preview":
            return
    else:
        if job["status"] != "queued":
            return

    supabase.table("jobs").update({
        "status": "processing",
        "started_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", job_id).execute()

    try:
        payload = job.get("payload")
        if not payload:
            raise ValueError("Payload vazio no job")

        urls = process_print_job(job_id, payload, preview=preview)

        # Só gera ZIP quando for confirmado (não preview)
        if not preview:
            zip_bytes = create_zip_from_urls(urls)
            if hasattr(zip_bytes, "getvalue"):
                zip_bytes = zip_bytes.getvalue()

            zip_name = f"{job_id}.zip"

            supabase.storage.from_("jobs-output").upload(
                zip_name,
                zip_bytes,
                {"content-type": "application/zip"}
            )

            zip_url = supabase.storage.from_("jobs-output").get_public_url(zip_name)

            supabase.table("jobs").update({
                "zip_url": zip_url
            }).eq("id", job_id).execute()

        # Status final já é tratado no render_engine
    except Exception as e:
        logger.exception("Erro ao processar job %s", job_id)

        supabase.table("jobs").update({
            "status": "error",
            "error": str(e),
            "finished_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

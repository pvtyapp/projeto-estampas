from datetime import datetime
from backend.supabase_client import supabase
from backend.render_engine import process_print_job


def process_render(job_id: str):
    job_res = supabase.table("jobs").select("*").eq("id", job_id).execute()
    job = job_res.data[0] if job_res.data else None

    if not job:
        return

    if job["status"] in ("canceled", "done", "error"):
        return

    if job["status"] != "queued":
        return

    try:
        # marca como processing para evitar corrida
        supabase.table("jobs").update({
            "status": "processing"
        }).eq("id", job_id).execute()

        urls = process_print_job(job["payload"])

        supabase.table("jobs").update({
            "status": "done",
            "result_urls": urls,
            "finished_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

    except Exception as e:
        supabase.table("jobs").update({
            "status": "error",
            "error": str(e),
            "finished_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

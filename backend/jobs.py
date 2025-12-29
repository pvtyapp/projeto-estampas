from datetime import datetime
from supabase_client import supabase
from render_engine import process_print_job

def process_render(job_id: str):
    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute().data

    try:
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

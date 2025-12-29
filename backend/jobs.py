from datetime import datetime
from supabase_client import supabase
from render_engine import process_print_job

def process_render(job_id: str):
    job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_res.data

    if not job:
        return

    # evita reprocessar
    if job["status"] != "queued":
        return

    try:
        urls = process_print_job(job["payload"])

        supabase.table("jobs").update({
            "status": "done",
            "result_urls": urls,
            "finished_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

        # registra uso
        total_qty = sum(item["qty"] for item in job["payload"].get("items", []))
        supabase.table("usage_logs").insert({
            "user_id": job["user_id"],
            "qty": total_qty,
            "created_at": datetime.utcnow().isoformat()
        }).execute()

    except Exception as e:
        supabase.table("jobs").update({
            "status": "error",
            "error": str(e),
            "finished_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

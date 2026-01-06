from backend.supabase_client import supabase
from backend.render_engine import process_print_job

def process_render(job_id: str, preview: bool = False):
    # Buscar o job
    job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_res.data

    if not job:
        raise Exception(f"Job {job_id} not found")

    pieces = job.get("items", [])

    if not pieces:
        raise Exception(f"Job {job_id} has no pieces")

    # Atualiza status
    supabase.table("jobs").update({
        "status": "processing"
    }).eq("id", job_id).execute()

    # Processa render
    files = process_print_job(
        job_id=job_id,
        pieces=pieces,
        preview=preview
    )

    # Salva arquivos gerados
    for f in files:
        supabase.table("generated_files").insert({
            "job_id": job_id,
            "page_index": f["page_index"],
            "file_path": f["file_path"],
            "public_url": f["public_url"],
            "preview": preview
        }).execute()

    # Atualiza status final
    supabase.table("jobs").update({
        "status": "preview_done" if preview else "done"
    }).eq("id", job_id).execute()

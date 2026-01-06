import os
import time
import uuid
from backend.supabase_client import supabase
from backend.render_engine import process_print_job


def process_render(job_id: str, preview: bool = False):
    print(f"▶️ Starting render for job {job_id}, preview={preview}")

    # 1. Buscar job
    job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_res.data

    if not job:
        raise Exception(f"Job {job_id} not found")

    items = job.get("items") or []

    if not items:
        raise Exception(f"Job {job_id} has no items")

    print(f"📦 Job {job_id} has {len(items)} items")

    # 2. Marcar status
    supabase.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

    # 3. Processar
    result_files = process_print_job(job_id, items, preview=preview)

    # 4. Salvar arquivos
    for f in result_files:
        supabase.table("generated_files").insert({
            "id": str(uuid.uuid4()),
            "job_id": job_id,
            "file_path": f["path"],
            "public_url": f["url"],
            "page_index": f.get("page_index", 0),
            "preview": preview,
        }).execute()

    # 5. Atualizar status final
    supabase.table("jobs").update({
        "status": "preview_done" if preview else "done"
    }).eq("id", job_id).execute()

    print(f"✅ Job {job_id} finished with status {'preview_done' if preview else 'done'}")

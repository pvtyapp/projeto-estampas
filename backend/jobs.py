import uuid
from datetime import datetime, timezone

from backend.supabase_client import supabase
from backend.render_engine import process_print_job


def process_render(job_id: str, preview: bool = False):
    print(f"▶️ Starting render for job {job_id}, preview={preview}")

    # 1. Buscar job
    job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_res.data

    if not job:
        raise Exception(f"Job {job_id} not found")

    payload = job.get("payload") or {}
    items = payload.get("pieces") or payload.get("items") or []

    if not items:
        raise Exception(f"Job {job_id} has no items")

    print(f"📦 Job {job_id} has {len(items)} pieces")

    # 2. Atualizar status
    supabase.table("jobs").update({
        "status": "preview" if preview else "processing"
    }).eq("id", job_id).execute()

    # 3. Processar
    result_files = process_print_job(job_id, items, preview=preview)

    # 4. Remover previews antigos (se for preview)
    if preview:
        supabase.table("generated_files").delete().eq("job_id", job_id).eq("preview", True).execute()

    # 5. Salvar arquivos
    for f in result_files:
        supabase.table("generated_files").insert({
            "id": str(uuid.uuid4()),
            "job_id": job_id,
            "file_path": f["path"],
            "public_url": f["url"],
            "page_index": f.get("page_index", 0),
            "preview": preview,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    # 6. Atualizar status final
    supabase.table("jobs").update({
        "status": "preview_done" if preview else "done"
    }).eq("id", job_id).execute()

    print(f"✅ Job {job_id} finished with status {'preview_done' if preview else 'done'}")

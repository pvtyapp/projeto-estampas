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

    payload = job.get("payload") or {}
    pieces = payload.get("pieces") or []

    if not pieces:
        raise Exception(f"Job {job_id} has no pieces")

    print(f"📦 Job {job_id} has {len(pieces)} pieces")

    # 2. Marcar status
    supabase.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

    # 3. Processar
    result_files = process_print_job(job_id, pieces, preview=preview)

    if not isinstance(result_files, list):
        raise Exception(f"process_print_job must return list, got {type(result_files)}")

    # 4. Salvar arquivos
    for idx, f in enumerate(result_files):
        if isinstance(f, str):
            supabase.table("generated_files").insert({
                "id": str(uuid.uuid4()),
                "job_id": job_id,
                "file_path": f,
                "public_url": f,
                "page_index": idx,
                "preview": preview,
            }).execute()

        elif isinstance(f, dict):
            supabase.table("generated_files").insert({
                "id": str(uuid.uuid4()),
                "job_id": job_id,
                "file_path": f.get("path"),
                "public_url": f.get("url"),
                "page_index": f.get("page_index", idx),
                "preview": preview,
            }).execute()

        else:
            raise Exception(f"Invalid file result type: {type(f)}")

    # 5. Atualizar status final
    supabase.table("jobs").update({
        "status": "preview_done" if preview else "done"
    }).eq("id", job_id).execute()

    print(f"✅ Job {job_id} finished with status {'preview_done' if preview else 'done'}")

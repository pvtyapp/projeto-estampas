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

    # 2. Marcar como processing
    supabase.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

    try:
        # 3. Processar render
        result_files = process_print_job(job_id, pieces, preview=preview)

        if not isinstance(result_files, list):
            raise Exception("process_print_job did not return a list")

        # 4. Salvar arquivos gerados (tolerante a string ou dict)
        for idx, f in enumerate(result_files):
            if isinstance(f, str):
                file_path = None
                public_url = f
                page_index = idx
            elif isinstance(f, dict):
                file_path = f.get("path")
                public_url = f.get("url")
                page_index = f.get("page_index", idx)
            else:
                raise Exception(f"Invalid file result at index {idx}: {f}")

            supabase.table("generated_files").insert({
                "id": str(uuid.uuid4()),
                "job_id": job_id,
                "file_path": file_path,
                "public_url": public_url,
                "page_index": page_index,
                "preview": preview,
            }).execute()

        # 5. Atualizar status final
        final_status = "preview_done" if preview else "done"
        supabase.table("jobs").update({"status": final_status}).eq("id", job_id).execute()

        print(f"✅ Job {job_id} finished with status {final_status}")

    except Exception as e:
        print(f"❌ Job {job_id} failed: {e}")

        supabase.table("jobs").update({
            "status": "error",
            "error": str(e)
        }).eq("id", job_id).execute()

        raise

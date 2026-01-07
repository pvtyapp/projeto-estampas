import uuid
import os
import zipfile
from datetime import datetime, timezone
from backend.supabase_client import supabase
from backend.render_engine import process_print_job


def process_render(job_id: str, preview: bool = False):
    print(f"▶️ Starting render for job {job_id}, preview={preview}")

    job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_res.data

    if not job:
        raise Exception(f"Job {job_id} not found")

    payload = job.get("payload") or {}
    pieces = payload.get("pieces") or []

    if not pieces:
        raise Exception(f"Job {job_id} has no pieces")

    print(f"📦 Job {job_id} has {len(pieces)} pieces")

    supabase.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

    try:
        result_files = process_print_job(job_id, pieces, preview=preview)

        if not isinstance(result_files, list):
            raise Exception("process_print_job did not return a list")

        file_paths = []

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

            if file_path:
                file_paths.append(file_path)

        if not preview:
            zip_name = f"{job_id}.zip"
            zip_local = f"/tmp/{zip_name}"

            with zipfile.ZipFile(zip_local, "w", zipfile.ZIP_DEFLATED) as z:
                for path in file_paths:
                    if os.path.exists(path):
                        z.write(path, arcname=os.path.basename(path))

            storage_path = f"{job['user_id']}/{job_id}/final.zip"
            with open(zip_local, "rb") as f:
                supabase.storage.from_("exports").upload(storage_path, f)

            zip_url = supabase.storage.from_("exports").get_public_url(storage_path)

            supabase.table("jobs").update({
                "status": "done",
                "zip_url": zip_url,
                "finished_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", job_id).execute()

            print(f"📦 ZIP generated and uploaded: {zip_url}")

        else:
            supabase.table("jobs").update({"status": "preview_done"}).eq("id", job_id).execute()

        print(f"✅ Job {job_id} finished")

    except Exception as e:
        print(f"❌ Job {job_id} failed: {e}")

        supabase.table("jobs").update({
            "status": "error",
            "error": str(e)
        }).eq("id", job_id).execute()

        raise

import uuid
import os
import zipfile
import requests
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

from backend.supabase_client import supabase
from backend.render_engine import process_print_job


def process_render(job_id: str, preview: bool = False):
    print(f"▶️ Starting render for job {job_id}, preview={preview}")

    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute().data
    if not job:
        raise Exception(f"Job {job_id} not found")

    expected_status = "preview" if preview else "queued"
    if job["status"] != expected_status:
        print(f"⚠️ Job {job_id} status is {job['status']}, expected {expected_status}. Skipping.")
        return

    payload = job.get("payload") or {}
    pieces = payload.get("pieces") or []

    if not pieces:
        raise Exception(f"Job {job_id} has no pieces")

    print(f"📦 Job {job_id} has {len(pieces)} pieces")

    # Limpeza preventiva
    q = supabase.table("print_files").delete().eq("job_id", job_id)
    if preview:
        q = q.eq("preview", True)
    q.execute()

    supabase.table("jobs").update({
        "status": "processing_preview" if preview else "processing"
    }).eq("id", job_id).execute()

    try:
        result_files = process_print_job(job_id, pieces, preview=preview)

        if not isinstance(result_files, list):
            raise Exception("process_print_job did not return a list")

        rows = []
        file_paths = []
        file_urls = []

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

            rows.append({
                "id": str(uuid.uuid4()),
                "job_id": job_id,
                "file_path": file_path,
                "public_url": public_url,
                "page_index": page_index,
                "preview": preview,
            })

            if file_path:
                file_paths.append(file_path)
            if public_url:
                file_urls.append(public_url)

        if rows:
            supabase.table("print_files").insert(rows).execute()

        sheets = len(result_files)

        new_payload = dict(payload)
        new_payload["sheets"] = sheets

        supabase.table("jobs").update({
            "payload": new_payload
        }).eq("id", job_id).execute()

        if not preview:
            zip_name = "PVTYARQUIVOS.zip"
            zip_local = f"/tmp/{zip_name}"

            def download(args):
                i, url = args
                r = requests.get(url, timeout=20)
                r.raise_for_status()
                tmp = f"/tmp/PVTY_PAGE_{i+1}.png"
                with open(tmp, "wb") as f:
                    f.write(r.content)
                return tmp

            with zipfile.ZipFile(zip_local, "w", zipfile.ZIP_DEFLATED) as z:
                if file_paths:
                    for i, path in enumerate(file_paths):
                        if os.path.exists(path):
                            z.write(path, arcname=f"PVTY_PAGE_{i+1}.png")
                else:
                    with ThreadPoolExecutor(max_workers=4) as ex:
                        downloaded = list(ex.map(download, enumerate(file_urls)))

                    for i, tmp in enumerate(downloaded):
                        if tmp and os.path.exists(tmp):
                            z.write(tmp, arcname=f"PVTY_PAGE_{i+1}.png")

            storage_path = f"{job['user_id']}/{job_id}/{zip_name}"
            with open(zip_local, "rb") as f:
                supabase.storage.from_("exports").upload(storage_path, f, {"upsert": "true"})

            zip_url = supabase.storage.from_("exports").get_public_url(storage_path)

            supabase.table("jobs").update({
                "status": "done",
                "zip_url": zip_url,
                "finished_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", job_id).execute()

            print(f"📦 ZIP generated and uploaded: {zip_url}")

        else:
            supabase.table("jobs").update({"status": "preview_done"}).eq("id", job_id).execute()

        print(f"✅ Job {job_id} finished with {sheets} sheets")

    except Exception as e:
        print(f"❌ Job {job_id} failed: {e}")

        supabase.table("jobs").update({
            "status": "error",
            "error": str(e)
        }).eq("id", job_id).execute()

        raise

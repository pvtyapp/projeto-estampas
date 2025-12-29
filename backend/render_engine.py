import io
import uuid
from PIL import Image
from supabase_client import supabase

# ---------- PRINT CONFIG ----------
SHEET_WIDTH_CM = 57
SHEET_HEIGHT_CM = 100
DPI = 300
SPACING_CM = 0.02
PX_PER_CM = DPI / 2.54

SHEET_WIDTH_PX = int(SHEET_WIDTH_CM * PX_PER_CM)
SHEET_HEIGHT_PX = int(SHEET_HEIGHT_CM * PX_PER_CM)
SPACING_PX = int(SPACING_CM * PX_PER_CM)

def cm_to_px(cm: float) -> int:
    return int(cm * PX_PER_CM)

def trim_transparent(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img

def process_print_job(job_payload: dict):
    sheets = job_payload["sheets"]
    urls = []

    for sheet in sheets:
        img = Image.new("RGBA", (SHEET_WIDTH_PX, SHEET_HEIGHT_PX), (0, 0, 0, 0))

        for item in sheet["items"]:
            file_res = supabase.table("print_files") \
                .select("*") \
                .eq("print_id", item["id"]) \
                .eq("type", item["type"]) \
                .single() \
                .execute()

            if not file_res.data:
                continue

            data = supabase.storage.from_("prints-library").download(file_res.data["file_path"])
            art = Image.open(io.BytesIO(data)).convert("RGBA")
            art = trim_transparent(art)
            art = art.resize((item["w"], item["h"]), Image.BICUBIC)

            img.alpha_composite(art, dest=(item["x"], item["y"]))

        buffer = io.BytesIO()
        img.save(buffer, "PNG")
        buffer.seek(0)

        filename = f"jobs/{uuid.uuid4()}.png"
        supabase.storage.from_("jobs-output").upload(filename, buffer.getvalue(), {"content-type": "image/png"})

        public_url = supabase.storage.from_("jobs-output").get_public_url(filename)
        urls.append(public_url)

    return urls

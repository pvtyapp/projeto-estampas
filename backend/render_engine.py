import io
import uuid
from PIL import Image
from supabase_client import supabase

# ---------- CONFIG ----------
SHEET_WIDTH_CM = 57
SHEET_HEIGHT_CM = 100
DPI = 300
SPACING_CM = 0.02
PX_PER_CM = DPI / 2.54

MAX_CM = 200

SHEET_WIDTH_PX = int(SHEET_WIDTH_CM * PX_PER_CM)
SHEET_HEIGHT_PX = int(SHEET_HEIGHT_CM * PX_PER_CM)
SPACING_PX = int(SPACING_CM * PX_PER_CM)

def cm_to_px(cm: float) -> int:
    return int(cm * PX_PER_CM)

def trim_transparent(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img

def pack_items(items):
    sheets = []
    current = []
    x, y, row_height = 0, 0, 0

    for item in items:
        w = item["w"]
        h = item["h"]

        if x + w > SHEET_WIDTH_PX:
            x = 0
            y += row_height + SPACING_PX
            row_height = 0

        if y + h > SHEET_HEIGHT_PX:
            sheets.append(current)
            current = []
            x, y, row_height = 0, 0, 0

        current.append({**item, "x": x, "y": y})
        x += w + SPACING_PX
        row_height = max(row_height, h)

    if current:
        sheets.append(current)

    return sheets

def process_print_job(job_payload: dict):
    urls = []

    raw_items = job_payload.get("items", [])
    items = []

    for item in raw_items:
        if item["width_cm"] > MAX_CM or item["height_cm"] > MAX_CM:
            raise ValueError("Dimensão excede limite máximo")

        items.extend([
            {
                "id": item["print_id"],
                "type": "front",
                "w": cm_to_px(item["width_cm"]),
                "h": cm_to_px(item["height_cm"])
            }
        ] * item["qty"])

    sheets = pack_items(items)

    for sheet in sheets:
        try:
            img = Image.new("RGBA", (SHEET_WIDTH_PX, SHEET_HEIGHT_PX), (0, 0, 0, 0))

            for item in sheet:
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
                art = art.resize((item["w"], item["h"]), Image.LANCZOS)

                img.alpha_composite(art, dest=(item["x"], item["y"]))
                art.close()

            buffer = io.BytesIO()
            img.save(buffer, "PNG")
            buffer.seek(0)

            filename = f"jobs/{uuid.uuid4()}.png"
            supabase.storage.from_("jobs-output").upload(filename, buffer.getvalue(), {"content-type": "image/png"})
            urls.append(supabase.storage.from_("jobs-output").get_public_url(filename))

            img.close()

        except Exception as e:
            print("Erro ao renderizar folha:", e)
            continue

    return urls

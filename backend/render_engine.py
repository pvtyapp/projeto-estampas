import io
import threading
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from backend.print_utils import load_print_image, cm_to_px
from backend.print_config import SHEET_WIDTH_CM, SHEET_HEIGHT_CM, SPACING_PX
from backend.supabase_client import supabase

# =========================
# CACHE GLOBAL DE IMAGENS
# =========================

_IMAGE_CACHE: dict[str, Image.Image] = {}
_CACHE_LOCK = threading.Lock()


class Shelf:
    def __init__(self, y):
        self.y = y
        self.height = 0
        self.used_width = 0


class Sheet:
    def __init__(self):
        self.shelves = []
        self.used_height = 0
        self.items = []


def trim_transparency(img: Image.Image) -> Image.Image:
    bg = Image.new(img.mode, img.size, (0, 0, 0, 0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    return img.crop(bbox) if bbox else img


def resize_to_slot(img: Image.Image, w: int, h: int) -> Image.Image:
    return img.resize((w, h), Image.LANCZOS)


def apply_watermark(img: Image.Image, text: str = "PRÉVIA • PVTY") -> Image.Image:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    w, h = img.size
    step = 260

    for y in range(0, h, step):
        for x in range(0, w, step):
            draw.text((x, y), text, fill=(0, 0, 0, 30))

    text_w, text_h = draw.textbbox((0, 0), text)[2:]
    draw.text(((w - text_w) / 2, (h - text_h) / 2), text, fill=(0, 0, 0, 80))

    img = Image.alpha_composite(img, overlay)
    img = img.filter(ImageFilter.GaussianBlur(radius=1.0))
    return img


def pack_items(raw_items, sheet_width, sheet_height):
    items = [{**i} for i in raw_items]
    items = sorted(items, key=lambda i: max(i["w"], i["h"]), reverse=True)

    sheets = [Sheet()]

    for item in items:
        placed = False

        for sheet in sheets:
            for shelf in sheet.shelves:
                for w, h, rotated in [(item["w"], item["h"], False), (item["h"], item["w"], True)]:
                    if shelf.used_width + w + SPACING_PX <= sheet_width and shelf.y + h + SPACING_PX <= sheet_height:
                        item.update({"x": shelf.used_width, "y": shelf.y, "rotated": rotated})
                        shelf.used_width += w + SPACING_PX
                        shelf.height = max(shelf.height, h + SPACING_PX)
                        sheet.items.append(item)
                        placed = True
                        break
                if placed:
                    break
            if placed:
                break

            for w, h, rotated in [(item["w"], item["h"], False), (item["h"], item["w"], True)]:
                if sheet.used_height + h + SPACING_PX <= sheet_height:
                    shelf = Shelf(sheet.used_height)
                    shelf.used_width = w + SPACING_PX
                    shelf.height = h + SPACING_PX
                    item.update({"x": 0, "y": shelf.y, "rotated": rotated})
                    sheet.shelves.append(shelf)
                    sheet.used_height += shelf.height
                    sheet.items.append(item)
                    placed = True
                    break

            if placed:
                break

        if not placed:
            sheet = Sheet()
            for w, h, rotated in [(item["w"], item["h"], False), (item["h"], item["w"], True)]:
                if h + SPACING_PX <= sheet_height:
                    shelf = Shelf(0)
                    shelf.used_width = w + SPACING_PX
                    shelf.height = h + SPACING_PX
                    item.update({"x": 0, "y": 0, "rotated": rotated})
                    sheet.shelves.append(shelf)
                    sheet.used_height = shelf.height
                    sheet.items.append(item)
                    sheets.append(sheet)
                    placed = True
                    break

        if not placed:
            raise ValueError(f"Item maior que a folha: {item}")

    return sheets


def _load_cached_image(url: str) -> Image.Image:
    with _CACHE_LOCK:
        if url in _IMAGE_CACHE:
            return _IMAGE_CACHE[url].copy()

    img = load_print_image(url)

    with _CACHE_LOCK:
        _IMAGE_CACHE[url] = img

    return img.copy()


def process_print_job(job_id: str, pieces: list[dict], preview: bool = False):
    items = []

    for p in pieces:
        w = cm_to_px(p["width"])
        h = cm_to_px(p["height"])

        slot = (
            supabase.table("print_slots")
            .select("url")
            .eq("print_id", p["print_id"])
            .eq("type", p["type"])
            .single()
            .execute()
            .data
        )

        if not slot or not slot.get("url"):
            raise ValueError(f"Slot sem imagem: {p['print_id']} / {p['type']}")

        items.append({
            "print_url": slot["url"],
            "w": w,
            "h": h
        })

    sheet_w = cm_to_px(SHEET_WIDTH_CM)
    sheet_h = cm_to_px(SHEET_HEIGHT_CM)

    sheets = pack_items(items, sheet_w, sheet_h)

    unique_urls = list({i["print_url"] for i in items})

    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(_load_cached_image, unique_urls))

    def render_sheet(args):
        idx, sheet = args
        img = Image.new("RGBA", (sheet_w, sheet_h), (255, 255, 255, 0))

        for item in sheet.items:
            art = _load_cached_image(item["print_url"])
            art = trim_transparency(art)
            art = resize_to_slot(art, item["w"], item["h"])
            if item.get("rotated"):
                art = art.rotate(90, expand=True)
            img.alpha_composite(art, dest=(item["x"], item["y"]))

        if preview:
            img = apply_watermark(img)

        filename = f"jobs/{job_id}/{ 'preview' if preview else 'final' }/{idx}.png"

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        supabase.storage.from_("jobs-output").upload(
            filename,
            buffer.read(),
            {"content-type": "image/png", "upsert": "true"}
        )

        return supabase.storage.from_("jobs-output").get_public_url(filename)

    with ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(render_sheet, enumerate(sheets)))

    return results

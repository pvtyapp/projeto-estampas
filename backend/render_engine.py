import uuid
import io
from PIL import Image
from backend.print_utils import load_print_image, cm_to_px
from backend.print_config import SHEET_WIDTH_CM, SHEET_HEIGHT_CM, SPACING_PX
from backend.supabase_client import supabase


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


def pack_items(items, sheet_width, sheet_height):
    items = sorted(items, key=lambda i: max(i["w"], i["h"]), reverse=True)
    sheets = [Sheet()]

    for item in items:
        placed = False

        for sheet in sheets:
            for shelf in sheet.shelves:
                for w, h, rotated in [
                    (item["w"], item["h"], False),
                    (item["h"], item["w"], True),
                ]:
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

            for w, h, rotated in [
                (item["w"], item["h"], False),
                (item["h"], item["w"], True),
            ]:
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
            for w, h, rotated in [
                (item["w"], item["h"], False),
                (item["h"], item["w"], True),
            ]:
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


def process_print_job(payload):
    items = []

    for it in payload["items"]:
        w = cm_to_px(it["width_cm"])
        h = cm_to_px(it["height_cm"])

        # buscar URL real do print
        print_row = supabase.table("print_files").select("public_url").eq("print_id", it["print_id"]).eq("type", "front").single().execute().data
        if not print_row:
            raise ValueError(f"Arquivo não encontrado para print {it['print_id']}")

        for _ in range(it["qty"]):
            items.append({
                "print_url": print_row["public_url"],
                "w": w,
                "h": h,
            })

    sheet_w = cm_to_px(SHEET_WIDTH_CM)
    sheet_h = cm_to_px(SHEET_HEIGHT_CM)

    sheets = pack_items(items, sheet_w, sheet_h)
    results = []

    for sheet in sheets:
        img = Image.new("RGBA", (sheet_w, sheet_h), (255, 255, 255, 0))

        for item in sheet.items:
            art = load_print_image(item["print_url"])

            if item["rotated"]:
                art = art.rotate(90, expand=True)

            img.alpha_composite(art, dest=(item["x"], item["y"]))

        filename = f"jobs/{uuid.uuid4()}.png"
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        supabase.storage.from_("jobs-output").upload(
            filename,
            buffer.read(),
            {"content-type": "image/png"}
        )

        results.append(supabase.storage.from_("jobs-output").get_public_url(filename))

    return results

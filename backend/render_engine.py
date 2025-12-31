import uuid
import math
from PIL import Image
from backend.print_utils import load_print_image
from backend.supabase_client import supabase

DPI = 300
CM_TO_IN = 1 / 2.54

SHEET_WIDTH_CM = 57
SHEET_HEIGHT_CM = 100


def cm_to_px(cm: float) -> int:
    return int(cm * CM_TO_IN * DPI)


class Shelf:
    def __init__(self, y):
        self.y = y
        self.height = 0
        self.used_width = 0


class Sheet:
    def __init__(self):
        self.shelves = []
        self.used_height = 0


def pack_items(items, sheet_width, sheet_height):
    # ordena por maior lado (desc)
    items = sorted(items, key=lambda i: max(i["w"], i["h"]), reverse=True)

    sheets = [Sheet()]

    for item in items:
        placed = False

        for sheet in sheets:
            for shelf in sheet.shelves:
                for w, h in [(item["w"], item["h"]), (item["h"], item["w"])]:
                    if shelf.used_width + w <= sheet_width and shelf.y + h <= sheet_height:
                        item["x"] = shelf.used_width
                        item["y"] = shelf.y
                        item["rotated"] = (w != item["w"])
                        shelf.used_width += w
                        shelf.height = max(shelf.height, h)
                        placed = True
                        break
                if placed:
                    break
            if placed:
                break

            # tenta nova shelf nessa sheet
            for w, h in [(item["w"], item["h"]), (item["h"], item["w"])]:
                if sheet.used_height + h <= sheet_height:
                    shelf = Shelf(sheet.used_height)
                    shelf.used_width = w
                    shelf.height = h
                    item["x"] = 0
                    item["y"] = shelf.y
                    item["rotated"] = (w != item["w"])
                    sheet.shelves.append(shelf)
                    sheet.used_height += shelf.height
                    placed = True
                    break

            if placed:
                break

        if not placed:
            # cria nova folha
            sheet = Sheet()
            for w, h in [(item["w"], item["h"]), (item["h"], item["w"])]:
                if h <= sheet_height:
                    shelf = Shelf(0)
                    shelf.used_width = w
                    shelf.height = h
                    item["x"] = 0
                    item["y"] = 0
                    item["rotated"] = (w != item["w"])
                    sheet.shelves.append(shelf)
                    sheet.used_height = shelf.height
                    sheets.append(sheet)
                    placed = True
                    break

        if not placed:
            raise ValueError(f"Item maior que a folha: {item}")

    return sheets, items


def process_print_job(payload):
    # converte items em px
    items = []
    for it in payload["items"]:
        w = cm_to_px(it["width_cm"])
        h = cm_to_px(it["height_cm"])
        for _ in range(it["qty"]):
            items.append({
                "print_id": it["print_id"],
                "w": w,
                "h": h
            })

    sheet_w = cm_to_px(SHEET_WIDTH_CM)
    sheet_h = cm_to_px(SHEET_HEIGHT_CM)

    sheets, packed_items = pack_items(items, sheet_w, sheet_h)

    results = []

    for sheet_index, sheet in enumerate(sheets):
        img = Image.new("RGBA", (sheet_w, sheet_h), (255, 255, 255, 0))

        for item in packed_items:
            if item.get("placed"):
                continue

            if "x" not in item:
                continue

            x, y = item["x"], item["y"]

            if y >= sheet_h:
                continue

            art = load_print_image(item["print_id"])

            if item.get("rotated"):
                art = art.rotate(90, expand=True)

            img.alpha_composite(art, dest=(x, y))
            item["placed"] = True

        filename = f"jobs/{uuid.uuid4()}.png"
        buffer = Image.new("RGBA", img.size)
        buffer.paste(img)

        # salva no storage
        supabase.storage.from_("jobs-output").upload(
            filename,
            buffer.tobytes(),
            {"content-type": "image/png"}
        )

        public_url = supabase.storage.from_("jobs-output").get_public_url(filename)
        results.append(public_url)

    return results

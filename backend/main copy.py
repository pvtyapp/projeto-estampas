import os, uuid, tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from uuid import UUID
from dotenv import load_dotenv
from supabase import create_client
from PIL import Image, ImageDraw
import io


# ---------- CONFIG ----------
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------- PRINT CONFIG ----------
SHEET_WIDTH_CM = 57
SHEET_HEIGHT_CM = 100
DPI = 300
SPACING_CM = 0.02  # 0.2mm
PX_PER_CM = DPI / 2.54

SHEET_WIDTH_PX = int(SHEET_WIDTH_CM * PX_PER_CM)
SHEET_HEIGHT_PX = int(SHEET_HEIGHT_CM * PX_PER_CM)
SPACING_PX = int(SPACING_CM * PX_PER_CM)

# ---------- HELPERS ----------
def cm_to_px(cm: float) -> int:
    return int(cm * PX_PER_CM)

def can_place(x, y, w, h, occupied):
    for ox, oy, ow, oh in occupied:
        if not (x + w <= ox or x >= ox + ow or y + h <= oy or y >= oy + oh):
            return False
    return True

# ---------- FASTAPI ----------
app = FastAPI(title="Projeto Estampas API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# ---------- MODELS ----------
class PrintCreate(BaseModel):
    name: str
    sku: str
    width_cm: int
    height_cm: int
    is_composite: bool = False

class PrintJobItem(BaseModel):
    print_id: UUID
    qty: int

class PrintJobRequest(BaseModel):
    items: List[PrintJobItem]

# ---------- BASIC ROUTES ----------
@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/prints")
def list_prints():
    return supabase.table("prints").select("*").order("created_at", desc=True).execute().data

@app.post("/prints")
def create_print(payload: PrintCreate):
    data = payload.dict()
    data["id"] = str(uuid.uuid4())
    return supabase.table("prints").insert(data).execute().data[0]

@app.post("/prints/{print_id}/upload")
async def upload_print_file(print_id: str, file: UploadFile = File(...)):
    content = await file.read()
    filename = f"{print_id}/{uuid.uuid4()}-{file.filename}"

    storage = supabase.storage.from_("prints-library")
    upload = storage.upload(filename, content, {"content-type": file.content_type})

    if hasattr(upload, "error") and upload.error:
        raise HTTPException(status_code=500, detail=str(upload.error))

    public_url = storage.get_public_url(filename)

    supabase.table("print_files").insert({
        "print_id": print_id,
        "file_path": filename,
        "public_url": public_url
    }).execute()

    return {"status": "ok", "file": public_url}

@app.get("/prints/{print_id}/files")
def list_print_files(print_id: str):
    return supabase.table("print_files").select("*").eq("print_id", print_id).execute().data

# ---------- EXPANSION ----------
def expand_items(items: List[PrintJobItem]):
    expanded = []

    for item in items:
        res = supabase.table("prints").select("*").eq("id", str(item.print_id)).limit(1).execute()

        if not res.data:
            raise HTTPException(400, f"Print {item.print_id} não existe")

        p = res.data[0]

        for _ in range(item.qty):
            expanded.append({
                **p,
                "width_cm": item.width_cm,
                "height_cm": item.height_cm
            })

    return expanded


# ---------- BIN PACKING ----------
def pack_into_sheets(items):
    sheets = []
    items = sorted(items, key=lambda x: x["width_cm"] * x["height_cm"], reverse=True)

    for item in items:
        w = cm_to_px(item["width_cm"])
        h = cm_to_px(item["height_cm"])

        if w > SHEET_WIDTH_PX or h > SHEET_HEIGHT_PX:
            raise HTTPException(400, f"Item {item['sku']} maior que a folha")

        placed = False

        for sheet in sheets:
            for rotate in [False, True]:
                pw, ph = (h, w) if rotate else (w, h)

                for y in range(0, SHEET_HEIGHT_PX - ph, SPACING_PX + 1):
                    for x in range(0, SHEET_WIDTH_PX - pw, SPACING_PX + 1):
                        if can_place(x, y, pw + SPACING_PX, ph + SPACING_PX, sheet["occupied"]):
                            sheet["items"].append({**item, "x": x, "y": y, "w": pw, "h": ph})
                            sheet["occupied"].append((x, y, pw + SPACING_PX, ph + SPACING_PX))
                            placed = True
                            break
                    if placed: break
                if placed: break
            if placed: break

        if not placed:
            new_sheet = {"items": [], "occupied": []}
            new_sheet["items"].append({**item, "x": 0, "y": 0, "w": w, "h": h})
            new_sheet["occupied"].append((0, 0, w + SPACING_PX, h + SPACING_PX))
            sheets.append(new_sheet)

    return sheets

# ---------- RENDER ----------
def render_sheet(sheet):
    img = Image.new("RGBA", (SHEET_WIDTH_PX, SHEET_HEIGHT_PX), (0, 0, 0, 0))

    for item in sheet["items"]:
        file_res = supabase.table("print_files") \
            .select("*") \
            .eq("print_id", item["id"]) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        if not file_res.data:
            continue

        file = file_res.data[0]
        file_path = file["file_path"]

        data = supabase.storage.from_("prints-library").download(file_path)
        art = Image.open(io.BytesIO(data)).convert("RGBA")

        art = art.resize((item["w"], item["h"]), Image.LANCZOS)

        img.alpha_composite(art, dest=(item["x"], item["y"]))

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    img.save(tmp.name, "PNG")
    return tmp.name



# ---------- PRINT JOB ----------

class PrintJobItem(BaseModel):
    print_id: UUID
    qty: int
    width_cm: float
    height_cm: float

class PrintJobRequest(BaseModel):
    items: List[PrintJobItem]


def expand_items(items: List[PrintJobItem]):
    expanded = []

    for item in items:
        res = supabase.table("prints").select("*").eq("id", str(item.print_id)).limit(1).execute()

        if not res.data:
            raise HTTPException(400, f"Print {item.print_id} não existe")

        p = res.data[0]

        for _ in range(item.qty):
            expanded.append({
                **p,
                "width_cm": item.width_cm,
                "height_cm": item.height_cm
            })

    return expanded


def pack_into_sheets(items):
    sheets = []
    items = sorted(items, key=lambda x: x["width_cm"] * x["height_cm"], reverse=True)

    for item in items:
        w = cm_to_px(item["width_cm"])
        h = cm_to_px(item["height_cm"])

        if w > SHEET_WIDTH_PX or h > SHEET_HEIGHT_PX:
            raise HTTPException(400, f"Item {item['sku']} maior que a folha")

        placed = False

        for sheet in sheets:
            for rotate in [False, True]:
                pw, ph = (h, w) if rotate else (w, h)

                for y in range(0, SHEET_HEIGHT_PX - ph, SPACING_PX + 1):
                    for x in range(0, SHEET_WIDTH_PX - pw, SPACING_PX + 1):
                        if can_place(x, y, pw, ph, sheet["occupied"]):
                            sheet["items"].append({**item, "x": x, "y": y, "w": pw, "h": ph})
                            sheet["occupied"].append((x, y, pw, ph))
                            placed = True
                            break
                    if placed: break
                if placed: break
            if placed: break

        if not placed:
            new_sheet = {"items": [], "occupied": []}
            new_sheet["items"].append({**item, "x": 0, "y": 0, "w": w, "h": h})
            new_sheet["occupied"].append((0, 0, w, h))
            sheets.append(new_sheet)

    return sheets


def render_sheet(sheet):
    img = Image.new("RGBA", (SHEET_WIDTH_PX, SHEET_HEIGHT_PX), (0, 0, 0, 0))

    for item in sheet["items"]:
        file_res = supabase.table("print_files") \
            .select("*") \
            .eq("print_id", item["id"]) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        if not file_res.data:
            continue

        file = file_res.data[0]
        file_path = file["file_path"]

        data = supabase.storage.from_("prints-library").download(file_path)
        art = Image.open(io.BytesIO(data)).convert("RGBA")

        # força ocupar exatamente o tamanho definido no front
        art = art.resize((item["w"], item["h"]), Image.BICUBIC)

        img.alpha_composite(art, dest=(item["x"], item["y"]))

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    img.save(tmp.name, "PNG")
    return tmp.name


@app.post("/print-jobs")
def create_print_job(payload: PrintJobRequest):
    expanded = expand_items(payload.items)
    sheets = pack_into_sheets(expanded)

    urls = []

    for sheet in sheets:
        path = render_sheet(sheet)
        filename = f"jobs/{uuid.uuid4()}.png"

        with open(path, "rb") as f:
            supabase.storage.from_("print-sheets").upload(filename, f.read(), {"content-type": "image/png"})

        urls.append(supabase.storage.from_("print-sheets").get_public_url(filename))

    return {
        "total_items": len(expanded),
        "total_sheets": len(sheets),
        "urls": urls
    }



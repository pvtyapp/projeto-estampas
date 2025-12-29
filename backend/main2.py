from fastapi import UploadFile, File
import uuid


from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import logging

from supabase_client import get_supabase

# -------------------------------------------------
# CONFIG BASICA
# -------------------------------------------------

app = FastAPI(
    title="Projeto Estampas API",
    description="API para gerenciamento e geração de estampas",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)

# -------------------------------------------------
# MODELOS (SCHEMAS)
# -------------------------------------------------

class PrintOut(BaseModel):
    id: str
    name: str
    sku: str
    width_cm: int
    height_cm: int
    is_composite: bool
    created_at: Optional[str]

class PrintCreate(BaseModel):
    name: str
    sku: str
    width_cm: int
    height_cm: int
    is_composite: bool = False

# -------------------------------------------------
# HEALTH CHECK
# -------------------------------------------------

@app.get("/")
def health():
    return {"status": "ok", "message": "API rodando corretamente"}

# -------------------------------------------------
# LISTAR ESTAMPAS (BIBLIOTECA)
# -------------------------------------------------

@app.get("/prints", response_model=List[PrintOut])
def list_prints():
    try:
        supabase = get_supabase()
        response = (
            supabase
            .table("prints")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []
    except Exception as e:
        logging.exception("Erro ao listar estampas")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------
# BUSCAR ESTAMPA POR ID
# -------------------------------------------------

@app.get("/prints/{print_id}", response_model=PrintOut)
def get_print(print_id: str):
    try:
        supabase = get_supabase()
        response = (
            supabase
            .table("prints")
            .select("*")
            .eq("id", print_id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="Estampa não encontrada")

        return response.data
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Erro ao buscar estampa")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------
# CRIAR ESTAMPA (METADADOS)
# -------------------------------------------------

@app.post("/prints", response_model=PrintOut)
def create_print(payload: PrintCreate):
    try:
        supabase = get_supabase()

        response = (
            supabase
            .table("prints")
            .insert(payload.model_dump())
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=400, detail="Falha ao criar estampa")

        return response.data[0]

    except Exception as e:
        logging.exception("Erro ao criar estampa")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/prints/{print_id}/upload")
def upload_print_image(
    print_id: str,
    file: UploadFile = File(...)
):
    try:
        supabase = get_supabase()

        # valida tipo
        if file.content_type not in ["image/png", "image/jpeg", "image/jpg"]:
            raise HTTPException(status_code=400, detail="Formato de imagem inválido")

        # gera nome seguro
        file_ext = file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = f"{print_id}/{file_name}"

        file_bytes = file.file.read()

        # upload no bucket
        supabase.storage.from_("prints-library").upload(
            path=file_path,
            file=file_bytes,
            file_options={
                "content-type": file.content_type,
                "upsert": "true"
            }
        )

        # url publica
        public_url = (
            supabase
            .storage
            .from_("prints-library")
            .get_public_url(file_path)
        )

        return {
            "success": True,
            "print_id": print_id,
            "file_path": file_path,
            "public_url": public_url
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

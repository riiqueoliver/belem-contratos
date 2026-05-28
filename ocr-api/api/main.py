"""Microserviço FastAPI para extração de notas fiscais via OCR.

Endpoints:
    GET  /health         → status do serviço (para healthcheck do Railway)
    POST /v1/extrair     → recebe arquivo (PDF/imagem), devolve JSON com as NFs

Variáveis de ambiente:
    CORS_ORIGINS       → lista separada por vírgula de origens permitidas
                          (default: localhost + belem-contratos.vercel.app)
    MAX_UPLOAD_MB      → tamanho máximo do upload em MB (default: 25)
    API_KEY            → se setada, exige header `X-API-Key` igual a esse valor
    OCR_BACKEND        → "tesseract" ou "ocrmac" (default: auto)
"""

from __future__ import annotations

import os
from typing import Optional

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from nota_fiscal_ocr import extract_all_from_bytes


# --------------------------------------------------------------------------- #
# Configuração
# --------------------------------------------------------------------------- #

DEFAULT_ORIGINS = (
    "http://localhost:5174,"
    "http://localhost:5173,"
    "http://localhost:3000,"
    "https://belem-contratos.vercel.app,"
    "https://belem-contratos.pages.dev"
)
CORS_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()
]
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
API_KEY = os.environ.get("API_KEY")


# --------------------------------------------------------------------------- #
# Modelos de resposta (Pydantic) — geram OpenAPI/Swagger automaticamente
# --------------------------------------------------------------------------- #

class NotaResponse(BaseModel):
    numero: Optional[str] = None
    valor: Optional[float] = None
    cliente: Optional[str] = None
    data_emissao: Optional[str] = None       # "DD/MM/YYYY"
    paginas: list[int] = []
    fonte: str                                # "pdf-text" | "pdf-ocr" | "image-ocr"


class ExtractResponse(BaseModel):
    arquivo: str
    total: int
    notas: list[NotaResponse]


class ErrorResponse(BaseModel):
    detail: str


# --------------------------------------------------------------------------- #
# App
# --------------------------------------------------------------------------- #

app = FastAPI(
    title="nota-fiscal-ocr API",
    version="0.1.1",
    description=(
        "Microserviço de extração de campos (número, valor, cliente, data) de "
        "NFS-e / NF-e a partir de PDF ou imagem. Aceita PDFs multi-documento "
        "e retorna em ordem cronológica + número."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,
)


# --------------------------------------------------------------------------- #
# Dependências
# --------------------------------------------------------------------------- #

def _check_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="API key inválida ou ausente.")


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@app.get("/health", tags=["meta"])
def health():
    """Healthcheck — usado pelo Railway."""
    return {"status": "ok", "service": "nota-fiscal-ocr", "version": app.version}


@app.post(
    "/v1/extrair",
    response_model=ExtractResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    tags=["extracao"],
    dependencies=[Depends(_check_api_key)],
)
async def extrair(arquivo: UploadFile = File(..., description="PDF ou imagem da NF.")):
    """Extrai número, valor, cliente e data de emissão de uma NF.

    Aceita múltiplas notas dentro do mesmo PDF (uma por página, com merge
    automático de continuações). Resposta em **ordem cronológica + número**.
    """
    if not arquivo.filename:
        raise HTTPException(status_code=400, detail="Arquivo sem nome.")

    # Lê com limite de tamanho.
    data = await arquivo.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo excede {MAX_UPLOAD_MB} MB (recebido: {len(data) / 1024 / 1024:.1f} MB).",
        )
    if not data:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    try:
        docs = extract_all_from_bytes(data, arquivo.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        # Backend de OCR indisponível.
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {exc}")

    notas = [
        NotaResponse(
            numero=nf.numero,
            valor=nf.valor,
            cliente=nf.cliente,
            data_emissao=nf.data_emissao,
            paginas=list(nf.paginas or []),
            fonte=nf.fonte,
        )
        for nf in docs
    ]
    return ExtractResponse(arquivo=arquivo.filename, total=len(notas), notas=notas)

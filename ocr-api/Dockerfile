# Imagem do microserviço FastAPI do nota-fiscal-ocr.
# Dois estágios: builder (instala deps) + runtime (slim).

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    OCR_BACKEND=tesseract

# Dependências de sistema para OCR em Linux:
#   - tesseract-ocr      : motor de OCR
#   - tesseract-ocr-por  : pacote de idioma português
#   - poppler-utils      : usado como fallback do pdf2image (PyMuPDF já é wheel)
#   - libgl1, libglib2.0-0 : libs nativas exigidas por algumas wheels
# Limpa o apt-cache no mesmo RUN para não inchar a imagem.
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-por \
        poppler-utils \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala o próprio pacote (a partir do pyproject.toml) e as deps da API.
# Copia o mínimo necessário primeiro para maximizar cache do Docker.
COPY pyproject.toml README.md LICENSE ./
COPY nota_fiscal_ocr/ ./nota_fiscal_ocr/
COPY api/requirements.txt ./api/requirements.txt

RUN pip install ".[tesseract]" \
    && pip install -r api/requirements.txt

COPY api/ ./api/

EXPOSE 8000

# Railway injeta $PORT; usamos 8000 como fallback local.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]

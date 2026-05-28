"""Extração de campos de NFS-e / NF-e a partir de imagens ou PDFs.

Estratégia:
1. PDF → tenta extrair texto vetorial com pdfplumber (rápido e confiável).
   Se vier vazio (PDF escaneado), renderiza as páginas e roda OCR.
2. Imagem → OCR direto.
3. Backends de OCR suportados (escolhidos automaticamente):
   - **ocrmac** (Apple Vision) — preferido no macOS, sem dependência de sistema.
   - **pytesseract** — fallback, exige Tesseract instalado (com pacote `por`).
4. Renderização de PDF: PyMuPDF (preferido, pure-wheel) → pdf2image (fallback).
5. Texto extraído é normalizado e passado pelos regex de patterns.py.
"""

from __future__ import annotations

import io
import os
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

from PIL import Image, ImageFilter, ImageOps

from . import patterns


# --------------------------------------------------------------------------- #
# Detecção dos backends disponíveis
# --------------------------------------------------------------------------- #

_TESSERACT_CMD = os.environ.get("TESSERACT_CMD")
if _TESSERACT_CMD:
    try:
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = _TESSERACT_CMD
    except ImportError:
        pass


def _has_ocrmac() -> bool:
    if sys.platform != "darwin":
        return False
    try:
        import ocrmac  # noqa: F401
        return True
    except ImportError:
        return False


def _has_pytesseract() -> bool:
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


# `OCR_BACKEND` força um backend específico: "ocrmac" ou "tesseract".
_FORCED_BACKEND = os.environ.get("OCR_BACKEND", "").lower().strip() or None


@dataclass
class NotaFiscal:
    numero: Optional[str]
    valor: Optional[float]
    cliente: Optional[str]
    data_emissao: Optional[str]
    texto_bruto: str
    fonte: str  # "pdf-text" | "pdf-ocr" | "image-ocr"
    paginas: tuple[int, ...] = ()  # páginas do PDF original que compõem esta NF (1-based)

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("texto_bruto", None)
        d["paginas"] = list(d.get("paginas") or ())
        return d


# --------------------------------------------------------------------------- #
# OCR / extração de texto
# --------------------------------------------------------------------------- #

def _preprocess_for_ocr(img: Image.Image) -> Image.Image:
    """Aumenta a confiabilidade do tesseract em scans ruidosos."""
    img = img.convert("L")  # tons de cinza
    img = ImageOps.autocontrast(img)
    # Upscale leve quando o DPI é baixo.
    w, h = img.size
    if max(w, h) < 1600:
        scale = 1600 / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    img = img.filter(ImageFilter.SHARPEN)
    return img


def _ocr_with_ocrmac(img: Image.Image) -> str:
    """OCR usando o framework Vision do macOS via ocrmac.

    Em formulários complexos (como NFSe da Prefeitura) o Vision retorna cada
    label e cada valor como uma anotação separada — frequentemente com texto
    rotacionado 90°. Tentamos juntar palavras adjacentes da mesma linha
    física, mas mantemos cada "célula" do formulário em sua própria linha
    de saída para preservar a relação label↔valor.

    Heurística:
      - Ordena por (y desc, x asc) — origem no canto inferior esquerdo.
      - Duas anotações pertencem à mesma linha lógica se as caixas se
        sobrepõem verticalmente E o espaço horizontal entre elas é pequeno.
    """
    from ocrmac import ocrmac

    annotations = ocrmac.OCR(
        img,
        recognition_level="accurate",
        language_preference=["pt-BR", "en-US"],
    ).recognize()

    # Cada item: (texto, conf, (x, y, w, h)) em coordenadas normalizadas.
    items = sorted(
        annotations, key=lambda a: (-round(a[2][1], 3), round(a[2][0], 3))
    )

    lines: list[str] = []
    cur_text: list[str] = []
    cur_y: Optional[float] = None
    cur_h: Optional[float] = None
    cur_x_end: Optional[float] = None

    for txt, _conf, bbox in items:
        x, y, w, h = bbox
        x_end = x + w
        same_line = False
        if cur_y is not None:
            # Tolerância vertical proporcional à altura da caixa atual.
            v_tol = max(cur_h or 0, h) * 0.4
            if abs(y - cur_y) <= v_tol:
                # Mesma faixa de y: só junta se também forem horizontalmente
                # contíguas (gap pequeno em x).
                gap = x - (cur_x_end or 0)
                if -0.005 <= gap <= 0.02:
                    same_line = True

        if same_line:
            cur_text.append(txt)
            cur_x_end = x_end
        else:
            if cur_text:
                lines.append(" ".join(cur_text))
            cur_text = [txt]
            cur_y = y
            cur_h = h
            cur_x_end = x_end

    if cur_text:
        lines.append(" ".join(cur_text))

    return "\n".join(lines)


def _ocr_with_tesseract(img: Image.Image) -> str:
    import pytesseract
    processed = _preprocess_for_ocr(img)
    config = "--oem 3 --psm 6"  # psm 6 = "uniform block of text"
    try:
        return pytesseract.image_to_string(processed, lang="por", config=config)
    except pytesseract.TesseractError:
        return pytesseract.image_to_string(processed, config=config)


def _ocr_image(img: Image.Image) -> str:
    backend = _FORCED_BACKEND
    if backend is None:
        if _has_ocrmac():
            backend = "ocrmac"
        elif _has_pytesseract():
            backend = "tesseract"
        else:
            raise RuntimeError(
                "Nenhum backend de OCR disponível. Instale `ocrmac` (macOS) "
                "ou o Tesseract + `pytesseract`."
            )

    if backend == "ocrmac":
        return _ocr_with_ocrmac(img)
    if backend == "tesseract":
        return _ocr_with_tesseract(img)
    raise ValueError(f"OCR_BACKEND desconhecido: {backend!r}")


def _render_pdf_to_images(source) -> list[Image.Image]:
    """Renderiza as páginas do PDF em imagens PIL.

    Prefere PyMuPDF (pure-Python wheel). Faz fallback para pdf2image+poppler.
    `source` pode ser um caminho (str/Path) ou bytes.
    """
    # Tenta PyMuPDF primeiro.
    try:
        import fitz  # pymupdf

        if isinstance(source, (bytes, bytearray)):
            doc = fitz.open(stream=bytes(source), filetype="pdf")
        else:
            doc = fitz.open(str(source))

        images: list[Image.Image] = []
        # 300 DPI ≈ matriz 300/72 = 4.166. Usamos 3x (≈216 DPI) — equilíbrio
        # entre nitidez para OCR e tempo de processamento.
        zoom = fitz.Matrix(3, 3)
        for page in doc:
            pix = page.get_pixmap(matrix=zoom, alpha=False)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            images.append(img)
        doc.close()
        return images
    except ImportError:
        pass

    # Fallback: pdf2image (exige poppler instalado).
    if isinstance(source, (bytes, bytearray)):
        from pdf2image import convert_from_bytes
        return convert_from_bytes(bytes(source), dpi=300)
    from pdf2image import convert_from_path
    return convert_from_path(str(source), dpi=300)


def _extract_text_from_pdf(path: Path) -> tuple[str, str]:
    """Devolve (texto, fonte). Fonte = 'pdf-text' ou 'pdf-ocr'."""
    import pdfplumber

    texts: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            if t.strip():
                texts.append(t)

    if texts:
        return "\n".join(texts), "pdf-text"

    images = _render_pdf_to_images(path)
    ocr_texts = [_ocr_image(img) for img in images]
    return "\n".join(ocr_texts), "pdf-ocr"


def _extract_text_from_pdf_bytes(data: bytes) -> tuple[str, str]:
    import pdfplumber

    texts: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            if t.strip():
                texts.append(t)

    if texts:
        return "\n".join(texts), "pdf-text"

    images = _render_pdf_to_images(data)
    ocr_texts = [_ocr_image(img) for img in images]
    return "\n".join(ocr_texts), "pdf-ocr"


# --------------------------------------------------------------------------- #
# Extração página-a-página (múltiplos documentos por PDF)
# --------------------------------------------------------------------------- #

def _extract_pages_from_pdf(source) -> list[tuple[int, str, str]]:
    """Devolve [(num_pagina_1based, texto, fonte), ...] para cada página do PDF.

    `source` pode ser caminho (str/Path) ou bytes. Tenta pdfplumber por página
    (texto vetorial). Páginas sem texto vetorial caem no caminho de OCR.
    """
    import pdfplumber

    pages: list[tuple[int, str, str]] = []
    pdf_ctx = (
        pdfplumber.open(io.BytesIO(source))
        if isinstance(source, (bytes, bytearray))
        else pdfplumber.open(str(source))
    )
    needs_ocr: list[int] = []
    with pdf_ctx as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            t = page.extract_text() or ""
            if t.strip():
                pages.append((i, t, "pdf-text"))
            else:
                pages.append((i, "", "pdf-ocr"))
                needs_ocr.append(i)

    # Renderiza e roda OCR apenas nas páginas necessárias.
    if needs_ocr:
        images = _render_pdf_to_images(source)
        for idx in needs_ocr:
            img = images[idx - 1]
            text = _ocr_image(img)
            # Substitui no slot pré-alocado.
            for pos, (p, _, fonte) in enumerate(pages):
                if p == idx:
                    pages[pos] = (idx, text, fonte)
                    break
    return pages


def _number_sort_key(numero: Optional[str]) -> tuple:
    """Converte o número da NF em chave de ordenação numérica + lexicográfica.

    Notas sem número vão depois das que têm número. Notas com número
    puramente numérico (`"00098765"`) ordenam corretamente como inteiro;
    valores não-numéricos caem no segundo termo da tupla.
    """
    if not numero:
        return (1, 0, "")
    digits = "".join(c for c in numero if c.isdigit())
    if digits:
        return (0, int(digits), numero)
    return (0, 0, numero)


def _date_sort_key(nf: "NotaFiscal") -> tuple:
    """Ordenação: 1º data de emissão; 2º número da nota.

    Notas sem data ficam ao final. Dentro do mesmo dia, notas são ordenadas
    pelo número (interpretado como inteiro quando possível).
    """
    d = nf.data_emissao
    num_key = _number_sort_key(nf.numero)
    if d:
        try:
            dd, mm, yyyy = d.split("/")
            return (0, yyyy, mm, dd, num_key)
        except ValueError:
            pass
    return (1, "", "", "", num_key)


def _merge_continuation(prev: "NotaFiscal", page_text: str, page_num: int) -> "NotaFiscal":
    """Anexa texto de uma página-continuação à NF anterior e re-parseia."""
    merged_text = (prev.texto_bruto or "") + "\n" + page_text
    return _parse(
        merged_text,
        prev.fonte,
        paginas=tuple(list(prev.paginas) + [page_num]),
    )


def _group_pages_into_documents(
    pages: list[tuple[int, str, str]],
) -> list["NotaFiscal"]:
    """Agrupa páginas em documentos lógicos.

    Regra: cada página gera uma `NotaFiscal` candidata. Se ela não tem nem
    número nem data, é considerada continuação da NF anterior (e merge).
    Caso contrário, vira uma nova NF.
    """
    docs: list[NotaFiscal] = []
    for page_num, text, fonte in pages:
        nf_page = _parse(text, fonte, paginas=(page_num,))
        is_continuation = (
            docs
            and not nf_page.numero
            and not nf_page.data_emissao
        )
        if is_continuation:
            docs[-1] = _merge_continuation(docs[-1], text, page_num)
        else:
            docs.append(nf_page)
    return docs


# --------------------------------------------------------------------------- #
# API pública
# --------------------------------------------------------------------------- #

_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}


def extract(path: str | os.PathLike) -> NotaFiscal:
    """Extrai campos de uma única NF a partir de um arquivo.

    Compatibilidade: se o PDF contiver várias notas, retorna a primeira em
    ordem cronológica. Para obter todas, use :func:`extract_all`.
    """
    docs = extract_all(path)
    if not docs:
        raise ValueError("Nenhum documento detectado no arquivo.")
    return docs[0]


def extract_from_bytes(data: bytes, filename: str) -> NotaFiscal:
    docs = extract_all_from_bytes(data, filename)
    if not docs:
        raise ValueError("Nenhum documento detectado no arquivo.")
    return docs[0]


def extract_all(path: str | os.PathLike) -> list[NotaFiscal]:
    """Extrai TODAS as notas fiscais contidas no arquivo.

    - Para imagens, retorna uma lista de tamanho 1.
    - Para PDFs, cada página gera uma NF candidata. Páginas sem número/data
      são tratadas como continuação da NF anterior.
    - Resultado ordenado por **data de emissão** (cronológico ascendente),
      com NFs sem data ao final.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(p)

    ext = p.suffix.lower()
    if ext == ".pdf":
        pages = _extract_pages_from_pdf(p)
        docs = _group_pages_into_documents(pages)
    elif ext in _IMAGE_EXT:
        text = _ocr_image(Image.open(p))
        docs = [_parse(text, "image-ocr", paginas=(1,))]
    else:
        raise ValueError(f"Formato não suportado: {ext}")

    return sorted(docs, key=_date_sort_key)


def extract_all_from_bytes(data: bytes, filename: str) -> list[NotaFiscal]:
    """Versão `extract_all` para uploads em memória (Streamlit)."""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        pages = _extract_pages_from_pdf(data)
        docs = _group_pages_into_documents(pages)
    elif ext in _IMAGE_EXT:
        text = _ocr_image(Image.open(io.BytesIO(data)))
        docs = [_parse(text, "image-ocr", paginas=(1,))]
    else:
        raise ValueError(f"Formato não suportado: {ext}")

    return sorted(docs, key=_date_sort_key)


def _parse(text: str, fonte: str, paginas: tuple[int, ...] = ()) -> NotaFiscal:
    norm = patterns.normalize(text)
    return NotaFiscal(
        numero=patterns.find_invoice_number(norm),
        valor=patterns.find_amount(norm),
        cliente=patterns.find_client_name(norm, text),
        data_emissao=patterns.find_issue_date(norm),
        texto_bruto=text,
        fonte=fonte,
        paginas=paginas,
    )

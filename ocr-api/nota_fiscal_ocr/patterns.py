"""Regex e heurísticas para extrair campos de NFS-e e NF-e em português.

O texto de entrada é tratado em minúsculas e com espaços normalizados antes
da aplicação destes padrões — então todos os padrões usam minúsculas.
"""

import re
import unicodedata
from typing import Optional


# ---------- normalização ----------

_WS_RE = re.compile(r"[ \t]+")


def normalize(text: str) -> str:
    """Minúsculas, sem acento, espaços compactados — preserva quebras de linha."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = _WS_RE.sub(" ", text)
    return text


def lines(text: str) -> list[str]:
    return [ln.strip() for ln in text.splitlines() if ln.strip()]


# ---------- número da nota ----------

# Casa "numero da nota", "nº nf-e", "nfs-e n°", "nota fiscal numero", etc.
_NUMBER_LABEL = (
    r"(?:"
    r"numero\s+(?:da\s+)?(?:nota|nf-?e|nfs-?e)|"
    r"nota\s+fiscal\s+(?:numero|n[o°ºª\.]+)|"
    r"nf-?[se]?-?e?\s*n[o°ºª\.]+|"
    r"n[o°ºª]\s*(?:da\s+)?(?:nota|nf-?e|nfs-?e)|"
    r"numero"
    r")"
)
NUMBER_RE = re.compile(_NUMBER_LABEL + r"\s*[:.\-]?\s*([0-9][0-9\.\-/]{0,30})")


_NUMBER_LABEL_ONLY_RE = re.compile(
    r"^\s*(?:numero(?:\s*/\s*serie)?\s*(?:da\s+)?(?:nota|nf-?e|nfs-?e)?|"
    r"nota\s+fiscal\s+(?:numero|n[o°ºª\.]+))\s*$"
)
# Padrão "<numero> / <serie>" típico da NFSe (ex.: "470 / E"). Exige que a
# série comece com letra para não confundir com datas (`21/10/2025`).
_NUMBER_SERIE_RE = re.compile(r"(?<!\d)(\d{1,10})\s*/\s*([a-z][a-z0-9]{0,4})(?!\w)")
# Sequência de 4–14 dígitos isolada.
_DIGITS_RUN_RE = re.compile(r"(?<!\d)(\d{4,14})(?!\d)")


def find_invoice_number(text: str) -> Optional[str]:
    for m in NUMBER_RE.finditer(text):
        raw = m.group(1).strip(" .-/")
        digits = re.sub(r"\D", "", raw)
        # 1-20 dígitos: aceita números pequenos (NFs começam em 1).
        if 1 <= len(digits) <= 20:
            return raw

    # Fallback: label sozinho numa linha (layout em coluna).
    norm_lines = text.splitlines()
    for i, ln in enumerate(norm_lines):
        if not _NUMBER_LABEL_ONLY_RE.match(ln):
            continue
        # Primeiro tenta o padrão "<num> / <serie>" (NFSe).
        for j in range(i + 1, min(i + 5, len(norm_lines))):
            m = _NUMBER_SERIE_RE.search(norm_lines[j])
            if m and len(m.group(1)) >= 1:
                return m.group(1)
        # Senão, qualquer sequência longa de dígitos isolada.
        for j in range(i + 1, min(i + 3, len(norm_lines))):
            for n in _DIGITS_RUN_RE.findall(norm_lines[j]):
                return n

    # Último recurso para NFSe: procurar padrão "<num> / <letra>" em todo o
    # documento se houver "número / série" como label em algum lugar.
    if "numero / serie" in text:
        for line in norm_lines:
            m = _NUMBER_SERIE_RE.search(line)
            if m:
                # filtros: ignorar competências tipo "08/2025"
                num, serie = m.group(1), m.group(2)
                if serie.isdigit() and len(serie) == 4:
                    continue  # provavelmente "MM/AAAA"
                return num
    return None


# ---------- valor ----------

# "valor total: r$ 1.234,56", "valor da nota", "total a pagar", "valor liquido"
_AMOUNT_LABEL = (
    r"(?:"
    r"valor\s+(?:total(?:\s+da\s+(?:nota|nfse|nf-?e))?|"
    r"total\s+(?:do\s+servico|dos\s+servicos)|"
    r"da\s+(?:nota|nfse)|liquido(?:\s+da\s+(?:nota|nfse))?|bruto|cobrado)|"
    r"total\s+(?:da\s+nota|a\s+pagar|geral|do\s+documento|liquido|bruto)"
    r")"
)
# Same-line: label seguido de pequena janela e do valor.
AMOUNT_RE = re.compile(
    _AMOUNT_LABEL + r"[^0-9\n]{0,40}?(?:r\$\s*)?([0-9]{1,3}(?:[\.,][0-9]{3})*[\.,][0-9]{2})"
)
# Label sozinho na linha — valor cai em alguma das próximas linhas.
_AMOUNT_LABEL_ONLY_RE = re.compile(r"^\s*" + _AMOUNT_LABEL + r"\s*(?:\(r?\$?\))?\s*[:.\-]?\s*$")
_NUMERIC_RE = re.compile(r"(?:r\$\s*)?([0-9]{1,3}(?:[\.,][0-9]{3})*[\.,][0-9]{2})")


def _parse_brl(raw: str) -> Optional[float]:
    """Converte '1.234,56' ou '1,234.56' em float."""
    s = raw.strip()
    if "," in s and "." in s:
        # Assume formato BR: ponto como separador de milhar, vírgula decimal.
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def find_amount(text: str) -> Optional[float]:
    candidates: list[float] = []

    # 1) Padrão direto: label + valor na mesma linha.
    for m in AMOUNT_RE.finditer(text):
        val = _parse_brl(m.group(1))
        if val is not None and val > 0:
            candidates.append(val)

    # 2) Label sozinho na linha → busca o valor nas próximas 3 linhas.
    norm_lines = text.splitlines()
    for i, ln in enumerate(norm_lines):
        if not _AMOUNT_LABEL_ONLY_RE.match(ln):
            continue
        for j in range(i + 1, min(i + 4, len(norm_lines))):
            m = _NUMERIC_RE.search(norm_lines[j])
            if m:
                val = _parse_brl(m.group(1))
                if val is not None and val > 0:
                    candidates.append(val)
                    break

    if not candidates:
        return None
    # Em NF o "valor total" é tipicamente o maior valor encontrado.
    return max(candidates)


# ---------- data de emissão ----------

DATE_RE = re.compile(
    r"(?:data\s+(?:de\s+|da\s+)?emissao|emitid[oa]\s+em|emissao(?:\s+da\s+nota)?|"
    r"data\s+e\s+hora\s+de\s+emissao|competencia)"
    r"\s*[:.\-]?\s*(\d{2}[/\-\.]\d{2}[/\-\.]\d{2,4})"
)
GENERIC_DATE_RE = re.compile(r"\b(\d{2}[/\-\.]\d{2}[/\-\.]\d{4})\b")


def find_issue_date(text: str) -> Optional[str]:
    m = DATE_RE.search(text)
    if m:
        return _normalize_date(m.group(1))
    # Fallback: primeira data encontrada no documento — costuma ser a emissão
    # quando o label não foi reconhecido pelo OCR.
    m = GENERIC_DATE_RE.search(text)
    if m:
        return _normalize_date(m.group(1))
    return None


def _normalize_date(raw: str) -> str:
    parts = re.split(r"[/\-\.]", raw)
    if len(parts) == 3:
        d, mth, y = parts
        if len(y) == 2:
            y = "20" + y
        return f"{d.zfill(2)}/{mth.zfill(2)}/{y}"
    return raw


# ---------- nome do cliente ----------

# Marcadores que abrem a seção do cliente (tomador / destinatário).
# Devem aparecer no documento ANTES dos dados do cliente.
_CLIENT_SECTION_RE = re.compile(
    r"\b(?:tomador(?:\s+(?:do|de|dos)\s+servicos?)?|"
    r"destinatario(?:\s*/\s*remetente)?|"
    r"dados\s+do\s+(?:tomador|cliente|destinatario)|"
    r"cliente)\b"
)

# Labels que aparecem em CADA seção (prestador E tomador) — só servem
# como fonte de nome DEPOIS de termos ancorado na seção do tomador.
_CLIENT_VALUE_RE = re.compile(
    r"(?:nome\s*/?\s*(?:razao\s+social|nome\s+empresarial|empresarial)|"
    r"razao\s+social|"
    r"nome\s+empresarial|"
    r"nome\s+do\s+(?:tomador|cliente|destinatario)|"
    r"\bnome\b)\s*[:.\-]?\s*(.*?)\s*(?:\n|$)"
)

# Marca uma linha que é só rótulo (sem valor depois) — pula para a linha de baixo.
_CLIENT_LABEL_ONLY_RE = re.compile(
    r"^\s*(?:nome\s*/?\s*(?:razao\s+social|nome\s+empresarial|empresarial)|"
    r"razao\s+social|nome\s+empresarial|"
    r"nome\s+do\s+(?:tomador|cliente|destinatario))\s*[:.\-]?\s*$"
)

# Palavras-chave que sinalizam fortemente um nome de pessoa jurídica brasileira.
_NAME_HINT_RE = re.compile(
    r"\b(?:ltda|s/?a|me|epp|eireli|mei|sociedade|companhia|cia\.?|"
    r"secretaria|ministerio|prefeitura|municipio|fundacao|instituto|"
    r"associacao|cooperativa|holding|consultoria|"
    r"comercio|industria|tecnologia|transformacao|telecomunicacoes|"
    r"engenharia|construtora|incorporadora|distribuidora|comunicacao|"
    r"comunicacoes|transportes)\b"
)
_ADDRESS_PREFIX_RE = re.compile(r"^(?:rua|av\.?|avenida|travessa|tv\.?|alameda|al\.?|rod\.?|rodovia|praca|estr\.?|estrada)\b")
# Frases que NÃO podem virar nome de cliente, mesmo contendo palavras-chave de PJ.
_NOT_NAME_RE = re.compile(
    r"\b(?:regra\s+especial|tributacao|imunidade|aliquota|exigibilidade|"
    r"incidencia|recolhimento|optante|simples\s+nacional|retencao|retencoes|"
    r"base\s+de\s+calculo|calculo\s+do|deducoes|descricao\s+do|"
    r"competencia|local\s+da\s+prestacao|pais\s+da\s+prestacao|"
    r"municipio\s+da\s+incidencia|situacao\s+do)\b"
)


# Linhas que NÃO podem virar nome de cliente.
_STOP_WORDS = {
    "cpf", "cnpj", "inscricao", "endereco", "rua", "avenida", "bairro",
    "cep", "municipio", "uf", "telefone", "email", "e-mail", "fone",
    "data", "numero", "valor", "codigo", "discriminacao", "descricao",
    "competencia", "tributacao", "aliquota", "base",
    # Fragmentos de labels que sobram quando o regex faz backtracking
    # (ex.: "tomador" casa só "tomador" e "de servicos" cai na captura).
    "do", "dos", "da", "das", "de",
    "servico", "servicos", "prestador",
    "tomador", "destinatario", "remetente", "cliente",
    "razao", "social", "nome",
}


_STRIP_CHARS = " -:.,;/\\\t"


def _looks_like_name(candidate: str) -> bool:
    c = candidate.strip(_STRIP_CHARS)
    if len(c) < 3 or len(c) > 120:
        return False
    low = c.lower()
    first_word = re.split(r"\W+", low, maxsplit=1)[0]
    if first_word in _STOP_WORDS:
        return False
    # Precisa ter pelo menos uma letra (não só dígitos/pontuação).
    if not re.search(r"[a-z]{2,}", low):
        return False
    # Frases administrativas/tributárias não são nomes de cliente.
    if _NOT_NAME_RE.search(low):
        return False
    # Endereços também não.
    if _ADDRESS_PREFIX_RE.search(low):
        return False
    return True


def _find_section_start(text: str) -> int:
    """Posição (no texto normalizado) onde começa a seção do tomador/cliente."""
    m = _CLIENT_SECTION_RE.search(text)
    return m.start() if m else -1


def _extract_value_from_line(raw_line: str, label_end_norm: int) -> str:
    """Pega o trecho útil da linha original a partir do fim do label."""
    raw_candidate = raw_line[label_end_norm:].strip(_STRIP_CHARS)
    raw_candidate = re.split(r"\s{2,}|\t|cpf|cnpj", raw_candidate, flags=re.I)[0]
    return raw_candidate.strip(_STRIP_CHARS)


def _line_is_strong_name(norm_line: str) -> bool:
    """Heurística: linha com um nome de pessoa jurídica/órgão público brasileiro."""
    c = norm_line.strip(_STRIP_CHARS)
    if not _looks_like_name(c):
        return False
    if _ADDRESS_PREFIX_RE.search(c):
        return False
    if _CLIENT_LABEL_ONLY_RE.match(c):
        return False
    if _NOT_NAME_RE.search(c):
        return False
    return bool(_NAME_HINT_RE.search(c))


def find_client_name(text: str, raw_text: str) -> Optional[str]:
    """Localiza o nome do tomador / destinatário.

    Estratégia:
      1. Acha a posição da seção do cliente (`TOMADOR`, `DESTINATÁRIO`, ...).
      2. Procura, depois dessa posição:
         a) `Nome/Razão Social: <valor>` na mesma linha;
         b) `Nome/...` como label sozinho → valor na linha seguinte;
         c) linha "forte" (contém SECRETARIA, COMPANHIA, LTDA, etc.).
      3. Fallback: primeira linha "forte" em todo o documento.
    """
    section_pos = _find_section_start(text)
    norm_lines = text.splitlines()
    raw_lines = raw_text.splitlines()

    line_offsets: list[int] = []
    acc = 0
    for ln in norm_lines:
        line_offsets.append(acc)
        acc += len(ln) + 1

    def line_index_for(pos: int) -> int:
        for idx in range(len(line_offsets) - 1, -1, -1):
            if line_offsets[idx] <= pos:
                return idx
        return 0

    # 1) Marcador inline: "Tomador: João Silva".
    if section_pos >= 0:
        i = line_index_for(section_pos)
        m_section = _CLIENT_SECTION_RE.search(norm_lines[i])
        if m_section:
            tail = norm_lines[i][m_section.end():].lstrip(_STRIP_CHARS)
            if tail and _looks_like_name(tail):
                raw_line = raw_lines[i] if i < len(raw_lines) else ""
                raw_val = _extract_value_from_line(raw_line, m_section.end())
                if _looks_like_name(normalize(raw_val)):
                    return raw_val
                return tail
        start_search = i + 1
    else:
        start_search = 0

    # 2) Procura label de valor (Nome/Razão Social) seguido do nome.
    for i in range(start_search, len(norm_lines)):
        line = norm_lines[i]
        m = _CLIENT_VALUE_RE.search(line)
        if not m:
            continue
        captured = m.group(1).strip(_STRIP_CHARS)
        if captured and _looks_like_name(captured):
            if i < len(raw_lines):
                raw_val = _extract_value_from_line(raw_lines[i], m.start(1))
                if _looks_like_name(normalize(raw_val)):
                    return raw_val
            return captured
        # Label sozinho na linha — valor pode estar na seguinte.
        if i + 1 < len(raw_lines):
            nxt = raw_lines[i + 1].strip(_STRIP_CHARS)
            if _looks_like_name(normalize(nxt)):
                return nxt

    # 3) Heurística forte: linha que casa com palavras-chave de PJ.
    #    Funciona mesmo quando o OCR embaralhou a ordem dos blocos.
    for i in range(start_search, len(norm_lines)):
        if _line_is_strong_name(norm_lines[i]):
            return raw_lines[i].strip(_STRIP_CHARS) if i < len(raw_lines) else norm_lines[i]

    # 4) Último recurso: a primeira linha "forte" em todo o documento.
    for i, ln in enumerate(norm_lines):
        if _line_is_strong_name(ln):
            return raw_lines[i].strip(_STRIP_CHARS) if i < len(raw_lines) else ln

    return None

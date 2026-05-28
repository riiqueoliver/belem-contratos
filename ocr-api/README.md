# Extrator de Notas Fiscais (OCR)

Aplicativo Python que lê **NFS-e** (serviços) e **NF-e / DANFE** (produtos) e
extrai quatro campos:

- **Número** da nota fiscal
- **Valor** cobrado
- **Cliente** (tomador / destinatário)
- **Data de emissão**

Aceita **PDF** (com texto vetorial ou escaneado) e **imagens** (PNG, JPG, TIFF, BMP, WEBP).

## Como a confiabilidade é alcançada

1. **PDF com texto vetorial** — leitura direta via `pdfplumber` (sem perda de informação).
2. **PDF escaneado / imagens** — OCR com **Tesseract** (idioma `por`),
   precedido de pré-processamento (escala de cinza, *autocontrast*, upscale e *sharpen*).
3. Texto normalizado (minúsculas, sem acento) e passado por regex específicos
   para os rótulos mais comuns em PT-BR (`Número da Nota`, `Valor Total`,
   `Tomador`, `Destinatário`, `Data de Emissão`, ...).

## Instalação

```bash
# dependências de sistema (Tesseract + Poppler)
brew install tesseract tesseract-lang poppler            # macOS
sudo apt install tesseract-ocr tesseract-ocr-por poppler-utils   # Ubuntu/Debian

# dependências Python
pip install -r requirements.txt
```

Caso o `tesseract` esteja em um caminho não-padrão, exporte
`TESSERACT_CMD=/caminho/para/tesseract` antes de rodar.

## Uso — CLI

```bash
# saída legível
python cli.py nota.pdf

# várias notas, saída JSON
python cli.py *.pdf *.jpg --json

# para debugar o OCR
python cli.py nota.jpg --show-text
```

Exemplo de saída:

```
=== nota.pdf ===
  Número da nota : 00012345
  Valor          : R$ 15.480,75
  Cliente        : ACME COMÉRCIO E SERVIÇOS LTDA
  Data emissão   : 27/05/2026
  Fonte          : pdf-text
```

## Uso — Streamlit

```bash
streamlit run app.py
```

Faça upload de uma ou mais notas; a tabela com os campos extraídos pode ser
baixada em CSV.

## Uso — como biblioteca

```python
from nota_fiscal_ocr import extract

nf = extract("nota.pdf")
print(nf.numero, nf.valor, nf.cliente, nf.data_emissao)
print(nf.to_dict())
```

## Testes

```bash
python3 tests/test_patterns.py
```

Os testes exercitam apenas os regex (não exigem Tesseract).

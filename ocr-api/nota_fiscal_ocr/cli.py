"""CLI para extrair campos de notas fiscais.

Uso (após `pip install nota-fiscal-ocr[ocrmac]`):
    nota-fiscal-ocr nota.pdf
    nota-fiscal-ocr nota1.pdf nota2.jpg --json
    nota-fiscal-ocr *.pdf --show-text

Ou diretamente: `python -m nota_fiscal_ocr nota.pdf`.

Documentos múltiplos dentro do mesmo PDF são detectados automaticamente e
apresentados em ordem cronológica (data de emissão ascendente).
"""

from __future__ import annotations

import argparse
import json
import sys

from .extractor import extract_all


def _fmt_brl(v):
    if v is None:
        return "—"
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai campos de NFS-e / NF-e via OCR.")
    parser.add_argument("arquivos", nargs="+", help="Arquivos PDF ou imagens de notas fiscais.")
    parser.add_argument("--json", action="store_true", help="Saída em JSON.")
    parser.add_argument("--show-text", action="store_true", help="Inclui o texto bruto extraído.")
    args = parser.parse_args()

    resultados = []
    for caminho in args.arquivos:
        try:
            docs = extract_all(caminho)
            for nf in docs:
                item = {"arquivo": caminho, **nf.to_dict()}
                if args.show_text:
                    item["texto_bruto"] = nf.texto_bruto
                resultados.append(item)
        except Exception as exc:  # noqa: BLE001
            resultados.append({"arquivo": caminho, "erro": str(exc)})

    # Ordenação global: cronológica + número da nota (tiebreaker).
    from .extractor import _number_sort_key

    def sort_key(item):
        num_key = _number_sort_key(item.get("numero"))
        d = item.get("data_emissao") or ""
        try:
            dd, mm, yyyy = d.split("/")
            return (0, yyyy, mm, dd, num_key)
        except (ValueError, AttributeError):
            return (1, "", "", "", num_key)

    resultados.sort(key=sort_key)

    if args.json:
        print(json.dumps(resultados, ensure_ascii=False, indent=2))
        return 0

    for r in resultados:
        if "erro" in r:
            print(f"\n=== {r['arquivo']} ===")
            print(f"  ERRO: {r['erro']}")
            continue
        paginas = r.get("paginas") or []
        pag_str = ",".join(map(str, paginas)) if paginas else "—"
        print(f"\n=== {r['arquivo']}  (pág. {pag_str}) ===")
        print(f"  Número da nota : {r.get('numero') or '—'}")
        print(f"  Valor          : {_fmt_brl(r.get('valor'))}")
        print(f"  Cliente        : {r.get('cliente') or '—'}")
        print(f"  Data emissão   : {r.get('data_emissao') or '—'}")
        print(f"  Fonte          : {r.get('fonte')}")
        if args.show_text:
            print("  --- texto bruto ---")
            print(r["texto_bruto"])

    print(f"\n{len(resultados)} documento(s) processado(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

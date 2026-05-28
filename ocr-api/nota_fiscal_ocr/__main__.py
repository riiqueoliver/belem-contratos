"""Permite rodar com `python -m nota_fiscal_ocr ...`."""
from .cli import main
import sys

if __name__ == "__main__":
    sys.exit(main())

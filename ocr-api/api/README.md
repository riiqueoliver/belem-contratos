# nota-fiscal-ocr — Microserviço HTTP

API REST que expõe o extrator de NFS-e / NF-e. Pensada para ser consumida
pelo frontend do [Belém Digital — Gestão de Contratos](https://belem-contratos.vercel.app/),
mas funciona com qualquer cliente HTTP.

## Endpoints

| Método | Rota          | Descrição                                                |
|--------|---------------|----------------------------------------------------------|
| GET    | `/health`     | Healthcheck (usado pelo Railway).                       |
| POST   | `/v1/extrair` | Recebe `multipart/form-data` com `arquivo`. Devolve JSON. |
| GET    | `/docs`       | Swagger UI (gerado automaticamente).                    |
| GET    | `/openapi.json` | Spec OpenAPI 3.                                       |

### Exemplo `POST /v1/extrair`

```bash
curl -X POST https://nota-fiscal-ocr.up.railway.app/v1/extrair \
     -F "arquivo=@nota.pdf"
```

Resposta:
```json
{
  "arquivo": "nota.pdf",
  "total": 2,
  "notas": [
    {
      "numero": "470",
      "valor": 15200.70,
      "cliente": "SECRETARIA MUNICIPAL DE COMUNICACAO - SECOM",
      "data_emissao": "21/10/2025",
      "paginas": [1],
      "fonte": "pdf-ocr"
    },
    {
      "numero": "471",
      "valor": 8350.00,
      "cliente": "SECRETARIA MUNICIPAL DE SAUDE - SESMA",
      "data_emissao": "22/10/2025",
      "paginas": [2],
      "fonte": "pdf-ocr"
    }
  ]
}
```

Lista **sempre ordenada** por data de emissão + número.

## Configuração via env vars

| Variável         | Default                                       | Descrição                                |
|------------------|-----------------------------------------------|------------------------------------------|
| `PORT`           | `8000`                                        | Porta do servidor (Railway injeta).      |
| `CORS_ORIGINS`   | `localhost:5174, …, belem-contratos.vercel.app` | Lista CSV de origens permitidas.       |
| `MAX_UPLOAD_MB`  | `25`                                          | Limite de tamanho por upload.            |
| `API_KEY`        | (não setada → endpoints públicos)             | Se setada, exige header `X-API-Key`.     |
| `OCR_BACKEND`    | `tesseract` (no Docker)                       | `tesseract` ou `ocrmac`.                |

## Rodando localmente

```bash
# A partir da raiz do repo nota-fiscal-ocr
pip install -e .[tesseract]
pip install -r api/requirements.txt
uvicorn api.main:app --reload --port 8000
# Swagger: http://localhost:8000/docs
```

## Deploy no Railway

O repositório já tem `Dockerfile` e `railway.json` configurados.

1. **Crie um novo projeto no Railway** → `New Project` → `Deploy from GitHub repo`
   (ou `Empty Project` → conectar repo depois).
2. Aponte para este diretório (ou o repo onde está). O Railway detecta o
   `Dockerfile` automaticamente.
3. (Opcional) Defina variáveis de ambiente no painel do serviço:
   - `CORS_ORIGINS` — adicione a URL final do app de contratos.
   - `API_KEY` — habilita autenticação simples por header.
4. Gere um domínio público em `Settings → Networking → Generate Domain`.
5. Verifique: `curl https://SEU-DOMINIO.up.railway.app/health`
   → deve retornar `{"status":"ok",...}`.

Tempo médio de build: ~3 min (instala Tesseract + libs Python).

## Integrando no frontend

O arquivo [`frontend-snippet.js`](./frontend-snippet.js) tem:
- A função `extrairNF(file)` (chama a API).
- O componente React `<NFUploader onExtract={...}>`.
- Três exemplos prontos para os pontos do `index.html` do app de contratos.

Como usar:
1. Cole o conteúdo do snippet dentro do `<script type="text/babel">` do
   `index.html`, junto com os outros componentes React.
2. Defina a URL: `window.NFO_API_URL = "https://nota-fiscal-ocr.up.railway.app";`
   antes do snippet (ou edite a constante).
3. Use `<NFUploader onExtract={...}>` nos pontos indicados nos exemplos.

## Custo estimado no Railway

Plano Hobby (US$ 5/mês de crédito incluso). O serviço fica suspenso quando
ocioso, sobe em poucos segundos no 1º request. Para um volume baixo
(≤ algumas centenas de NFs/mês), o crédito incluso costuma cobrir tudo.

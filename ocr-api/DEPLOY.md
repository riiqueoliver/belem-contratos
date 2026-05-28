# OCR API — Deploy no Railway

Este microserviço extrai automaticamente os campos de uma Nota Fiscal (número,
data de emissão, valor, cliente) de PDFs — inclusive PDFs de imagem escaneada.

## Como subir no Railway (5 min)

1. Acesse https://railway.app → **New Project → Deploy from GitHub repo**
2. Selecione o repo `riiqueoliver/belem-contratos`
3. Em **Source → Root Directory**, digite: `ocr-api`
4. Railway detecta o `Dockerfile` automaticamente — clique em **Deploy**
5. Aguarde o build (~3 min). Acesse **Settings → Networking → Generate Domain**
6. Anote a URL gerada (ex.: `https://ocr-api-production.up.railway.app`)

## Variáveis de ambiente (Settings → Variables)

| Variável | Valor |
|---|---|
| `CORS_ORIGINS` | `https://belem-contratos.vercel.app,http://localhost:5174` |
| `API_KEY` | (opcional) string aleatória para proteger o endpoint |
| `MAX_UPLOAD_MB` | `25` (padrão) |

## Testar

```bash
curl https://SUA-URL.up.railway.app/health
# → {"status":"ok","service":"nota-fiscal-ocr","version":"0.1.1"}

curl -X POST https://SUA-URL.up.railway.app/v1/extrair \
     -F "arquivo=@nota.pdf"
# → {"arquivo":"nota.pdf","total":1,"notas":[{"numero":"470","valor":15200.70,...}]}
```

Swagger UI: `https://SUA-URL.up.railway.app/docs`

## Configurar a URL no app

Após o deploy, acesse o **Painel Administrativo → Configurações** e cole a URL
do Railway no campo **"URL da API de OCR"**. A configuração fica salva no
navegador e os PDFs das parcelas passarão a ser lidos automaticamente.

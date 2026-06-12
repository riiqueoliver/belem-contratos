# Onboarding — Sistema de Gestão de Contratos (Belém Digital)

Guia para quem está chegando agora no projeto via Claude Code.

## O que é

SPA (single-page application) em React + Tailwind para acompanhar o ciclo de tramitação de contratos administrativos da **Belém Digital** com os órgãos da Prefeitura de Belém (SECOM, SEFIN, SEMEC, SESMA, SEMMA, APMB).

Status atual: **MVP funcional, validado, publicado no Cloudflare Pages**. Aguarda migração para arquitetura produtiva (TR/ETP/DFD prontos nesta pasta).

## Stack técnica

- **HTML único** (`index.html`) com React 18 + ReactDOM via UMD do unpkg
- **Babel Standalone** transpila JSX no navegador (sem build step)
- **Tailwind CSS** via CDN (`cdn.tailwindcss.com`)
- **Ícones SVG inline** (recriação manual de lucide-react)
- **Persistência local**: `localStorage` (chaves `belem-contratos-v1` e `belem-contatos-v1`)
- **Sem backend, sem banco de dados, sem dependências instaladas** (sem Node/npm)

## Estrutura de arquivos

```
belem-digital-contratos/
├── index.html                          # App principal (todo o React/JSX inline)
├── logo.png                            # Logomarca Belém Digital (renomeada do nome original com acentos)
├── Cópia de Belém Digital - Assinatura Horizontal Branco.png  # Logo original (mantida como backup)
├── dist/                               # Pasta para deploy (cópia limpa)
│   ├── index.html
│   └── logo.png
├── belem-contratos.zip                 # ZIP pronto para upload no Cloudflare Pages
├── .claude/launch.json                 # Config do preview local (Python http.server :5174)
├── TR-Sistema-Gestao-Contratos.md      # Termo de Referência (20 seções Lei 14.133/2021)
├── ETP-Sistema-Gestao-Contratos.md     # Estudo Técnico Preliminar
└── DFD-Sistema-Gestao-Contratos.md     # Documento de Formalização de Demanda
```

## Como rodar localmente

```bash
cd belem-digital-contratos
python3 -m http.server 5174
# abre http://localhost:5174
```

No Claude Code, o `launch.json` já define o servidor — basta usar o painel de preview.

## Como publicar/atualizar

1. Edite `index.html` na raiz
2. Sincronize para `dist/`: `cp index.html dist/index.html`
3. Regere o ZIP: `cd dist && zip -r ../belem-contratos.zip . && cd ..`
4. Upload no Cloudflare Pages → projeto `belem-contratos` → "Create deployment" → arrasta o ZIP
5. URL: `https://belem-contratos.pages.dev` (com Cloudflare Access para senha)

## Regras de negócio (essenciais)

### Fluxo de tramitação — 6 etapas
1. **Emissão da NF** (gatilho — automaticamente concluída no cadastro)
2. **Relatórios DTI e DSI** — prazo: 2 dias úteis a partir da emissão
3. **PDF Unificado** — prazo: 4 dias úteis
4. **Assinaturas (DTI / DSI / DAF)** — prazo: 4 dias úteis
5. **Assinatura Presidente** — prazo: 4 dias úteis
6. **Envio ao Cliente** — prazo: 5 dias úteis

### SLA e semáforo
- Cálculo em **dias úteis** (segunda a sexta; feriados não tratados)
- 🟢 Verde: prazo > hoje
- 🟡 Amarelo: prazo = hoje
- 🔴 Vermelho: prazo < hoje (e etapa não concluída)
- 🔵 Azul: etapa/contrato concluído

### Parcelas mensais
- Contratos podem ter vigência de 1 a 36 meses
- Ao cadastrar com >1 mês, o sistema gera N entradas, uma por mês, com a data da NF deslocada
- O `nfNumber` é informado apenas na 1ª parcela no cadastro; as demais ficam vazias e devem ser informadas mensalmente no card de cada parcela (botão "Informar nº da NF" → edição inline)

### Notificações
- Cada gestor cadastrado (drawer "Contatos") está vinculado a uma ou mais etapas
- Quando um contrato está amarelo ou vermelho, aparecem botões de e-mail e WhatsApp
- Ao clicar, o app simula o envio listando os contatos relevantes para a etapa atual no toast (mock — não há integração real ainda)

## Identidade visual

- **Azul marinho**: `#0B2B5E` (constante `BLUE` no código)
- **Verde**: `#3A8A35` (constante `GREEN`)
- Fundo do header: `#0B2B5E` com logomarca branca
- Font: Inter (Google Fonts via CDN)

## Decisões já tomadas (não desfaça sem motivo)

1. **Logomarca como `<img src="logo.png">`** — fim das recriações em SVG (não eram fiéis à marca). O arquivo é a "Assinatura Horizontal Branco" oficial.
2. **Cabeçalho azul** com texto branco, sem wordmark redundante "Belém Digital" (já está na logo).
3. **`localStorage` em chaves versionadas** (`-v1`) para permitir migração futura.
4. **Botão "Resetar dados"** no rodapé limpa tudo e volta aos mocks.
5. **5 KPIs no topo**: Total · No Prazo · Vence Hoje · Atrasados · Concluídos.
6. **Ordem das seções**: KPIs em primeiro (acima), navegação por mês em segundo (logo abaixo), lista de contratos por último.
7. **Persistência sem confirmação** — toda alteração é salva automaticamente.

## Pendências e direção futura

- ⏳ **Backend + PostgreSQL + SSO institucional** — escopo completo no `TR-Sistema-Gestao-Contratos.md`. Valor estimado: R$ 285k anuais. Modalidade: inexigibilidade (Belém Digital, Lei 14.133/2021 art. 74 + Lei 13.303/2016).
- ⏳ **Integração real** com SMTP institucional e WhatsApp Business (Twilio ou Evolution API)
- ⏳ **Autenticação RBAC** (Visualizador / Operador / Administrador)
- ⏳ **Auditoria imutável** com retenção mínima 2 anos
- ⏳ **Migração de feriados nacionais e municipais** para o cálculo de dias úteis
- ⏳ **Notificações automáticas** (cron/scheduler) em vez de só botão manual
- ⏳ **Multi-usuário com dados compartilhados** (hoje cada navegador tem seus próprios dados via localStorage)

## Limitações conhecidas do MVP

| Limitação | Impacto | Mitigação prevista |
|---|---|---|
| Dados em `localStorage` por navegador | Não há compartilhamento entre usuários | Backend (TR) |
| Sem autenticação no app | Qualquer pessoa com a URL+senha do Cloudflare Access entra como "todos" | SSO + RBAC (TR) |
| Sem feriados | Cálculo de SLA pode dar falso positivo em feriados | Tabela de feriados ou API |
| Notificações apenas simuladas (toast) | Gestores não recebem e-mail/WhatsApp de verdade | Integrações SMTP/Twilio (TR) |
| Tailwind/React via CDN | Risco de adulteração de CDN, dependência externa | Build próprio com Vite (TR) |

## Memória do usuário original

Há um arquivo de memória do Claude em:
`~/.claude/projects/-Users-leonardomendonca-Library-CloudStorage-Dropbox-c-python/memory/project_belem_digital.md`

Ele resume as regras de negócio e a paleta de cores. **Não é necessário** para continuar — todo o contexto está neste ONBOARDING.

## Para começar a trabalhar

1. Abra esta pasta no Claude Code
2. Leia este arquivo
3. Rode o preview local
4. Para mudanças no app: edite `index.html`, recarregue o preview, verifique no navegador
5. Para republicar: passos do "Como publicar/atualizar" acima

Boa sorte! 🚀

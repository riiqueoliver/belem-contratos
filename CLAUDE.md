# belem-contratos — SGC + Módulo Arcanjo

> **Atenção:** `ONBOARDING.md` está congelado em junho/2026 e descreve um MVP com `localStorage`
> e sem backend. Isso **não existe mais**. Este arquivo é o mapa atual.

## O que é

Uma base de código serve **dois sistemas** e vários módulos, tudo dentro de um único `index.html`
(~18 mil linhas, 1,3 MB) com React 18 + Tailwind via CDN e JSX inline.

| Rota | O que é |
|---|---|
| `/` | Belém Digital — sistema principal (navy `#0B2B5E`, coleções sem prefixo) |
| `/gcsp` | GCSP — Gerência de Contratos, Suprimentos e Patrimônio (petróleo `#0E7490`, prefixo `gcsp_`) |
| `/gcsp/painel` | Painel de TV do setor — tela própria, sem login |
| `/moduloarcanjo` | Login do Instituto Arcanjo's (arquivo separado: `arcanjo-login.html`) |
| `/campanha` | Módulo privado — só o usuário `henriquecorreia` |

Persistência é **Firestore** (projeto `belem-contratos`). Produção: https://belem-contratos.vercel.app

## Fluxo de trabalho — automático até o deploy

O Henrique autorizou a cadeia completa. Ao receber um pedido de alteração, execute sem pedir confirmação:

1. Editar `index.html` (ou o arquivo pertinente)
2. `node build.js` — transpila o JSX e gera `dist/index.html`
3. `git add` + `git commit` (mensagem curta em português, no estilo do histórico: `Módulo: o que mudou`)
4. `git push` → a Vercel publica sozinha
5. Avisar que está no ar

Não é preciso perguntar antes do push. **Exceção:** mudanças que alterem regra de negócio já em uso,
apaguem dados, ou mexam em login/permissões — nesses casos, mostre o diff e confirme antes.

Preview local: use o preview do Claude Code (`.claude/launch.json` → `node claude/server.js`, porta 5174).
Não use `python -m http.server` — o Python não está instalado nesta máquina.

## Mapa do index.html

Âncoras aproximadas (o arquivo cresce; confirme com grep antes de editar):

| Linha | Seção |
|---|---|
| ~164 | Config do Firebase |
| ~190 | `ADMIN_USERNAMES`, `ARCANJO_USERS`, `INITIAL_USERS` |
| ~229 | `SYSTEMS` / `SYS_ID` / `COL()` — multi-sistema |
| ~937 | Prospecção de leads no PNCP |
| ~1166 | Emissão de propostas |
| ~1530 | Certidões corporativas |
| ~1813 | Integração GDoc |
| ~3643 | Propostas (kanban) |
| ~4336 | Parcelas / NFs |
| ~4663 | Contratos |
| ~8228 | Painel Admin |
| **~8306** | **Módulo Arcanjo's** |
| **~9299** | **Painel Gerencial Arcanjo** |
| ~9562 | Módulo privado de Campanha |
| ~10067 | Cronograma Financeiro |
| ~11545 | GDoc |
| ~14537 | Painel de TV do GCSP |
| ~14810 | `App` principal |

Pastas satélite: `ocr-api/` (Python, OCR de nota fiscal — deploy separado) e
`gdoc-extension/` (extensão de navegador para o gdoc.belem.pa.gov.br).

## Módulo Instituto Arcanjo's

Assistência social — "Acolher, Cuidar e Transformar". Coleção `arcanjo_social`, cor `#7b61c7`.
**Está em uso diário e real** (~480 registros): não é protótipo, cuidado com mudanças destrutivas.

- Abas: **Análise CRA'S** (`cras`) · **2ª Via RG** (`rg`) · **2ª Via Certidão** (`certidao`)
- Status: `pendente`, `encaminhado`, `atendido`, `nao_compareceu` — e `visita`, **exclusivo da aba CRAS**
- `concluido`/`cancelado` são status legados, já migrados. `migrate-status.mjs` (na raiz, sem commit)
  não tem mais o que fazer e pode ser removido.
- Acesso: `laynesoares` está em `ARCANJO_ONLY` — entra e vê **somente** este módulo; o logout dela
  redireciona para `/moduloarcanjo`.
- Exportação para Excel sai por responsável, seguindo a aba ativa.

## Armadilhas conhecidas

- **React vem do unpkg, não do jsDelivr.** Os caminhos UMD do React no jsDelivr retornam 400, o que
  deixa `React` undefined e entrega tela branca. Está comentado no `build.js` — não "otimize" isso.
- **`dist/` local desatualizado é normal.** A Vercel roda `node build.js` no deploy. Rodar o build
  localmente serve para conferir, não é requisito do push.
- `node_modules/` está no `.gitignore` mas `node_modules/.package-lock.json` foi commitado antes disso
  e vive aparecendo como modificado. Ignore, ou remova do índice de uma vez.

## Dívida técnica prioritária — segurança

O Firestore responde a **leitura sem autenticação** usando só a apiKey web, que vai embutida no
`index.html` público. Não há Firebase Auth em lugar nenhum: o login compara `username`/`password`
contra a coleção `users`, com as **senhas em texto puro**. Como o app grava sem autenticar, as regras
quase certamente liberam escrita também.

Na prática, qualquer pessoa com a URL consegue ler e provavelmente alterar tudo — inclusive nome, CPF,
nome da mãe, endereço e telefone dos atendidos do Arcanjo, que é dado sensível sob a LGPD.

Correção real: Firebase Auth + regras por usuário autenticado + hash de senha. Não trate como resolvido
e não proponha features novas fingindo que isso não existe — mas a prioridade é decisão do Henrique.

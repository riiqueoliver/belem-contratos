# SGC → GDoc · Emissão automática

Extensão do Chrome que preenche o GDoc automaticamente com os dados da NF
cadastrada no Sistema de Gestão de Contratos.

## Instalação (uma vez por computador)

1. Abra o Chrome em `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione esta pasta (`gdoc-extension`)

Pronto. A extensão fica ativa apenas em dois endereços:
`belem-contratos.vercel.app` e `gdoc.belem.pa.gov.br`.

## Como usar

1. No sistema, abra a parcela e clique em **Emitir GDoc**
2. Clique em **Abrir GDoc ↗** (isso envia os dados para a extensão)
3. Faça login no GDoc, se necessário
4. Vá em **Processo → Novo Processo**
5. No painel roxo que aparece no canto, clique em **Preencher esta etapa**

A cada tela do GDoc (interessado → processo → anexos → encaminhamento),
clique novamente em "Preencher esta etapa". A extensão detecta em qual
etapa você está e preenche os campos correspondentes.

**Os botões Salvar e Enviar continuam sendo seus** — a extensão preenche,
você confere e confirma. Isso evita que um processo saia errado.

## Segurança

- Usa a **sua sessão já autenticada** no GDoc; nenhuma senha é armazenada
- Funciona apenas nos dois domínios acima
- Os dados ficam no navegador e expiram em 12 horas

## Se algum campo não preencher

O GDoc usa componentes JSF/PrimeFaces que às vezes mudam de estrutura.
O painel mostra exatamente o que preencheu e o que falhou — o que falhar,
preencha manualmente e nos avise para ajustarmos o seletor.

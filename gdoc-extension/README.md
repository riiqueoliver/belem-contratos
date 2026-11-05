# SGC ↔ GDoc · Emissão e acompanhamento de processos

Extensão do Chrome com duas funções:

1. **Emissão** — preenche o processo de cobrança no GDoc com os dados da NF cadastrada no
   Sistema de Gestão de Contratos (botão *Emitir GDoc* da parcela).
2. **Acompanhamento** — verifica os processos das parcelas no GDoc e traz para o sistema:
   - em que setor o processo está (tramitação);
   - a **Nota Fiscal** anexada (o PDF entra na parcela, com número, data e valor);
   - a **Nota de Liquidação** anexada (o PDF entra na parcela, que passa a contar como **paga**).

   Cada novidade aparece no sininho de alertas do sistema e num aviso do Windows.

## Instalação (uma vez por computador)

1. Abra o Chrome em `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação** e selecione esta pasta (`gdoc-extension`)
   — se já estava instalada, clique no ícone de **recarregar** da extensão
4. Na tela de configurações que abrir: marque o **login automático**, informe matrícula e senha
   do GDoc e os horários (padrão: 8h, 12h e 17h)

## Quando a varredura roda

- ao abrir o Chrome (assim que houver internet);
- nos horários configurados — se o PC estiver desligado no horário, roda ao ligar;
- quando você clicar em **Verificar agora** (ícone da extensão).

Para rodar ao ligar o notebook, o Chrome precisa iniciar com o Windows.

Ela abre o GDoc numa janela minimizada, lê cada processo e fecha a janela.
**Só lê**: não salva, não tramita e não anexa nada no GDoc.

## Quais parcelas são verificadas

As do sistema principal com número de GDoc preenchido (ex.: `983/2026`) e ainda não pagas.

## Regras de leitura

- **Setor atual**: o encaminhamento mais recente.
- **NF**: o anexo mais recente do tipo NOTA FISCAL (a "atestada" só se for a única).
- **NL**: o anexo mais recente do tipo NOTA DE LIQUIDAÇÃO, ignorando a minuta "p/ assinatura".
- PDFs acima de ~700 KB não cabem no banco do sistema: viram um aviso para anexar manualmente.

## Segurança

- Matrícula e senha ficam só neste computador, no armazenamento da extensão.
- Funciona apenas em `gdoc.belem.pa.gov.br`, `belem-contratos.vercel.app` e no banco do sistema.

## Se algo não for lido

O GDoc usa componentes JSF/PrimeFaces que às vezes mudam de estrutura. A última varredura
fica registrada nas configurações da extensão, com o erro de cada processo.

# DOCUMENTO DE FORMALIZAÇÃO DE DEMANDA — DFD

**Prioridade:** [X] Alta  [ ] Média  [ ] Baixa

**Setor requisitante:** Secretaria Municipal de Administração - SEMAD

**Servidor Responsável pela demanda:** [A definir]
**Matrícula nº:** xxxxxx
**Cargo:** [A definir]
**E-mail:** xxxxxx@belem.pa.gov.br

**Tipo de demanda:** [X] Nova contratação  [ ] Prorrogação de contrato de serviço continuado

---

## 1. Tabela do objeto

| ITEM | Descrição dos Serviços | Unid | Valor Total Máximo (R$) |
|------|------------------------|------|--------------------------|
| 01   | Desenvolvimento, implantação, hospedagem segura, suporte 24x7 e manutenção evolutiva do **Sistema de Gestão de Contratos – Belém Digital**, plataforma web destinada ao acompanhamento eletrônico do ciclo de tramitação de contratos administrativos firmados entre a Belém Digital e os órgãos da administração pública municipal, contemplando 6 etapas (Emissão NF → Relatórios DTI/DSI → PDF Unificado → Assinaturas DTI/DSI/DAF → Assinatura Presidente → Envio ao Cliente), cálculo automático de SLA em dias úteis com semáforo de prazos, dashboard mensal de indicadores, alertas automáticos por e-mail e WhatsApp aos gestores responsáveis, cadastro de contatos com vínculo a etapas, geração automática de parcelas mensais e trilha de auditoria em conformidade com a LGPD | serviço | 285.000,00 |
| | **VALOR TOTAL ESTIMADO** | | **R$ 285.000,00** |

Composição do valor: R$ 165.000,00 (cento e sessenta e cinco mil reais) em parcela única referente ao desenvolvimento, implantação, integração com SSO institucional, integrações de notificação (SMTP e WhatsApp Business), adequação à LGPD e treinamento; somados a R$ 10.000,00 (dez mil reais) mensais durante 12 (doze) meses referentes à operação, infraestrutura, suporte técnico 24x7, backups, monitoramento, manutenção evolutiva e licenciamento de WAF, totalizando R$ 120.000,00 (cento e vinte mil reais) anuais para a parcela mensal.

## 2. Justificativa da contratação

A Secretaria Municipal de Administração - SEMAD apresenta a presente demanda com o objetivo de viabilizar a modernização da gestão e do controle da tramitação dos contratos administrativos celebrados entre a Belém Digital e os órgãos partícipes da administração pública municipal, em consonância com as diretrizes de transformação digital do município de Belém e com os princípios da economicidade, eficiência e melhoria contínua da qualidade dos serviços prestados ao cidadão.

Atualmente o controle do fluxo de tramitação dessas contratações — que envolvem mensalmente a emissão de nota fiscal, a elaboração de relatórios técnicos pelas diretorias DTI (Diretoria de Tecnologia da Informação) e DSI (Diretoria de Soluções Integradas), a unificação documental em PDF, as assinaturas sucessivas das diretorias DTI, DSI e DAF (Diretoria Administrativo-Financeira), a chancela da Presidência e o envio final ao cliente — é executado de forma manual e descentralizada, predominantemente em planilhas eletrônicas e mensagens avulsas. Esse arranjo gera risco recorrente de descumprimento de prazos legais e contratuais, retrabalho administrativo, dificuldade de auditoria e ausência de visão consolidada do desempenho mensal por órgão atendido. A demanda visa substituir esse cenário por um ecossistema integrado, com cálculo automático de SLA em dias úteis, alertas tempestivos por e-mail e WhatsApp aos gestores responsáveis pela etapa em atraso e dashboard gerencial com indicadores em tempo real.

A contratação beneficiará diretamente os seis principais órgãos atendidos pela Belém Digital — SECOM, SEFIN, SEMEC, SESMA, SEMMA e APMB — bem como a própria Belém Digital em sua gestão interna, abrangendo dezenas de contratos ativos com tramitação mensal e ciclos plurimensais de até 36 meses. A solução assegura escalabilidade horizontal para incorporação de novos órgãos, segurança de dados em conformidade irrestrita com a Lei nº 13.709/2018 (LGPD) — incluindo trilha de auditoria imutável com retenção mínima de 2 (dois) anos, criptografia em repouso AES-256, transporte por TLS 1.3, autenticação institucional via Active Directory e GOV.BR, autorização baseada em papéis (RBAC), backups regra 3-2-1, plano de resposta a incidentes em até 72 (setenta e duas) horas, Relatório de Impacto à Proteção de Dados Pessoais (RIPD) documentado e Encarregado pelo Tratamento de Dados Pessoais (DPO) formalmente designado — e eficiência operacional comprovada por meio de SLA contratual de 99,5% de disponibilidade, RTO de 4 (quatro) horas e RPO máximo de 24 (vinte e quatro) horas. Cabe destacar que o MVP funcional da plataforma já foi validado em ambiente de desenvolvimento, contemplando todas as funcionalidades-núcleo descritas, o que mitiga significativamente o risco técnico e o prazo de implantação produtiva.

## 3. Alinhamento ao Planejamento Estratégico

3.1. A presente contratação deverá ser incorporada ao Plano Anual de Contratações (PAC) do exercício de 2026 da SEMAD, em conformidade com a Lei nº 14.133/2021 e a Instrução Normativa SEGES/ME nº 58/2022. Caso a demanda não conste do PAC vigente, deverá ser providenciada a respectiva inclusão por revisão extraordinária previamente à abertura do processo de inexigibilidade, tendo em vista a criticidade administrativa da solução e seu alinhamento com as diretrizes municipais de transformação digital.

## 4. Prazo desejado e cronograma

4.1. O prazo de vigência contratual desejado é de 12 (doze) meses, contados a partir da assinatura, com possibilidade de prorrogação na forma da legislação aplicável. A implantação inicial deverá ocorrer em até 90 (noventa) dias corridos após a assinatura, contemplando: (a) nos primeiros 30 dias, prova de conceito de integração com SSO institucional, desenho técnico final e provisionamento dos ambientes de desenvolvimento, homologação e produção; (b) entre 31 e 60 dias, desenvolvimento dos módulos não cobertos pelo MVP (backend, banco PostgreSQL, RBAC, trilha de auditoria) e integrações de notificação; (c) entre 61 e 90 dias, testes integrados, homologação pela SEMAD, treinamento dos usuários e migração definitiva para produção. A operação continuada (suporte 24x7, backups, monitoramento e manutenção evolutiva) iniciará imediatamente após o recebimento inicial e se estenderá pelos 9 (nove) meses restantes do contrato.

## 5. Indicação do fornecedor

5.1. Contratação da Belém Digital, entidade da administração pública indireta da Prefeitura Municipal de Belém, constituída sob a forma de sociedade de economia mista nos termos da Lei Municipal nº 7.217/1982, que tem como função principal o desenvolvimento de soluções de tecnologia da informação para o município. A contratação enquadra-se na hipótese de inexigibilidade de licitação prevista no art. 74 da Lei nº 14.133/2021, combinada com o art. 30 da Lei nº 13.303/2016 (Estatuto das Estatais), em razão da natureza singular dos serviços, do domínio exclusivo da contratada sobre os fluxos administrativos internos dos órgãos municipais e da identidade visual institucional, e da especialização técnica consolidada da Belém Digital atestada por sua atuação histórica junto à administração pública municipal de Belém.

## 6. Dados pessoais ou sensíveis envolvidos (LGPD)

(X) SIM. Quais?  ( ) NÃO

6.1. A solução tratará as seguintes categorias de dados pessoais, todas com base legal de execução de política pública (art. 7º, III, da Lei nº 13.709/2018 — LGPD):

- **Dados de identificação e contato funcional de gestores** das diretorias DTI, DSI, DAF e da Presidência da Belém Digital, bem como dos órgãos clientes (SECOM, SEFIN, SEMEC, SESMA, SEMMA, APMB e outros eventualmente incorporados): nome completo, cargo/função, e-mail funcional institucional e número de telefone celular para notificação via WhatsApp Business.
- **Dados de autoria e auditoria operacional**: identificação do usuário autenticado, endereço IP de origem, data e horário de cada operação executada na plataforma (criação, edição, avanço ou desfazer de etapas, disparo de notificações), armazenados em trilha de auditoria imutável com retenção mínima de 2 (dois) anos para fins de prestação de contas e compliance.
- **Dados contratuais administrativos**: números de contratos, processos administrativos e notas fiscais, com vinculação aos órgãos contratantes.

Em conformidade com a LGPD, a contratada deverá implementar todas as medidas técnicas e administrativas exigidas pela legislação, incluindo a elaboração e manutenção do Relatório de Impacto à Proteção de Dados Pessoais (RIPD), a designação formal do Encarregado pelo Tratamento de Dados Pessoais (DPO), a observância dos direitos dos titulares previstos no art. 18 da LGPD, a notificação à Autoridade Nacional de Proteção de Dados (ANPD) e aos titulares em caso de incidente de segurança no prazo máximo de 72 (setenta e duas) horas, e a adoção das medidas de segurança detalhadas no Termo de Referência (criptografia AES-256 em repouso, TLS 1.3 em trânsito, WAF, SSO com MFA obrigatório, RBAC, backups 3-2-1 com teste mensal de restauração).

---

Belém, 18 de maio de 2026.

___________________________
[A definir]
[CARGO]
SEMAD

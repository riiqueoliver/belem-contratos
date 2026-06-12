# ESTUDO TÉCNICO PRELIMINAR — ETP

**Secretaria requisitante:** Secretaria Municipal de Administração - SEMAD
**Objeto:** Contratação da Belém Digital para desenvolvimento, implantação, hospedagem segura, suporte 24x7 e manutenção evolutiva do Sistema de Gestão de Contratos – Belém Digital
**Processo administrativo nº:** A definir

---

## 1. Descrição da necessidade da contratação

1.1. A SEMAD identificou a necessidade de contratação de plataforma web especializada para o acompanhamento eletrônico do ciclo de tramitação dos contratos administrativos firmados entre a Belém Digital e os órgãos da administração pública municipal, contemplando as 6 (seis) etapas do fluxo institucional — Emissão da Nota Fiscal; Elaboração dos Relatórios DTI e DSI; Unificação documental em PDF; Assinaturas das diretorias DTI, DSI e DAF; Assinatura da Presidência; e Envio ao Cliente —, com o objetivo de garantir o cumprimento tempestivo dos prazos legais e contratuais, fortalecer a governança administrativa e prover indicadores gerenciais consolidados por mês de referência.

1.2. A modernização é indispensável para viabilizar rotinas operacionais adequadas ao volume de aproximadamente 6 (seis) órgãos municipais principais atualmente atendidos pela Belém Digital — SECOM, SEFIN, SEMEC, SESMA, SEMMA e APMB —, com possibilidade de incorporação progressiva de novos órgãos partícipes, totalizando dezenas de contratos ativos com tramitação mensal e ciclos plurimensais de até 36 (trinta e seis) meses, substituindo o controle manual descentralizado em planilhas eletrônicas e mensagens avulsas pela operação em ecossistema digital integrado, auditável e com automação de SLA.

1.3. A ausência de uma ferramenta única, com cálculo automático de prazos em dias úteis, semáforo de vencimento, alertas tempestivos por e-mail e WhatsApp aos gestores responsáveis pela etapa em atraso e trilha de auditoria imutável, compromete a eficiência administrativa, gera risco recorrente de descumprimento de prazos contratuais, dificulta a prestação de contas e impede a visão consolidada do desempenho mensal por órgão atendido, evidenciando a urgência de ferramentas que promovam controle proativo, rastreabilidade e governança contratual.

1.4. A contratação visa assegurar a economicidade, eficiência e a melhoria da qualidade dos serviços administrativos prestados pela Belém Digital aos órgãos da Prefeitura Municipal de Belém, em consonância com as diretrizes do município de Belém para transformação digital, profissionalização da gestão pública e conformidade irrestrita com a Lei Geral de Proteção de Dados (LGPD).

## 2. Alinhamento com o planejamento estratégico

2.1. A presente demanda deverá constar do Plano Anual de Contratações (PAC) da SEMAD para o exercício vigente, estando plenamente alinhada às diretrizes estratégicas de modernização e eficiência da gestão pública municipal, conforme exigência da Instrução Normativa SEGES/ME nº 58/2022 e da Lei nº 14.133/2021. Caso a demanda não conste do PAC vigente, deverá ser providenciada a respectiva inclusão por revisão extraordinária previamente à abertura do processo de inexigibilidade.

## 3. Requisitos da contratação

3.1. A contratação exige disponibilidade de serviço em regime 24x7 (vinte e quatro horas por dia, sete dias por semana), com SLA contratual de 99,5% (noventa e nove vírgula cinco por cento) de disponibilidade mensal, RTO (Recovery Time Objective) máximo de 4 (quatro) horas e RPO (Recovery Point Objective) máximo de 24 (vinte e quatro) horas, suporte técnico contínuo com atendimento por severidade (crítico em 1 hora, alto em 4 horas, médio em 8 horas, baixo em 24 horas úteis) e manutenção evolutiva contemplada para ajustes funcionais não estruturantes.

3.2. É requisito mandatório que a futura contratada adote protocolos avançados de segurança da informação, assegurando integridade e confidencialidade dos dados do município. Os dados sensíveis devem ser mantidos em ambiente de datacenter certificado, com acesso rigorosamente controlado e criptografado, garantindo conformidade irrestrita com a Lei Geral de Proteção de Dados (LGPD).

3.3. São requisitos técnicos específicos de segurança a serem observados pela contratada: (a) cifragem em trânsito por TLS 1.3 com HSTS habilitado e cabeçalhos CSP, X-Frame-Options e X-Content-Type-Options conforme melhores práticas OWASP; (b) cifragem em repouso AES-256 aplicada ao banco de dados, aos backups e aos discos; (c) autenticação institucional integrada ao Active Directory corporativo, com fallback para GOV.BR (OAuth 2.0) e MFA obrigatório para perfis Operador e Administrador; (d) autorização baseada em papéis (RBAC) com três perfis distintos — Visualizador, Operador e Administrador —, com verificação no servidor; (e) Web Application Firewall (WAF) e proteção contra DDoS; (f) backups automatizados sob regra 3-2-1 (três cópias, duas mídias distintas, uma offsite), com teste mensal documentado de restauração; (g) trilha de auditoria imutável com retenção mínima de 2 (dois) anos, registrando autor, data, hora, IP de origem e natureza da operação; (h) plano de resposta a incidentes de segurança com comunicação à Autoridade Nacional de Proteção de Dados (ANPD) e aos titulares em até 72 (setenta e duas) horas, conforme exigência da LGPD; (i) elaboração e manutenção do Relatório de Impacto à Proteção de Dados Pessoais (RIPD) e designação formal do Encarregado pelo Tratamento de Dados Pessoais (DPO).

3.4. É igualmente requisito a integração com o servidor de SMTP institucional da Prefeitura Municipal de Belém para envio de alertas por e-mail e com plataforma homologada de WhatsApp Business (Twilio, Evolution API ou equivalente) para notificações instantâneas aos gestores responsáveis pelas etapas em atraso.

## 4. Levantamento de mercado e solução escolhida

4.1. Como solução técnica e administrativa mais viável, identificou-se a contratação direta da Belém Digital, entidade da administração pública indireta da Prefeitura Municipal de Belém, constituída sob a forma de sociedade de economia mista nos termos da Lei Municipal nº 7.217/1982, configurando hipótese de inexigibilidade de licitação prevista no art. 74 da Lei nº 14.133/2021, combinada com o art. 30 da Lei nº 13.303/2016 (Estatuto das Estatais).

4.2. A Belém Digital detém a expertise necessária por ter como função principal o desenvolvimento de soluções de TI para o município. Sua atuação assegura economia de escala, integração nativa com a identidade visual institucional, alinhamento com os fluxos administrativos internos dos órgãos municipais e dispensa customizações onerosas em sistemas genéricos de mercado. Soma-se a isso o fato de a contratada deter MVP funcional já validado em ambiente de desenvolvimento, contemplando todas as funcionalidades-núcleo do escopo (dashboard de KPIs por mês, navegação por mês de referência, fluxo de 6 etapas, cálculo de SLA em dias úteis com semáforo, alertas por e-mail e WhatsApp, cadastro de gestores com vínculo a etapas, desfazer última etapa, geração automática de parcelas mensais e persistência local), o que reduz substancialmente o risco técnico e o prazo de implantação produtiva.

4.3. Foram avaliadas, no levantamento de mercado, três alternativas técnicas, descritas a seguir com a respectiva análise de viabilidade:

a) **Manutenção do controle manual em planilhas eletrônicas e mensagens avulsas** — alternativa descartada por perpetuar os riscos operacionais já identificados (descumprimento de prazos, retrabalho, ausência de auditoria, dificuldade de consolidação gerencial) e por contrariar as diretrizes municipais de transformação digital e conformidade com a LGPD;

b) **Contratação de plataforma SaaS genérica de mercado para gestão de contratos** — alternativa descartada por falta de aderência aos fluxos internos específicos da Belém Digital, especialmente quanto às 6 etapas particulares de tramitação (com assinaturas sucessivas das diretorias DTI, DSI, DAF e Presidência), à integração com o SSO institucional, ao licenciamento por usuário em escala incompatível com o orçamento e à ausência de garantia de tratamento dos dados em território nacional sob controle direto da administração pública municipal;

c) **Desenvolvimento e operação pela própria Belém Digital** — alternativa **escolhida**, por estar plenamente alinhada à missão institucional da estatal, aproveitar o MVP já validado, garantir a aderência exata aos fluxos internos, manter os dados sob governança da administração pública municipal e configurar a hipótese legal de inexigibilidade prevista no art. 74 da Lei nº 14.133/2021.

## 5. Estimativa do valor da contratação

5.1. O valor estimado para a contratação é de R$ 285.000,00 (duzentos e oitenta e cinco mil reais) para o período inicial de 12 (doze) meses. A precificação foi calculada de forma escalável, decomposta em parcela única de R$ 165.000,00 (cento e sessenta e cinco mil reais) referente ao desenvolvimento, implantação, integração com SSO institucional, adequação à LGPD e treinamento, somada a parcelas mensais de R$ 10.000,00 (dez mil reais) durante 12 (doze) meses referentes à operação, infraestrutura, suporte 24x7, backups, monitoramento, manutenção evolutiva e licenciamento de WAF, totalizando R$ 120.000,00 (cento e vinte mil reais) anuais para a parcela mensal. A base de cálculo considerou os preços praticados pela Belém Digital em contratos de igual natureza para outros órgãos da administração pública municipal de Belém, conforme documentação comprobatória que integrará o processo administrativo.

| Item | Descrição dos Serviços | Unid | Valor Total Máximo (R$) |
|------|------------------------|------|--------------------------|
| 01   | Desenvolvimento, implantação, integração com SSO institucional, adequação à LGPD, treinamento e documentação técnica do Sistema de Gestão de Contratos – Belém Digital (parcela única) | Serviço | 165.000,00 |
| 02   | Operação, hospedagem em datacenter institucional, suporte técnico 24x7, backups automatizados 3-2-1, monitoramento, manutenção evolutiva (até 40 horas-técnicas/mês) e licenciamento de WAF/SSO/WhatsApp Business (12 meses × R$ 10.000,00) | Mês | 120.000,00 |
| | **VALOR TOTAL ESTIMADO** | | **R$ 285.000,00** |

## 6. Descrição da solução

6.1. A solução consiste em plataforma web responsiva, acessada por navegador padrão (Chrome, Edge, Firefox, Safari) sem necessidade de instalação local, hospedada em datacenter institucional da Belém Digital sob arquitetura cliente-servidor segura. O frontend será desenvolvido em React/TypeScript com build versionado (Vite), eliminando dependência de CDN em tempo de execução; o backend será desenvolvido em Node.js ou Python (FastAPI) com banco de dados PostgreSQL 15 ou superior; toda a comunicação ocorrerá por HTTPS com TLS 1.3, autenticação via SSO institucional (Active Directory ou GOV.BR) com MFA obrigatório e autorização RBAC verificada no servidor.

6.2. **Módulo de Cadastro de Contratos** — permite o registro de contratos administrativos contendo número do contrato, número do processo administrativo, número da nota fiscal, data de emissão da nota fiscal, órgão/cliente, responsável e vigência em parcelas mensais (até 36 meses), com geração automática de uma instância de tramitação por mês para contratos plurimensais.

6.3. **Módulo de Tramitação em 6 Etapas** — implementa o fluxo institucional Emissão NF → Relatórios DTI/DSI → PDF Unificado → Assinaturas DTI/DSI/DAF → Assinatura Presidente → Envio ao Cliente, com botões de avanço de etapa, função de desfazer a última etapa (com registro em auditoria), cálculo automático do prazo SLA em dias úteis (considerando segunda a sexta-feira), exibição de semáforo verde (no prazo), amarelo (vence hoje) e vermelho (atrasado), e destaque visual proeminente da etapa atual em cada contrato.

6.4. **Módulo de Notificações** — dispara alertas automáticos por e-mail (via SMTP institucional) e WhatsApp (via API WhatsApp Business homologada) aos gestores cadastrados como responsáveis pela etapa em atraso, com botões manuais de reenvio disponíveis em cada cartão de contrato em estado amarelo ou vermelho. Os gestores são mantidos em cadastro próprio, com vínculo explícito às etapas que acompanham (um mesmo gestor pode acompanhar múltiplas etapas).

6.5. **Módulo de Dashboard e Indicadores** — apresenta KPIs consolidados por mês de referência (Total de Contratos, No Prazo, Vence Hoje, Atrasados), navegação por meses (anteriores e seguintes) com contagem de contratos por mês, legenda do semáforo de SLA e listagem detalhada dos contratos do mês selecionado.

6.6. **Módulo de Auditoria e Conformidade LGPD** — registra de forma imutável toda operação sensível (criação/edição/exclusão de contratos e contatos, avanço e desfazer de etapas, disparo de notificações, login/logout), com retenção mínima de 2 (dois) anos, exportação sob demanda, RIPD atualizado e plano de resposta a incidentes em até 72 (setenta e duas) horas.

6.7. A operacionalização ocorrerá imediatamente após a assinatura contratual, possuindo como metas: entrega da prova de conceito de integração com SSO institucional em até 30 (trinta) dias; entrega dos módulos não cobertos pelo MVP (backend, banco PostgreSQL, RBAC, trilha de auditoria) e das integrações de notificação em até 60 (sessenta) dias; e disponibilização da plataforma em ambiente de produção, com todas as funcionalidades validadas e migração concluída, em até 90 (noventa) dias corridos contados da assinatura.

6.8. Vincula-se ao presente ETP todos os demais regramentos dispostos no Termo de Referência, Ata e Edital, do Órgão Gerenciador da Ata, anexos ao presente processo administrativo.

## 7. Parcelamento da contratação

7.1. A contratação não deve ser parcelada, uma vez que se trata do fornecimento de um ecossistema digital integrado, no qual o frontend, o backend, o banco de dados, as integrações de notificação, a camada de autenticação institucional, a infraestrutura segura, os backups, a auditoria e o suporte continuado operam de maneira unificada sob a mesma arquitetura técnica. Dividir a execução entre fornecedores distintos romperia a integridade da arquitetura, comprometeria a responsabilidade única pelo SLA contratado, multiplicaria os pontos de falha de segurança e dificultaria substancialmente a aplicação consistente das exigências da LGPD em toda a cadeia de tratamento de dados.

## 8. Resultados pretendidos

8.1. **Modernização operacional** — substituição do controle manual descentralizado em planilhas pelo ecossistema digital integrado, com eliminação de redundâncias, automação do cálculo de prazos em dias úteis, notificação proativa dos gestores responsáveis por etapas em atraso e visão consolidada por mês de referência, permitindo à SEMAD e à Belém Digital atuar de forma preventiva sobre desvios de SLA.

8.2. **Conformidade administrativa e jurídica** — total conformidade administrativa com a Lei nº 14.133/2021, com a Lei nº 13.709/2018 (LGPD) e com as boas práticas de governança de TI da administração pública, coibindo inconsistências documentais, garantindo trilha de auditoria imutável com retenção mínima de 2 (dois) anos e provendo evidências completas para eventual fiscalização interna, externa ou pelo TCM-PA.

8.3. **Transparência e auditabilidade** — assegurar a lisura, a igualdade de condições no tratamento dos órgãos atendidos e a plena auditabilidade do fluxo de tramitação, com registro completo de quem realizou cada operação, quando e a partir de qual endereço de origem, viabilizando a prestação de contas tempestiva à Presidência da Belém Digital e à própria SEMAD.

8.4. **Segurança da informação** — garantir a proteção dos dados pessoais dos gestores cadastrados (nome, cargo, e-mail funcional, WhatsApp) e dos dados contratuais administrativos por meio das camadas técnicas previstas no item 3.3 — criptografia em repouso e em trânsito, WAF, SSO institucional com MFA, RBAC, backups 3-2-1 e resposta a incidentes em 72h.

## 9. Providências para adequação do ambiente

9.1. Será necessário que a SEMAD designe equipe interna competente, com perfil técnico em tecnologia da informação e gestão de contratos administrativos, para validação técnica da plataforma durante a implantação e emissão formal do Termo de Aceite de Entrega ao término dos 90 (noventa) dias iniciais. Caberá também à contratante: (a) viabilizar, em conjunto com a equipe de TI da Prefeitura, o acesso ao Active Directory corporativo para integração de SSO; (b) homologar a base inicial de gestores e contatos a serem importados para o cadastro vinculado às etapas; (c) emitir e manter atualizadas as parametrizações legais e operacionais (papéis RBAC, vínculos etapa-gestor, regras de notificação); e (d) realizar o pagamento adequado das obrigações mensais decorrentes do contrato, observados os indicadores de SLA mensurados a cada ciclo.

## 10. Contratações correlatas e/ou interdependentes

10.1. Não foram identificadas contratações adicionais de caráter interdependente ligadas a este escopo, haja vista que as obrigações necessárias — desenvolvimento, infraestrutura, suporte, backups, WAF, SSO institucional, integrações de SMTP e WhatsApp Business — já se encontram absorvidas no escopo central e no custo desta contratação, sob responsabilidade única da contratada.

## 11. Impactos ambientais

11.1. O impacto ambiental decorrente da execução deste projeto é expressivamente benéfico ao ecossistema urbano. A implementação de sistema digital integrado promove o fim da tramitação de arquivos físicos e da emissão de cópias impressas para coleta de assinaturas nas diretorias DTI, DSI, DAF e na Presidência, refletindo em economia de recursos naturais, redução do consumo de papel, energia e insumos de impressão, eliminação de deslocamentos físicos para entrega de documentos e mitigação da geração de resíduos sólidos administrativos. A arquitetura prevê ainda uso eficiente de recursos computacionais (virtualização, contêineres e dimensionamento elástico) e priorização, quando disponível, de datacenter com matriz energética renovável certificada, enquadrando-se nas premissas de sustentabilidade da gestão pública.

## 12. Declaração de viabilidade

12.1. Sustentada pela urgência em promover a transformação digital da gestão administrativa dos contratos celebrados entre a Belém Digital e os órgãos da administração pública municipal, pelo atendimento de dezenas de contratos ativos com tramitação mensal em 6 (seis) órgãos prioritariamente beneficiados (SECOM, SEFIN, SEMEC, SESMA, SEMMA e APMB), aliada à economicidade, agilidade e segurança jurídica garantidas pela contratação por inexigibilidade nos termos do art. 74 da Lei nº 14.133/2021 combinado com a Lei nº 13.303/2016, à plena conformidade com a Lei nº 13.709/2018 (LGPD) e ao baixo risco técnico decorrente do MVP funcional já validado, esta equipe de planejamento declara ser tecnicamente e administrativamente viável e vantajosa a efetivação da presente contratação.

---

Belém, 19 de maio de 2026.

**Equipe de planejamento:**
- [A definir] — [Cargo] — Matrícula nº xxxxxx
- [A definir] — [Cargo] — Matrícula nº xxxxxx

# TERMO DE REFERÊNCIA - Nº 001/2026

**Secretaria requisitante:** Secretaria Municipal de Administração - SEMAD
**Processo administrativo nº:** A definir

---

## 1. DO OBJETO DA CONTRATAÇÃO

1.1. Contratação da Belém Digital para a prestação de serviços técnicos especializados de desenvolvimento, implantação, hospedagem, suporte e manutenção evolutiva do **Sistema de Gestão de Contratos – Belém Digital**, plataforma web destinada ao acompanhamento eletrônico do ciclo de tramitação de contratos administrativos firmados entre a Belém Digital e os órgãos da administração pública municipal, com o objetivo de atender às necessidades técnicas, operacionais e de conformidade da SEMAD e demais órgãos partícipes.

1.2. O escopo da contratação contempla: (a) migração do MVP atual (single-page application em HTML/React com persistência local) para arquitetura cliente-servidor produtiva; (b) desenvolvimento de backend RESTful com banco de dados PostgreSQL; (c) implantação de camada de autenticação institucional (SSO via Active Directory ou GOV.BR) e autorização baseada em papéis (RBAC); (d) integrações com APIs corporativas de notificação por e-mail (SMTP institucional) e WhatsApp Business; (e) provisionamento de infraestrutura segura em datacenter da Belém Digital, com WAF, criptografia em repouso e em trânsito, backups automatizados e monitoramento 24x7; (f) adequação plena à Lei nº 13.709/2018 (LGPD), incluindo trilha de auditoria imutável, RIPD e atuação do DPO; (g) documentação técnica, treinamento de usuários e suporte continuado pelo prazo de vigência contratual.

## 2. BENS E SERVIÇOS QUE COMPÕEM A SOLUÇÃO

| Item | Descrição | Qtd. | Unidade |
|---|---|---|---|
| 2.1 | Análise de requisitos, modelagem de dados e desenho da arquitetura de software e segurança, com base no MVP funcional já validado | 1 | serviço |
| 2.2 | Desenvolvimento de frontend em React/TypeScript, com build versionado (Vite), eliminando dependência de CDN em tempo de execução | 1 | serviço |
| 2.3 | Desenvolvimento de backend RESTful (Node.js ou Python/FastAPI) com banco de dados PostgreSQL 15+, contemplando endpoints para CRUD de contratos, contatos, parcelas mensais, lançamentos de etapas e trilha de auditoria | 1 | serviço |
| 2.4 | Implantação de motor de cálculo de SLA em dias úteis, com semáforo verde/amarelo/vermelho aderente às regras de prazos das 6 etapas (Emissão NF, Relatórios DTI/DSI, PDF Unificado, Assinaturas DTI/DSI/DAF, Assinatura Presidente, Envio ao Cliente) | 1 | serviço |
| 2.5 | Integração com SMTP institucional da Prefeitura para envio de alertas por e-mail aos gestores responsáveis pela etapa em atraso | 1 | serviço |
| 2.6 | Integração com API WhatsApp Business (Twilio, Evolution API ou equivalente homologado) para envio de notificações instantâneas | 1 | serviço |
| 2.7 | Implementação de geração automática de parcelas mensais para contratos de vigência plurimensal (3, 6, 12, 24 e 36 meses) | 1 | serviço |
| 2.8 | Implementação de função de desfazer (undo) do lançamento da última etapa, com registro em trilha de auditoria | 1 | serviço |
| 2.9 | Infraestrutura de hospedagem em datacenter institucional da Belém Digital: 2 vCPU, 4 GB RAM, 50 GB SSD criptografado para o ambiente de produção; ambientes adicionais de homologação e desenvolvimento dimensionados pela contratada | 1 | mês |
| 2.10 | Solução de WAF (Web Application Firewall), proteção contra DDoS, monitoramento de vulnerabilidades e enforcement de cabeçalhos HSTS, CSP, X-Frame-Options | 1 | mês |
| 2.11 | Implantação de SSO institucional (LDAP/Active Directory) com fallback para autenticação GOV.BR via OAuth 2.0, com MFA obrigatório para perfis de operação e administração | 1 | serviço |
| 2.12 | Backups automatizados regra 3-2-1 (três cópias, duas mídias distintas, uma offsite), com criptografia AES-256 e teste mensal de restauração documentado | 1 | mês |
| 2.13 | Trilha de auditoria imutável (quem, o quê, quando, de onde), com retenção mínima de 2 (dois) anos e exportação sob demanda | 1 | mês |
| 2.14 | Suporte técnico 24x7 com SLA de atendimento por severidade (crítico 1h, alto 4h, médio 8h, baixo 24h úteis) | 12 | meses |
| 2.15 | Manutenção evolutiva (até 40 horas-técnicas/mês para ajustes funcionais não estruturantes) | 12 | meses |
| 2.16 | Documentação técnica completa (arquitetura, modelo de dados, manuais de operação, RIPD, plano de resposta a incidentes) e treinamento presencial/EAD de até 30 usuários | 1 | serviço |

## 3. JUSTIFICATIVA LEGAL E CONTEXTUALIZAÇÃO DA CONTRATAÇÃO

3.1. A contratação é fundamental para a SEMAD garantir a modernização e o controle eficiente da tramitação dos contratos administrativos celebrados entre a Belém Digital e os órgãos da administração pública municipal — SECOM, SEFIN, SEMEC, SESMA, SEMMA, APMB, entre outros —, substituindo controles manuais e descentralizados em planilhas por uma plataforma única, auditável, com alertas automatizados de SLA e indicadores gerenciais por mês de referência. A solução reduz risco de inadimplência de prazos, fortalece a governança contratual e provê transparência institucional à tramitação de notas fiscais e relatórios técnicos das diretorias DTI, DSI e DAF até a assinatura da Presidência e envio ao cliente.

3.2. A Belém Digital é uma entidade da administração pública indireta da Prefeitura Municipal de Belém, constituída como sociedade de economia mista nos termos da Lei Municipal nº 7.217/1982, com função principal de desenvolver, implantar e operar soluções de tecnologia da informação para o município, possuindo know-how técnico exclusivo sobre os fluxos administrativos, infraestrutura corporativa e padrões de identidade visual e segurança institucional.

3.3. A contratação da Belém Digital se justifica pela natureza singular dos serviços, pelo domínio exclusivo dos fluxos internos de tramitação contratual entre os órgãos municipais e pela especialização técnica consolidada da contratada, configurando hipótese de inexigibilidade de licitação prevista no art. 74, caput e incisos, da Lei nº 14.133/2021, combinado com o disposto na Lei nº 13.303/2016 (Estatuto das Estatais).

3.4. A solução enquadra-se como sistema crítico de gestão administrativa, sujeito integralmente à Lei nº 13.709/2018 (LGPD), por tratar dados pessoais de gestores públicos (nome, cargo, e-mail funcional, número de WhatsApp) e dados contratuais com finalidade de execução de política pública (art. 7º, III, da LGPD), o que reforça a necessidade de contratação com entidade tecnicamente capacitada e vinculada à administração municipal.

## 4. DO LOCAL DE EXECUÇÃO

4.1. Os serviços serão prestados na infraestrutura de datacenter da Belém Digital, com gerenciamento e acesso remoto seguro pela equipe técnica da SEMAD e pelos demais órgãos partícipes mediante credenciais SSO. As atividades de desenvolvimento, implantação, suporte e manutenção evolutiva poderão ser executadas remotamente, com reuniões presenciais quando solicitado pela contratante.

## 5. OBRIGAÇÕES DA CONTRATADA

5.1. Disponibilizar e manter a infraestrutura de produção, homologação e desenvolvimento dimensionada conforme o item 2.9, com SLA de disponibilidade mínima de 99,5% (noventa e nove vírgula cinco por cento) em janela mensal, RTO (Recovery Time Objective) de 4 (quatro) horas e RPO (Recovery Point Objective) máximo de 24 (vinte e quatro) horas.

5.2. Garantir acesso remoto seguro à plataforma exclusivamente por canal HTTPS com TLS 1.3, com enforcement de HSTS, cabeçalhos CSP, X-Frame-Options e X-Content-Type-Options, conforme melhores práticas OWASP.

5.3. Implantar e operar autenticação institucional via Active Directory corporativo, com fallback para GOV.BR (OAuth 2.0), MFA obrigatório para os perfis Operador e Administrador, bloqueio progressivo após 5 (cinco) tentativas falhas, sessão expirada por inatividade em 30 (trinta) minutos e registro de todas as autenticações em log centralizado.

5.4. Implementar controle de acesso baseado em papéis (RBAC) com, no mínimo, três perfis distintos — Visualizador (somente leitura), Operador (avanço/desfazer etapas e disparo de notificações) e Administrador (CRUD completo, gestão de contatos e auditoria) — sendo toda autorização verificada no servidor.

5.5. Realizar backups automatizados diários sob regra 3-2-1, com criptografia AES-256 em repouso, armazenamento de uma cópia offsite e teste mensal documentado de restauração, mantendo retenção mínima de 90 (noventa) dias para backups diários e 12 (doze) meses para backups mensais.

5.6. Manter trilha de auditoria imutável de todas as operações sensíveis (criação/edição/exclusão de contratos e contatos, avanço e desfazer de etapas, disparo de notificações, login/logout, alterações de perfis), com retenção mínima de 2 (dois) anos e capacidade de exportação sob demanda para a contratante.

5.7. Assegurar que o datacenter atenda aos padrões de segurança física e lógica institucionais, incluindo solução de Web Application Firewall (WAF), proteção contra DDoS, varredura de vulnerabilidades automatizada em CI/CD e pentest anual, com remediação tempestiva das vulnerabilidades identificadas.

5.8. Prestar suporte técnico contínuo (24x7) para manter a disponibilidade e estabilidade da plataforma, atuando prontamente em caso de falhas conforme o SLA por severidade definido no item 2.14, com canal de abertura de chamados via portal web, e-mail e telefone.

5.9. Manter sigilo e confidencialidade absolutos sobre todos os dados e informações da SEMAD e dos órgãos partícipes, em conformidade com a Lei nº 13.709/2018 (LGPD), elaborando e mantendo atualizado o Relatório de Impacto à Proteção de Dados Pessoais (RIPD), indicando formalmente o Encarregado pelo Tratamento de Dados Pessoais (DPO) e cumprindo os direitos dos titulares previstos no art. 18 da LGPD.

5.10. Implementar plano de resposta a incidentes de segurança, com comunicação à contratante e à Autoridade Nacional de Proteção de Dados (ANPD) no prazo máximo de 72 (setenta e duas) horas a contar da ciência do incidente, conforme exigência da LGPD.

5.11. Manter o sigilo profissional em relação a todas as decisões do Planejamento, fluxos administrativos internos da Belém Digital e dados gerenciais expostos pela plataforma.

5.12. Responsabilizar-se integralmente por todos os encargos trabalhistas, previdenciários, fiscais e comerciais decorrentes da execução do contrato, sem qualquer vínculo empregatício entre a equipe técnica alocada e a contratante.

5.13. Implementar práticas de compliance, governança de TI e DevSecOps, com atualização contínua de dependências (Dependabot/Snyk ou equivalente), separação estrita de ambientes (desenvolvimento, homologação, produção), uso de dados sintéticos fora de produção e princípio do menor privilégio em acessos administrativos.

5.14. Entregar, ao final do contrato ou em caso de rescisão, todos os dados, código-fonte, documentação e bases armazenadas em formato aberto e estruturado, no prazo máximo de 30 (trinta) dias corridos, garantindo a portabilidade e continuidade do serviço pela contratante ou por terceiro indicado.

## 6. PREÇO DE REFERÊNCIA OU ORÇAMENTO ESTIMADO

6.1. O valor total estimado para a contratação dos serviços é de R$ 285.000,00 (duzentos e oitenta e cinco mil reais) pelo período de 12 (doze) meses, sendo aproximadamente R$ 165.000,00 (cento e sessenta e cinco mil reais) referentes às entregas de desenvolvimento, implantação e adequação à LGPD (parcela única na entrega) e R$ 10.000,00 (dez mil reais) mensais referentes à operação, suporte 24x7, infraestrutura, backups, manutenção evolutiva de até 40 horas/mês e licenciamento de WAF/SSO/WhatsApp Business — totalizando R$ 120.000,00 (cento e vinte mil reais) anuais para a parcela mensal. O valor foi estimado com base nos preços praticados pela Belém Digital em contratos de igual natureza para outros órgãos da administração pública municipal de Belém, conforme documentação comprobatória anexa.

## 7. CRITÉRIO DE JULGAMENTO DAS PROPOSTAS

7.1. A contratação ocorrerá por inexigibilidade de licitação, com base na natureza singular do serviço e na especialização técnica exclusiva da Belém Digital sobre os fluxos administrativos internos da própria entidade e dos órgãos municipais, conforme art. 74 da Lei nº 14.133/2021 e art. 30 da Lei nº 13.303/2016.

## 8. QUALIFICAÇÃO TÉCNICA E ECONÔMICO-FINANCEIRA

8.1. A qualificação jurídica, técnica e econômico-financeira da Belém Digital é atestada por sua constituição via Lei Municipal nº 7.217/1982, sua atuação consolidada no fornecimento de soluções de tecnologia da informação para a administração pública municipal de Belém e seu histórico de execução de contratos de natureza semelhante junto a órgãos do mesmo município, comprovado por meio de atestados de capacidade técnica anexos.

## 9. VISITA TÉCNICA

9.1. Não Aplicável. A natureza dos serviços é eminentemente lógica/digital e dispensa visita técnica presencial. Eventuais reuniões de alinhamento técnico ocorrerão remotamente ou nas dependências da SEMAD/Belém Digital conforme conveniência das partes.

## 10. SUBCONTRATAÇÃO

10.1. É permitida a subcontratação parcial de serviços acessórios (como licenças de WAF, plataformas de envio de WhatsApp Business e ferramentas de monitoramento), desde que previamente aprovada pela Companhia de Tecnologia de Belém (CINBESA), assegurando que os subcontratados atendam aos mesmos padrões técnicos, de segurança e jurídicos exigidos da contratada, em especial às cláusulas de LGPD. A subcontratação integral do objeto é vedada.

## 11. FORMA DE RECEBIMENTO

11.1. O recebimento inicial dos serviços se dará em até 90 (noventa) dias corridos após a assinatura do contrato, com a efetiva disponibilização da plataforma em ambiente de produção, integrada ao SSO institucional, com todas as funcionalidades validadas no MVP em pleno funcionamento e migração concluída.

11.2. O recebimento subsequente será mensal, mediante a verificação da continuidade e qualidade dos serviços prestados, comprovada pelo cumprimento dos SLAs de disponibilidade (item 5.1), tempo de resposta de suporte (item 2.14), execução dos backups (item 5.5) e ausência de incidentes de segurança não tratados.

## 12. GARANTIA CONTRATUAL

12.1. A exigência de garantia contratual será dispensada para esta contratação, conforme permitido pela Lei nº 13.303/2016, que prevê tal dispensa quando a contratação se dá por inexigibilidade.

12.2. Os pagamentos serão realizados apenas após a conclusão e validação dos serviços prestados, garantindo que os recursos públicos sejam liberados somente mediante comprovação da execução.

12.3. Esta metodologia de pagamento após a execução efetiva limita substancialmente o risco financeiro e administrativo para a Secretaria Municipal contratante.

12.4. A natureza do serviço e a modalidade de contratação por inexigibilidade, embasada na especialização técnica, asseguram um engajamento confiável da contratada.

## 13. PRAZO DE VIGÊNCIA

13.1. O prazo de vigência do contrato será de 12 (doze) meses, contados a partir da data de sua assinatura, com possibilidade de renovação por iguais e sucessivos períodos, até o limite legal.

13.2. Há possibilidade de renovação ou prorrogação do contrato, conforme previsto pela legislação aplicável e com base nas necessidades da SEMAD, mediante manifestação formal das partes e disponibilidade orçamentária.

## 14. PRAZO DE EXECUÇÃO

14.1. O prazo para a execução dos serviços será de 12 (doze) meses, com início imediato após a assinatura do contrato. A implantação inicial e disponibilização da plataforma em ambiente de produção ocorrerá em até 90 (noventa) dias corridos, conforme item 11.1.

## 15. ÍNDICE DE REAJUSTE

15.1. O valor do contrato estará sujeito a reajuste anual com base na variação do índice IPCA-E (Índice de Preços ao Consumidor Amplo - Especial), divulgado pelo IBGE.

## 16. CONDIÇÕES DE PAGAMENTO

16.1. O pagamento da parcela única referente ao desenvolvimento e implantação (item 2.1 a 2.8, 2.11 e 2.16) será efetuado em até 30 (trinta) dias após o recebimento inicial previsto em 11.1, mediante apresentação da nota fiscal correspondente e comprovação de entrega dos artefatos.

16.2. O pagamento das parcelas mensais referentes à operação, infraestrutura, suporte e manutenção evolutiva (itens 2.9, 2.10, 2.12, 2.13, 2.14 e 2.15) será efetuado mensalmente, após a prestação dos serviços e mediante a apresentação da nota fiscal correspondente, observados os indicadores de SLA do item 11.2.

## 17. REQUISITOS DE SUSTENTABILIDADE AMBIENTAL

17.1. A contratada deverá observar os seguintes itens de sustentabilidade:

17.2. Uso eficiente de recursos naturais, com adoção de virtualização, contêineres e dimensionamento elástico de infraestrutura para reduzir consumo energético do datacenter.

17.3. Implementação de práticas de gestão de resíduos eletrônicos, incluindo descarte adequado de equipamentos substituídos no ciclo de vida da infraestrutura.

17.4. Promoção de uma cultura organizacional sustentável entre os colaboradores, com incentivo ao trabalho remoto e à redução de deslocamentos físicos.

17.5. Adoção de tecnologias com menor impacto ambiental, priorizando datacenter com matriz energética renovável certificada quando disponível e otimização de código para reduzir consumo computacional.

## 18. MATRIZ DE RISCO

18.1. Riscos identificados e respectivas estratégias de mitigação:

| Risco | Probabilidade | Impacto | Mitigação | Responsável |
|---|---|---|---|---|
| Vazamento de dados pessoais de gestores (LGPD) | Baixa | Alto | Criptografia AES-256 em repouso e TLS 1.3 em trânsito; WAF; testes de penetração anuais; trilha de auditoria; RIPD atualizado | Contratada |
| Indisponibilidade da plataforma | Média | Alto | SLA 99,5% contratual; redundância de infraestrutura; backups 3-2-1; monitoramento 24x7 | Contratada |
| Falha na entrega de notificações por WhatsApp/e-mail | Média | Médio | Filas com retry exponencial; fallback entre canais; relatório de entrega disponível na plataforma | Contratada |
| Atraso na implantação inicial (90 dias) | Média | Médio | Cronograma com marcos quinzenais; uso do MVP funcional como base; reuniões semanais de acompanhamento | Contratada/Contratante |
| Incompatibilidade com SSO institucional | Baixa | Alto | Prova de conceito (PoC) de integração nos primeiros 30 dias; envolvimento prévio da equipe de TI institucional | Contratada/Contratante |
| Mudança regulatória da LGPD | Baixa | Médio | Acompanhamento contínuo pela DPO; manutenção evolutiva contemplada no contrato | Contratada |
| Subdimensionamento da infraestrutura | Baixa | Médio | Monitoramento de capacidade; cláusula de aditivo proporcional ao crescimento de uso | Contratada |

## 19. INDICAÇÃO DO FISCAL DO FUTURO CONTRATO E SEU SUPLENTE

19.1. A definir. Indicar fiscal titular e suplente, ambos servidores efetivos da SEMAD ou do órgão partícipe responsável pela coordenação operacional, com formação ou experiência em tecnologia da informação ou gestão de contratos administrativos. Recomenda-se nominação antes da publicação do contrato.

## 20. ANEXOS

20.1. Documentos que comprovem a prática do preço praticado pela contratada em serviços semelhantes (atestados de capacidade técnica e cópias de contratos análogos firmados com outros órgãos municipais).

20.2. ETP — Estudo Técnico Preliminar.

20.3. DFD — Documento de Formalização de Demanda.

20.4. Cronograma físico-financeiro detalhado do desenvolvimento e implantação (marcos de 30/60/90 dias).

20.5. Relatório de Impacto à Proteção de Dados Pessoais (RIPD) — minuta a ser entregue pela contratada nos primeiros 60 dias de contrato.

20.6. Plano de Resposta a Incidentes de Segurança — a ser entregue pela contratada nos primeiros 60 dias de contrato.

20.7. Documentação técnica do MVP validado, disponível em ambiente de desenvolvimento da SEMAD/Belém Digital, contendo as funcionalidades já homologadas que servirão de baseline funcional para o desenvolvimento.

---

Belém, 18 de maio de 2026.

__________________________
[A definir]
FISCAL DO CONTRATO

__________________________
[A definir]
DEPARTAMENTO ADMINISTRATIVO-FINANCEIRO - DAF

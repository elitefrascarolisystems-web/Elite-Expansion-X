# Elite Expansão — entrega parcial de implementação

Data: 08/10/2026. Base: versão 5, commit `76b1eaffb8442cd9b45e4194fefc95f922648681`.

**Situação: não concluído.** A implementação territorial e as correções abaixo têm evidências de execução local. Nenhum teste automatizado aqui equivale a homologação em Chrome, Safari, iPhone ou Android. Não foram criados usuários, campanhas, mensagens, pagamentos ou registros fictícios em produção.

## 1. Situação visual e funcional encontrada

Inspeção de código e do arquivo de marca, sem inspeção de tela em navegador. A interface existente usa preto e dourado, cartões, tabelas, abas e formulários. O mapa anterior desenhava referências municipais em CSS, sem mapa de ruas navegável. A marca existente contém “Elite Expansão”. Não foi possível confirmar que seja a logo oficial da Elite Frascaroli Academy.

A arquitetura existente foi mantida: React 19, Vinext, Vite, componentes shadcn, Worker Cloudflare, D1 SQLite, autenticação ChatGPT/Sites. A aplicação usa `/api/dashboard` para os módulos anteriores. Não houve reconstrução integral.

## 2. Capacidades anteriores preservadas

Cidades, embaixadores, CRM, vendas com estado de pagamento, custos, parceiros, eventos, materiais, tarefas, portal de embaixador, critérios de decisão e exportação CSV. O login e a saída continuam sob autenticação existente. Testes de domínio confirmam cálculo sem divisão por zero, pagamento como base do CAC e ausência de dupla contagem de consolidado/detalhado. Isso não certifica todos os cliques das telas anteriores.

## 3. Problemas e correções

| Prioridade | Evidência encontrada | Alteração | Validação |
| --- | --- | --- | --- |
| P0 | Coordenação tinha leitura global e autorização global de cidade | Escopo por cidade na consulta e nas mutações; novas coordenações exigem cidade | Testes executados com Coordenação/Líder e IDs de outra cidade |
| P1 | Validação de data incompatível com formulário de evento | Data AAAA-MM-DD real; datas inexistentes rejeitadas | Testes de evento válido e 31/02 inválido |
| P1 | Mapa esquemático sem cartografia | MapLibre com ruas OSM, controles e lista alternativa | Compilação/API/SSR; renderização em navegador pendente |
| P1 | Lead e embaixador sem identidade comum | Cadastro territorial compartilhado e escolha de pessoa existente | Um marcador para uma pessoa com dois papéis |
| P1 | Cadastro permitia ativação sem requisitos | Bloqueio no servidor até treinamento, aceite e atividade | Mutação rejeitada e fluxo autorizado executados |
| P2 | Filtros/pontos divergiam | Lista e pinos usam a mesma página de resposta | Paginação 200 + 30 e filtros combinados executados |
| P2 | Ausência de localização editável e follow-up | Referência aproximada, origem, validação, visibilidade, ações e indicação | SQLite/API executados; clique visual pendente |

## 4. Mapa territorial entregue no código

Mapa de ruas com zoom, rotação, escala, agrupamento visual, seleção, busca, filtro de cidade, papel/camada, situação e mês; lista alternativa e paginação de 200 registros. Camadas: cidade, pessoa, parceiro, evento, ação, líder, embaixador, lead, cliente com pagamento e follow-up. Ficha territorial, painel de indicadores da cidade, referências de localização, vínculos de indicação e ações persistentes. CRM tem “Ver no mapa”.

Pessoas usam referência municipal ou grade aproximada de 0,01 grau, próxima de 1 km. Coordenadas pessoais completas não são persistidas. Locais comerciais/públicos autorizados podem ter pino exato e abrir rota externa. Nenhum telefone, e-mail ou endereço residencial é incluído na resposta territorial. Localizações Admin são excluídas da consulta de outros perfis, inclusive busca por região. Embaixador só pode consultar seu próprio vínculo; Comercial só contatos atribuídos.

A contagem principal representa registros territoriais, não pessoas únicas de toda a operação. A camada Pessoas representa identidades únicas. Os pinos representam os registros geolocalizados da página atual; registros pendentes continuam na lista. Não há consulta geográfica por viewport nem agregação de toda a base no servidor.

Busca de endereços está preparada no servidor para `MAPTILER_GEOCODING_KEY`, sem chave configurada. Retorna erro explícito e permite pino manual. Satélite, híbrido, relevo e edifícios 3D não foram entregues. Nenhum controle desses modos foi simulado.

## 5. Identidade e design system

Preservados: `public/elite-expansao-logo.png` no acesso, cabeçalho e portal; `public/elite-expansao-icon.png` no favicon. Nenhuma nova marca foi desenhada. **Solicitar o arquivo oficial da Academy antes de concluir a integração.** Relatórios com a marca oficial e versões de fundo claro/escuro continuam pendentes.

O módulo territorial centraliza controles em classes `territory-*`, usa componentes Button/Dialog existentes, foco em pinos, status com texto e símbolo, estados de carregamento/erro/vazio, controles de 42px e adaptação em 760px. A consolidação de todos os valores visuais do sistema em tokens e a medição de contraste de todas as telas não foram concluídas.

## 6. Arquivos, APIs e banco

Alterados: `app/expansion-dashboard.tsx`, `app/expansion-forms.tsx`, `app/territorial-map.tsx`, `app/globals.css`, `app/layout.tsx`, `db/mutations.ts`, `db/queries.ts`, `db/schema.ts`, tipos, permissões, validações, dependências e testes.

Novos: `app/territory-canvas.tsx`, `/api/territory` GET/POST, `/api/territory/geocode` POST, `db/territory.ts`, tipos/validações territoriais, testes de integração, documentação.

Novas tabelas: `territory_people`, `territory_locations`, `territory_actions`. Coluna nullable `person_id` em `ambassadors` e `leads`, com índice único em cada uma. Migrações aditivas `0004_overconfident_praxagora.sql` e `0005_keen_harry_osborn.sql`. MapLibre GL 5.6.0 adicionado.

## 7. Backup e recuperação

Cópia lógica completa das 14 tabelas originais: 4 cidades, 1 administrador, 1 configuração, 11 tabelas vazias. Arquivo `elite-expansao-backup.json`, capturado antes das mudanças. Não é snapshot transacional da hospedagem. Dados privados não estão no repositório Git.

A cópia foi restaurada em SQLite isolado; as migrações 0004/0005 foram aplicadas; todas as colunas e linhas originais permaneceram idênticas; `foreign_key_check` sem erros. Evidência: `backup-verification.json`.

Recuperação preferencial: retornar o código à versão 5, mantendo as tabelas aditivas, para não apagar novas entradas. Antes de uma reversão estrutural, suspender novas gravações, obter novo backup completo incluindo as três novas tabelas, restaurar em ambiente isolado e conferir contagens e chaves. Apenas em cópia isolada foi testado remover tabelas territoriais, índices person_unique e as colunas person_id. **Não executar essa remoção em produção: apagaria os novos vínculos.** O backup anterior restaura o estado anterior, não cobre registros criados depois de sua captura. Recuperação D1 em produção ainda não foi exercitada.

## 8. Testes executados

Comando: `node --test --test-concurrency=1 tests/*.test.mjs`. Ambiente: Node, módulos reais carregados por Vite e SQLite em memória; autenticação substituída por fixture exclusiva dos testes. D1 real hospedado e navegador não foram usados para essas gravações. Resultado: 32 testes aprovados, incluindo 14 cenários de integração territorial. Evidência completa: `elite-tests.txt`; cenários e asserts em `tests/territory-integration.test.mjs`. TypeScript e ESLint aprovados.

| Cenário | Perfil | Esperado e obtido |
| --- | --- | --- |
| Pessoa → embaixador + lead → indicação → follow-up → localização | Administrador | Identidade única, vínculo persistente, coordenadas arredondadas, auditoria: aprovado |
| API direta sem sessão e origem externa | Anônimo | 401/403: aprovado |
| Consulta, filtro e mutação em outra cidade | Coordenação/Líder | Nenhum registro externo; escrita negada: aprovado |
| Localização Admin e busca pela região restrita | Líder/Administrador | Coordenadas/região restritas ausentes para líder: aprovado |
| Consulta de outra pessoa | Embaixador/Comercial | Próprio perfil ou contato atribuído: aprovado |
| Parceiro, evento, situação e localização pendente | Administrador | Persistência e leitura corretas: aprovado |
| Coordenadas e data inválidas | Administrador | Rejeição: aprovado |
| Duplicidade lead/pessoa e ciclo de indicação | Administrador | Rejeição sem duplicar: aprovado |
| Busca externa sem chave | Administrador | 503 útil, sem expor chave: aprovado |
| Reenvio da criação de pessoa com mesmo requestId | Administrador | Uma pessoa; outro autor impedido: aprovado |
| Ativação prematura | Administrador | Rejeição no servidor: aprovado |
| 230 pessoas, filtros e paginação | Administrador | 200 + 30 sem mistura de cidade: aprovado |
| Cidade nova → líder → aprovação → aceite próprio → treinamento → atividade → venda sem/paga → custo → cancelamento → revogação | Administrador/Embaixador/Líder | Receita/CAC/ROI corretos e isolamento: aprovado |
| Falha forçada na auditoria durante criação territorial | Administrador | API 503, sem falso sucesso, transação revertida: aprovado |
| Restauração lógica e migrações | Local, sem sessão | Dados originais idênticos e integridade referencial: aprovado |

Os cenários não testados não devem ser marcados como aprovados: login/logout/recuperação ponta a ponta; cada botão com teclado; download CSV real; QR e clipboard reais; Safari/Chrome no Mac; iPhone/Android/tablet; internet lenta; falha real de tiles/WebGL; foco e contraste; migração e recuperação em D1 hospedado. O fluxo local não envia convites ou confirma cobranças reais.

## 9. Permissões, dados e limites

A publicação deve permanecer somente para o proprietário, como encontrado. Não foram preparados perfis reais novos nem alterados compartilhamentos. As 4 cidades existentes são Esmeraldas, Belo Horizonte, Contagem e Betim; as próximas não foram ativadas por esta atualização. Todos os dados pessoais existentes foram preservados na cópia e no teste de migração.

Coordenação atualmente tem uma cidade por perfil, conforme o esquema existente; permissão para várias cidades exigirá associação própria. Seletores de pessoas exibem até 200 identidades, enquanto o mapa pagina; pesquisa paginada nesses seletores é pendência. Logs legados, retenção, exportação auditada e todos os caminhos antigos precisam de revisão completa para certificação. Não há certificação de conformidade LGPD nesta entrega técnica.

## 10. Manual curto

**Administrador:** abra Mapa territorial; filtre cidade/camada/situação. Cadastre Pessoa com autorização. Ao cadastrar Lead ou Embaixador, selecione “Pessoa já cadastrada” para manter os vínculos. Selecione uma ficha para registrar follow-up, indicação ou validar referência. Pessoas devem usar bairro/cidade, nunca residência. Use CRM para oportunidades e estados de pagamento; use Custos para os gastos. Revise indicadores e critérios antes de avançar a cidade.

**Líder:** acesse somente sua cidade; acompanhe embaixadores, atividades, parceiros e eventos autorizados. Confira pendências, atualize a próxima ação e registre origem/validação de localização. Alterações de configuração global são do administrador.

**Embaixador:** use o portal próprio para aceitar regras, concluir treinamento, registrar atividades e leads autorizados e consultar seus resultados. Não há acesso aos dados de outros embaixadores. Links/QR dependem de destino oficial configurado; nenhuma mensagem é enviada automaticamente.

## 11. Plano 7, 30 e 60 dias e Esmeraldas

- **7 dias:** receber logo oficial; homologar telas e todos os cliques em dispositivos reais; revisar backup hospedado; definir líder de Esmeraldas, limite de CAC, orçamento e critérios com Felipe; cadastrar apenas pessoas autorizadas. Não há base de resultados para recomendar avançar agora.
- **30 dias:** operar o piloto, registrar ações/origens/pagamentos/custos, revisar taxa orgânica e qualidade de dados semanalmente; testar provedor e cobertura 3D/satélite; ampliar seletores, filtros e métricas sem alterar o significado dos dados.
- **60 dias:** comparar cidades do mesmo estágio; expandir somente após critérios do piloto; adicionar consulta por área, agrupamento no servidor e desempenho com volume real.

Próximo movimento: completar a homologação e montar a operação real de Esmeraldas com líder e primeiras pessoas autorizadas. Belo Horizonte, Contagem e Betim permanecem condicionadas aos resultados do piloto.

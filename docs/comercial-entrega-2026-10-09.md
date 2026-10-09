# Elite Expansion X — continuidade comercial

## Estado inicial confirmado

Versão 8 privada, fonte 7d41387dbcd4dc24a09be32dc15988a4573f8ac4. Os 40 testes anteriores passaram antes das alterações. Backup completo de 19 tabelas e sete registros capturado em execution-backup-before.json. Os novos testes usam apenas SQLite em memória, nunca produção.

## Implementado nesta etapa

- Empresas: cadastro manual de dados comerciais públicos, fonte, segmento, bairro, endereço público, responsável ativo, conferência, situação, próxima ação e vínculo com parceiro existente. Identidade normalizada e identificador externo evitam duplicidade. Empresa vinculada a parceiro tem uma única representação no mapa.
- Oportunidades: vínculo com lead autorizado e empresa opcional, origem do lead preservada, temperatura separada, oito etapas, prazo, próxima ação e motivo de perda. Histórico de mudanças. Ganho não cria venda ou pagamento. Alterações concorrentes exigem versão atual.
- Rotina comercial: contatos, follow-ups, reuniões e propostas registrados por autor; metas por vendedor/cidade/dia; relato diário identificado como autodeclarado. Pagamentos por data de confirmação. Leads novos são os vinculados a oportunidades, por data de criação do lead e temperatura atual, não a classificação histórica original.
- Importação de empresas CSV/XLSX: limite de 1 MB e 50 linhas, prévia, mapeamento, validação, duplicidades, confirmação, UUID por linha e resultado individual. Não importa leads nem consentimentos. XLSX rejeita fórmulas, limita descompressão e usa a primeira aba encontrada por nome de arquivo; não é importação genérica de toda planilha.
- Exportação CSV pelo servidor, limitada aos registros exibidos (até 200 para empresas/oportunidades), com autorização, proteção contra fórmula e registro de auditoria.
- Decisões humanas por cidade com justificativa, próxima ação, revisão e histórico aditivo. Plano da organização como rascunho, sem cobrança, assinatura ou imposição automática de limites.
- Mapa inclui empresas e função Vendedor. Comercial recebe somente seus contatos/empresas autorizados. Localização pessoal permanece municipal. Pessoas com múltiplos papéis mantêm identidade única.
- Camada de volumes de edifícios com alturas fornecidas pelo OpenFreeMap, abaixo dos rótulos. Controle 2D/3D, aviso de cobertura e ausência de edificações. Alturas podem ser estimadas; não é fotogrametria, imagem de satélite ou terreno 3D.
- Adaptadores de satélite/híbrido e Street View condicionados à configuração aprovada. Nenhuma credencial ou serviço pago foi ativado.

## Permissões e qualidade

Todas as leituras comerciais aplicam organização e, conforme perfil, cidade e responsável. Embaixador não acessa a API comercial. Comercial não altera metas, planos ou decisões territoriais. Responsáveis precisam ser usuários ativos autorizados para a cidade. Lead revogado ou cancelado não aparece nas oportunidades nem recebe novas atividades. Reatribuição de lead remove acesso do vendedor anterior. Falhas internas não retornam SQL nem segredos.

P0 revisado: isolamento das novas entidades e acesso após troca de responsável. P1 tratado: duplicidade de importação, alteração concorrente, confusão entre ganho e pagamento, status comercial sem autorização. P2: formulários com rótulos, estados de operação, mensagens e filtros; falta validação visual real.

## Matriz resumida de ações novas

| Ação | Perfil | API | Alteração | Evidência |
|---|---|---|---|---|
| Cadastrar/editar empresa | Gestão; comercial próprio | POST /api/commercial business | businesses + audit_logs | Teste de ciclo, duplicidade e escopo |
| Vincular parceiro | Gestão da cidade | POST link_partner | businesses + auditoria | Um único registro no mapa |
| Criar/editar oportunidade | Gestão; comercial autorizado | POST opportunity | opportunities, leads na criação, histórico e auditoria | Ciclo, versão concorrente, autorização |
| Registrar atividade | Gestão; comercial autorizado | POST activity | commercial_activities + auditoria | Atividade, revogação e reatribuição |
| Definir meta | Gestão da cidade | POST goal | seller_goals + auditoria | Comercial impedido |
| Relato diário | Própria conta autorizada | POST report | seller_reports + auditoria | Persistência e escopo |
| Prévia de importação | Gestão; comercial próprio | POST import_preview | Nenhuma | Prévia não grava |
| Confirmar importação | Mesmos perfis | POST import_commit | Empresas válidas, auditoria por linha | Repetição sem duplicação |
| Exportar | Perfis comerciais autorizados | GET format=csv | Auditoria; registros em leitura | CSV e log |
| Registrar decisão | Gestão da cidade | POST decision | Histórico + auditoria | Repetição, escopo e perfil |
| Planejar plano | Administrador da organização | POST plan | organization_plans + auditoria | Negação a líder |
| Selecionar base do mapa | Conta autorizada | GET /api/map-config | Nenhuma | Configuração ausente sem chaves |
| Consultar panorama | Gestão/comercial com registro autorizado | POST /api/territory/street-view | Auditoria de cota | Pessoas recusadas; sem chave retorna pendência |

Os testes de APIs/funções não são evidência de cliques, foco ou responsividade em navegador.

## Integrações externas: configuração exata

Nenhuma variável externa estava configurada no início desta execução.

- MAPS_EXTERNAL_ENABLED=true: somente após aprovação do uso, restrições e limites do provedor.
- PUBLIC_MAPTILER_KEY: chave própria para navegador, restrita ao domínio e APIs necessárias.
- PUBLIC_MAPTILER_SATELLITE_ID e PUBLIC_MAPTILER_HYBRID_ID: IDs dos estilos verificados na conta contratada; não assumimos cobertura ou disponibilidade.
- MAPTILER_GEOCODING_KEY: chave de servidor para busca de locais comerciais (integração preexistente).
- PUBLIC_GOOGLE_EMBED_KEY: chave restrita a domínio e Maps Embed API.
- GOOGLE_STREETVIEW_SERVER_KEY: segredo de servidor para metadados de cobertura. Não é retornado ao navegador.

Street View consulta apenas coordenadas de registros comerciais/eventos validados e autorizados. A API limita consultas de metadados a 100 por organização/dia; limites de mapas/tiles devem ser definidos no provedor. ZERO_RESULTS gera ausência de panorama. O iframe usa apenas a chave pública restrita. Integração completa e erros reais do provedor não foram testados sem credenciais.

Documentação consultada: https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/ ; https://docs.maptiler.com/cloud/api/maps/ ; https://developers.google.com/maps/documentation/embed/embedding-map ; https://developers.google.com/maps/documentation/streetview/metadata .

## Migrações e recuperação

0008: cinco tabelas comerciais novas. 0009: unicidade do vínculo empresa/parceiro. 0010: decisões e planejamento de planos. Nenhuma coluna/linha anterior removida.

scripts/verify-commercial-migration.mjs restaura o backup exclusivamente em memória, aplica as migrações, compara todas as colunas anteriores, verifica chaves e remove as tabelas novas apenas nessa cópia para provar reversão pré-escritas. Esse teste não autoriza apagar tabelas em produção.

Recuperação: suspender novas escritas; capturar backup atualizado; identificar operações posteriores; preferir correção aditiva. Se for necessária reversão, preservar os novos registros e ensaiar a restauração numa cópia antes de alterar produção. Não restaurar cegamente o backup anterior nem publicar código incompatível com novas entidades.

## Pendências — não declarar projeto completo

- Chrome/Safari no Mac, iPhone/Android, WebGL real, teclado, contraste renderizado e conexão lenta: não testados. O fluxo Sites exige control-browser para QA, e essa capacidade não está disponível. Nenhum navegador alternativo foi improvisado.
- Leitura XLSX no navegador e interação completa de importação: não testadas em navegador. CSV e processamento no servidor têm testes executados.
- Satélite/híbrido/Street View: código preparado; configuração e validação externas pendentes. 3D: camada e troca de estado testadas em objeto de mapa simulado, cobertura real não verificada.
- Diretório automático de todos os estabelecimentos: não implementado; requer fonte licenciada e definição de cobertura. O diretório manual/importado não é apresentado como censo completo.
- Onboarding SaaS, cobrança, assinatura e limites efetivos não foram ativados. Planos são planejamento administrativo.
- Não foi feita auditoria de clique de todos os controles legados; não há evidência para considerar o briefing inteiro concluído.

## Manual

Administrador: confira a organização; cadastre cidades e usuários reais autorizados. Em Empresas, registre fonte e dados comerciais públicos; ou importe lote com prévia. Vincule parceiro quando houver cadastro existente. Em Leads e vendas, cadastre lead autorizado e crie oportunidade. Na Equipe comercial, defina metas aprovadas; acompanhe ações e relatos. Em Cidades, registre a decisão e revisão. Configurações contém planejamento do plano, sem cobrança.

Líder: mesmas operações apenas na cidade autorizada, sem administrar planos da organização. Comercial: trabalha em seus leads, oportunidades e empresas; registra ações e seu relato; não define metas. Embaixador continua no portal próprio.

Esmeraldas: confirmar líder e responsáveis; cadastrar registros reais autorizados; conferir referência municipal; registrar primeiro período completo com custos e pagamentos. A expansão para outras cidades depende de evidência, não de volume de cadastros isolado.

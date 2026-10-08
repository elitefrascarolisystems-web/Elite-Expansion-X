# Elite Territory Map — atualização de temas e pessoas

Entrega parcial sobre versão 6. Não representa conclusão de todos os critérios do projeto.

## Implementação

- Claro, misto e escuro: estilos cartográficos OpenFreeMap Liberty/Dark, sem inversão de imagem. Preferência por usuário no armazenamento local do navegador, com preferência inicial do dispositivo. A troca de estilo mantém a instância e a câmera. Painéis e formulário territorial recebem tema. Ruas OSM claras são alternativa explícita em falha do estilo; não são apresentadas como tema escuro.
- Ícones Lucide: cidade, líder, embaixador, mentor, mentorado, equipe, parceiro, ponto parceiro, evento, ação, lead, cliente e follow-up. Legenda, títulos acessíveis, indicador textual de status e contorno de seleção. Vários papéis têm indicador adicional.
- Papéis territoriais locais Mentor/Mentorado/Equipe/Parceiro: identidade única, status independente, responsável, fonte e autorização. Não criam conta, não liberam acesso e não importam dados de outra plataforma. Cliente continua derivado de pagamento confirmado. Embaixador e líder preservam os módulos anteriores.
- Consulta agrupada no servidor sobre todos os registros autorizados do filtro, independente da página de 200 da lista. Pontos agregados por coordenada, agrupamento visual adicional, consulta de área visível e seleção geográfica. Máximo de 1.000 coordenadas por resposta, com aviso para aproximar. Totais completos separados de pessoas únicas, área visível, lista e pendentes.
- Pesquisa e paginação nos seletores de pessoa e indicador. Rede de indicações passa a consultar todas as páginas da cidade, com nomes autorizados e acesso ao mapa.
- Filtros de responsável exato, treinamento, ações pendentes/atrasadas e localização. Status de um papel manual é filtrado no vínculo correspondente.
- Última atividade da pessoa usa ação realizada, atividade do embaixador ou tarefa concluída, sem confundir edição de cadastro com atividade. Ficha do embaixador apresenta treinamento, tarefas, ações e resultados já autorizados.
- Corrigida sobreposição do mapa ampliado aos diálogos.

## Segurança e migração

Migração aditiva `0006_outgoing_swarm.sql`: tabela `territory_roles`, índice único pessoa/cidade/papel, índice cidade/papel/status. Escrita do vínculo e auditoria na mesma transação. O escopo territorial também protege contagens, pontos, busca e indicações. A cartografia não recebe nomes, IDs nem dados de CRM. Nenhum segredo necessário aos estilos públicos.

Backup antes das alterações: 17 tabelas completas; 4 cidades, 1 administrador, 1 configuração, demais vazias. Nenhum cadastro fictício em produção. Comparação pós-publicação deve constar na entrega.

Recuperação preferencial: retornar à versão 6 mantendo a tabela aditiva. Antes de qualquer restauração, suspender gravações e obter novo backup completo. Restaurar primeiro em ambiente isolado. Remover `territory_roles` somente na cópia isolada; em produção apagaria vínculos criados após a atualização. O backup anterior não cobre dados posteriores à sua captura.

## Testes e limites da evidência

Testes executados em Node + SQLite em memória, módulos reais e autenticação simulada exclusivamente nos testes. Novos cenários: múltiplos papéis sem duplicar pessoa ou criar acesso, filtro de status por papel, bloqueio entre cidades, 250 pessoas em agregação com 200 na lista, área vazia, área inválida, indicação fora da página, lookup de pessoa e data de atividade. Resultados finais ficam em `elite-v7-tests.txt`.

As URLs de estilos são documentadas oficialmente pelo provedor. A tentativa de carregá-las neste ambiente recebeu HTTP 403; o navegador de QA exigido pela habilidade Sites não está disponível. Não há evidência visual de renderização dos temas, preservação de câmera por interação real, teclado, contraste ou toque. Esses testes continuam pendentes em Chrome/Safari/iPhone/Android/tablet. HTML/SSR e compilação não substituem esses testes.

Referências: https://openfreemap.org/quick_start/ ; https://github.com/hyperknot/openfreemap-styles ; https://openfreemap.org/ . A instância pública documenta uso sem chave e sem cobrança por requisição. Não foi contratada infraestrutura.

## Pendências reais

1. Logo oficial da Academy: arquivo não recebido. Marca Elite Expansão existente preservada.
2. Homologação visual dos três temas, ícones, filtros, câmera, diálogos e dispositivos; verificar legibilidade em Esmeraldas.
3. Satélite, híbrido e edifícios/relevo 3D: não implementados; dependem de provedor e cobertura validados. Nenhum botão falso adicionado.
4. Geocodificação: chave de serviço não configurada; pino manual/pendente continuam disponíveis.
5. Integração externa de mentorados: não foi criada nem declarada. Os vínculos novos são locais e autorizados.
6. Atuação de uma pessoa em cidades adicionais, Coordenação com múltiplas cidades, união revisada de duplicados e catálogo completo de pontos parceiros: precisam de expansão específica do modelo/fluxo. Nenhuma união automática foi feita.
7. Filtros adicionais de origem e intervalo de última atividade, sincronização da preferência entre dispositivos e controles independentes de múltiplas camadas ainda pendentes.
8. Recuperação D1 hospedada, auditoria integral das ações legadas, exportação ponta a ponta e matriz completa de testes de dispositivos permanecem pendentes.

## Uso

Administrador/líder: Mapa territorial → Aparência → escolha Claro/Misto/Escuro. Filtre papel, cidade e situação. Selecione um marcador ou registro da lista. “Papéis e responsáveis” cadastra ou atualiza vínculo local autorizado. “Editar pessoa e indicação” mantém a identidade. Pesquise pessoas pelo nome e use “Mais pessoas” quando necessário. A legenda explica os ícones e indicadores. Clique num agrupamento para recortar os registros daquela região; use “Limpar seleção geográfica” para retornar. “Limpar filtros” remove também o foco em cadastro.

Embaixador: continua no portal próprio, com seus dados e ações autorizadas; não recebe acesso global ao mapa nem às outras pessoas.

Próximo passo para Esmeraldas: validar visualmente a versão com Felipe, receber a marca oficial e registrar os primeiros vínculos reais autorizados. Não há resultados reais no banco que justifiquem avançar as cidades seguintes.

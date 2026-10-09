# Mapa territorial — entrega de 9 de outubro de 2026

Status: implementação parcial, com validação técnica. Não atende ainda a todos os critérios de conclusão visual e funcional do anexo.

## Auditoria e preservação

Publicação encontrada: versão 6, acesso exclusivo do proprietário, sem grupos ou visitantes externos. Fonte recuperada: 38fe0c7bb80e5e6ceb040a8a6b15803d2f0bae0c. Ela continha melhorias preparadas e ainda não publicadas. React 19, Vinext/Vite, Cloudflare Worker, D1/SQLite, MapLibre e componentes existentes foram preservados.

Antes da alteração, 17 testes de integração passaram em Node/SQLite em memória com autenticação de teste. Não representam execução no navegador nem em produção. Backup completo das 17 tabelas de produção: 4 cidades, 1 administrador e 1 configuração; demais tabelas vazias. Restauração isolada e comparação de todas as linhas passaram, com integridade de chaves estrangeiras. Nenhum dado de teste inserido em produção.

Não foi possível obter evidência visual da interface publicada. A inspeção de código revelou:

| Prioridade | Problema | Correção/evidência |
|---|---|---|
| P0 | Pessoas podiam receber ponto aproximado individual, em desacordo com o novo requisito | Escrita de ponto pessoal rejeitada; leitura, busca e agregação ignoram pontos pessoais antigos; geocodificação pessoal rejeitada antes de chamar provedor. Testes com ponto legado inserido somente na memória. |
| P1 | Filtro Mentor também encontrava Mentorado por comparação parcial | Comparação da função completa. Teste com duas pessoas e funções distintas. |
| P1 | Atualizações da consulta podiam recentralizar a câmera por troca do objeto selecionado | Dependências limitadas à identidade e coordenadas; interação visual ainda pendente. |
| P1 | Seleção de cadastro indicado preservava filtros incompatíveis | Limpeza das camadas e filtros ao abrir indicação; teste de clique pendente. |
| P2 | Ícones divergiam do anexo | Escudo para embaixador, bússola para mentor, grupo para equipe, demais símbolos existentes preservados. |
| P2 | Ausência de camadas independentes, filtros de estado/nível/origem e resumo ativo | Controles ligados à API autorizada; união de camadas testada sem duplicação. |

## Implementação entregue

Três temas: claro (mapa e painéis claros), misto (mapa claro e painéis escuros) e escuro (mapa e painéis escuros). OpenFreeMap Liberty/Dark, sem filtro de inversão. Preferência do usuário somente neste dispositivo, indicada na interface. Tokens para fundo, painel, texto, texto secundário, borda, controles e destaque. Foco visível, ícones vetoriais, legenda textual, seleção e múltiplas funções. Não há evidência visual de contraste ou renderização, apenas implementação e validação técnica.

Mapa e lista usam a mesma consulta autorizada; 200 registros por página e agregação independente da paginação, limitada a 1.000 coordenadas distintas por resposta com aviso. Contadores distinguem pessoas únicas, registros, página, área visível e pendentes. Vários papéis não duplicam a pessoa. Inclinação tem o nome “Inclinar mapa”, retorno para 2D e descrição de que não representa edifícios ou terreno 3D.

Papéis territoriais Mentor/Mentorado/Equipe/Parceiro com status, responsável e origem; não criam conta nem concedem acesso. Leads e clientes permanecem vinculados ao CRM; cliente depende de pagamento confirmado. Busca, ações locais, indicações e formulários usam o cadastro persistido. Origem filtra o texto registrado em vínculos locais; não representa importação de outra plataforma. Nível filtra embaixadores.

Pessoas usam somente a referência da cidade; sem GPS, contato, endereço residencial ou distribuição aleatória. Coordenadas legadas são preservadas no banco, mas não são retornadas. O botão de validar localização só aparece para cidades e entidades não pessoais. A sede municipal validada passa a representar também suas pessoas. Referências municipais herdadas precisam de conferência cartográfica pelo administrador; não foram novamente geocodificadas.

A marca encontrada é `public/elite-expansao-logo.png` (globo e texto Elite Expansão), com ícone correspondente. Ela foi preservada. Não é possível afirmar que seja a logo oficial da Academy. Essa integração depende do arquivo oficial fornecido/confirmado pelo proprietário; nenhuma imitação foi criada.

## Código e banco

Componentes: `app/territorial-map.tsx`, `app/territory-canvas.tsx`, `app/territory-icons.tsx`, `app/territory-person-picker.tsx`. Design: `app/globals.css`, `lib/territory-appearance.ts`. API: GET/POST `/api/territory`, POST `/api/territory/geocode`; consultas `db/territory.ts` e validação `lib/territory-validation.ts`. Testes em `tests/territory-integration.test.mjs`, `tests/ui-components.test.mjs`, `tests/rendered-html.test.mjs`.

Migração aditiva preparada antes desta sessão: `0006_outgoing_swarm.sql`, tabela `territory_roles` e índices. Não houve outra mudança de schema nesta sessão. Ela será aplicada pela publicação; schema anterior e registros existentes são preservados. Nenhuma cobrança ou convite ativado.

## Recuperação

Backup JSON contém todas as linhas e colunas retornadas, sem truncamento, acompanhado do resultado de restauração isolada. Para recuperação: suspender gravações, capturar novo backup, restaurar e comparar primeiro em ambiente isolado. Preferir reversão do código para a versão 6 mantendo a tabela aditiva. Não apagar `territory_roles`: isso perderia vínculos criados após a atualização. Retornar à versão 6 também restaura o comportamento anterior de localização aproximada; portanto a reversão precisa manter a correção de privacidade ou restringir o acesso ao mapa. A restauração hospedada não foi executada.

## Testes e pendências

Resultados detalhados nos arquivos de evidências: testes anteriores, integração final, suíte completa, análise de tipos, lint e restauração. Os cenários de integração incluem administração, coordenação/líder por cidade, embaixador próprio, comercial atribuído, anônimo, origem inválida, manipulação de cidade, duplicidade, cancelamento, pagamento, revogação, custo, falha transacional, 250 registros, área inválida, funções, camadas e pontos pessoais legados. Todos usam banco e identidades isolados; não validam autenticação real de dispositivos.

Pendentes: Chrome, Safari, iPhone, Android, tablet, toque, teclado, leitor de tela, contraste, carregamento real dos estilos, falha visual de API/mapa e clique repetido no navegador. A habilidade Sites exige control-browser; ela não está disponível nesta sessão. Não foram produzidas capturas de tela da aplicação.

Também pendentes: arquivo oficial da Academy; satélite/híbrido e edifícios/relevo 3D com provedor/cobertura; geocodificação comercial sem credencial configurada; união revisada de duplicados; auditoria completa das ações legadas; exportação ponta a ponta e restauração hospedada. Não há sincronização externa com mentorados de outra plataforma. Painéis gerais e relações adicionais continuam sujeitos à auditoria completa solicitada; a matriz não certifica todos os botões.

## Manual curto

- Administrador: abra Mapa territorial, escolha a aparência e as camadas. Cadastre pessoas autorizadas, selecione a ficha e use Papéis e responsáveis. Valide a sede pela ficha da cidade; nunca cadastre coordenada de pessoa. Mostrar todas restaura camadas; Limpar filtros restaura a consulta geral. Use a lista se o provedor falhar.
- Líder: opera somente a cidade autorizada. Atualize pessoas, vínculos e ações reais. Confira a origem e o status antes de salvar. A função mostrada no mapa não cria acesso à plataforma.
- Embaixador: usa seu portal, tarefas, materiais e resultados autorizados. Não tem acesso global a outras pessoas no mapa.

## Esmeraldas e próximos passos

7 dias: homologar os três temas nos dispositivos, receber a logo oficial, conferir a referência municipal e cadastrar pessoas reais autorizadas do piloto.

30 dias: revisar ações, qualidade de leads e pagamentos, indicadores e completude dos custos; concluir auditoria de botões/permissões e exportações.

60 dias: avaliar resultados reais do piloto e capacidade da equipe antes de avançar para Belo Horizonte, Contagem ou Betim. Não há dados operacionais suficientes hoje para recomendar expansão automática.

Referências técnicas consultadas: https://openfreemap.org/quick_start/ e https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/. Consulta documental não equivale a teste visual do serviço.

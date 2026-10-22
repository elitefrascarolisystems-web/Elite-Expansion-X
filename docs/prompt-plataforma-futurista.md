# Prompt — Plataforma futurista: mapa com modos, abas premium e gráficos que fazem sentido

> Para usar: cole este texto em uma nova conversa com o Claude neste repositório (ou peça "siga o docs/prompt-plataforma-futurista.md").
> Continua o `docs/prompt-reorganizacao-premium.md`, que já foi executado (navegação por áreas e primeiro visual premium).

---

## Contexto

Você está trabalhando na **Elite Expansion X** (repositório `elite-expansion-x`, branch `claude/executar-projeto-2ehft2`): plataforma de expansão por cidades — mapa, pessoas, locais, atendimento até a venda, embaixadores, mentorados e indicadores. A Elite Frascaroli Academy usa e também vende por assinatura: cada empresa assinante tem um ambiente só dela, com a plataforma inteira.

Stack: Next 16 (vinext) + React 19 em Cloudflare Workers com D1, Tailwind, shadcn/Radix, lucide-react, **maplibre-gl**, **recharts** (com `components/ui/chart.tsx`), **cmdk** e sonner. App instalável no celular, com cadastro sem internet (`lib/offline-queue.ts`, `app/offline-sync.tsx`). Identidade: preto profundo (#080807), dourado Elite (#c9a227 / #d6b94f), emblema em `public/elite-emblem.png`.

Funções: Administrador, Coordenação (1 cidade), Líder (1 cidade), Comercial, Embaixador (portal próprio) e Mentorado (portal próprio). A Assessoria Elite entra nos clientes como administradora; os donos da plataforma veem ainda a área Plataforma.

## Como está hoje (ponto de partida — não refazer o que já existe)

**Navegação** (`lib/navigation.ts`, `app/app-shell.tsx`): barra lateral no computador, barra inferior no celular, botão "+ Novo", busca rápida (Ctrl+K) e área/sub-aba na URL (`?org=1&area=vendas&ver=agenda`).
- **Hoje**
- **Território**: Mapa · Cidades · Locais
- **Vendas**: Agenda · Atendimentos · Ganchos · Método F.E.C.H.A. · Pagamentos · Pós-venda
- **Rede**: Embaixadores · Indicações · Mentorados · Parceiros e eventos · Materiais
- **Resultados**: Visão geral · Metas e rotina · Mapeamento · Custos e canais
- **Gestão**: Time e acessos · Regras e cálculos · Identidade · Plano · Histórico · Privacidade (LGPD) · Avisos por e-mail · Assessoria Elite
- **Plataforma** (donos): Assinaturas · Pedidos de assinatura · Assessores

**Visual** (`app/globals.css`): já tem tokens dourados, superfícies de vidro escuro, indicadores com variação, tabelas que viram cartões no celular e estados vazios com ação. A fonte ainda é a do sistema (Arial/Segoe). Os tokens `--chart-1..5` (dourado, cinza, azul-petróleo, âmbar, laranja) nunca foram validados para daltonismo — dourado, âmbar e laranja são vizinhos.

**Mapa** (`app/territorial-map.tsx`, `app/territory-canvas.tsx`, `app/mapping-wizard.tsx`):
- maplibre com estilos OpenFreeMap (Claro / Misto / Escuro); satélite e híbrido quando configurados e liberados no plano (`/api/map-config`); Street View por local; perspectiva 3D com prédios.
- Pinos em HTML (um elemento por ponto), agrupados no navegador por distância; o servidor já devolve pontos agregados da área visível.
- Camadas por tipo de local e função da pessoa, muitos filtros, contadores, modo lista, tela cheia e ficha lateral com ações (pessoa, atividade, localização, função, iniciar atendimento).
- Busca de endereço no servidor (`/api/territory/geocode`).
- Mapeamento guiado: Cidade → Local → Pessoas → Iniciar atendimento, funcionando sem internet.
- Mapas impressos A3/PDF por cidade (`/imprimir/mapa`).
- LGPD: a pessoa aparece no local ligado a ela ou no centro da cidade, **nunca na residência**; cada posição tem precisão (Cidade / Região aproximada / Local comercial), validação e visibilidade (Equipe/Admin).

**Gráficos**: existe **um só** — barras de "Receita confirmada e custo" por período, em Resultados → Visão geral. O resto são números (indicadores com variação) e tabelas (cobertura por cidade, produção por mapeador).

**Dados que já existem para gráficos** (D1):
- `leads`: canal, origem, etapa, embaixador, parceiro, evento, autorização e datas.
- `opportunities`: etapa, temperatura, responsável, próximo passo e motivo de perda.
- `followup_events`: antes/depois de cada mudança — dá para medir o tempo em cada etapa.
- `commercial_activities`: tipo e data de cada atividade.
- `sales`: valor, situação e data do pagamento.
- `costs`: categoria, canal, período e valor.
- `territory_people`, `businesses`, `territory_locations`: quem cadastrou, quando, tipo, setor e validação; `referrer_id` liga quem indicou quem.
- `ambassadors` e `ambassador_updates`.
- `seller_goals` e `seller_reports`: metas e rotina.
- `portal_steps` e `portal_progress`: jornada do mentorado.
- `organization_subscriptions` e `organization_plans`: assinaturas.

## O que eu quero

1. **Cara de futuro**: sensação de painel de comando de alto nível — profundidade, luz dourada, movimento sutil e resposta imediata —, sem perder legibilidade, velocidade nem acessibilidade.
2. **Mapa com modos**: jeitos diferentes de **mapear** (cadastrar) e de **enxergar** o território, mais interativos, no computador e no celular, em campo.
3. **Abas premium**: cada aba com cabeçalho vivo, a ação principal à mão, visões lista / quadro / mapa onde fizer sentido, ficha lateral e acabamento de produto caro.
4. **Gráficos que fazem sentido**: cada gráfico responde a uma pergunta de decisão. Nada de gráfico decorativo.
5. **Nada se perde**: funcionalidades, permissões, LGPD, limites do plano, modo sem internet e links continuam funcionando.

## Etapa 0 — Diagnóstico e direção visual (entregar ANTES de mudar as telas)

Entregue em português simples:

1. **Três direções visuais**, num protótipo rápido aplicado só à tela **Hoje** e ao **Mapa** (capturas em 1440 px e 390 px), para eu escolher uma:
   - **Noite Dourada 2.0**: evolução do visual atual, com mais profundidade e luz dourada nas bordas e no foco.
   - **Holográfico**: vidro escuro translúcido, brilho difuso (aurora dourada bem sutil), linhas finas.
   - **Sala de Comando**: grade técnica fina no fundo, números em fonte geométrica, indicadores como instrumentos.
2. **Plano do mapa**: quais modos (Etapas 2 e 3) entram e em que ordem, como a pessoa troca de modo, o que muda no banco, o que depende de serviço externo e o peso no carregamento.
3. **Catálogo de gráficos**: a tabela da Etapa 4 conferida contra os dados reais — o que já dá para fazer, o que precisa de histórico novo e o que eu deveria cortar.
4. **Riscos** (desempenho no celular, LGPD, permissões por função, testes que dependem de nomes) e como evitar.

Pare aqui e espere minha aprovação. O protótipo descartado sai do código.

## Etapa 1 — Fundação futurista (vale para todas as telas)

- **Tipografia**: uma fonte geométrica para títulos e números (ex.: Sora ou Space Grotesk) e uma neutra para o texto, de licença livre e **hospedadas no próprio app** (`public/fonts`, para funcionar sem internet), sem atrasar a primeira pintura. Números grandes com algarismos proporcionais; tabelas com algarismos tabulares.
- **Profundidade e luz**:
  - 3 níveis de superfície em tokens: fundo, painel e painel flutuante sobre o mapa.
  - Borda de 1 px com gradiente dourado.
  - Brilho só no item ativo, no foco e no que pede ação.
  - Grade técnica ou aurora no fundo **somente** em Hoje, Mapa e Sala de comando.
- **Movimento com propósito**:
  - Transição suave entre abas (View Transitions onde o navegador suportar).
  - Números que contam até o valor e painéis que deslizam.
  - Pinos que pulsam quando há atividade nova.
  - Tudo desligado com `prefers-reduced-motion`; nenhuma animação atrasa a ação.
- **Paleta de gráficos validada**: redefinir `--chart-*` com:
  - escala sequencial dourada;
  - escala categórica de no máximo 6 cores;
  - par divergente (acima/abaixo de zero);
  - cores de situação (bom / atenção / crítico), reservadas e sempre com ícone e texto.

  Rodar o **validador do skill `dataviz`** (`scripts/validate_palette.js`, modo escuro, contra as superfícies Elite) e colar o resultado no relatório.
- **Componentes reutilizáveis**: indicador com minigráfico de 8 semanas, medidor de meta, controle segmentado (troca de modo), ficha lateral com linha do tempo, quadro (kanban), estado vazio ilustrado em traço dourado e esqueleto de carregamento no formato da tela.
- **Central de comandos**: evoluir a busca rápida (Ctrl+K / ⌘K) para também ir a qualquer aba, criar (mapear, atendimento, venda…) e rodar as ações da tela atual, respeitando as permissões.

Critério: contraste AA em tudo; Hoje interativo em até 2,5 s em 4G simulado; o código do mapa e dos gráficos só carrega nas abas que usam.

## Etapa 2 — Mapa: motor novo e modos de ver

**Motor**: trocar os pinos em HTML por fontes GeoJSON com agrupamento nativo do maplibre (camadas de círculo e símbolo, ícones como imagens do mapa, seleção por `feature-state`). Meta: fluido com **5 mil pontos** num celular intermediário. Manter a busca por área visível no servidor e o **modo lista** como alternativa acessível a todos os modos.

**Modos de ver**: controle segmentado sobre o mapa; o modo fica na URL (ex.: `&modo=calor`).

| Modo | O que mostra | Para quê |
|---|---|---|
| **Explorar** (padrão) | agrupamentos que se abrem com animação, cartão ao passar o mouse, ficha lateral | navegar e agir |
| **Calor** | densidade de locais, oportunidades abertas, vendas confirmadas ou atividade dos últimos 30 dias (a pessoa escolhe) | ver onde está a força e onde está o vazio |
| **Cobertura** | hexágonos pintados pela quantidade de locais mapeados e validados (dourado claro → escuro); com áreas de varredura (Etapa 3), o % da meta de cada área | decidir onde mapear a seguir |
| **Funil** | cada local colorido pela etapa mais avançada dos atendimentos ligados a ele, com filtro de temperatura | achar as vendas quentes |
| **Linha do tempo** | a expansão mês a mês, com play/pausa e régua de datas | contar a história da cidade |
| **Cidade acesa (3D)** | prédios em 3D; os que têm empresa mapeada acendem em dourado; satélite/híbrido quando o plano permitir | visão de impacto e reconhecimento antes de ir a campo |

Regras:
- Calor, cobertura e ligações usam **só locais comerciais e centros de cidade**, nunca a posição de uma pessoa.
- Cada modo tem legenda clara e contadores.
- No celular, a legenda e os filtros ficam numa gaveta inferior.

## Etapa 3 — Mapa: novos jeitos de mapear

Além do **Mapeamento guiado** (fica como está, com o visual novo):

1. **Toque no mapa**:
   - tocar num prédio ou ponto e escolher "Novo local aqui", com o endereço sugerido;
   - adicionar as pessoas do local em sequência rápida;
   - arrastar o pino para ajustar a posição.

   O endereço vem de uma busca reversa nova em `/api/territory/geocode`, com cache e dentro dos limites do serviço.
2. **Em campo (GPS)**: tela cheia para usar com uma mão.
   - "Estou aqui" e os locais num raio de 300 m, com a situação de cada um.
   - **Check-in de visita**, que vira atividade.
   - Cadastro rápido, com a fila sem internet visível ("3 cadastros esperando conexão").
   - Vibração curta ao concluir, onde o aparelho suportar.

   A localização do mapeador serve só para centralizar o mapa e sugerir a posição do local. **Não guardar o histórico de deslocamento.**
3. **Rota do dia**:
   - escolher locais (ou "retornos de hoje que têm local");
   - ver a ordem sugerida pela proximidade;
   - abrir no Google Maps (várias paradas) ou no Waze (próxima parada);
   - marcar cada local como visitado.
4. **Varredura por áreas**:
   - dividir a cidade em hexágonos automáticos (cálculo leve, sem biblioteca pesada) ou desenhar bairros/áreas;
   - cada área com responsável, meta de locais e situação (a varrer / em andamento / varrida);
   - painel de progresso por área e por pessoa.

   Precisa de uma tabela nova (ex.: `territory_zones`: organização, cidade, nome, geometria, responsável, meta, situação e datas), com migração e validação no servidor. Permissões: Administrador, Coordenação e Líder criam e atribuem; o Comercial vê e atualiza as áreas dele.
5. **Lote com revisão no mapa**:
   - importar a planilha (usa a importação que já existe) e ver os pinos provisórios;
   - arrastar para corrigir os duvidosos;
   - confirmar.
6. **Por conexões**: a partir de uma pessoa ou local, cadastrar quem ela indica. O mapa desenha as ligações **entre locais e cidades**, nunca entre residências (base: `referrer_id`).

Opcional, só se eu aprovar o custo de armazenamento: **foto da fachada** do local (nunca de pessoas).

Critério: cada jeito de mapear é testado em 390 px, com o servidor desligado (fila sem internet) e com GPS simulado. Nenhum cadastro sai sem a confirmação de LGPD que já existe hoje.

## Etapa 4 — Gráficos que fazem sentido

Regras (do skill `dataviz`):
- **Título e conclusão**: o título é a pergunta ou a resposta ("Onde estamos perdendo atendimentos?"), seguido de uma frase de conclusão calculada ("Maior queda: Oportunidade → Pagamento, −62%").
- **Forma**:
  - **um só eixo** (nunca dois eixos Y);
  - no máximo 6 categorias + "Outros";
  - pizza/rosca só para parte do todo com até 4 fatias bem diferentes;
  - rótulos só nos pontos que importam.
- **Leitura**:
  - dica ao passar o mouse e ao focar pelo teclado;
  - botão **"Ver tabela"** em todo gráfico.
- **Filtros**: numa única linha acima de tudo o que afetam (período 7 d / 30 d / 90 d / 12 m, cidade, responsável). Ao recarregar, o gráfico anterior fica esmaecido, sem piscar.
- **Dados**:
  - "Sem dados suficientes" quando não houver base — **nunca dado inventado**;
  - os números respeitam a função: o Comercial vê só os dele, o Embaixador só os dele.

| Aba | Pergunta | Gráfico |
|---|---|---|
| Hoje | Estou no ritmo? | indicadores com minigráfico de 8 semanas (leads válidos, clientes pagos, receita confirmada, retornos atrasados) + medidor da meta (vendas do mês × meta da cidade; para o Comercial, contatos da semana × meta dele) |
| Território → Cidades | Qual cidade precisa de atenção? | barras horizontais de locais validados ÷ mapeados por cidade + minigráficos de leads e vendas por cidade, lado a lado |
| Vendas → Agenda | Como está a carga dos próximos dias? | colunas por dia nos próximos 14 dias, com os atrasados em destaque |
| Vendas → Atendimentos | Onde perdemos gente? | funil horizontal Mapeadas → Atendimento iniciado → Lead válido → Oportunidade → Pagamento confirmado, com o % de passagem entre as etapas |
| Vendas → Atendimentos | O que está parado? | tempo médio em cada etapa (barras, a partir de `followup_events`) + lista dos parados há mais tempo |
| Vendas → Pagamentos | Quanto entrou e quanto falta? | colunas por mês, confirmado × pendente, empilhadas e com rótulo |
| Rede → Embaixadores | Quem está gerando resultado? | ranking em barras (o selecionado em destaque, o resto em cinza) + funil do embaixador (indicados → válidos → pagos) |
| Rede → Indicações | De onde vêm as indicações? | barras por origem e canal |
| Rede → Mentorados | Em que etapa da jornada estão? | barras com a distribuição por etapa + medidor de conclusão |
| Resultados → Visão geral | Estamos crescendo com lucro? | receita confirmada × custo por mês (barras lado a lado, mesmo eixo em R$) + resultado do mês (receita − custo) em barras acima/abaixo de zero + leads válidos e clientes pagos por semana em dois gráficos pequenos lado a lado |
| Resultados → Metas e rotina | Quem bate a meta e quando a equipe rende mais? | meta × realizado por pessoa (barra com marcador de meta) + mapa de calor dia da semana × hora das atividades |
| Resultados → Mapeamento | O mapeamento está acelerando? | locais validados acumulados (área, uma série) + produção por mapeador por semana (destaque para "você", o resto em cinza) + locais por setor (barras, 6 maiores + Outros) |
| Resultados → Custos e canais | Qual canal paga a conta? | custo, custo por lead e custo por cliente por canal (barras, em gráficos separados) + ROAS como indicador |
| Plataforma → Assinaturas | A carteira está crescendo? | receita mensal recorrente por mês (área) + empresas por plano (barras) + vencimentos dos próximos 30 dias |
| Portal do Embaixador | Como estou indo? | meus resultados por mês (colunas) + medidor do nível e da ativação |
| Portal do Mentorado | Quanto falta? | trilha da jornada com medidor de progresso |

As agregações ficam em funções puras (`lib/`) ou em consultas em `db/`, com testes em `tests/`. Os gráficos carregam sob demanda (importação dinâmica), para não pesar a primeira tela.

## Etapa 5 — Abas premium (área por área)

Padrão para todas as áreas:
- **Cabeçalho vivo**: nome da área, para que serve em uma frase, 3–4 indicadores com minigráfico e a ação principal em destaque.
- **Sub-abas com contador** (ex.: Agenda 5, Atendimentos 12); a última sub-aba usada fica lembrada.
- **Troca de visão** onde fizer sentido: Lista ↔ Quadro ↔ Mapa (Atendimentos, Locais, Embaixadores).
- **Ficha lateral** em vez de trocar de tela, com a linha do tempo de tudo o que aconteceu e link direto (`&ficha=`).
- **Ações rápidas na linha** (próximo passo, temperatura, data do retorno), com desfazer.
- **Ações em lote** onde a função permitir (atribuir responsável, mudar etapa), conferidas no servidor.
- **Visões salvas**: filtros favoritos de cada pessoa.

Destaques por área:
- **Hoje** vira o "cockpit do dia": saudação, meta da semana, agenda em linha do tempo, alertas por prioridade e um mini-mapa de onde atuar hoje.
- **Vendas → Atendimentos**: quadro por etapa com arrastar e soltar, pedindo confirmação quando a etapa exige dado (como a venda).
- **Vendas → Agenda**: visão de dia e de semana em linha do tempo.
- **Rede → Embaixadores**: cartões com nível, progresso do treinamento, conquistas e ranking.
- **Rede → Parceiros e eventos**: calendário.
- **Rede → Materiais**: galeria com prévia.
- **Gestão**: layout de configurações (lista à esquerda, conteúdo à direita); Histórico em linha do tempo com filtros.

## Etapa 6 — Portais e Sala de comando

- **Portal do Embaixador** (pensado primeiro para o celular):
  - missões da semana;
  - nível e conquistas;
  - resultados com gráfico;
  - link e QR code de indicação, que já existem. O QR passa a ser gerado no próprio aparelho, sem mandar o link para um serviço externo.
- **Portal do Mentorado**: trilha visual da jornada, próximo encontro e materiais.
- **Sala de comando** (Administrador): modo tela cheia para a TV do escritório.
  - Mapa vivo com pulsos da atividade das últimas 24 h.
  - Indicadores do dia e da semana.
  - Alterna entre as cidades a cada minuto e se atualiza sozinho.
  - **Nenhum nome de pessoa nem dado pessoal na tela**: só números, locais e cidades.

## O que NÃO quero

- Neon em tudo, brilho em textos longos, animação que atrasa ou distrai, sons.
- Gráfico com dois eixos Y, arco-íris de cores, pizza com muitas fatias, número em cada ponto.
- 3D ou efeitos pesados nas telas de trabalho (tabelas, formulários).
- Dados de exemplo aparecendo para clientes de verdade.

## Regras que não mudam

- Continuam como estão: permissões no servidor, isolamento entre empresas, limites do plano (satélite, Street View, importação, exportação) e Assessoria Elite.
- LGPD:
  - pessoa nunca marcada na residência;
  - atendimento só com autorização registrada;
  - calor, cobertura, ligações e Sala de comando nunca expõem a posição de uma pessoa;
  - GPS do mapeador sem histórico.
- O cadastro em campo continua funcionando sem internet; `/api/` nunca entra no cache do app.
- Mentorado e Embaixador continuam com o portal próprio.
- Não quebrar os links `/?org=…&area=…&ver=…`, o login nem os mapas impressos.

## Como validar cada etapa

- **Código**: `npx tsc --noEmit`, lint e `npm test` (hoje 112 testes) passando, com testes novos para as agregações dos gráficos, as áreas de varredura (permissões e isolamento entre empresas) e a rota.
- **Navegador**: teste por função, em **1440 px** e **390 px**, sem rolagem horizontal e sem erro no console, com capturas antes/depois. Funções: Administrador, Coordenação, Líder, Comercial, Embaixador, Mentorado, empresa assinante, Assessoria Elite e dono da plataforma.
- **Mapa**: 5 mil pontos de teste fluidos; modo campo testado sem internet e com GPS simulado; cada modo de ver conferido com a legenda.
- **Gráficos**: paleta aprovada pelo validador do `dataviz` (colar a saída).
- **Acessibilidade**:
  - com movimento reduzido ligado, tudo funciona sem animação;
  - axe sem violações graves.
- **Cliques**: o número de cliques até as 5 ações mais usadas (mapear pessoa, iniciar atendimento, registrar retorno, registrar venda, convidar pessoa) fica igual ou menor.
- **Publicação e guias**: publicar no ambiente de teste a cada etapa e atualizar `docs/guia-do-mapeador.md`, `/guia` e `docs/kit-de-lancamento.md`.

## Entrega

Uma etapa por vez, cada uma com: o que mudou (em palavras simples), capturas antes/depois, testes e o que vem a seguir. Commit e push na branch `claude/executar-projeto-2ehft2`, sem abrir PR.

# Etapa 0 — Diagnóstico da plataforma futurista

> Entrega da Etapa 0 do `docs/prompt-plataforma-futurista.md` (22/10/2026). Nada foi mudado nas telas: o protótipo das três direções foi aplicado por cima das telas reais só para as capturas, e não entrou no código.

## Resumo

1. **Três direções visuais prontas para você escolher** (capturas de Hoje e Mapa, no computador e no celular).
2. **O maior problema de hoje é o lugar do mapa**: no computador, os filtros ocupam ~480 px antes do mapa aparecer; no celular, o mapa só aparece depois de rolar mais de uma tela inteira. A Etapa 2 resolve: mapa ocupando a tela, filtros numa gaveta e os modos em cima do mapa (como no protótipo).
3. **A paleta de gráficos atual reprova** nos testes de cor (daltonismo, contraste e diferença entre cores vizinhas).
4. **Quase todo o catálogo de gráficos dá para fazer com os dados de hoje.** Só 2 gráficos precisam de um histórico novo (começam a encher depois de implantados) e 1 tem dado fraco (sugiro cortar).
5. **No mapa, só a Varredura por áreas e o check-in de visita mudam o banco.** O resto usa o que já existe.

## 1. Direções visuais

Como foi feito: cada direção é um conjunto de cores, fontes e superfícies aplicado às telas reais, com os dados reais. Nas três, o protótipo também mostra o **layout proposto**: indicadores no topo de Hoje (2 por linha no celular), mapa ocupando a tela, seletor de modos, legenda e números sobre o mapa.

O desenho das ruas é esquemático porque o ambiente de teste não acessa os servidores de mapa; na plataforma aparecem as ruas reais. O seletor de modos ainda é só ilustração.

| | A — Noite Dourada 2.0 | B — Holográfico | C — Sala de Comando |
|---|---|---|---|
| Sensação | evolução do visual de hoje: mais profundidade, borda e brilho dourados | vidro translúcido sobre uma aurora dourada e azulada, cantos bem arredondados | painel técnico: grade no fundo, cantos em colchete, títulos em maiúsculas |
| Fonte | Sora (títulos e números) + Inter (texto) | Space Grotesk + Inter | Space Grotesk + Inter |
| Ponto forte | mais legível e mais "Elite"; funciona igual em qualquer celular | é a que mais impressiona à primeira vista | números parecem instrumentos; ótima para a TV da Sala de comando |
| Risco | é a menos "diferente" de hoje | o efeito de vidro pesa em celular simples e reduz um pouco o contraste | maiúsculas cansam em texto longo; mais fria |

**Minha recomendação:** A (Noite Dourada 2.0) como base de toda a plataforma, com o estilo C só na **Sala de comando** (tela da TV) e nos números grandes dos indicadores. É a combinação mais legível e mais leve, e ainda dá a cara de "painel de comando" onde ela faz sentido. Mas a escolha é sua: também posso fazer B ou C inteiros.

As fontes pesam pouco (~15–24 KB cada peso) e ficam dentro do app, funcionando sem internet.

## 2. Plano do mapa

**Como está hoje:**
- Pinos em HTML, agrupados no navegador a cada 42 px. O servidor manda até 1.000 pontos agregados da área visível.
- Busca de endereço pelo Nominatim (OpenStreetMap), ou pelo MapTiler quando há chave.
- Prédios 3D do OpenFreeMap a partir do zoom 15; satélite e híbrido pelo MapTiler, conforme o plano.
- O painel do mapa abre no tema **Claro** por padrão, um bloco branco no meio da plataforma escura.

**Como a pessoa troca de modo:** controle no topo do mapa (no celular, ele rola para o lado e os filtros e a legenda ficam numa gaveta de baixo). O modo fica no endereço da página e a plataforma lembra o último usado. O tema Claro continua como opção para usar em campo, sob sol forte.

### Modos de ver (Etapa 2)

| Modo | Como funciona | Muda o banco? | Serviço externo? | Peso |
|---|---|---|---|---|
| Explorar | motor novo (GeoJSON + agrupamento nativo do maplibre) | não | não | quase zero (o maplibre já carrega só no mapa) |
| Calor | camada de calor nativa, só com locais validados | não | não | quase zero |
| Cobertura | hexágonos calculados no próprio aparelho (código pequeno; a biblioteca pronta pesaria ~400 KB) | não; usa as áreas da Etapa 3 quando existirem | não | ~2 KB |
| Funil | consulta nova no servidor: a etapa mais avançada dos atendimentos de cada local | não | não | pequeno |
| Linha do tempo | consulta nova, mês a mês, pela data de cadastro | não (talvez um índice por data) | não | pequeno |
| Cidade acesa 3D | os prédios do mapa-base não têm um código fixo para "acender" o prédio certo. Proposta: **torres de luz** douradas em cada empresa mapeada (altura = pessoas e atendimentos), com os prédios reais em 3D ao fundo | não | não | pequeno |

### Jeitos de mapear (Etapa 3)

| Jeito | Muda o banco? | Serviço externo? | Observação |
|---|---|---|---|
| Toque no mapa | não | busca reversa de endereço | o Nominatim aceita 1 pedido por segundo; recomendo a mesma chave do MapTiler usada no satélite, com cache de 30 dias |
| Em campo (GPS) + check-in | **sim**: hoje as ações ficam ligadas só a pessoas, então o check-in num local precisa de uma coluna nova (local da visita) | não | a localização de quem mapeia não é guardada |
| Rota do dia | não | abre o Google Maps (até 10 paradas) ou o Waze (próxima parada) | "visitado" usa o check-in |
| Varredura por áreas | **sim**: tabela nova `territory_zones`, com permissões e isolamento por empresa | não | o Comercial vê e atualiza só as áreas dele |
| Lote com revisão no mapa | não | geocodificação em lote | também esbarra no limite do Nominatim, por isso o MapTiler é recomendado |
| Por conexões | não (já existe quem indicou quem) | não | as ligações são sempre entre locais ou cidades |
| Foto da fachada (opcional) | sim + armazenamento de arquivos (R2), que tem custo | — | só se você aprovar |

**Ordem proposta:**
- **Etapa 2 inteira primeiro**, porque resolve o maior problema (o mapa escondido) e não mexe no banco.
- Na Etapa 3, primeiro **Em campo + Rota do dia + Toque no mapa**, que ajudam o Paulo a mapear já. Depois **Varredura**, **Lote** e **Conexões**.

## 3. Catálogo de gráficos conferido com os dados reais

✅ dá para fazer hoje · 🆕 precisa de histórico novo (enche a partir da implantação) · ✂️ sugiro cortar

| Aba | Gráfico | Situação | De onde vem |
|---|---|---|---|
| Hoje | indicadores com minigráfico de 8 semanas | ✅ | série mensal e semanal que já existe |
| Hoje | medidor da meta | ✅ | meta de vendas da cidade; metas diárias do vendedor |
| Território → Cidades | cobertura e minigráficos por cidade | ✅ | locais validados ÷ mapeados; leads e vendas por cidade |
| Vendas → Agenda | carga dos próximos 14 dias | ✅ | data do próximo retorno |
| Vendas → Atendimentos | funil Mapeadas → Pagamento confirmado | ✅ | situação atual de cada pessoa e atendimento |
| Vendas → Atendimentos | tempo em cada etapa | 🆕 | hoje a **troca de etapa não fica registrada com data** (o histórico guarda só os retornos). Precisa de um registro novo de mudança de etapa; recomendo criá-lo já na Etapa 1 para ir acumulando |
| Vendas → Pagamentos | confirmado × pendente por mês | ✅ | vendas com valor, situação e data do pagamento |
| Rede → Embaixadores | ranking e funil do embaixador | ✅ | leads e vendas de cada embaixador |
| Rede → Indicações | por origem e canal | ✅ | canal e origem dos leads; quem indicou quem |
| Rede → Mentorados | distribuição por etapa da jornada | ✅ | etapas concluídas no portal |
| Resultados → Visão geral | receita × custo, resultado do mês, leads e clientes por semana | ✅ | já existe a série mensal |
| Resultados → Metas e rotina | meta × realizado por pessoa | ✅ | metas diárias × atividades registradas |
| Resultados → Metas e rotina | mapa de calor dia × hora | ✂️ | a atividade guarda só o **dia**; a hora disponível é a do registro, que pode ser bem depois. Ficaria um gráfico enganoso |
| Resultados → Mapeamento | acumulado, produção por mapeador, locais por setor | ✅ | quem cadastrou e quando; data da validação |
| Resultados → Custos e canais | custo, custo por lead e por cliente por canal | ✅ | custos por canal e período |
| Plataforma → Assinaturas | receita mensal recorrente por mês | 🆕 | a assinatura guarda só o valor atual. Proposta: uma "foto" mensal automática (o envio programado diário já existe); empresas por plano e vencimentos ✅ |
| Portal do Embaixador / Mentorado | resultados por mês; trilha da jornada | ✅ | dados do próprio embaixador ou mentorado |

**Paleta atual** (validador do skill `dataviz`, modo escuro, sobre a superfície Elite): **REPROVADA** em todos os quatro testes:
- **Faixa de claridade**: 4 cores fora da faixa.
- **Saturação**: o cinza e o azul-petróleo quase não têm cor e parecem cinza.
- **Daltonismo**: âmbar e laranja ficam quase iguais (diferença 5,6; o mínimo é 8).
- **Visão normal**: mesmo sem daltonismo, âmbar e laranja ficam parecidos demais (diferença 7,4; o mínimo é 15).

Há ainda um alerta de **contraste**: o azul-petróleo some no fundo escuro. A Etapa 1 refaz a paleta e só segue quando o validador aprovar.

## 4. Riscos e como evitar

- **Celular simples:**
  - efeito de vidro e brilho só em poucos elementos (nunca em listas longas);
  - o motor novo do mapa desenha os pontos no próprio mapa, e não um elemento por pino;
  - meta de 5 mil pontos fluidos, testada com dados de teste.
- **LGPD:**
  - calor, cobertura, ligações e torres usam só locais comerciais e centros de cidade;
  - a Sala de comando não mostra nomes;
  - o GPS de quem mapeia não é guardado.
- **Permissões:** toda consulta nova (funil, linha do tempo, áreas, gráficos) passa pela mesma regra de hoje (o Comercial vê só o dele; cada empresa só o dela), com testes automáticos.
- **Serviço de endereço:** o Nominatim pode bloquear o uso intenso em campo → MapTiler + cache.
- **Sem internet:**
  - fontes e telas continuam no app;
  - o mapa-base (ruas) não carrega sem internet, mas a lista de locais próximos e o cadastro funcionam, como hoje.
- **Testes que dependem de nomes:** os nomes de áreas e abas não mudam; os modos do mapa são nomes novos.
- **Legibilidade:** maiúsculas só em rótulos curtos (nunca em textos); contraste AA conferido em cada etapa.

## 5. O que preciso de você

1. **Direção visual**: A, B, C ou a minha recomendação (A como base + C na Sala de comando e nos números).
2. **Chave do MapTiler**: se a publicação já tem a chave do satélite, uso a mesma para a busca de endereço em campo e em lote. Se não tiver, a gente cria uma (há plano gratuito).
3. **Mapa de calor por horário**: confirmar o corte (ou manter, sabendo que a hora é a do registro).
4. **Foto da fachada**: agora, depois ou nunca (tem custo de armazenamento).

Com essas respostas, sigo para a **Etapa 1 (fundação futurista)**.

## Decisões (22/10/2026)

- **Visual:** A (Noite Dourada 2.0) como base de toda a plataforma; estilo C (Sala de Comando) só na tela da TV e nos números grandes dos indicadores.
- **Busca de endereço em campo e em lote:** usar a chave do MapTiler, a mesma do satélite, com cache.
- **Mapa de calor dia × hora:** cortado.
- **Foto da fachada:** depois, decidida com o uso real dos modos do mapa.

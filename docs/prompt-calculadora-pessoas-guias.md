# Prompt — Calculadora de metas, página de cada pessoa e guia em cada aba

> Para usar: cole este texto em uma nova conversa com o Claude neste repositório (ou peça "siga o docs/prompt-calculadora-pessoas-guias.md").
> Rode **depois da primeira semana de uso real** (`docs/roteiro-primeira-semana.md`): a Etapa 0 começa pelo que a equipe anotou.
> Este prompt absorve partes das Etapas 3 a 6 do `docs/prompt-plataforma-futurista.md` e fixa uma regra para o `docs/prompt-missoes-futuristas.md` (veja "O que este prompt absorve").

---

## Contexto

Você está trabalhando na **Elite Expansion X** (repositório `elite-expansion-x`, branch `claude/executar-projeto-2ehft2`): plataforma de expansão por cidades — mapa, pessoas, locais, atendimento até a venda, embaixadores, mentorados, rede de indicações e resultados. A Elite Frascaroli Academy usa e também vende por assinatura: cada empresa assinante tem um ambiente só dela (uma organização), com a plataforma inteira.

Stack: Next 16 (vinext) + React 19 em Cloudflare Workers com D1 (no máximo 100 parâmetros por consulta e 5 SELECTs por UNION), Drizzle (a última migração é a `0027_territory_regions.sql`), Tailwind, shadcn/Radix, lucide-react, maplibre-gl, recharts carregado sob demanda e os componentes de `components/elite` (ChartFrame, StatTile, Meter, Segmented, Timeline, EmptyArt). Visual Noite Dourada 2.0, com a paleta de gráficos já validada (`--chart-*` em `app/globals.css`).

Funções de login: Administrador, Coordenação (1 cidade), Líder (1 cidade), Comercial, Embaixador (portal próprio) e Mentorado (portal próprio). A empresa assinante entra como Administrador da organização dela. A Assessoria Elite entra nos clientes como Administrador, com a faixa "Modo assessoria". Os donos da plataforma veem ainda a área Plataforma.

## Como está hoje (ponto de partida — não refazer o que já existe)

**Metas e números**
- Metas por cidade em `cities`, todas sem prazo nem período: "Meta de vendas" (`sales_goal`, padrão 100), que não aparece em nenhuma tela e não entra em nenhum cálculo; "Meta de embaixadores" (`ambassador_goal`), que só aparece como a barra de embaixadores ativos em Saúde das cidades; "CAC máximo (R$)" e "Orçamento da cidade (R$)", usados na decisão da cidade. Quem edita: Administrador (qualquer cidade) e Coordenação (a própria), no cadastro da cidade.
- Meta **diária** por vendedor em `seller_goals` (frios, quentes e contatos), definida pela gestão em Resultados → Metas e rotina ("Definir meta"); relato diário em `seller_reports`.
- Critérios da expansão em `settings` (mínimos, dias sem atividade, meta orgânica), em Gestão → Regras e cálculos, só para o Administrador. Toda empresa nova nasce com esses números em 0.
- Não existe meta da empresa inteira.
- Os indicadores são calculados no navegador por `buildDashboardView` (`lib/expansion-domain.ts`), sobre até 1.000 leads, vendas e custos. `safeRatio` devolve vazio em vez de dividir por zero, e a tela mostra "Sem dados suficientes".
- A única "conversão" é pagamentos ÷ leads válidos. Ninguém calcula conversão por coorte, tempo até pagar, ticket médio, ritmo ou projeção. `opportunity_stage_events` grava cada troca de etapa desde a migração 0025 (que criou eventos `ini-` para os atendimentos antigos, sem a data real da troca), mas nada lê essa tabela.
- Armadilhas nos dados:
  - `record_sale` (`db/mutations.ts`) regrava `paid_at` com a hora atual quando uma venda já paga é salva de novo, e zera em qualquer outra situação (Em negociação, Venda confirmada, Cancelada ou Reembolsada);
  - a importação da rede grava a data do pagamento que veio da planilha, mas o lead fica com a data da importação (o tempo até pagar dá negativo);
  - a etapa "Ganho" não garante pagamento: a venda de verdade é `sales.status = 'Pagamento confirmado'` com `paid_at`;
  - cada pessoa tem no máximo um atendimento, e cada atendimento no máximo uma venda (índices únicos): receita recorrente não entra;
  - o atendimento tem dois responsáveis: `leads.assigned_to_email` (as telas do Comercial filtram por ele) e `opportunities.owner_email` (Metas e rotina conta por ele). Muitos atendimentos não têm oportunidade ("+ Novo → Novo atendimento" e a importação da rede não criam), e os importados ficam sem responsável;
  - as datas chegam em quatro formatos: `AAAA-MM-DDTHH:MM:SS-03:00`, `AAAA-MM-DD 12:00:00` (importação), `CURRENT_TIMESTAMP` (UTC, padrão de colunas antigas) e só o dia, `AAAA-MM-DD` (visitas e atividades);
  - Visão geral agrupa pagamentos e receita pelo mês em que o lead foi criado. O e-mail semanal e a Linha do tempo do mapa usam a data do pagamento. Os "Pagamentos confirmados" de Metas e rotina contam um dia só e só atendimentos com oportunidade, sem cancelados nem revogados (o anonimizado vira Cancelado).
- Escopo: o Comercial vê só os próprios números e não vê custos nem CAC; Líder e Coordenação, só a sua cidade; o Embaixador vê os atendimentos como "Lead #id".
- Plano: `PLAN_FEATURES` tem só `imports`, `exports` e `externalMaps`; sem linha em `organization_entitlements`, tudo fica liberado.

**A pessoa no mapa**
- `territory_people` guarda nome, cidade, líder, quem indicou (`referrer_id`), **um** local (`place_id` + `place_link`) e **um** bairro (`region_id`). Não guarda contato nem endereço: o contato e a autorização ficam no lead.
- A pessoa nunca tem coordenada própria: aparece no local ligado, no centro do bairro ou no centro da cidade (JOIN em `db/territory.ts`; `displayedCoordinates`; a ação `location` recusa `person:`; o geocode recusa `kind=person`).
- O vínculo "Frequenta" existe em `PLACE_LINKS` (`lib/places.ts`), mas a pessoa só tem **um** local: editar troca o local e perde o anterior. A ficha de um local não lista as pessoas ligadas a ele.
- A "Ficha territorial" é um painel do mapa aberto por estado do React: não existe link para ela, e ao recarregar ela fecha. O resultado "Pessoa" do Ctrl+K só leva ao mapa.
- Não há linha do tempo da pessoa. A ficha mostra "Próxima ação" e "Última atividade operacional"; a ficha do atendimento tem o "Histórico do acompanhamento" (só `followup_events`). `territory_actions` guarda só o dia e não tem coluna de local.
- Níveis da rede (calculados, não gravados): Cliente (pagamento confirmado), Indicador (indicou alguém) e Multiplicador (alguém que ela indicou comprou). A legenda do mapa ("Círculo dourado = comprou", "Indicador (comprou e indicou alguém)") e Rede → Indicações dizem que é preciso ter comprado, mas `db/territory.ts`, `db/followup.ts` e `tests/network-levels.test.mjs` marcam como Indicador quem indicou mesmo sem ter comprado, e o pino é dourado nos três níveis. "Indicador" também é o 1º nível do programa de embaixadores, que é outra coisa.
- Dicas que já existem: Banco de Ganchos (`prospect_hooks`, por situação, canal e setor; o setor não é casado com o local da pessoa), roteiro do Método F.E.C.H.A. (`lib/fecha-guide.ts`), jornada do mentorado e o Guia do mapeador (`lib/mapper-guide.ts`, igual para todos).
- Portal do Mentorado (`app/client-portal.tsx`): jornada, materiais, próximo encontro, contato da equipe, "Indicar alguém" e "Suas indicações". Não mostra lugares nem dicas.
- Defeitos que esta rodada corrige: o Comercial ainda recebe o id de quem indicou mesmo quando essa pessoa está fora do acesso dele; a auditoria `link_referral` (`db/followup.ts`) grava a observação livre e não é limpa na anonimização; o titular anonimizado continua no mapa e na Rede quando era embaixador ou nunca teve atendimento; e a pessoa ligada a uma igreja, ou como paciente de uma clínica, aparece no ponto desse local.

**Ajuda dentro da plataforma**
- Cada área tem uma frase "para que serve" (`description` em `lib/navigation.ts`), igual para todas as funções; as sub-abas não têm.
- Algumas sub-abas têm uma dica curta no topo (`ActionBar`), e várias telas vazias ensinam o próximo passo (`EmptyState`), as duas dentro de `app/expansion-dashboard.tsx`.
- Boas-vindas por função (`WelcomeDialog`, grava `app_users.welcomed_at` uma vez e não reabre; a Assessoria não grava); Primeiros passos em Hoje (só gestão); `/guia` público, com o guia do mapeador; glossário e "Como os indicadores são calculados" só para o Administrador, em Gestão → Regras e cálculos.
- Não existe guia por aba, registro de "guia visto", botão para reabrir a ajuda, comando de ajuda no Ctrl+K nem teste que garanta guia em toda aba.
- Tamanho: existem 29 sub-abas. O Administrador vê Hoje + 26; Coordenação e Líder, Hoje + 17; o Comercial, Hoje + 10. Somam-se os 2 portais.
- Os modelos de importação usam dados que parecem reais (o de empresas cita "Escritório Esmeraldas" e a fonte "Equipe Elite"; o da rede, telefones `31 99999-000X`, e-mails `@exemplo.com` e o produto "Mentoria Elite"), e o "Ver exemplo" de Convidar equipe preenche o campo de verdade.

**Testes e publicação**: 146 testes em 25 arquivos (`npm test` = build + `node --test`). O CI lista cada arquivo de teste à mão em `.github/workflows/verificar.yml`, e `tests/navigation.test.mjs` compara as sub-abas exatas de cada função. `publicar-teste.yml` aplica as migrações no D1 e publica. O ambiente publicado guarda os dados reais da semana de uso: migração nele precisa ser idempotente, e nada de exemplo é semeado lá.

## O que eu quero

Três partes que se ligam:

1. **Calculadora de metas.** A Elite e cada empresa assinante, cada uma só com os próprios números, colocam uma meta (vendas pagas ou receita até uma data). A plataforma responde em português simples:
   - **quanto falta** e **quando chegamos no ritmo atual**;
   - **o que precisa acontecer por semana** para bater no prazo: atendimentos novos, pessoas a mapear, vendedores e mapeadores;
   - **o que mais ajuda**: os ajustes que mais encurtam o prazo (mais vendedores ou mapeadores, conversão, indicações e, quando houver custo registrado, verba de mídia), para eu simular antes de decidir;
   - depois de decidir, **"Aplicar como meta"**: a meta passa a aparecer em Hoje, em Metas e rotina e na Saúde das cidades.

   Tudo sai dos números reais da empresa. Onde não houver base, a tela diz "Sem dados suficientes" e pede a minha estimativa, que fica marcada como estimativa.
2. **Página de cada pessoa.** Cada pessoa do mapa ganha uma página própria, com link, que junta tudo dela: onde aparece no mapa, nível na rede, quem indicou e quem ela indicou, atendimento, histórico e o **próximo passo**. Nela ficam os **lugares** onde a pessoa tem vínculo: onde trabalha, é sócia, é membro ou frequenta. É o que eu chamei de "rotas" da pessoa, sem virar rastreamento: sem trajeto, horário, GPS ou casa. Cada lugar mostra se é hora de abrir, plantar ou avançar, ou se já dominamos, e tem um **plano para plantar relacionamentos**, com dicas e estratégias prontas pelo nível da pessoa e pelo tipo do lugar. O mentorado vê os lugares e as dicas dele no portal.
3. **Guia em cada aba.** Na primeira vez que alguém entra numa aba, aparece um cartão curto com para que ela serve e o 1º passo; um toque em "Ver como usar" mostra os 3 passos e um exemplo. Depois, o botão "Como usar" reabre o guia quando a pessoa quiser. Assim cada função aprende a plataforma inteira sem treinamento.

**Como as partes se ligam:** a Calculadora diz quantos atendimentos faltam e **onde buscar** (clientes que ainda não indicaram, indicações sem atendimento, pessoas mapeadas sem atendimento, lugares com cliente e ainda sem plano de plantio). Cada item abre a página da pessoa, e o próximo passo dela é a ação que faz o número andar. O guia ensina a fazer. Cada visita, indicação e venda registrada melhora as taxas da Calculadora.

## O que este prompt absorve (para não fazer duas vezes)

- **Etapa 4 do futurista (gráficos):** o medidor "Estou no ritmo?" de Hoje vira o cartão "Quanto falta"; a meta × realizado por pessoa entra em Metas e rotina; as funções de taxa (conversão por coorte, tempo até pagar, produção por mapeador por semana) ficam em `lib/` e `db/` para a Etapa 4 reaproveitar. Continuam com a Etapa 4: os outros gráficos, o funil com % de passagem e o tempo em cada etapa (ignorando os eventos `ini-`), e a mudança dos 4 indicadores de Hoje para agregados do servidor.
- **Etapa 5 do futurista (abas premium):** o contrato de link `&ficha=` (aqui só para pessoa), a linha do tempo de tudo (para a pessoa), o "para que serve em uma frase" (vai para o guia e para o botão "Como usar") e a "meta da semana" do cockpit (lida de `goals`). Continuam lá: cabeçalho vivo, sub-abas com contador, Lista ↔ Quadro ↔ Mapa, ações rápidas e em lote, visões salvas, Hoje como cockpit e as fichas de local e de atendimento pelo mesmo `&ficha=`. O botão "Como usar" continua no cabeçalho quando a Etapa 5 redesenhá-lo.
- **Etapa 3 do futurista e os passos do mapa:** os "passos do mapa" são o plano que combinei numa conversa anterior e não estão escritos no repositório; só o passo 1 (bairros) foi feito, no commit `bb5cb5a`. A numeração deles não é a da lista da Etapa 3 do futurista (lá, 1 é Toque no mapa, 2 Em campo, 3 Rota do dia, 4 Varredura, 5 Lote e 6 Por conexões), então cite sempre o passo pelo nome. Nenhum deles é feito aqui. Este prompt pega só três coisas: `territory_actions.business_id`, o "Registrar visita" manual sem GPS e a regra "nunca linhas entre os lugares de uma pessoa". Ficam para os passos: **Toque no mapa** (pino arrastável), que depende da `MAPTILER_GEOCODING_KEY` e roda num pedido meu separado, entre as etapas deste prompt; **Em campo**, que reaproveita "Registrar visita" como check-in e põe a visita na fila sem internet guardando só ids; **Varredura**, cuja meta por área entra em `goals`; **Conexões e Rota do dia**, que pode puxar as visitas programadas e trazer um modo "Onde plantar" colorido pela situação do lugar, com ligações só entre locais e cidades; e **Lote com revisão**.
- **Etapa 6 do futurista (portais e Sala de comando):** o guia nos dois portais e "Seus lugares" no Portal do Mentorado. Continuam lá: trilha visual da jornada, missões, nível e QR do Embaixador, e a Sala de comando, que nunca mostra lugares de pessoas.
- **`docs/prompt-missoes-futuristas.md` (não executado):** nada dele roda aqui. Fica uma regra: missões automáticas leem o alvo de `goals` (por exemplo, a meta de Pessoas mapeadas da pessoa) e nunca criam uma meta própria. "Missões de plantio" podem nascer das visitas programadas depois.
- **Já feito no commit `c90e5f7` (não refazer; só cobrir com teste o que faltar):** bairro na cópia de dados e na anonimização, contagem de "Indicou" do Comercial pelo escopo dele e textos de LGPD com o centro do bairro.

## Etapa 0 — Diagnóstico e decisões (entregar ANTES de mudar telas)

Entregue `docs/diagnostico-calculadora-pessoas-guias.md`, em português simples, com seis partes:

1. **Retorno da semana de uso real**, por função: onde travou, o que não entendeu e o que faltou, a partir das anotações que eu colar nesta conversa (o roteiro pede para a equipe anotar e me mandar, e você não acessa o ambiente publicado). Se eu ainda não tiver colado, peça antes desta parte e adiante as outras. O que se resolve em até 1 dia vira ajuste rápido da Etapa 1; o que muda o plano volta para mim antes de seguir.
2. **Números dos dados, só para leitura e sem nomes**, com o SQL escrito no documento. O banco é um só para todas as empresas: cada consulta filtra pela organização (`JOIN cities c ON c.id = x.city_id AND c.organization_id = ?`), o resultado sai separado por empresa e, por padrão, só a Elite (organização 1) entra no documento. Rode primeiro no banco local, que é de TESTE (um mês, pessoas de carga de teste, custos de R$ 1) e não serve de premissa. Para o ambiente publicado (o banco `elite-expansion-x-teste`), crie `.github/workflows/diagnostico-leitura.yml`, disparado à mão e no padrão do passo "Diagnóstico de acesso (só leitura)" de `publicar-teste.yml`: só `SELECT`, uma organização por vez (entrada `organizacao`, padrão 1), só contagens, nunca nomes, e-mails ou telefones, e sem publicar nada. Dispare-o pelo GitHub e copie as contagens para o documento. (Você não tem a credencial do Cloudflare, e um `npx wrangler d1 execute DB --remote` solto não acha esse banco, porque o repositório não tem `wrangler.toml`.) Meça:
   - a amostra de cada taxa da Calculadora (Etapa 2) e quais dariam "Sem dados suficientes";
   - o tempo mediano até o pagamento;
   - as vendas pagas salvas mais de uma vez (mais de um "Venda atualizada para Pagamento confirmado." por venda em `audit_logs`);
   - as vendas importadas, os atendimentos e as vendas pagas sem oportunidade, e as cidades em modo Consolidado;
   - as cidades com "Meta de vendas" diferente do padrão 100;
   - os atendimentos em que `opportunities.owner_email` é diferente de `leads.assigned_to_email`;
   - os locais sem setor que já têm pessoas ligadas;
   - as pessoas ligadas hoje a locais do setor Religioso, de Saúde (com Frequenta, Membro do network ou Mentorado), de Associação / entidade, ou de ensino (tipo Instituição de ensino ou setor Educação) com Frequenta;
   - os locais cujo nome ou "Atividade" (`businesses.segment`, que a tela sugere preencher com "padaria, clínica, igreja") fala em igreja, templo, sindicato, partido, clínica, hospital, condomínio ou residencial sem o setor correspondente. É uma lista de revisão: nada é apagado sozinho.
3. **Esboço em 390 px**, em texto ou desenho simples, sem código: Calculadora, Página da pessoa e cartão "Como usar".
4. **Migrações previstas**, sempre no próximo número livre de `drizzle/` (o passo Toque no mapa pode ocupar um número antes): `app_users.guides_seen` (Etapa 1), `territory_people.source` (Etapa 2), `goals` (Etapa 3), `person_places` e `territory_actions.business_id` (Etapa 5).
5. **Decisões**, cada uma com a sua recomendação (tabela abaixo). Junto, para eu aprovar uma vez: o exemplo resolvido da Calculadora (Etapa 2) conferido conta a conta e o texto das dicas de plantio (Etapa 5).
6. **Riscos** e como evitar cada um. Já sei destes: lugares e visitas virarem rastreamento de uma pessoa; dado sensível escondido num local sem setor ou de tipo genérico (uma igreja cadastrada como "Ponto de encontro", sem setor); taxa errada por amostra pequena ou armadilha de data; números diferentes entre telas por bases diferentes; vazamento entre funções e entre empresas (`leads`, `sales`, `costs` e `territory_*` não têm `organization_id`); migração no ambiente publicado, que guarda dados reais; limites do D1; testes que dependem de nomes exatos; e a expectativa de que a Calculadora promete, quando ela só projeta.

| Decisão | Minha recomendação de partida |
|---|---|
| O que da semana de uso real entra antes | O que se resolve em até 1 dia entra na Etapa 1. Se a semana mostrar que achar e acompanhar pessoas é mais urgente que a meta, a Página da pessoa (Etapa 4) vem antes da Calculadora (Etapas 2 e 3), e "Onde buscar" entra no fim da Etapa 2. |
| Significado de "Indicador" | **Já decidido por mim:** fica a regra que a plataforma já calcula. Indicador é quem indicou alguém, mesmo sem ter comprado. Só os textos que dizem "comprou e indicou" e "Círculo dourado = comprou" são corrigidos (Etapa 1). O cálculo (`db/territory.ts`, `db/followup.ts`, `tests/network-levels.test.mjs`) e as cores do mapa não mudam. Como "Indicador" também é o 1º nível do programa de embaixadores, guias e página dizem "nível na rede". |
| Onde fica a Calculadora e quem usa | Em Resultados → Calculadora, para o Administrador (a empresa toda ou uma cidade), a Coordenação e o Líder (só a cidade deles). O Comercial vê só "Minha meta", em Hoje e em Metas e rotina, sem custos. Embaixador e Mentorado não veem. |
| Quem aplica a meta | O Administrador (a empresa ou qualquer cidade) e a Coordenação (a própria cidade), que já editam a cidade hoje. O Líder divide pela equipe uma meta já aplicada. O Comercial não aplica. A Assessoria Elite aplica como Administrador, e fica marcado no Histórico. |
| Que tipo de meta | Uma meta só, com começo e fim: vendas pagas ou receita confirmada, do dia 1º do mês até a data escolhida (o padrão é o mês). Pode ser da empresa, de uma cidade ou de uma pessoa. O plano grava junto as metas de atendimentos e de pessoas mapeadas. A meta diária de frios, quentes e contatos passa a se chamar "Rotina do dia", e a "Meta de embaixadores" fica como está (tabela `goals`). |
| "Meta de vendas" que já existe nas cidades | Hoje é um número sem prazo que nenhuma tela usa. Mostrar só as cidades da Elite com valor diferente do padrão 100 (no banco de teste, Esmeraldas 30 e Sete Lagoas 20) e transformar em meta só as que eu confirmar. O campo sai do cadastro da cidade. Nas empresas assinantes nada é convertido: o Administrador de cada uma define a meta na Calculadora. |
| Salvar simulações | Não salvar: comparar "Hoje" e "Com ajustes" na própria tela, usar "Copiar resumo" e gravar só a meta aplicada, com as estimativas usadas. |
| Quanto histórico a Calculadora usa | Os últimos 90 dias. O ritmo de vendas e os atendimentos por semana olham as últimas 8 semanas, e o tempo até pagar, 180 dias. A conversão só conta atendimentos começados há mais de 60 dias, para dar tempo de a pessoa pagar. Com pouco histórico, a conta divide pelas semanas que existem, sem inventar as que faltam. Abaixo do mínimo, a tela diz "Sem dados suficientes" e pede a minha estimativa. Mínimos: conversão, 30 atendimentos e 3 pagamentos; ticket e tempo até pagar, 5 vendas; ritmo, 2 semanas; atendimentos por semana, vendedores e mapeadores, 4 semanas; pessoa mapeada → atendimento, 30 pessoas e 3 atendimentos; indicações, 5 clientes e 2 indicações; mídia, 10 atendimentos e custo maior que zero. |
| De quem é cada venda e cada atendimento na meta por pessoa | Do responsável que aparece em Metas e rotina. O atendimento que ainda não chegou lá conta para quem está com ele na Agenda. A venda sem ninguém responsável (as importadas pela planilha da rede) conta na cidade e na empresa e aparece como "sem responsável", fora da meta de cada pessoa. Se a parte 2 achar responsáveis diferentes, os dois passam a mudar juntos (`opportunities.owner_email` e `leads.assigned_to_email`). |
| Consertos de dados | Hoje, quem salva de novo uma venda já paga troca a data do pagamento pela data em que salvou: isso é consertado já. As datas antigas só mudam com a minha aprovação, usando a primeira confirmação de pagamento que ficou no Histórico, e as vendas importadas pela planilha ficam como estão. Cada pessoa nova no mapa passa a guardar de onde veio (mapeamento, atendimento, portal, importação ou embaixador); nas antigas, só quando houver prova (`record_sale`, `territory_people.source`). |
| Calculadora no plano de assinatura | Incluída em todos os planos. Revejo quando houver nomes e preços dos planos. |
| Como abre a Página da pessoa | Por cima da tela em que você está, com um link próprio que dá para copiar e enviar: painel largo no computador, tela cheia no celular. Sem aba nova. A busca rápida (Ctrl+K) abre a página (`&ficha=pessoa:<id>`). |
| Lugares: nome, limites e quem pode ter | "Lugares" (no guia, "lugares de relacionamento"), nunca "rota". Só estabelecimentos do mapa, na cidade da pessoa, até 5 contando o principal. Sem ordem, horário, frequência, linhas no mapa, GPS ou texto livre. Lugares além do principal só para quem autorizou contato ou é Mentorado ou Embaixador ativo, com a confirmação da pessoa a cada lugar. |
| Setores sensíveis (LGPD art. 5º, II e art. 11) | Igreja: nenhuma pessoa ligada, nem como local principal. Saúde: só quem trabalha lá. Associação / entidade: só com a confirmação "Não é sindicato, partido nem entidade religiosa". Escola: "Frequenta" só se a própria pessoa estuda ou trabalha lá. Para ligar pessoas, o local precisa ter setor ("Outro" vale; é um campo a mais só ao cadastrar local que não é Empresa). Vale também para o mapeamento, a edição, as importações, os planos e as visitas. Os vínculos antigos que quebram a regra não são apagados: até a gestão revisar, a pessoa aparece no centro do bairro ou da cidade, e o local não aparece nas telas novas. |
| Situação do lugar e plano | Situação automática pelas pessoas da rede ligadas ao lugar: Abrir, Plantar, Avançar ou Dominado. A visita do plano só tem "programada" e "feita". Sem jeito novo de ver o mapa agora. |
| Como o guia aparece e onde guarda o "já vi" | Cartão curto no topo da aba na 1ª visita (no mapa, um chip pequeno), botão "Como usar" no cabeçalho e "Ajuda" na busca rápida (Ctrl+K). O "já vi" fica guardado no login da pessoa, com cópia no aparelho; a Assessoria guarda só no aparelho. Alternativa mais simples: só no aparelho, com o cartão reaparecendo em cada celular ou computador (`app_users.guides_seen`). |
| Visita sem internet e passos do mapa | Nesta rodada, registrar visita precisa de internet; o registro sem internet vem no passo Em campo. O passo Toque no mapa roda num pedido separado, quando a chave do MapTiler estiver no Cloudflare, sem travar nada daqui. |

Pare aqui e espere minha aprovação.

## Etapa 1 — "Como usar" em cada aba, correções de texto e travas contra dado de exemplo

A equipe está usando a plataforma agora. Esta etapa reduz dúvidas já, com risco baixo (não mexe em número nem em permissão), cria o registro de guias que toda tela nova vai seguir e fecha os caminhos por onde uma linha de exemplo viraria cadastro de cliente.

**Como aparece**
- **Primeira visita** a cada aba: no topo do conteúdo, o cartão "Como usar: <aba>", com no máximo 3 linhas em 390 px (para que serve e o 1º passo) e os botões "Ver como usar" (abre o guia completo), "Fazer agora" (quando houver) e "Entendi" (fecha e marca como visto). Não é janela: não cobre nada e nunca aparece com a `WelcomeDialog` aberta. Na 1ª entrada, as boas-vindas vêm primeiro.
- **No mapa**, o cartão vira um chip flutuante no canto ("Como usar o mapa" e X), acima do botão Legenda, para não tirar altura do mapa.
- **Guia completo** numa gaveta (`components/ui/sheet.tsx`): no celular sobe de baixo, com até 85dvh e rolagem; no computador abre à direita, com cerca de 420 px. Tem título, descrição, foco preso, Esc e "Fechar", que devolve o foco.
- **Reabrir:** o botão "Como usar" no cabeçalho da área (`app/app-shell.tsx`, ao lado do título), com ícone e texto (no celular só o ícone, com `aria-label` "Como usar esta aba"); o mesmo botão no topo do Portal do Embaixador (`AmbassadorPortal`, em `app/expansion-dashboard.tsx`) e do Portal do Mentorado (`app/client-portal.tsx`); e, no Ctrl+K (`lib/commands.ts`), "Ajuda: <aba>" (leva à aba com o guia aberto) e "Mostrar os guias de novo".
- Sem tour, setas pela tela, vídeo ou som. Animação curta, desligada com movimento reduzido.

**Conteúdo** (`lib/tab-guides.ts`: dados puros, carregados sob demanda com `import()` quando a aba ainda não foi vista ou o botão é tocado, e com `warmUp` depois de Hoje; sem pedido ao servidor)
- Chaves: `${area}/${view}` (a mesma chave `here` de `app/expansion-dashboard.tsx`; `hoje/` para Hoje), `portal:embaixador` e `portal:mentorado`; depois, `resultados/calculadora` (Etapa 2) e `ficha:pessoa` (Etapa 4).
- Campos de cada guia:
  - **título** ("Como usar: Agenda", até 40 caracteres);
  - **para que serve** (1 frase, até 120);
  - **passos** (exatamente 3, até 100 caracteres cada, começando por um verbo ou pelo lugar da tela, como em Em "Resumo", veja…, e com o nome exato do botão ou da seção entre aspas, como aparece em 390 px);
  - **exemplo** (até 280 caracteres, sempre com o selo "Exemplo", e um desenho estático opcional feito com os tokens da plataforma);
  - **cuidado** (opcional, até 2 frases, só quando há LGPD ou permissão);
  - **ação** (opcional: uma ação do + Novo, `area/aba` ou `mapear`; o botão "Fazer agora" só aparece se a função pode fazer, com o mesmo motivo de indisponível do + Novo, como "sem cidade");
  - **por função** (variações parciais, por exemplo para o Comercial em Hoje, Mapa, Indicações, Ganchos e Metas e rotina).
- Regras: `{empresa}` vira `access.organizationName`; até cerca de 120 palavras por guia; nenhuma sigla sem explicação (CAC = custo por cliente pago); nada de maiúsculas em texto longo; nenhum guia cita aba que a função não vê.
- Cobertura nesta etapa: Hoje, as 29 sub-abas e os 2 portais (32 guias). A Calculadora e a Página da pessoa ganham o guia nas etapas delas (34 ao todo). As janelas e importações continuam ensinando pelo próprio texto, e o guia da aba aponta para elas. Daqui em diante, toda tela nova (Missões, Rota do dia, Varredura) só entra com guia, e o teste obriga.

**Exemplo sem dado falso**
- O exemplo é texto fixo do guia, num quadro com o selo "Exemplo". Nunca é gravado no D1 nem enviado ao servidor, e nunca entra em indicadores, mapa, Ctrl+K, exportações, e-mails ou Privacidade (LGPD). Não existe "modo demonstração".
- Nomes fictícios e fixos, só o primeiro nome (Ana, Bruno, Carla, Maria, Daniel); lugares Padaria Pão Dourado, Academia Corpo Ativo e Escritório Contábil Modelo; "Cidade Exemplo". Números redondos, sem telefone, e-mail ou documento. Em nenhuma empresa aparecem "Elite", "Esmeraldas" ou pessoas reais da equipe.
- O exemplo mostra as regras certas: a pessoa aparece no local ligado, no centro do bairro ou no centro da cidade, nunca na casa; o atendimento aparece com a autorização registrada.
- Travas: os três modelos de importação (`app/people-import.tsx`, `app/business-import.tsx` e `lib/network-import.ts`) passam a ter a linha de exemplo com o nome começando por "EXEMPLO", nenhum contato e nada de "Elite" em nenhuma coluna (hoje o produto do modelo da rede é "Mentoria Elite" e a Fonte do de empresas é "Equipe Elite"). Nos modelos com coluna Cidade (pessoas e rede), a cidade é "Cidade Exemplo"; o de empresas não tem essa coluna (a cidade vem da tela), e lá a trava é só pelo nome. Os três importadores recusam essa linha no servidor (o de empresas em `db/commercial.ts`, `import_preview` e `import_commit`): "Linha de exemplo do modelo: troque pelos dados reais." O "Ver exemplo" de Convidar equipe (`app/team-panel.tsx`) mostra o exemplo num quadro à parte, sem preencher o campo real, e o servidor recusa e-mail `@exemplo.com`.

**Exemplos de guia (o tom que eu quero)**
- **Território → Mapa** (gestão e Comercial). Para que serve: ver onde a rede está e cadastrar locais e pessoas sem sair do mapa. 1) Toque em "Mapear" (no computador, "Mapear local e pessoas") e siga os 3 passos: cidade, local e pessoas. 2) No alto do mapa, troque o jeito de ver: "Explorar" para agir, "Cobertura" para ver o que falta. 3) Toque num ponto para abrir a ficha e use "Iniciar atendimento" (a partir da Etapa 4, "Abrir página da pessoa"). Exemplo: Ana mapeou a Padaria Pão Dourado e ligou Bruno como Colaborador. No mapa, Bruno aparece no ponto da padaria, nunca na casa dele; sem local, apareceria no centro do bairro. Cuidado: nunca cadastre endereço de casa; atendimento só com a autorização de contato registrada. Fazer agora: "Mapear local e pessoas". Para o Comercial, o passo 3 diz: "Você vê as pessoas que cadastrou e as do seu atendimento; toque numa delas para abrir a ficha."
- **Vendas → Agenda** (gestão e Comercial). Para que serve: saber com quem falar hoje, o que foi combinado e quando voltar. 1) Comece por "Atrasados" e depois "Hoje". 2) Toque em "Abrir ficha" e use "Usar gancho": a mensagem já sai com o nome da pessoa. 3) Depois da conversa, toque em "Registrar retorno" e marque a próxima data. Exemplo: Carla estava atrasada desde segunda. Você abriu a ficha, usou o gancho de Retomada, conversou e registrou o retorno para quinta. Carla sai de Atrasados e volta na quinta. Cuidado: a plataforma não envia mensagens sozinha; se a pessoa não respondeu, use "Sem resposta". Fazer agora: "Novo atendimento".
- **Portal do Mentorado.** Para que serve: acompanhar sua jornada, seus encontros e as pessoas que você indicou. 1) Em "Sua jornada", toque no círculo de cada etapa quando concluir. 2) Em "Indicar alguém", escreva nome e contato de quem aceitou conversar e toque em "Enviar indicação". 3) Em "Suas indicações", acompanhe cada pessoa (na Etapa 6, este passo passa a falar de "Seus lugares"). Exemplo: Bruno indicou a dona da academia onde treina, que aceitou conversar. Ela aparece em "Suas indicações" como Recebida, depois Em conversa e, quando comprar, Virou cliente. Cuidado: só indique quem sabe da indicação e autorizou o contato. Fazer agora: "Indicar alguém".

**Onde guardar o "já vi"**
- Coluna nova `app_users.guides_seen` (texto, padrão vazio, chaves separadas por vírgula), lida em `getUserAccess` (`access.guidesSeen`) e nos dados do portal.
- Grava por `POST /api/team {action:'guide_seen', key}` (equipe e Embaixador) e `POST /api/portal {action:'guide_seen', key}` (Mentorado), sempre com `UPDATE … WHERE id = ? AND organization_id = ?`, acrescentando a chave só se ela ainda não estiver lá. A chave é conferida contra a lista de guias.
- Cópia no aparelho: `localStorage` na chave `elite-guides-seen:{organizationId}:{access.id}` (em try/catch), para a tela não piscar e funcionar sem internet. Se a gravação falhar, segue em silêncio (como as boas-vindas) e tenta de novo na próxima vez. Nunca entra na fila sem internet (`lib/offline-queue.ts`).
- A Assessoria Elite não grava na empresa cliente (como a ação `welcome` já faz): usa só o aparelho.
- "Mostrar os guias de novo" (na gaveta e no Ctrl+K) zera a lista (ação `guides_reset`).
- A "Cópia dos dados" do titular (`exportSubject`) passa a trazer os guias vistos.

**Correções de texto (o guia não pode repetir erro da tela)**
- "Abrir no CRM" → "Etapa e autorização", o nome da janela que ele abre (`app/territorial-map.tsx`).
- Níveis da rede (já decidido: Indicador é quem indicou alguém, mesmo sem ter comprado; o cálculo não muda): "Indicadores (compraram e indicaram)" e "Indicador (comprou e indicou alguém)" no filtro e na legenda do mapa (`app/territorial-map.tsx`), "Indicador comprou e indicou" em `app/referral-workspace.tsx` e o comentário de `lib/territory-appearance.ts` passam a "Indicador: indicou alguém (mesmo sem ter comprado)". Na mesma legenda, "Círculo dourado = comprou" passa a "Círculo dourado = está na rede: Cliente (comprou), Indicador (indicou alguém) ou Multiplicador (alguém que indicou comprou)"; "Multiplicador (a pessoa que ele indicou também comprou)" e "Multiplicador a pessoa indicada também comprou" (`app/referral-workspace.tsx`) passam a "Multiplicador: alguém que indicou comprou". Guias e página dizem "nível na rede", para não confundir com o nível Indicador do programa de embaixadores.
- "leads no CRM" → "atendimentos" na Rede vazia (`app/referral-workspace.tsx`).
- O título pequeno "Equipe Elite" de Time e acessos (`app/team-panel.tsx`) passa a mostrar o nome da empresa.
- "Método FECHA" e "Iniciar FECHA" → "Método F.E.C.H.A." e "Iniciar F.E.C.H.A." (`app/followup-workspace.tsx`, inclusive no `aria-label` do roteiro).
- Boas-vindas do Embaixador (`app/getting-started.tsx`) sem "Regras do mapeamento" e sem "Ler o guia" do mapeador: no lugar, as regras dele (só materiais aprovados e só contatos que autorizaram).
- Frase da área por função (`lib/navigation.ts`): Rede, para o Comercial, sem embaixadores, mentorados e parceiros; Hoje sem "alertas" para quem não vê alertas. Sem reformatar as linhas que `tests/rendered-html.test.mjs` procura.
- "CAC máximo (R$)" ganha a dica "Custo máximo por cliente pago" (`app/expansion-forms.tsx`).
- Sai a opção de visibilidade "Vendedor" do formulário de localização (`app/territorial-map.tsx`), porque o servidor só aceita Equipe e Admin (`lib/territory-validation.ts`).

**Também nesta etapa**
- Os ajustes rápidos que vierem da Etapa 0.
- Uma nota no topo de `docs/prompt-plataforma-futurista.md` e de `docs/prompt-missoes-futuristas.md` dizendo o que este prompt absorveu, para não nascerem telas e metas repetidas.
- Na entrega, o texto de todos os guias por função (pode ser gerado de `lib/tab-guides.ts`), para eu revisar de uma vez.

Critério: toda aba que cada função vê tem guia; nenhum guia cita aba ou ação que a função não tem; nada de Elite ou Esmeraldas em empresa assinante; cada guia cabe numa tela de 390 px. Os testes estão em "Como validar".

## Etapa 2 — Calculadora: números confiáveis e simulação (sem gravar meta)

É o pedido principal e só lê: eu confiro as taxas reais na tela antes de elas virarem meta. Sem consertar a data de pagamento e sem a origem das pessoas, o ritmo, o tempo até pagar e "quanto mapear" sairiam errados desde o primeiro dia.

**Onde e quem**
- Sub-aba nova Resultados → **Calculadora** (`id: "calculadora"`, entre Visão geral e Metas e rotina), carregada sob demanda.
- Administrador: a empresa inteira ou qualquer cidade. Coordenação e Líder: só a própria cidade; sem cidade, "Sem cidade definida para o seu acesso.". O Administrador de empresa assinante usa igual, isolado pela organização. A Assessoria Elite usa como Administrador, com a faixa "Modo assessoria".
- O Comercial não tem a sub-aba: na Etapa 3 ele ganha "Minha meta", pelo mesmo motor, só com os números dele e sem custo, verba ou CAC. O servidor já força o escopo dele em `GET /api/calculator`. Embaixador e Mentorado recebem 403 ("Seu perfil não possui acesso comercial.").
- Atalhos: Ctrl+K ("Calculadora" e "Simular meta") e, na Etapa 3, o cartão "Quanto falta" de Hoje. Incluída em todos os planos (decisão da Etapa 0).

**O que a pessoa digita** (nada mais)
- **Meta:** um número e o tipo, "Vendas pagas" ou "Receita confirmada" (R$), preenchida com a meta ativa, se houver (Etapa 3).
- **Até quando:** "Este mês", "Próximo mês" ou "Até uma data". O período começa sempre no 1º dia do mês atual.
- **Onde:** a empresa inteira ou uma cidade (fixo para Coordenação e Líder).
- **E se…?**, começando nos valores de hoje: vendedores (+/−), mapeadores (+/−), conversão (%), indicações por cliente por mês e verba de mídia por mês (só quando existe custo por atendimento de mídia confiável, e nunca para o Comercial).
- **Premissas**, só onde falta dado ("Sem dados suficientes: digite sua estimativa") ou quando a pessoa toca em "Usar minha estimativa": ticket médio, conversão, tempo até pagar, capacidade de um vendedor por semana, pessoas por mapeador por semana, pessoa mapeada → atendimento e custo por atendimento de mídia. Ficam só na tela; na Etapa 3, "Aplicar como meta" as grava junto com a meta.

**O que a tela responde**, de cima para baixo (no celular, uma rolagem só)
1. Linha de escopo e período (`Segmented` "Este mês · Próximo mês · Até uma data") e o cartão "Sua meta": "Quero [40] [vendas pagas ▾] até [28/12]".
2. **Quanto falta:** "Faltam 36 vendas (≈ R$ 43.200) em 56 dias", com o `Meter` "4 de 40". Se não falta nada, "Meta batida".
3. **No ritmo atual:** a data em que a meta chega, quantos dias antes ou depois do prazo e a faixa "entre X e Y" ("No ritmo atual: 25/01 · 28 dias depois · entre 11/01 e 15/02"). Sem venda paga nas últimas 8 semanas: "No ritmo atual a meta não chega".
4. **O que precisa acontecer**, por semana e no total: vendas, atendimentos novos (e até quando precisam começar), pessoas a mapear, vendedores e mapeadores necessários, e o gargalo numa frase, com ícone ("O que trava: atendimentos").
5. **E se…?:** botões de + e − para vendedores e mapeadores e controle deslizante (`components/ui/slider.tsx`) para conversão, indicações e verba, com as colunas "Hoje" e "Com ajustes" lado a lado (data, atendimentos por semana, equipe). Recalcula a cada toque, no aparelho, sem gravar nada. "Voltar ao atual" desfaz tudo.
6. **O que mais ajuda:** os 4 ajustes que mais encurtam o prazo, cada um com a nova data, os dias ganhos e "Simular este", e a menor combinação de equipe que bate a data.
7. **Bônus da rede:** as indicações que os clientes novos devem trazer até o prazo, mostradas como bônus, fora da data.
8. Gráfico **"Chegamos lá?"** (`app/charts/goal-pace-chart.tsx`, recharts sob demanda dentro de `ChartFrame`): vendas pagas acumuladas, com o realizado em linha cheia, as projeções "Hoje" e "Com ajustes" tracejadas e marcadas "Projeção", a meta como linha de referência, um eixo só e "Ver tabela".
9. **Taxas da sua empresa** e **Como calculamos**, cada uma num `<details>`: o valor de cada taxa, a origem (real ou premissa), a base e o período, e "O que ficou de fora" (atendimentos importados, cidades em Consolidado, pessoas sem origem e vendas pagas salvas de novo antes do conserto), só com contagens.
10. Rodapé fixo no celular com **"Copiar resumo"** (um texto curto, sem dados pessoais, para o WhatsApp do time) e, a partir da Etapa 3, "Aplicar como meta".

Gestão → Regras e cálculos ganha o bloco "Como a Calculadora calcula", com o mesmo texto de "Como calculamos".

**Como calcula** (`lib/goal-calculator.ts`, puro; datas pelo dia de Brasília)
- **Notação.** Cada conta vale para um escopo (empresa, cidade ou, em "Minha meta", a pessoa), sempre dentro de `cities.organization_id`. O período vai de I (1º dia do mês atual) até T (data-alvo). M = meta em vendas pagas; P = vendas pagas com o dia do `paid_at` entre I e hoje; F = max(0, M − P) (se F = 0, "Meta batida"); D = dias de hoje até T; S = D ÷ 7.
- **Meta em receita:** M = ⌈Mr ÷ t⌉ (Mr em R$, t = ticket médio) e F = max(0, ⌈(Mr − Pr) ÷ t⌉), com Pr = soma dos valores pagos no período. Daí em diante, P = M − F (no `Meter`, na chegada e no gráfico), para que tudo parta do mesmo F. A tela mostra as duas formas ("faltam 36 vendas ≈ R$ 43.200"). Sem t: "Sem dados suficientes: digite o ticket médio".
- **Ritmo atual:** v = vendas pagas (pelo dia do `paid_at`) nos últimos 56 dias ÷ semanas cobertas, no máximo 8. Semanas cobertas = desde o dia mais antigo entre o 1º atendimento não importado e o 1º pagamento do escopo (a venda importada conta pela data da planilha, e o atendimento dela, pela data da importação), com mínimo de 2; abaixo disso, "Sem dados suficientes".
- **No ritmo atual:** t_atual = ⌈7 × F ÷ v⌉ dias; data = hoje + t_atual; diferença = t_atual − D (positiva = atraso). Se v = 0, "não chega". Faixa: a mesma conta com o ritmo × 1,2 e × 0,8. Esta linha não depende do tempo até pagar e aparece mesmo quando ele falta.
- **Tempo até pagar:** m = mediana de dias entre o dia do `leads.created_at` e o dia do `paid_at`, arredondada para cima em dias inteiros (com número par de vendas, a mediana pode dar meio dia) e limitada a 0..90; L = m ÷ 7. Do que já está em andamento saem E = v × min(L, S) vendas.
- **Funil de trás para frente:** R = max(0, F − E) vendas precisam sair de atendimentos novos, começados em U = S − L semanas (se U ≤ 0: "Para este prazo só contam os atendimentos já em andamento: estenda a data"). vn = R ÷ U vendas por semana. Atendimentos novos por semana: Nn = N × vn ÷ v, a proporção de hoje entre atendimentos e vendas, a mesma que as alavancas usam. No modo absoluto (N = 0 ou v = 0), Nn = max(0, N + (vn − v) ÷ c), que pede a conversão. Total = Nn × U; começar até T − m; diferença para hoje = Nn − N.
- **Origem e equipe:** N = Nmap + Nind + Nmid + Nout (mapeamento, indicação, mídia, outros). Mantendo indicação, mídia e outros, o mapeamento precisa render Nmap* = max(0, Nn − Nind − Nmid − Nout). Pessoas a mapear por semana = Pm × Nmap* ÷ Nmap, e no total = por semana × U; mapeadores = ⌈nm × Nmap* ÷ Nmap⌉. No modo absoluto (Nmap = 0 ou nm = 0): Pm + (Nmap* − Nmap) ÷ a pessoas por semana e nm + ⌈((Nmap* − Nmap) ÷ a) ÷ km⌉ mapeadores. Vendedores = ⌈Nn ÷ kv⌉.
- **Gargalo**, só quando Nn > N (senão: "No ritmo atual, a meta chega no prazo"): se a oferta N é menor que a capacidade nv × kv, "O que trava: atendimentos", e, se Nn passa da capacidade, travam também os vendedores; se N já chega à capacidade, "O que trava: vendedores".
- **Rede:** r = Nind ÷ C indicações por cliente por semana. A tela e o controle de "E se…?" mostram por mês (r × 30 ÷ 7), e o valor do controle volta para semana antes das contas (r′ = valor × 7 ÷ 30). Bônus da rede, conservador e fora da data: B = R × r × U ÷ 2, porque os R clientes novos entram ao longo de U semanas.
- **Alavancas (E se…?):**
  - N′map = Nmap × n′m ÷ nm; no modo absoluto (Nmap = 0 ou nm = 0, a mesma condição do funil), N′map = Nmap + (n′m − nm) × km × a;
  - N′ind = Nind × r′ ÷ r (se r = 0, C × r′);
  - N′mid = Nmid + (verba extra por mês ÷ CPL) × 7 ÷ 30 (sem CPL confiável, a alavanca fica desligada);
  - capacidade = max(n′v × kv, N + (n′v − nv) × kv), para nunca ficar abaixo da oferta de hoje; N′ = min(N′map + N′ind + N′mid + Nout, capacidade);
  - ritmo com ajustes: v′ = v × (N′ ÷ N) × (c′ ÷ c), com c′ ÷ c = 1 enquanto a conversão estiver sem dados (só a alavanca de conversão espera a premissa); no modo absoluto (N = 0 ou v = 0), v′ = max(0, v + N′ × c′ − N × c);
  - sem nenhum ajuste, N′ = N e v′ = v em todos os casos;
  - se `settings.organic_goal_percent` for maior que 0 e a participação orgânica estimada, em porcentagem ((1 − N′mid ÷ N′) × 100), ficar abaixo dele, a tela avisa, como a decisão da cidade já faz em `lib/expansion-domain.ts`.
- **Chegada com ajustes:** se P + v × m ÷ 7 ≥ M, t* = ⌈7 × F ÷ v⌉; senão, t* = m + ⌈7 × (F − v × m ÷ 7) ÷ v′⌉ (se v′ = 0, "não chega"). Na faixa, v e v′ mudam juntos (× 1,2 e × 0,8), para que, sem ajuste, a faixa de "Com ajustes" seja a mesma de "Hoje". No gráfico, Q(t) = P + v × min(t, m) ÷ 7 + v′ × max(0, t − m) ÷ 7. Sem nenhum ajuste, t* = t_atual: é teste.
- **O que mais ajuda:** cada passo padrão aplicado sozinho (conversão +5 pontos, no máximo 100%; +1 mapeador; indicações +50%; +R$ 1.000 por mês de mídia, só com CPL; +1 vendedor), ordenado pelos dias ganhos. No empate, vem antes o que não exige contratar: conversão, indicações, mídia, mapeador, vendedor. Mostra os 4 primeiros; um passo sem ganho aparece como "sozinho não muda a data", com o gargalo.
- **Menor combinação:** procura n′m de nm a nm + 10 e n′v de nv a nv + 5, com c e r atuais, tal que t* ≤ D; escolhe a que soma menos pessoas novas e, no empate, a data mais cedo. Se nada serve: "Nem com +10 mapeadores e +5 vendedores: revise a meta ou a data".
- **Aviso de divergência:** se |v − N × c| > 0,3 × v, "O ritmo recente e os atendimentos de hoje não batem: a data pode mudar." As contas continuam coerentes entre si, porque todas usam a proporção de hoje.
- **Arredondamento:** pessoas, atendimentos e dias para cima; vendas projetadas e o bônus da rede para baixo (o bônus é conservador: 4,5 vira "≈ 4"); percentuais sem casas decimais na tela. O cálculo usa os valores sem arredondar (menos o tempo até pagar, já em dias inteiros). Nunca aparece `NaN` nem `Infinity`: divisão por zero vira vazio, e a tela mostra "Sem dados suficientes".

**Exemplo resolvido** (vira o teste `tests/goal-calculator.test.mjs` e o exemplo do guia, com o selo "Exemplo")

Cidade Exemplo. Hoje é segunda-feira, 02/11/2026. Meta: 40 vendas pagas até 28/12/2026 (em receita, R$ 48.000 com ticket de R$ 1.200 dá ⌈48.000 ÷ 1.200⌉ = 40). O período começa em 01/11; D = 56 dias = 8 semanas. Já pagas desde 01/11: P = 4, então F = 36 (≈ R$ 43.200).

Taxas: ritmo v = 3 vendas por semana (24 nas últimas 8 semanas); conversão c = 20%; tempo até pagar m = 14 dias (L = 2 semanas); atendimentos novos por semana N = 15 (mapeamento 8, indicação 3, mídia 0, outros 4); pessoas mapeadas por semana Pm = 32, com nm = 2 mapeadores (km = 16); pessoa mapeada → atendimento a = 25%; nv = 2 vendedores com capacidade demonstrada kv = 10 atendimentos novos por semana cada; C = 60 clientes; custo de mídia sem dados.

1. No ritmo atual: ⌈7 × 36 ÷ 3⌉ = 84 dias, ou seja, 25/01/2027, 28 dias depois do prazo. Faixa (3,6 e 2,4 por semana): 70 e 105 dias, entre 11/01 e 15/02/2027.
2. Em andamento: E = 3 × min(2, 8) = 6 vendas até 16/11. Restam R = 30 vendas em U = 6 semanas: vn = 5 por semana.
3. Atendimentos novos: Nn = 15 × 5 ÷ 3 = 25 por semana (hoje 15, faltam +10): 150 no total, começando até 14/12 (28/12 − 14 dias).
4. Origem: 25 − 3 − 0 − 4 = 18 precisam vir do mapeamento. Pessoas a mapear = 32 × 18 ÷ 8 = 72 por semana (hoje 32), 432 até 14/12. Mapeadores = ⌈2 × 18 ÷ 8⌉ = 5 (+3).
5. Vendedores = ⌈25 ÷ 10⌉ = 3 (+1). Hoje o que trava são os atendimentos (oferta 15 < capacidade 20); com 25, travam também os vendedores (25 > 20).
6. O que mais ajuda, cada ajuste sozinho (t* = 14 + ⌈210 ÷ v′⌉):
   - conversão +5 pontos: v′ = 3 × 25 ÷ 20 = 3,75 → 70 dias (11/01/2027);
   - +1 mapeador: N′ = 12 + 3 + 0 + 4 = 19, v′ = 3,8 → 14 + ⌈55,3⌉ = 70 dias; empata com a conversão, que vem antes porque não exige contratar;
   - indicações +50%: N′ = 8 + 4,5 + 0 + 4 = 16,5, v′ = 3,3 → 14 + ⌈63,6⌉ = 78 dias (19/01/2027);
   - +1 vendedor: N′ = 15 → 84 dias, "sozinho não muda a data: falta atendimento";
   - mídia: desligada (sem custo por atendimento).
7. Menor combinação: +3 mapeadores e +1 vendedor. N′ = min(20 + 3 + 0 + 4, 30) = 27, v′ = 5,4 → 14 + ⌈38,9⌉ = 53 dias, 25/12/2026, 3 dias antes do prazo. As menores não servem: +2/+1 dá 60 dias (01/01); +4/+0 e +3/+0 dão 67 (08/01).
8. Bônus da rede: r = 3 ÷ 60 = 0,05 indicação por cliente por semana (≈ 0,2 por mês). B = 30 × 0,05 × 6 ÷ 2 = 4,5, mostrado como "≈ 4 indicações a mais até o prazo", fora da data.
9. Coerência: sem ajuste, 14 + ⌈7 × 30 ÷ 3⌉ = 84 dias, igual ao ritmo atual. Como N × c = 15 × 20% = 3 = v, o aviso de divergência não aparece.

Resumo para copiar: "Meta (Cidade Exemplo): 40 vendas pagas até 28/12. Feitas: 4. Faltam 36. No ritmo atual chegamos em 25/01. Para chegar no prazo: 25 atendimentos novos por semana até 14/12 (hoje 15), por exemplo com +3 mapeadores e +1 vendedor."

**De onde vêm as taxas** (`db/calculator.ts`, SQL agregado no servidor)
- Regras para todas:
  - nunca sobre os até 1.000 registros de `getDashboardData`;
  - isolamento por `JOIN cities c ON c.id = x.city_id AND c.organization_id = ?` nas tabelas sem `organization_id` (`leads`, `sales`, `costs`, `territory_people`), ou `organization_id` direto em `opportunities` e `commercial_activities`;
  - escopo por função antes de contar (Coordenação e Líder: a cidade; Comercial: os atendimentos e as vendas dele, pela regra de responsável decidida na Etapa 0);
  - o dia de cada data: só o dia (`AAAA-MM-DD`), o próprio valor; com `-03:00`, `substr(x,1,10)`; com hora e sem fuso (`CURRENT_TIMESTAMP`, em UTC, ou a importação ao meio-dia), `date(x,'-3 hours')`. Diferenças de dias por `julianday` desses dias;
  - no máximo 100 parâmetros por consulta e 5 SELECTs por UNION, em `db.batch`;
  - base padrão de 90 dias; ritmo, atendimentos por semana, pessoas mapeadas e vendedores pelas últimas 8 semanas. Com menos de 8 semanas de histórico, cada taxa divide pelas semanas que os próprios dados cobrem (no máximo 8), nunca por 8 fixo.
- **Realizado (P) e ritmo (v):** `sales` com status "Pagamento confirmado" e `paid_at` preenchido. Vendas importadas contam (o pagamento é real, com a data da planilha), e a venda de um atendimento anonimizado depois também. "Ganho" sem pagamento e "Venda confirmada" não contam. As semanas do ritmo seguem a regra de "Como calcula".
- **Ticket médio (t):** média dos valores das vendas pagas nos últimos 90 dias com valor maior que zero, incluindo as importadas. Mínimo 5 vendas.
- **Conversão (c), por coorte que já teve 60 dias para amadurecer:** base = leads "Lead válido" ou "Oportunidade", com autorização não revogada e fora da "Importação da rede por planilha", criados entre hoje − 150 e hoje − 60; c = os que têm venda paga até 60 dias depois da criação ÷ total. Mínimo 30 atendimentos e 3 pagamentos. A tela mostra a base ("base: 120 atendimentos de 02/06 a 31/08") e explica que é diferente da "Conversão" de Hoje, que usa todos os leads válidos sem esperar amadurecer.
- **Tempo até pagar (m):** mediana dos dias entre a criação do lead e o pagamento, nas vendas pagas dos últimos 180 dias, arredondada para cima em dias inteiros. Ficam de fora a importação da rede (dá negativo) e qualquer resultado negativo. Mínimo 5 vendas; abaixo disso, a tela pede a premissa e não preenche nada sozinha.
- **Atendimentos novos por semana (N) e origem:** leads válidos não importados criados nos últimos 56 dias ÷ semanas desde o 1º atendimento não importado (no máximo 8), classificados nesta ordem: Indicação (canal "Indicação" ou pessoa com quem indicou), Mídia (canal "Mídia paga"), Mapeamento (`source_label` "Mapeamento" ou começando com "Mapeamento · "), Outros. O "Lead informado" do portal só conta quando vira lead válido. Mínimo 4 semanas de histórico.
- **Pessoas mapeadas (Pm), mapeadores (nm) e produção (km):** só pessoas com origem "Mapeamento" gravada no próprio cadastro, ou seja, criadas depois da migração da coluna nova (as marcadas pelo preenchimento do passado ficam de fora, porque o passado só marca quem já virou atendimento), nos últimos 56 dias: Pm = total ÷ semanas desde a migração (no máximo 8); nm = quem cadastrou, sem repetir; km = Pm ÷ nm. Não é a "Produção por mapeador" de Resultados → Mapeamento, que soma locais e pessoas de qualquer origem, no total e nos últimos 7 dias: calcule aqui, sem reaproveitar `getMappingStats`. Mínimo 1 mapeador e 4 semanas desde a migração.
- **Pessoa mapeada → atendimento (a)**, só no modo absoluto: pessoas com origem "Mapeamento" gravada no cadastro, criadas entre hoje − 120 e hoje − 30; a = as que têm lead válido criado até 30 dias depois ÷ total. Mínimo 30 pessoas e 3 atendimentos; até lá, a tela pede a premissa.
- **Vendedores (nv) e capacidade (kv):** nv = pessoas distintas com pelo menos 1 atendimento novo nas últimas 8 semanas, pelo responsável do atendimento (`leads.assigned_to_email`), entre os logins ativos de Administrador, Coordenação, Líder ou Comercial. kv = a melhor semana real de atendimentos novos de uma pessoa nos últimos 90 dias ("capacidade demonstrada"), que pode ser editada. Mínimo 4 semanas.
- **Clientes (C) e indicações por cliente (r):** C = pessoas distintas com venda paga e autorização não revogada no escopo (a regra do nível Cliente em `db/territory.ts`); r = Nind ÷ C por semana. Mínimo 5 clientes e 2 indicações.
- **Custo por atendimento de mídia (CPL)**, só para a gestão: custos com categoria ou canal "Mídia paga" nos 3 últimos meses fechados ÷ leads válidos do canal "Mídia paga" criados nesses meses. Mínimo: custo maior que zero e 10 atendimentos. A tela lembra que o CAC e o ROI da plataforma usam todos os custos, e que a verba simulada é só de mídia.
- **Cidades em modo Consolidado:** o realizado (P) é a soma de `city_updates.sales` dos meses do período, marcado "fechamento consolidado"; as taxas ficam "Sem dados suficientes (cidade em modo Consolidado)". Na empresa inteira, as taxas usam só as cidades em modo Detalhado, e a tela diz isso.

**Honestidade**
- Cada número traz a origem ao lado: "real · base 120 atendimentos (jun–ago)", "premissa · digitada por você", "premissa da gestão" (para o Comercial, Etapa 3) ou "Sem dados suficientes: digite sua estimativa". Uma premissa nunca vira "real".
- A projeção é sempre rotulada "Projeção", tracejada e em cor neutra. Nunca é somada ao realizado nem gravada como resultado, e nunca vai para indicadores, exportações ou e-mails.
- Abaixo da amostra mínima não aparece número, nunca "0%" no lugar de "Sem dados suficientes", e nada é preenchido com "média de mercado". O resto da Calculadora continua funcionando com as premissas digitadas.
- Toda data projetada vem com a faixa "entre X e Y".
- "Como calculamos" explica as bases: realizado e ritmo pela data do pagamento, como o e-mail semanal e a linha "Meta" de Metas e rotina (os "Pagamentos confirmados" do dia em Metas e rotina deixam de fora atendimentos sem oportunidade, revogados e anonimizados); conversão por coorte madura; a Visão geral agrupa pelo mês do atendimento e deixa de fora a venda de quem foi anonimizado. Por isso os números podem diferir entre telas, e cada tela diz a sua base. Explica também que a importação fica fora da conversão, do tempo até pagar e dos atendimentos por semana (as datas são retroativas), mas entra no realizado e no ticket; que "Ganho" não é venda; e que cada atendimento tem no máximo uma venda, então receita recorrente não entra.
- Avisos fixos em letra pequena: "O histórico pode mudar: pagamentos cancelados, reembolsos e pedidos de exclusão (LGPD) mudam os números passados." e "Modelo simples: supõe que o ritmo recente continua; não prevê sazonalidade nem campanhas."
- Só agregados nos números: taxas, projeções, "Copiar resumo" e a resposta de `GET /api/calculator` nunca trazem nomes, contatos ou posições. A única lista com nomes é "Ver lista", de "Onde buscar" (Etapa 4), que vem à parte, por `whereToLook`, com o escopo da página da pessoa e só nome e motivo. Cada empresa usa só os próprios números; nenhuma taxa da Elite ou de outra empresa vira padrão.

**Para os números serem confiáveis**
- `record_sale` (`db/mutations.ts`): `paid_at` só é gravado na passagem para "Pagamento confirmado"; salvar de novo uma venda já paga mantém a data. Qualquer situação diferente de "Pagamento confirmado" continua zerando, como hoje, e a importação continua gravando a data da planilha. O passado só é corrigido com a minha aprovação (decisão da Etapa 0).
- Coluna nova `territory_people.source` (texto, padrão vazio), gravada só quando a pessoa nasce, como o `created_by`: editar, inclusive pelo `ON CONFLICT(id) DO UPDATE` de `db/territory.ts` usado por "Editar pessoa e indicação", nunca muda a origem. Caminhos de cadastro:
  - mapeamento guiado e formulário de pessoa do mapa: "Mapeamento";
  - `create_lead` (`db/mutations.ts`): "Novo atendimento";
  - cadastro de embaixador (`create_ambassador`): "Embaixador". As duas ações criam a pessoa por `resolvePerson`, e a origem sai do parâmetro `table` dela ("Novo atendimento" para `leads`, "Embaixador" para `ambassadors`);
  - indicação do portal (`db/portal.ts`) e `ensurePortalPerson` (`db/portal-person.ts`): "Portal do mentorado";
  - importação de pessoas (`db/territory.ts`) e da rede (`db/network-import.ts`): "Importação".
- O passado é preenchido só com prova, nesta ordem: papel com origem começando em "Importação" ou lead da "Importação da rede por planilha" → "Importação"; papel "Acesso ao portal de mentoria" ou lead "Lead informado" do portal → "Portal do mentorado"; lead com `source_label` começando em "Mapeamento" → "Mapeamento". O resto fica sem origem e fora das taxas de mapeamento. A migração é idempotente, porque roda no D1 publicado, que guarda dados reais.
- Índices novos só se o `EXPLAIN QUERY PLAN` das consultas novas mostrar varredura completa.

**Código**
- `lib/goal-calculator.ts` (puro): os tipos `CalculatorBase`, `Levers` e `Projection`, e as funções `projectAtCurrentPace`, `reverseFunnel`, `projectWithLevers`, `rankAdjustments`, `smallestTeamCombo`, `networkBonus` e `sampleOk`.
- `db/calculator.ts`: `getCalculatorBase(access, {cityId, ownerEmail, from, to})`, em `db.batch`.
- `app/api/calculator/route.ts`: `GET` com a base, a meta ativa e o progresso, usando `getTeamAccess` e a organização do cabeçalho `X-Elite-Organization`, como os outros GET. O `sameOrigin` fica só no `POST` da Etapa 3: o navegador não manda o cabeçalho Origin num GET da mesma origem, e o GET daria 403 sempre.
- `app/goal-calculator.tsx` (com `React.lazy` e `warmUp`) e `app/charts/goal-pace-chart.tsx`.
- `lib/navigation.ts`: `{ id: "calculadora", label: "Calculadora" }` em Resultados, só para a gestão, sem reformatar as linhas que `tests/rendered-html.test.mjs` procura. `PLAN_FEATURES` não muda.

**Guia da aba** (o tom): Como usar: Calculadora. Para que serve: saber quanto falta para a meta, quando vocês chegam e o que muda a data. 1) Digite a meta e a data: por exemplo, 40 vendas pagas até 28/12. 2) Leia "Quanto falta", a data "No ritmo atual" e "O que precisa acontecer". 3) Mexa em "E se…?" e, quando fizer sentido, toque em "Aplicar como meta" (a partir da Etapa 3). Exemplo: faltam 36 vendas em 8 semanas. No ritmo de hoje (3 por semana), a meta chega em 25/01, quase um mês depois. Com +3 mapeadores e +1 vendedor, chega em 25/12. Subir a conversão de 20% para 25% ganha 2 semanas. Cuidado: onde aparecer "Sem dados suficientes", digite sua estimativa; ela fica marcada como premissa. Projeção não é resultado. Sem "Fazer agora": ao fechar o guia, o foco vai para o campo da meta.

## Etapa 3 — Meta com período e "Quanto falta" no dia a dia

Fecha o ciclo simulação → meta → rotina e põe o número onde a equipe trabalha todo dia, com uma fonte só. Depende do motor da Etapa 2.

**A tabela `goals`, fonte única de meta**
- Campos: `id` (uuid); `organization_id`; `scope` ("Empresa", "Cidade" ou "Pessoa"); `city_id` (vazio só em Empresa); `owner_email` (só em Pessoa); `metric` ("Vendas pagas", "Receita confirmada", "Atendimentos" ou "Pessoas mapeadas"); `target` (≥ 0; centavos na receita); `period_start` e `period_end` (AAAA-MM-DD); `assumptions_json` (as taxas e premissas usadas, com a origem de cada uma: é a "foto" do plano); `status` ("Ativa" ou "Substituída"; meta encerrada é a de período já passado); `version` (inteiro, começa em 1, como em `businesses` e `opportunities`); `created_by`, `created_at` e `updated_at`. Índices em (organização, situação, fim do período) e (organização, cidade, responsável).
- Gravada só por "Aplicar como meta" e "Dividir pela equipe". O servidor recusa duas metas ativas que se sobrepõem no mesmo escopo e na mesma métrica; a anterior só vira "Substituída" com confirmação.
- Uma função só lê o progresso (`goalProgress`, em `db/goals.ts`, com o realizado pela data do pagamento) para o cartão "Quanto falta" de Hoje, a linha por pessoa de Metas e rotina, a coluna "Meta" de Saúde das cidades e a Calculadora.
- Meta da empresa: a linha "Empresa", se existir; senão, a soma das metas das cidades, com o aviso "soma de 3 de 5 cidades".
- De quem é cada venda e cada atendimento, conforme a decisão da Etapa 0: do responsável da oportunidade (`opportunities.owner_email`); sem oportunidade, de quem está com o atendimento na Agenda (`leads.assigned_to_email`); sem ninguém (as vendas importadas pela planilha da rede), conta na cidade e na empresa e aparece como "sem responsável: N", fora da meta de cada pessoa.

**O que acontece com o que já existe**
- "Meta de vendas" das cidades sai do formulário (a coluna fica no banco, sem leitura); só vira meta o que eu confirmar na Etapa 0. No lugar do campo: "A meta fica em Resultados → Calculadora."
- "Meta de embaixadores" continua como está: é tamanho de estrutura, não meta de período.
- "CAC máximo (R$)" e "Orçamento da cidade (R$)" continuam como limites da decisão da cidade; a Calculadora só avisa quando uma simulação passa deles.
- `seller_goals` continua guardando frios, quentes e contatos por dia, mas a tela passa a chamar de "Rotina do dia": "Definir meta" → "Definir rotina do dia" e "Frios / meta" → "Frios / rotina" (o mesmo para quentes e contatos). Aplicar uma meta nunca grava ali.
- Os critérios de Regras e cálculos continuam como estão. A Calculadora só usa `organic_goal_percent` como aviso ao simular mídia.

**Aplicar como meta** (Administrador: a empresa ou qualquer cidade; Coordenação: a própria cidade; Assessoria: como Administrador, marcada)
- Abre uma confirmação que lista exatamente o que será gravado: "Meta da Cidade Exemplo: 40 vendas pagas de 01/11 a 28/12. Plano até 14/12: 150 atendimentos e 432 pessoas mapeadas. Substitui a meta atual (30)." A caixa "Gravar também o plano" grava as metas de Atendimentos e de Pessoas mapeadas de hoje até a data de começar (no exemplo, de 02/11 a 14/12: 25 atendimentos e 72 pessoas por semana), e não até a data da meta de vendas, porque atendimento começado depois disso já não paga até o prazo.
- "Dividir pela equipe" mostra uma linha por pessoa ativa da cidade (a mesma lista de Metas e rotina), com vendas, atendimentos e pessoas mapeadas (só para quem mapeia), preenchida em proporção ao que cada um fez nas últimas 8 semanas (ou em partes iguais, sem base) e editável. O servidor confere que a soma das vendas fecha com a meta. O Líder usa "Dividir pela equipe" numa meta de cidade já aplicada. O Comercial não aplica nem divide ("Somente a gestão define metas.").
- Gravação em lote (`db.batch`): as metas novas e a anterior, que vira "Substituída". O pedido leva o `version` da meta substituída, e o servidor grava com `WHERE id = ? AND organization_id = ? AND version = ?`, como `db/commercial.ts` já faz; se ela mudou nesse meio-tempo, devolve 409 com a mensagem que já existe lá ("Outra pessoa alterou este registro agora há pouco. Atualize a página e repita a alteração."). Auditoria `goal_apply` e `goal_split`, com os valores antes e depois e sem nomes; a Assessoria aparece marcada em Gestão → Histórico.
- Aplicar nunca cria tarefas, missões, mensagens nem rotina do dia.
- Servidor: `POST /api/calculator` com as ações `apply` e `split`; `applyGoal`, `splitGoal`, `listGoals` e `goalProgress` em `db/goals.ts`.
- "Metas anteriores": lista simples ("out/2026: 30 → 27 (90%)"), com o realizado recalculado na hora e o aviso de que ele muda se um pagamento for cancelado ou houver pedido LGPD.

**Onde a meta aparece**
- **Hoje:** cartão "Quanto falta" (`app/goal-card.tsx`), compacto (2 linhas e o anel do `Meter`), entre os indicadores e a faixa da agenda. A gestão vê a meta da empresa (ou a soma das cidades) ou a da própria cidade, com "Abrir calculadora". O Comercial vê "Minha meta" (vendas do período e atendimentos da semana), com "Abrir a agenda". Sem meta: "Sem meta para novembro · Definir na calculadora" (Administrador e Coordenação) ou "A gestão ainda não definiu sua meta." (Comercial).
- **"Minha meta" do Comercial:** o mesmo motor, só com os números dele e sem custo, verba ou CAC. Uma taxa sem amostra própria usa a premissa que a gestão gravou ao aplicar a meta, com o selo "premissa da gestão"; antes de responder a ele, o servidor tira da foto (`assumptions_json`) o custo por atendimento de mídia, a verba e qualquer outro custo. "Semana: x de y atendimentos": x = atendimentos novos dele na semana (segunda a domingo, Brasília); y = meta de Atendimentos dele ÷ semanas entre o início dessa meta e a data de começar. Depois dessa data, a linha "Semana" some.
- **Resultados → Metas e rotina:** cada pessoa ganha "Meta: 3 de 8 vendas · Semana: 4 de 10 atendimentos", e a gestão vê também "Sem responsável: N vendas". O subtítulo passa a "Meta, rotina do dia e atividades registradas, sem classificação competitiva.". Sem ranking: só a gestão vê a linha de cada pessoa, e cada Comercial vê só a dele. Os "Pagamentos confirmados" do dia continuam com a base de hoje (só atendimentos com oportunidade, ativos e com autorização), e a tela diz isso.
- **Território → Cidades → Saúde das cidades:** coluna nova "Meta" (realizado sobre a meta, com barra e prazo).
- Os guias da Calculadora e de Metas e rotina atualizados, e o texto da janela "Aplicar como meta" ensinando o que será gravado.

## Etapa 4 — Página da pessoa

Organiza o que já existe, sem tabela nova, e vira o link único que Calculadora, Agenda e Rede passam a usar. Cria o link, o escopo e as proteções antes de qualquer dado novo de lugar.

**Link e navegação**
- `&ficha=pessoa:<uuid>` acrescentado ao endereço atual, em qualquer área (`/?org=1&area=vendas&ver=agenda&ficha=pessoa:8f3c…`). É o contrato que a Etapa 5 do futurista reaproveita depois para `local:` e `atendimento:`.
- Abre por cima da tela atual: no computador, painel largo à direita (até cerca de 760 px); no celular, tela cheia. Título, foco preso e Esc.
- Abrir faz `pushState`: o botão voltar fecha a página e devolve para onde a pessoa estava, e recarregar mantém a página aberta. `navigate()` (`app/expansion-dashboard.tsx`) passa a remover `&ficha=` ao trocar de área, como já faz com `&modo=`. `resolveLocation` continua cuidando só de `area` e `ver`. Um id que não é uuid fecha a página sem erro, e os links antigos continuam iguais.
- Entradas: "Abrir página da pessoa" na Ficha territorial; "Página da pessoa" na ficha do atendimento, ao lado de "Ver no mapa"; "Página" nos cartões e na tabela de Rede → Indicações; o resultado "Pessoa" do Ctrl+K (`app/quick-search.tsx`), que passa a abrir a página (com "Ver no mapa" dentro dela); e as listas de "Onde buscar".
- Servidor: `GET /api/territory/person?id=<uuid>` (`app/api/territory/person/route.ts` → `db/person-page.ts`), com consultas por id que não montam o CTE de todas as entidades de `getTerritory`, e com o mesmo escopo de `db/territory.ts`. Sem aba nova (`tests/navigation.test.mjs` não muda); a tela é carregada sob demanda.

**O que a página mostra**
- **Cabeçalho**, sempre visível: nome; selo do nível com uma explicação curta ("Cliente: pagamento confirmado", "Indicador: indicou alguém" ou "Multiplicador: alguém que ela indicou comprou"), mais Mentorado, Embaixador ou Líder quando houver; "Cidade · Bairro"; "No mapa: Padaria Pão Dourado", "centro do bairro Centro" ou "centro da cidade" (nunca coordenada); botões "Ver no mapa", "Editar" (abre "Editar pessoa e indicação") e "Copiar link".
- **Próximo passo:** cartão dourado com 1 frase e 1 botão, calculado por `lib/next-step.ts`, que testa as regras nesta ordem e para na primeira que valer:
  1. autorização revogada → "Não entrar em contato" (sem botão);
  2. retorno atrasado → "Registrar retorno";
  3. retorno para hoje → "Abrir acompanhamento";
  4. F.E.C.H.A. em andamento → "Continuar F.E.C.H.A.";
  5. sem atendimento → "Iniciar atendimento" (quem não pode iniciar vê "Peça à gestão");
  6. Cliente que ainda não indicou ninguém → "Pedir indicação" (abre "Usar gancho" na situação Indicação);
  7. mentorado sem próximo encontro → "Marcar encontro" (só o Administrador, que cuida de Rede → Mentorados);
  8. visita de plantio vencida → "Registrar visita" (Etapa 5);
  9. lugar em Avançar sem plano → "Planejar visita" (Etapa 5);
  10. indicações dela sem atendimento → "Ver indicações";
  11. Multiplicador sem papel de embaixador → "Cadastrar papel de embaixador" (só a gestão);
  12. nenhuma das anteriores → "Registrar interação".
- Três partes num `Segmented`: **Resumo · Lugares · Histórico**. O aparelho lembra a última parte aberta (`localStorage` por `access.id`, em try/catch).
- **Resumo:**
  - Atendimento, se houver: "Proposta · Quente · retorno 05/11 com João", com "Abrir acompanhamento" e, para quem pode, "Registrar venda" ou "Ver venda". A autorização aparece ("Autorizou contato em 12/10 · WhatsApp · para mentoria"), mas sem número nem e-mail: a página não mostra contato, e o envio continua pela ficha do atendimento. Se o atendimento é de outra pessoa: "Atendimento com outra pessoa da equipe".
  - Rede: "Indicado por Ana" (gestão), "Indicado por alguém fora do seu acesso" (Comercial, sem id) ou "Sem indicador", com "Quem indicou?"; "Indicou 3 (1 comprou)", em que, para o Comercial, contagem, compra e nomes são só de quem está no escopo dele, como `db/territory.ts` já faz desde o commit `c90e5f7`; "Explorar ramo", que abre Rede → Indicações.
  - Mentoria, se ela for Mentorado, só para o Administrador (como em Rede → Mentorados): "3 de 5 etapas", o próximo encontro e o contato responsável. Embaixador, se for, só para a gestão: o bloco "Acompanhamento" que já existe, com números vindos do servidor, e não do `buildDashboardView` no navegador. O Comercial vê só o selo Mentorado ou Embaixador, porque hoje não recebe embaixadores, atualizações, tarefas nem custos.
  - Como abordar: até 2 dicas para o nível dela e para o tipo e o setor do local principal (`lib/planting-tips.ts`, criado aqui e ampliado na Etapa 5), mais 1 gancho aprovado casado com ela (situação pelo nível, setor pelo lugar), com "Copiar".
- **Lugares:** nesta etapa, só o local principal. Os outros chegam na Etapa 5.
- **Histórico:** linha do tempo unificada (`components/elite/timeline.tsx`), agrupada por dia de Brasília e só com o dia, sem hora; 30 itens e "Ver mais". Hoje o `Timeline` mostra a hora de todo item e agrupa por `Date.parse`: ele ganha uma opção para esconder a hora (Gestão → Histórico continua com hora), e `lib/person-timeline.ts` entrega cada item com `at` no meio-dia de Brasília (`AAAA-MM-DDT12:00:00-03:00`), porque uma data só com o dia é lida como meia-noite UTC e cairia no dia anterior. Fontes:
  - cadastro ("Cadastrada no mapa por Ana", ou "pela equipe" para quem não vê o nome) e "Dados atualizados" (não há histórico campo a campo);
  - papéis: só o estado atual ("Papel atual: Mentorado · Ativo desde 10/10"), porque o upsert não guarda mudanças antigas, e a tela não inventa histórico;
  - autorização e revogação, sem número nem e-mail;
  - atendimento iniciado ("Atendimento iniciado · Mapeamento · Padaria Pão Dourado");
  - trocas de etapa (`opportunity_stage_events`; os eventos `ini-` aparecem como "Etapa no início do registro");
  - atividades dos tipos Contato, Follow-up, Reunião e Proposta (o tipo "Etapa" fica de fora, para não repetir as trocas; a nota só aparece para quem vê o atendimento) e os comandos do acompanhamento (`followup_events`);
  - venda registrada e pagamento confirmado (o valor só para a gestão e o responsável; "Ganho" nunca aparece como pagamento);
  - indicações feitas ("Indicou Bruno"), só das pessoas que estão no escopo de quem vê;
  - interações e visitas (`territory_actions`);
  - mentoria e embaixador (etapas do portal, só para o Administrador; atualizações de embaixador e tarefas concluídas, só para a gestão);
  - pedidos do titular (`privacy_requests`), só para o Administrador.

  Uma consulta por fonte, com LIMIT 50 e em lotes de 80 ids; `lib/person-timeline.ts` (puro) junta tudo, ordena pelo dia de Brasília, desempata pelo tipo e mostra "Hoje", "Ontem" e as datas.

**Quem vê o quê** (tudo conferido no servidor; o navegador só esconde botões)
- Administrador e Assessoria Elite (com a faixa "Modo assessoria"): qualquer pessoa da empresa. Coordenação e Líder: pessoas da própria cidade (sem cidade, nenhuma). Comercial: o mesmo escopo do mapa (pessoas com atendimento atribuído a ele sem revogação, ou cadastradas por ele). Embaixador e Mentorado: 403 ("Esta página é da equipe.").
- Pessoa fora do acesso, de outra empresa, inexistente ou anonimizada: 404 com a mesma mensagem, "Pessoa não encontrada ou fora do seu acesso.", para não revelar que ela existe.
- Contato (WhatsApp e e-mail) não aparece na página para ninguém.
- Nomes de quem indicou e de quem ela indicou: a gestão vê; o Comercial vê só os do escopo dele e não recebe o id de quem está fora.
- Atendimento, valores de venda e notas: só para a gestão e para o responsável (o mesmo filtro do mapa: dono da oportunidade e responsável do lead). Um Comercial que só cadastrou a pessoa vê "Atendimento com outra pessoa da equipe", e o Próximo passo dele pula as regras 2 a 6 (nunca "Iniciar atendimento", porque cada pessoa tem um atendimento só).
- Mentoria: só o Administrador. Bloco de embaixador, atualizações e tarefas: só a gestão.
- Os botões seguem as permissões que já existem: "Iniciar atendimento" (`canManagePipeline`); "Registrar venda" (`record_sale`, que o Comercial responsável também tem); "Editar" e papéis (quem mapeia, com a pessoa no escopo; marcar líder continua só para a gestão).
- A página não pode ser impressa nem exportada; a cópia completa continua só em Gestão → Privacidade (LGPD). Nenhuma coordenada da pessoa é enviada.

**Corrigir junto**
- O Comercial deixa de receber o `referrerId` de quem está fora do acesso dele (`db/territory.ts`; hoje só o Embaixador recebe vazio): recebe vazio e o sinal "indicado por alguém fora do acesso".
- A auditoria `link_referral` (`db/followup.ts`) passa a gravar só os ids, sem a observação livre, e a anonimização (`anonymizeSubject`, em `db/privacy.ts`) limpa o resumo das linhas antigas que citam a pessoa.
- O titular anonimizado some do mapa, da Rede, das contagens e da página, tenha sido embaixador ou não. Hoje ele aparece por dois caminhos: `recordsSql` e `visiblePersonSql` (`db/territory.ts`) o aceitam por causa do embaixador, que a anonimização só marca como "Desligado", e também quando ele nunca teve lead, porque o `NOT EXISTS` de lead revogado dá verdadeiro; `peopleScope` (`db/followup.ts`) faz o mesmo. Reconheça o anonimizado pelo nome começando com `ANONYMOUS_LABEL` (`lib/privacy.ts`).
- Vínculo sensível que já existe (pessoa ligada a local do setor Religioso, ou a local de Saúde como Frequenta, Membro do network ou Mentorado): até a gestão revisar, a pessoa aparece no centro do bairro ou da cidade, e não no ponto do local (o JOIN de coordenadas de `db/territory.ts` ignora esse local, e ela não entra na contagem do ponto). A página não mostra o nome do local: para a gestão, "Local a revisar", com "Editar" para trocar o local ou o vínculo; para os outros, nada. "Como abordar" não usa esse local. A regra fica numa função pura, `sensitiveLink`, em `lib/person-places.ts`, que a Etapa 5 amplia. Nada é apagado sozinho.
- O "Histórico do acompanhamento" (`app/followup-workspace.tsx`) passa a usar o mesmo `Timeline` da página.
- Escopo do Comercial: na Rede (`peopleScope`, em `db/followup.ts`) ele vê só pessoas com atendimento dele; no mapa, também as que cadastrou. A página usa o escopo do mapa; alinhar a Rede a ele ou explicar a diferença no guia de Indicações.
- A Ficha territorial não mostra "Registrar venda" ao Comercial responsável, embora ele tenha a permissão (`onOpen` só chega ao mapa para a gestão, em `app/expansion-dashboard.tsx`). A página mostra.

**"Onde buscar" na Calculadora:** "18 clientes ainda não indicaram ninguém", "7 indicações sem atendimento", "40 pessoas mapeadas sem atendimento há mais de 14 dias". Cada linha tem "Ver lista", com até 50 pessoas do escopo de quem vê (o mesmo da página da pessoa), só com nome e motivo, e "Abrir página da pessoa". A lista vem à parte, por `whereToLook` (em `db/calculator.ts`), nunca dentro da resposta de `GET /api/calculator`. Se a Etapa 4 vier antes das Etapas 2 e 3 (decisão da Etapa 0), "Onde buscar" entra no fim da Etapa 2.

**Guia da página** (o tom; a versão final, com Lugares, vem na Etapa 5): Como usar: Página da pessoa. Para que serve: ver tudo de uma pessoa num lugar só e saber o próximo passo com ela. 1) Comece pelo "Próximo passo": é a ação mais importante agora, a um toque. 2) Em "Resumo", veja o atendimento, quem indicou e como abordar. 3) Em "Histórico", veja o que já aconteceu, dia a dia. Exemplo: Maria é Cliente e sócia da Padaria Pão Dourado. Próximo passo: "Pedir indicação". Cuidado: a página não mostra contato; o envio continua pela ficha do atendimento. Fazer agora: o botão do próprio Próximo passo. Junto, o passo 3 do guia do Mapa passa a "Abrir página da pessoa".

## Etapa 5 — Lugares, situação do lugar e plano de plantio

É a parte mais sensível (LGPD) e depende da página, do escopo e das decisões da Etapa 0. Todas as travas entram no mesmo commit do dado novo.

**O conceito**
- "Lugares" é uma seção da Página da pessoa (no guia e no kit, "lugares de relacionamento"). Não usar "rota": a palavra já quer dizer "Abrir rota externa" e a futura "Rota do dia" da equipe, e "rota de uma pessoa" soa como rastreamento.
- São estabelecimentos já cadastrados em `businesses` onde a pessoa tem vínculo (trabalha, é sócia, é responsável, é membro de uma rede ou frequenta), que ela mesma contou e autorizou, para a equipe plantar relacionamentos ali com a ajuda dela. Até 5 por pessoa, contando o local principal, na mesma cidade dela.
- Não é trajeto: não tem ordem, horário, dia da semana, frequência, linhas no mapa nem GPS.
- Cada lugar mostra a situação (Abrir · Plantar · Avançar · Dominado) e um Plano de plantio, com visitas planejadas e feitas e dicas pelo nível da pessoa e pelo tipo e setor do lugar.

**Dados**
- Tabela nova `person_places`: `id` (uuid), `organization_id`, `city_id` (a cidade da pessoa), `person_id`, `business_id` (da mesma organização e cidade, com a validação do local principal), `link` (um dos `PLACE_LINKS`), `authorized_by`, `authorized_at`, `created_by`, `created_at` e `updated_at`. Única em (pessoa, local); índices em (organização, local) e (pessoa). Sem coluna de horário, dia, frequência, ordem, coordenada, nota ou foto. Remover um lugar apaga a linha: não fica histórico de onde a pessoa costumava ir.
- `territory_people.place_id` e `place_link` continuam sendo o **local principal**, o que define o ponto no mapa; `person_places` guarda só os outros e nunca repete o principal. Assim nada do que depende de `place_id` quebra (coordenadas, contagens, `startAttendance`, portal, importações, impressão, privacidade). "Tornar principal" troca os dois numa transação (`db.batch`), com auditoria. O servidor recusa o 6º lugar.
- `territory_actions` ganha `business_id` (com índice em local e data), e `activitySchema` (`lib/territory-validation.ts`) passa a aceitar `businessId`, conferindo que o local é da mesma organização e cidade. Com `businessId`, o servidor só aceita a categoria "Visita" e o nome da lista fixa (o passo do plano, ou "<passo> — <resultado>"), porque hoje `name` é texto livre; e só grava a pessoa como ponte se ela estiver ligada a esse local (como principal ou extra) e o local não for Religioso. O formulário de ação do mapa continua sem `businessId`. Sem categoria nova: o plano e a visita usam "Visita" com as situações que já existem (Programado e Realizado).
- Código puro:
  - `lib/person-places.ts` (com zod): quem pode ter lugares extras, o limite, a mesma cidade, os setores sensíveis e as mensagens de recusa; o servidor e o mapeamento guiado usam a mesma regra;
  - `lib/place-situation.ts`: devolve Abrir, Plantar, Avançar, Dominado ou "Institucional" (local Religioso);
  - `lib/planting-tips.ts` passa a considerar também o vínculo e a situação: `tipsFor({nivel, tipo, setor, vinculo, situacao, publico})` devolve até 2 dicas, da mais específica para a genérica;
  - `lib/hooks.ts`: a variável `{lugar}` ("lugar onde a pessoa tem vínculo") em `HOOK_VARIABLES`, o lugar e o setor em `HookContext`, e `fillHook` trocando `{lugar}`.
- As contagens atuais continuam contando só quem aparece no local (o principal) e passam a dizer isso no rótulo: as pessoas de cada ponto do mapa (`db/territory.ts`), "Ligadas" em Resultados → Mapeamento (`db/mapping-stats.ts`) e a impressão (`app/imprimir/mapa/print-map.tsx`). A contagem nova, "Pessoas da rede ligadas aqui" (principal mais lugares extras, pessoas distintas, no escopo de quem vê), fica na ficha do local e na situação.

**Autorização e LGPD**
- Finalidade, escrita onde se liga um lugar e no kit (§6): "Para criar relacionamentos nos lugares onde a pessoa já tem vínculo, com a ajuda dela: indicações, parcerias e eventos. Só trabalho, negócios e comunidades: nunca a casa dela, e sem horários." Nenhum outro uso: nada de perfil de consumo, crédito, publicidade de terceiros ou repasse.
- Quem pode ter lugares além do principal: pessoa com autorização de contato vigente (lead com autorização e sem revogação) ou com papel Mentorado ou Embaixador ativo. Para as outras, "Ligar a outro lugar" fica desligado, com o motivo e o atalho "Iniciar atendimento".
- Caixa obrigatória a cada lugar ligado: "{primeiro_nome} contou que tem esse vínculo e concordou em ajudar a criar relacionamentos aqui." Ela grava `authorized_by` e `authorized_at`. Em local de ensino (tipo Instituição de ensino ou setor Educação) com "Frequenta", a frase acrescenta "a própria pessoa estuda ou trabalha aqui (não use para a escola dos filhos)" (LGPD art. 14).
- Só estabelecimentos já cadastrados, que já exigem "Confirme que são dados públicos de um estabelecimento.". Nunca endereço livre, ponto da pessoa, GPS, horário, dia, frequência, ordem, nota ou foto.
- Ações de um lugar: "Ligar a outro lugar", "Tornar principal" e "Remover". "Ligar a outro lugar" abre a mesma escolha de local do mapeamento guiado, na cidade da pessoa: "Local já cadastrado" (busca pelo nome) ou "Cadastrar novo local", com a confirmação de dados públicos do estabelecimento. Depois de salvar o local novo, volta para escolher o vínculo e marcar a caixa da autorização. Nunca endereço livre.
- Revogação, pelos dois caminhos que já existem: "Revogar autorização" em Gestão → Privacidade (LGPD) (`revokeSubject`) e a revogação marcada em "Etapa e autorização" (`update_lead`, em `db/mutations.ts`). Os dois apagam os lugares extras da pessoa e cancelam as visitas programadas em que ela é ponte. O mentorado do portal não tem lead, e `revokeSubject` hoje recusa quem não tem lead nem WhatsApp de embaixador autorizado; por isso, a revogação passa a aceitar também quem tem lugares extras, apagando os lugares e cancelando as visitas sem mexer no resto. O local principal segue a regra de hoje.
- Direitos do titular (`db/privacy.ts`): a cópia traz os lugares (local, vínculo, autorizado por e quando) e as visitas ligadas a ela (local e dia); "Corrigir dados" permite remover um lugar; a anonimização apaga os lugares, desliga a pessoa das ações (`territory_actions.person_id` vazio) e limpa os resumos de `link_referral` que a citam.
- Auditoria sem nome e sem o local: `save_person_place` e `remove_person_place` gravam "Registro territorial person:<id da pessoa>.", nunca o id do local nem o da linha apagada; `plant_visit` grava o id da ação, como o território já faz. O Histórico da página lê `remove_person_place` para mostrar "Um lugar removido pela própria pessoa" (quando foi o login do portal) ou "Um lugar removido pela equipe", sem dizer qual. É a única marca que fica depois de apagar a linha.
- Quem vê: a mesma visibilidade da pessoa. O Comercial só vê lugares das pessoas do escopo dele; o Embaixador não vê nada; o Mentorado vê só os dele, no portal (Etapa 6). Impressão, CSV, Ctrl+K e e-mails nunca listam lugares de pessoas.
- Assessoria Elite: vê como Administrador, com a faixa, e tudo o que fizer fica marcado no Histórico. O contrato precisa prever esse acesso (pendência de `ESTADO_MULTIEMPRESA.md`).
- Nada de lugares nem visitas na fila sem internet nesta rodada: nenhum dado pessoal novo fica guardado no aparelho.
- A base legal (autorização da pessoa, LGPD art. 7º, I) e um resumo de por que a regra protege o titular entram no kit §6 e no guia do mapeador.

**Setores sensíveis** (uma regra só, em `lib/person-places.ts`, conferida no servidor pelo setor gravado em `businesses`, não pelo que a tela mandou; vale para os lugares extras, para o local principal no mapeamento guiado e em "Editar pessoa e indicação", para as importações, que recusam a linha com o motivo, e para planos e visitas, que nunca têm como ponte uma pessoa que não poderia estar ligada ao local)
- Para ligar pessoas a um local, ele precisa ter setor ("Outro" vale). Hoje o setor só é obrigatório no tipo Empresa, e uma igreja cadastrada como "Ponto de encontro" sem setor passaria pela regra. No mapeamento guiado, "Setor" deixa de ser opcional quando há pessoas a ligar (só ao cadastrar local que não é Empresa); no servidor, a ligação a local sem setor é recusada com "Escolha o setor deste local antes de ligar pessoas a ele.". Os vínculos antigos com local sem setor ficam como estão e entram na lista de revisão.
- Religioso: nenhuma pessoa é ligada, nem como local principal. O lugar existe no mapa e recebe só plano institucional (evento aberto, parceria, material aprovado, em Rede → Parceiros e eventos), sem nomes e sem situação ("Lugar institucional"). Mensagem: "Igreja revela religião (dado sensível). Mapeie o lugar, mas não ligue pessoas a ele."
- Saúde: só vínculo de trabalho (Sócio / dono, Colaborador ou Responsável). "Frequenta", "Membro do network" e "Mentorado" são recusados: "Ser paciente revela dado de saúde."
- Associação / entidade: só com a confirmação "Não é sindicato, partido nem entidade religiosa", a cada ligação. Associação comercial, CDL e clubes de negócio continuam permitidos.
- Nas importações não há caixa: a linha com "Frequenta" em local de ensino, e a de local do setor Associação / entidade, é recusada com "Ligue esta pessoa pelo mapa, com a confirmação.".
- As dicas desses setores falam com a instituição; nunca mandam abordar quem frequenta durante culto, consulta ou reunião, nem usar lista de membros.
- Vínculos atuais que caem nas regras: a Etapa 0 lista, e a proteção da Etapa 4 (centro do bairro ou da cidade e "Local a revisar") continua até a revisão. Território → Locais ganha o filtro "A revisar", com os locais que têm vínculos assim, para a gestão de cada empresa trocar o setor, o local ou o vínculo. Quando a gestão muda o setor de um local para Religioso ou Saúde, os vínculos que passam a quebrar a regra entram na mesma lista. Nada é apagado sozinho. Base legal: LGPD art. 5º, II e art. 11.

**No mapa**
- A pessoa continua sendo um ponto só, pela regra de hoje (local principal → centro do bairro → centro da cidade). Nunca aparece na residência nem num lugar extra. Continuam como estão `displayedCoordinates`, a recusa de `person:` na ação `location` e a recusa de `kind=person` no geocode.
- Os lugares extras não movem nem duplicam a pessoa, não são ligados por linhas e não entram em Calor, Cobertura, Funil ou Linha do tempo como posição dela.
- A ficha de um local ganha "Pessoas da rede ligadas aqui: 3", contando e nomeando só quem está no escopo de quem vê, como a situação (o Comercial não fica sabendo quantas pessoas de fora estão ligadas ao lugar); a situação, com ícone e frase ("Avançar: 1 cliente aqui"); "Plano de plantio aqui"; e "Registrar visita".
- Território → Locais ganha a coluna e o filtro "Situação".
- Na página da pessoa, cada lugar tem "Ver no mapa", que abre a ficha do local, não a da pessoa.
- Sem modo novo de mapa nesta rodada: um modo colorido pela situação ("Onde plantar") pode vir no passo Conexões e Rota do dia, reaproveitando `lib/place-situation.ts`.

**Situação do lugar e plano de plantio**
- Situação automática, contando pessoas distintas ligadas (principal ou extra) no escopo de quem vê: **Abrir** (ninguém da rede); **Plantar** (rede presente, nenhum cliente); **Avançar** (pelo menos 1 cliente); **Dominado** (pelo menos 1 Multiplicador ou 3 clientes). Cada uma com 1 frase ("Plantar: 3 pessoas da rede, nenhum cliente ainda"), sempre com ícone e texto.
- "Planejar visita", em cada lugar da página e na ficha do local, abre "Plano de plantio em {lugar}":
  - **o que fazer** (lista fixa: Pedir apresentação ao responsável · Visitar junto com {primeiro_nome} · Levar material aprovado · Propor evento ou palestra · Propor parceria · Pedir indicação);
  - **até quando** (data);
  - **quem faz** (alguém da equipe; para o Comercial, ele mesmo);
  - a caixa "Com {primeiro_nome} como ponte", que grava a pessoa.
  Mostra a dica daquele tipo de lugar. Salvar grava uma ação "Visita" "Programado", com o local.
- **Como abordar:** `tipsFor` escolhe até 2 dicas pelo nível da pessoa e pelo tipo, setor, vínculo e situação do lugar (sem dica própria, usa a genérica do tipo; em local sensível, só a institucional). Aparecem na página, no plano e, em 2ª pessoa, no portal.
- **Ganchos casados:** "Usar gancho" mostra primeiro os ganchos aprovados do setor do lugar, na situação certa: sem atendimento → Primeiro contato; retorno atrasado → Retomada; Cliente, Indicador ou Multiplicador → Indicação; plano "Propor evento ou palestra" → Evento; cliente antigo → Pós-venda. `{lugar}` é preenchido. Sem gancho da empresa, a dica da plataforma continua aparecendo.
- O Próximo passo usa o plano (regras 8 e 9). Hoje ganha a linha "Plantio: N visitas para hoje · Ver" (visitas programadas com local para hoje, do responsável; a gestão vê as do escopo). A Agenda continua só com os retornos comerciais.
- "Onde buscar" ganha "N lugares em Avançar sem plano de plantio": é a lista onde uma apresentação abre mais portas.
- Depois de "Registrar visita", "Mapear pessoas deste local" abre o mapeamento guiado já com o local escolhido (prop nova do `MappingWizard`).
- Fica para depois: "Adicionar à Rota do dia" (passo Conexões e Rota do dia) e missões de plantio. Nunca nota ou pontuação da pessoa: a situação é do lugar.

**Registrar visita** (em cada lugar da página e na ficha do local)
- Um toque abre uma folha com "Hoje" já marcado; dá para escolher um dia até 7 dias atrás, nunca no futuro. Quatro resultados fixos: Conheci o responsável · Deixei material aprovado · Combinei evento ou conversa · Não deu certo.
- Se há visita programada naquele lugar (e para aquela pessoa, quando vem da página), ela vira "Realizado", com o nome "<passo> — <resultado>". Senão, cria uma ação "Visita" "Realizado", com o local, a pessoa (quando foi ponte), o dia (AAAA-MM-DD) e quem registrou como responsável.
- Sem hora, GPS, foto ou texto livre. A folha avisa: "Registre a visita da equipe ao local. Não registre onde a pessoa estava nem horários."
- A visita aparece no Histórico da pessoa, se ela foi ponte, e na ficha do local ("Última visita: 30/10"). A situação do lugar não depende da visita: vem das pessoas ligadas.
- Sem internet: "Sem conexão: registre quando o sinal voltar." A fila sem internet para visitas fica para o passo Em campo, guardando só ids; esse passo reaproveita esta ação como check-in, com o GPS do mapeador só para sugerir locais próximos e sem histórico de deslocamento.
- Permissão: quem mapeia (gestão e Comercial), só com lugar e pessoa no próprio escopo; Embaixador e Mentorado não. Auditoria `plant_visit`.

**As dicas da casa** (fixas no código, revisadas por mim na Etapa 0, sem citar Elite nem produto; variáveis `{primeiro_nome}`, `{lugar}` e `{empresa}`)
- *Lead ou pessoa sem atendimento, qualquer lugar.* Primeiro, a autorização. Faça: antes de qualquer mensagem, pergunte pessoalmente se {primeiro_nome} aceita contato da {empresa} e para quê, e registre em "Iniciar atendimento". Evite: mandar WhatsApp para quem ainda não autorizou.
- *Cliente · Empresa ou Comércio e varejo · Sócio / dono · Avançar.* Peça a indicação de outro dono. Faça: nas primeiras semanas depois do pagamento, peça um nome por vez. Diga: "{primeiro_nome}, quem do {lugar} ou do seu ramo também quer crescer este ano?" Evite: pedir lista de contatos ou falar com alguém antes de essa pessoa autorizar.
- *Indicador · a indicação ainda não comprou.* Feche o ciclo da indicação. Faça: conte a {primeiro_nome} que a pessoa indicada já foi atendida e agradeça, sem valores nem detalhes da conversa. Evite: cobrar dela o resultado da indicação.
- *Multiplicador · Network / comunidade · Membro do network · Dominado.* Convide para multiplicar de propósito. Faça: agradeça em particular e convide para o programa de embaixadores ou para apresentar a {empresa} no próximo encontro do {lugar}. Evite: expor a pessoa indicada ou prometer recompensa fora das regras do programa.
- *Colaborador · Comércio e varejo ou Alimentação · Plantar.* Plante pelo responsável, não pelo balcão. Faça: peça a {primeiro_nome} que apresente quem decide, combine a visita num horário tranquilo do estabelecimento e leve só material aprovado. Evite: abordar clientes da loja ou atrapalhar o atendimento.
- *Cliente · Esporte e lazer · Frequenta.* Relação antes de negócio. Faça: peça a {primeiro_nome} que apresente você ao dono ou ao professor e proponha uma conversa aberta para alunos que empreendem. Evite: abordar alunos durante o treino. Nunca anote dias ou horários em que ela treina.
- *Qualquer nível · Instituição de ensino · Responsável ou Colaborador.* Fale com a coordenação, não com os alunos. Faça: proponha uma aula aberta ou oficina gratuita, com inscrição em que a própria pessoa autoriza o contato. Evite: pedir lista de alunos e qualquer contato com menores de idade.
- *Lugar institucional · Religioso ou Associação / entidade.* Trabalhe com a instituição, nunca com a lista de quem frequenta. Faça: combine com o responsável o apoio a um evento ou projeto aberto e registre em Rede → Parceiros e eventos. Evite: registrar quem frequenta, abordar durante celebração ou reunião, ou usar lista de membros.
- *Para o mentorado, no portal.* No {lugar}: quem você conhece que quer crescer? Conte para a pessoa antes e, se ela aceitar, use "Indicar alguém". Uma boa ideia: sugerir ao responsável uma conversa curta com a {empresa}.

**Guia da página (versão final):** Como usar: Página da pessoa. Para que serve: ver tudo de uma pessoa num lugar só e saber o próximo passo com ela. 1) Comece pelo "Próximo passo": é a ação mais importante agora, a um toque. 2) Em "Lugares", veja onde ela tem vínculo, a situação de cada lugar e o plano de plantio. 3) Depois da visita, toque em "Registrar visita"; tudo entra no "Histórico". Exemplo: Maria é Cliente e sócia da Padaria Pão Dourado. Próximo passo: "Pedir indicação". Em Lugares: Academia Corpo Ativo · Frequenta · Avançar (1 cliente aqui). Plano: "Pedir apresentação ao responsável" até 05/11. Cuidado: lugares só com a autorização da pessoa: trabalho, negócios e comunidades, nunca a casa, e sem horários. Fazer agora: o botão do próprio Próximo passo.

## Etapa 6 — Portal do Mentorado ("Seus lugares") e fechamento

O mentorado é quem mais circula e indica, e o portal depende das regras da Etapa 5 já estáveis.

- **"Seus lugares"**, cartão novo em `app/client-portal.tsx`, abaixo de "Indicar alguém": o local principal e os lugares extras do próprio mentorado (pela pessoa ligada ao login dele, `app_users.person_id`), com nome, vínculo e 1 dica em 2ª pessoa em cada um. Se houver plano, aparece só o passo combinado ("Combinado com a equipe: apresentar o responsável"), sem datas e sem nomes da equipe.
- **"Não frequento mais"**, com confirmação ("A equipe deixa de ver este lugar ligado a você."): remove um lugar extra. Conta como correção feita pelo próprio titular: a auditoria `remove_person_place` registra a pessoa (nunca o local), e o Histórico da página mostra "Um lugar removido pela própria pessoa", sem dizer qual. O local principal não sai pelo portal, porque define o ponto no mapa: "Para mudar seu local principal, fale com {contato}."
- **"Dicas para você":** até 2 dicas pelo nível dele ("Você já indicou 2 pessoas; quando uma comprar, você vira Multiplicador.").
- Dados: `getPortalData` (`db/portal.ts`) lê os lugares pela pessoa ligada ao login, na mesma organização; `PortalData` (`lib/portal.ts`) ganha os lugares e as dicas; `portalAction` ganha `place_remove`. O Mentorado continua sem acesso às APIs da equipe e nunca vê mapa, bairro, outras pessoas do lugar, contagens ou planos internos.
- Fica para depois: "Sugerir um lugar", que exige revisão pela equipe.
- O 3º passo do guia do portal passa a ser "Em 'Seus lugares', veja como abrir portas onde você já circula."; os guias dos dois portais são revisados.
- `docs/guia-do-mapeador.md`, `/guia` (`lib/mapper-guide.ts`), `docs/kit-de-lancamento.md` e `docs/roteiro-primeira-semana.md` revisados de ponta a ponta com "Como usar", Calculadora, Página da pessoa e Lugares.
- Validação final por função e publicação.

## O que NÃO quero

- **Número inventado:** projeção sem base, taxa abaixo da amostra mínima, "0%" no lugar de "Sem dados suficientes", "média de mercado" escondida, premissa mostrada como se fosse real.
- **Projeção com cara de realizado:** somada a ele, gravada como resultado ou levada a indicadores, exportações e e-mails; nem duas respostas diferentes para "se nada mudar".
- **Calcular a Calculadora no navegador**, sobre os até 1.000 registros de `getDashboardData`.
- **Uma terceira meta:** tudo o que é meta vem de `goals`; `seller_goals` vira "Rotina do dia"; Missões e Varredura leem de `goals`.
- **Ranking ou comparação pública de vendedores**; custo, CAC ou verba para o Comercial; números de outra empresa; comparar empresas entre si nesta rodada.
- **Rastrear pessoas:** chamar de "rota", desenhar linha ou trajeto entre os lugares de alguém, horário, dia da semana, frequência ou ordem de passagem, GPS ou check-in da pessoa, endereço livre, a casa dela, condomínio onde mora, escola dos filhos ou foto.
- **Dado sensível:** pessoa ligada a igreja, como paciente de clínica, a sindicato ou a partido; dicas que mandem abordar em culto, consulta ou reunião, ou usar lista de membros.
- **Texto livre** em lugares, planos e visitas: só listas fixas.
- **Lugares de pessoas** em impressão, CSV, Ctrl+K, e-mails ou Sala de comando. **Dossiê:** página da pessoa para imprimir ou exportar (a cópia completa é só a da LGPD).
- **Dados de exemplo gravados no banco**, inclusive no ambiente publicado; "modo demonstração"; exemplo com Elite, Esmeraldas ou pessoas reais em empresa assinante; "Ver exemplo" que preenche formulário real.
- **Guia que atrapalha:** janela sobre janela, guia que cobre o mapa, tour de vários passos, vídeo obrigatório, animação que atrasa, som.
- **Mensagem enviada sozinha:** a plataforma sugere o texto e quem envia é a pessoa; aplicar uma meta não cria tarefa, missão nem mensagem.
- **Tela nova quando um cartão resolve**, mais de 1 toque até o próximo passo, formulário longo na Calculadora (só meta, data e onde).
- **Gráfico decorativo**, dois eixos Y, número em cada ponto, sigla sem explicação.
- Mudar o significado de `place_id` (continua sendo o local principal) ou mexer na decisão calculada da cidade e nos critérios de Regras e cálculos.

## Regras que não mudam

- Permissões no servidor, isolamento entre empresas (tabelas novas nascem com `organization_id`; as antigas sem ela passam pelo JOIN com `cities.organization_id`), limites do plano e Assessoria Elite como hoje, com tudo o que ela faz marcado no Histórico.
- O Comercial vê só os próprios números; Coordenação e Líder, só a cidade deles; Embaixador e Mentorado ficam nos portais deles.
- LGPD:
  - pessoa nunca marcada na residência: aparece no local ligado, no centro do bairro ou no centro da cidade;
  - nenhuma coordenada de pessoa sai do servidor; GPS do mapeador sem histórico; nenhum GPS da pessoa;
  - atendimento só com autorização registrada; lugares extras só com a autorização da pessoa e a confirmação a cada lugar;
  - calor, cobertura, ligações e telas compartilhadas nunca expõem a posição de uma pessoa;
  - cópia, correção, revogação e anonimização cobrem tudo o que for criado aqui.
- "Sem dados suficientes" em vez de número inventado, sem dividir por zero.
- O cadastro em campo continua funcionando sem internet; `/api/` nunca entra no cache do app; as telas novas dizem "Sem conexão" em vez de mostrar números velhos.
- Não quebrar os links `/?org=…&area=…&ver=…&modo=…`, o login, os mapas impressos nem as 5 ações mais usadas (mapear pessoa, iniciar atendimento, registrar retorno, registrar venda, convidar pessoa), que não podem ganhar cliques.
- Limites do D1: no máximo 100 parâmetros por consulta e 5 SELECTs por UNION. Migrações sempre no próximo número livre de `drizzle/` (o passo Toque no mapa pode ocupar um número antes).

## Como validar cada etapa

- **Código:** `npx tsc --noEmit`, lint e `npm test` (hoje 146 testes em 25 arquivos) passando, com os testes novos de cada etapa listados à mão em `.github/workflows/verificar.yml` (o CI não roda arquivo fora da lista).
- **Testes da Etapa 1:**
  - `tests/tab-guides.test.mjs`, no padrão de `tests/navigation.test.mjs`: para Administrador dono, Administrador de empresa assinante com assessores, Coordenação, Líder e Comercial, cada `${area}/${view}` de `navigationFor` e `hoje/` tem guia, e existem `portal:embaixador` e `portal:mentorado`; exatamente 3 passos, exemplo e limites de tamanho em todos; o alvo de "Fazer agora" existe para a função e passa em `canPerform` ou na disponibilidade do + Novo; nenhum guia que a função vê cita uma aba que ela não tem; renderizado para "Empresa Teste", nenhum texto tem "Elite", "Esmeraldas", "@" ou padrão de telefone.
  - `tests/elite-components.test.mjs`: cartão e gaveta do guia renderizados (título, descrição, selo "Exemplo", "Entendi" e "Como usar" com rótulo acessível, nenhum pedido ao servidor); o Ctrl+K acha "Ajuda: Agenda" quando se digita "retorno".
  - `tests/team.test.mjs` e `tests/portal.test.mjs`: `guide_seen` grava só a própria linha, recusa chave desconhecida, não duplica, não grava para a Assessoria e funciona pelo portal; `guides_reset` zera; isolamento entre empresas; convite com e-mail `@exemplo.com` recusado.
  - `tests/network-import.test.mjs`, `tests/territory-integration.test.mjs` e um teste novo do importador de empresas (`tests/business-import.test.mjs`): a linha "EXEMPLO…" é recusada com a mensagem, e nenhum modelo tem "Elite".
- **Testes da Etapa 2:**
  - `tests/goal-calculator.test.mjs` (puro, com `vite.ssrLoadModule`): o exemplo da Cidade Exemplo inteiro, número a número e data a data:
    - F = 36 (≈ R$ 43.200) em 56 dias; No ritmo atual 84 dias, 25/01/2027, 28 dias depois, faixa de 70 e 105 dias (11/01 e 15/02/2027);
    - E = 6 até 16/11, R = 30, U = 6, vn = 5; Nn = 25 (+10), 150 no total, começar até 14/12; 18 do mapeamento, 72 pessoas por semana (432 até 14/12), 5 mapeadores (+3), 3 vendedores (+1); o gargalo (atendimentos, depois também vendedores);
    - ranking: conversão em 70 dias (11/01/2027) antes de +1 mapeador, também em 70, pelo desempate; indicações em 78 (19/01/2027); +1 vendedor em 84, "sozinho não muda a data"; mídia desligada;
    - menor combinação +3/+1 em 53 dias (25/12/2026), e nenhuma outra com até 4 pessoas novas chegando (+2/+1 e +2/+2 dão 60; +3/+0 e +4/+0 dão 67);
    - r = 0,05 por semana (≈ 0,2 por mês) e bônus 4,5, mostrado "≈ 4"; coerência sem ajuste, sem aviso de divergência e com a mesma faixa nas duas colunas; R$ 48.000 → 40 vendas; o "Resumo para copiar" igual ao do prompt;
    - bordas: meta batida (também em receita, com o pago acima da meta); ritmo zero; v′ = 0; o que está em andamento já basta (P + v × m ÷ 7 ≥ M); prazo menor que o tempo até pagar; tempo até pagar ausente (só "No ritmo atual"); N = 0 ou v = 0 no modo absoluto, com "Com ajustes" igual a "Hoje" sem ajuste; Nmap = 0 ou nm = 0; r = 0; sem CPL (mídia desligada); "Nem com +10 mapeadores e +5 vendedores"; conversão sem dados (só a alavanca de conversão espera a premissa); capacidade editada abaixo da oferta de hoje; divergência acima de 30%; o aviso de participação orgânica só com critério maior que 0; arredondamentos; nunca `NaN` nem `Infinity`.
  - `tests/calculator-base.test.mjs` (SQLite em memória com todas as migrações, como `tests/regions.test.mjs`): taxas a partir de dados semeados; importação fora da conversão, do tempo até pagar e dos atendimentos por semana, e dentro do realizado e do ticket; tempo negativo descartado; "Ganho" sem pagamento e "Venda confirmada" fora; revogado e cancelado fora da coorte; amostra abaixo do mínimo → vazio; os 4 formatos de data caindo no dia certo; cidade em Consolidado; organização 2 nunca entra na 1, mesmo com cidades de mesmo nome; Comercial só com os números dele e sem custo; Coordenação e Líder só com a cidade (sem cidade, nada); Embaixador e Mentorado 403; 150 cidades sem passar de 100 parâmetros; 1.200 atendimentos e 1.100 vendas com os mesmos totais do SQL direto; `record_sale` mantendo `paid_at` (qualquer situação diferente de Pagamento confirmado zera, e a importação mantém a data da planilha); `territory_people.source` certo em cada caminho (o embaixador criado por `resolvePerson` recebe "Embaixador"), sem mudar ao editar, e o preenchimento do passado só com prova, podendo rodar duas vezes sem mudar nada; com 3 a 7 semanas de histórico, ritmo, atendimentos por semana e pessoas mapeadas divididos pelas semanas cobertas; uma importação recente de vendas antigas não infla o ritmo; Pm e a sem as pessoas marcadas pelo preenchimento do passado.
  - `tests/navigation.test.mjs`: Resultados da gestão passa a `['visao','calculadora','metas','mapeamento','custos']`; o Comercial continua com `['metas']`.
- **Testes da Etapa 3:** `tests/goals.test.mjs` (Administrador aplica em qualquer cidade, Coordenação só na dela, Líder só divide uma meta existente, Comercial 403; meta sobreposta vira "Substituída"; 409 pelo `version` quando a meta substituída mudou; a divisão fecha com a meta; o plano gravado de hoje até a data de começar ("Semana" com 25 no exemplo) e a linha "Semana" sumindo depois dessa data; o Comercial recebe a meta sem custo nem verba na foto; venda sem responsável fora da meta de cada pessoa e dentro da cidade e da empresa; auditoria sem nomes; isolamento entre empresas; Assessoria marcada no Histórico).
- **Testes da Etapa 4:** `tests/person-page.test.mjs`:
  - GET por função: Administrador ok; Coordenação de outra cidade 404; Líder sem cidade 404; Comercial ok com atendimento dele e com pessoa cadastrada por ele, 404 com outra; Embaixador e Mentorado 403; o mesmo id em outra organização 404 com a mesma mensagem; titular anonimizado 404;
  - nenhuma latitude, longitude, WhatsApp ou e-mail na resposta; o Comercial sem id nem nome de fora do escopo; autorização revogada → nenhum contato e "Não entrar em contato"; 200 indicados em lotes de 80 sem passar de 100 parâmetros;
  - renderização com título, Próximo passo, as 3 partes e o `Timeline`;
  - `lib/next-step.ts` regra por regra e na ordem; `lib/person-timeline.ts` (ordem por dia, só o dia, `ini-` como "Etapa no início do registro", sem o tipo "Etapa", sem histórico inventado de papéis, privacidade só para o Administrador);
  - o endereço com `&ficha=` sem perder `org`, `area`, `ver` e `modo`, mantido ao recarregar e removido ao trocar de área.
  - "Onde buscar" (`whereToLook`): cada lista só com pessoas do escopo de quem vê (Coordenação e Líder, a cidade; sem cidade, nada), nunca de outra organização, no máximo 50, só nome e motivo, sem contato nem coordenada; Embaixador e Mentorado 403;
  - para o Comercial: "Indicou" e o Histórico sem pessoas de fora do escopo; sem mentoria, bloco de embaixador, atualizações e tarefas; Próximo passo sem as regras 2 a 6 quando o atendimento é de outra pessoa;
  - titular anonimizado fora do mapa, da Rede e da página nos dois casos: com lead e embaixador, e só mapeado;
  - vínculo sensível antigo: a pessoa no centro do bairro ou da cidade, fora da contagem do ponto, e "Local a revisar" só para a gestão;
  - `Timeline` sem hora quando pedido, e datas só com o dia caindo no dia certo.
  - Junto: `tests/privacy.test.mjs` com o `link_referral` sem a observação livre e limpo na anonimização.
- **Testes da Etapa 5:** `tests/person-places.test.mjs`:
  - o servidor recusa, com a mensagem exata: local de outra organização ou cidade; o 6º lugar; pessoa sem autorização vigente nem papel ativo; lugar sem a caixa; qualquer vínculo com Religioso, inclusive como principal, pelo mapeamento e pela importação; "Frequenta", "Membro do network" ou "Mentorado" em Saúde; Associação / entidade sem a confirmação; local de ensino (tipo Instituição de ensino ou setor Educação) com "Frequenta" sem a confirmação; local sem setor; ponte que não está ligada ao local, e qualquer ponte em local Religioso; com `businessId`, categoria diferente de "Visita" ou nome fora da lista fixa; nas importações, "Frequenta" em local de ensino e local de Associação / entidade; Comercial fora do escopo; Embaixador e Mentorado pela API da equipe;
  - o ponto da pessoa é o mesmo antes e depois de ligar lugares, e nenhuma linha nasce de `person_places`; "Tornar principal" troca sem duplicar; as contagens antigas não mudam e "Pessoas da rede ligadas aqui" conta pessoas distintas no escopo;
  - `lib/place-situation.ts` nos limites (0, 1 e 3 clientes; com e sem Multiplicador; Religioso "Institucional");
  - visita só com o dia, sem futuro nem mais de 7 dias atrás, fechando a programada;
  - revogação, cópia e anonimização cobrindo lugares, visitas e `link_referral` (em `tests/privacy.test.mjs`); a revogação pelos dois caminhos (Privacidade e "Etapa e autorização"), inclusive de um mentorado sem lead;
  - auditoria `save_person_place` e `remove_person_place` com o id da pessoa, nunca o do local; o Histórico com "Um lugar removido pela própria pessoa" ou "pela equipe";
  - o filtro "A revisar" em Território → Locais; "Onde buscar" de lugares só no escopo de quem vê;
  - `lib/planting-tips.ts` com dica para todo tipo e nível, só a institucional em setor sensível, sem horário, residência, Elite, Esmeraldas, e-mail ou telefone; `fillHook` trocando `{lugar}`; isolamento entre empresas.
- **Testes da Etapa 6:** `tests/portal.test.mjs` (o Mentorado vê só os próprios lugares; "Não frequento mais" remove um extra e não o principal; ele nunca vê outras pessoas do lugar).
- Em todas: `tests/navigation.test.mjs` e `tests/rendered-html.test.mjs` continuam passando. Este lê o código de `app/territorial-map.tsx`: "nunca na residência" e "Não informe residência" continuam nesse arquivo, mesmo com o guia novo.
- **Coerência dos números:** para a mesma empresa, cidade e dias, o realizado da Calculadora = o cartão "Quanto falta" = a soma das linhas "Meta" de Metas e rotina com o "sem responsável" (todos por `goalProgress`) = a linha de pagamentos do e-mail semanal (esta só no total da empresa, porque o e-mail não separa por cidade), inclusive com a venda de um atendimento anonimizado e com uma venda importada pela planilha. Os "Pagamentos confirmados" do dia em Metas e rotina continuam com a base de hoje e ficam fora dessa igualdade; a tela diz a base deles.
- **Sem base:** numa empresa sem histórico no banco local, todas as taxas em "Sem dados suficientes", nenhuma data inventada e a Calculadora funcionando com premissas. O exemplo da Cidade Exemplo só é semeado no banco local ou nos testes em memória, nunca no ambiente publicado. Eu confiro na tela publicada se as taxas reais fazem sentido.
- **Navegador**, por função (Administrador dono, Administrador de empresa assinante, Assessoria Elite, Coordenação, Líder, Comercial, Embaixador e Mentorado), em 1440 px e 390 px: sem rolagem horizontal, sem erro no console, com capturas antes e depois. Toques no celular: "Quanto falta" em Hoje sem nenhum toque; simular com 1; do mapa à página da pessoa com 2 (pelo Ctrl+K, 1); o próximo passo com 1; registrar visita com 2; reabrir o guia com 1. As 5 ações mais usadas ficam com o mesmo número de cliques ou menos. Na 1ª entrada, as boas-vindas e depois o guia, nunca duas janelas; sem internet, o guia abre (o conteúdo está no pacote).
- **LGPD, roteiro manual:** a pessoa nunca tem coordenada própria e nenhuma linha liga lugares; igreja, "Frequenta" em Saúde, Associação sem confirmação, escola sem "estuda aqui" e o 6º lugar são recusados no servidor; o ponto da pessoa não muda ao ligar lugares; Ctrl+K, impressão, CSV e e-mails não mostram lugares; o Comercial não recebe nada de fora do escopo; cópia, revogação e anonimização cobrem lugares, visitas e `link_referral`.
- **Acessibilidade:** axe sem violações graves; foco e Esc na gaveta do guia e na página da pessoa; `Meter` com texto; movimento reduzido respeitado; contraste AA; cores de situação sempre com ícone e texto; paleta do gráfico "Chegamos lá?" aprovada pelo validador do skill `dataviz` (colar a saída).
- **Desempenho:** Hoje não fica mais lenta (comparar o tamanho do pacote principal antes e depois); as APIs da Calculadora e da página respondem em menos de 500 ms com os dados de teste; nenhuma consulta passa de 100 parâmetros.
- **Sem internet:** a Calculadora e a página dizem "Sem conexão" em vez de mostrar números velhos, e o cadastro em campo continua funcionando.
- **Publicação:** a cada etapa, publicar no ambiente de teste (`publicar-teste.yml`, que aplica as migrações no D1) e atualizar `docs/guia-do-mapeador.md`, `/guia` (`lib/mapper-guide.ts`) e `docs/kit-de-lancamento.md`.

## Entrega

Uma etapa por vez, cada uma com: o que mudou (em palavras simples), capturas antes/depois, testes e o que vem a seguir. Commit e push na branch `claude/executar-projeto-2ehft2`, sem abrir PR.

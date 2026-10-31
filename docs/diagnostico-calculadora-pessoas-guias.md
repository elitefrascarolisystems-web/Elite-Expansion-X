# Etapa 0 — Diagnóstico da Calculadora, da página de cada pessoa e do guia em cada aba (31/10/2026)

Entrega da Etapa 0 do `docs/prompt-calculadora-pessoas-guias.md`. Levantamento feito no código e no banco local de TESTE, só para leitura. Nenhuma tela foi alterada.

> **Repositório público.** Este documento traz só números do banco local de teste, que é carga de teste. Nenhum número real e nenhum nome de pessoa ou de local entra aqui nem em log do GitHub. Os números do ambiente publicado você roda no painel da Cloudflare e cola na conversa (parte 2.2).

---

## O que preciso de você

1. **As anotações da semana de uso real** (parte 1), coladas na conversa, sem nomes de pessoas.
2. **As consultas da parte 2.2**, rodadas no painel da Cloudflare, com o resultado colado na conversa.
3. **A sua resposta às decisões da parte 5.1**: "aprovo" ou o que muda em cada linha.
4. **O exemplo da Calculadora (parte 5.2) e o texto das dicas (parte 5.3)**: "aprovo" ou o que muda.

Nada da Etapa 1 começa antes disso.

---

## 1. Retorno da semana de uso real

**Aguardando as suas anotações.** O roteiro (`docs/roteiro-primeira-semana.md`) pede para a equipe anotar e mandar para mim. Eu não acesso o ambiente publicado, então dependo do que você colar na conversa.

Como mandar, por função (Administrador, Coordenação, Líder, Comercial, Embaixador e Mentorado), sem nomes de pessoas:

- **Onde travou:** a tela e o botão em que a pessoa parou.
- **O que não entendeu:** a palavra, o número ou o passo que confundiu.
- **O que faltou:** o que ela procurou e não achou.

Com as anotações, separo:

- o que se resolve em até 1 dia, que entra como ajuste rápido na Etapa 1;
- o que muda o plano, que volta para você antes de seguir. Por exemplo: se achar e acompanhar pessoas for mais urgente que a meta, a Página da pessoa (Etapa 4) vem antes da Calculadora (Etapas 2 e 3).

---

## 2. Números dos dados

Rodei as consultas só para leitura, para a Elite (organização 1), em 30/10/2026. Elas seguem as regras do prompt: só atendimentos válidos; só pagamentos com data; a importação fica fora das taxas em que a data é retroativa; e o dia de cada data é o de Brasília. Também conferi as consultas num banco sintético com importação, cidade em Consolidado, outra empresa e datas em três formatos (com "-03:00", da importação ao meio-dia e em UTC sem fuso): o resultado bateu com um cálculo independente. O quarto formato, só o dia, aparece em visitas e atividades, que estas consultas não leem.

### 2.1 No banco local de TESTE

O banco local tem uma semana de dados (20 a 25/10/2026). Por isso, quase tudo dá "Sem dados suficientes", como devia. Estes números só servem para conferir as consultas, nunca como premissa.

**Taxas da Calculadora**

| Taxa | No banco local | Mínimo | Resultado |
|---|---|---|---|
| Ticket médio | 4 vendas pagas com valor | 5 vendas | Sem dados suficientes |
| Conversão (atendimentos de 02/06 a 31/08) | Nenhum atendimento | 30 atendimentos e 3 pagamentos | Sem dados suficientes |
| Tempo até pagar | 5 vendas, mediana de 0 dia | 5 vendas | Passa no mínimo, mas é dado de teste: as vendas foram pagas no mesmo dia do atendimento |
| Ritmo | 5 vendas em 1,43 semana | 2 semanas | Sem dados suficientes; com os mesmos dados, passaria a valer em 03/11 |
| Atendimentos novos por semana | 30 em 1,43 semana: indicação 1, mídia 0, mapeamento 15, outros 14 | 4 semanas | Sem dados suficientes |
| Pessoas mapeadas por semana (aproximação) | 31 pessoas e 5 mapeadores em 1,43 semana | 1 mapeador e 4 semanas | Sem dados suficientes; o número que a Calculadora vai usar só existe depois da coluna de origem (Etapa 2) |
| Pessoa mapeada → atendimento (pessoas de 02/07 a 30/09) | Nenhuma pessoa | 30 pessoas e 3 atendimentos | Sem dados suficientes |
| Vendedores e capacidade | 5 vendedores; a melhor semana de uma pessoa teve 6 atendimentos novos | 4 semanas | Sem dados suficientes |
| Clientes e indicações por cliente | 5 clientes e 1 indicação | 5 clientes e 2 indicações | Sem dados suficientes |
| Custo por atendimento de mídia (julho a setembro) | R$ 0 e nenhum atendimento de mídia | Custo maior que zero e 10 atendimentos | Sem dados suficientes |

**Dados a conferir**

| O que mede | No banco local | O que fazer |
|---|---|---|
| Vendas pagas salvas de novo (a data do pagamento mudou) | 0 | Nada a corrigir no passado do teste. O conserto de `record_sale` vale daqui para frente. |
| Vendas e atendimentos importados pela planilha da rede | 0 | Nada. |
| Atendimentos sem oportunidade | 16 de 35 (13 dos 30 válidos) | Contam para quem está com eles na Agenda (parte 5.1). |
| Vendas pagas sem oportunidade | 0 de 5 | Nada. |
| Atendimentos cujo responsável não é login ativo da equipe | 9 (com 9 e-mails diferentes) | Não contam como vendedor nem na meta de ninguém: entram em "sem responsável" (parte 5.1). Nada a fazer agora. |
| Cidades em modo Consolidado | 0 de 9 | O padrão do banco é Consolidado, mas o cadastro pela tela cria em Detalhado. Cidade em Consolidado fica fora das taxas. |
| Cidades com "Meta de vendas" diferente de 100 | 2, com os valores 20 e 30 | Você decide se viram meta (parte 5.1). |
| Responsável diferente entre oportunidade e atendimento | 0 de 19 | Nada. |
| Locais sem setor com pessoas ligadas | 1 local, com 1 pessoa | Entra em "A revisar" (Etapa 5). |
| Pessoas ligadas a igreja, a Saúde fora do trabalho, a Associação / entidade ou a escola com "Frequenta" | 0 em todos os grupos | Nada. |
| Locais com nome ou "Atividade" de igreja, clínica, sindicato, condomínio e parecidos, sem o setor certo | 0 | Nada. |

**O que mais apareceu nos dados de teste**

- 300 das 353 pessoas da Elite são carga de teste em lote, cadastradas por "teste" e não por um login. A aproximação de pessoas mapeadas deixa essa carga de fora.
- Uma das 5 vendas pagas tem valor R$ 0 e fica fora do ticket.
- Uma venda paga está num atendimento na etapa "Proposta". Por isso a Calculadora conta só o pagamento, nunca a etapa "Ganho".
- Três vendas apagadas ainda aparecem na auditoria. Todas as datas de atendimentos, vendas e pessoas estão no formato com "-03:00".

### 2.2 Para você rodar no ambiente publicado (painel da Cloudflare)

As consultas abaixo só leem: não mudam nada no banco. As consultas 1 a 4 e a 6 devolvem uma linha só, com totais da Elite (organização 1), sem nenhum nome. A consulta 5 é opcional e é a única exceção: ela lista os locais da Elite a revisar, com o nome de cada um. Rode só se quiser revisar antes da Etapa 5; senão, a mesma lista aparece para a gestão no filtro "A revisar" de Território → Locais.

**Passo a passo**

1. Entre em dash.cloudflare.com com a conta da Elite.
2. No menu da esquerda, abra **Storage & Databases** e depois **D1 SQL Database**.
3. Clique no banco **elite-expansion-x-teste**.
4. Abra a aba **Console**.
5. Copie a consulta 1 inteira. No GitHub, use o botão de copiar no canto de cima, à direita, do quadro da consulta: assim nenhuma linha fica para trás. Cole no Console e clique em **Execute**.
6. O resultado vem numa tabela larga, com uma coluna para cada número (a consulta 1 tem 28). Selecione a tabela inteira, com a linha de cima, que traz os nomes das colunas, copie e cole aqui na conversa. Se não der para selecionar, mande capturas de tela até a última coluna. Repita com as outras consultas.

Cole os resultados só na conversa, nunca num arquivo do repositório: ele é público.

**Consulta 1: Calculadora: amostras de vendas, atendimentos e mídia (ticket, conversão, tempo até pagar e mediana, ritmo, atendimentos por semana e origem, custo por atendimento de mídia)**

```sql
WITH h AS (SELECT date('now', '-3 hours') AS hoje),
ld AS (
  SELECT l.id, l.status, l.channel, l.source_label, l.person_id, l.consent_revoked_at,
    (l.source_label = 'Importação da rede por planilha') AS imp,
    CASE WHEN length(l.created_at) = 10 THEN l.created_at WHEN l.created_at LIKE '%-03:00' THEN substr(l.created_at, 1, 10) ELSE date(l.created_at, '-3 hours') END AS dia
  FROM leads l JOIN cities c ON c.id = l.city_id AND c.organization_id = 1 AND c.tracking_mode = 'Detalhado'
),
sd AS (
  SELECT s.lead_id, s.amount_cents, (s.created_at LIKE '____-__-__ 12:00:00') AS imp,
    CASE WHEN length(s.paid_at) = 10 THEN s.paid_at WHEN s.paid_at LIKE '%-03:00' THEN substr(s.paid_at, 1, 10) ELSE date(s.paid_at, '-3 hours') END AS dia
  FROM sales s JOIN cities c ON c.id = s.city_id AND c.organization_id = 1 AND c.tracking_mode = 'Detalhado'
  WHERE s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND s.paid_at <> ''
),
sem AS (
  SELECT hoje, inicio, (julianday(hoje) - julianday(inicio)) / 7.0 AS s FROM (
    SELECT h.hoje, max(date(h.hoje, '-56 days'), coalesce((SELECT min(dia) FROM ld WHERE NOT imp), h.hoje)) AS inicio FROM h)
),
coorte AS (
  SELECT EXISTS (SELECT 1 FROM sd WHERE sd.lead_id = ld.id AND sd.dia <= date(ld.dia, '+60 days')) AS pago
  FROM ld, h
  WHERE ld.status IN ('Lead válido', 'Oportunidade') AND ld.consent_revoked_at IS NULL AND NOT ld.imp
    AND ld.dia BETWEEN date(h.hoje, '-150 days') AND date(h.hoje, '-60 days')
),
tp AS (
  SELECT julianday(sd.dia) - julianday(ld.dia) AS dias
  FROM sd JOIN ld ON ld.id = sd.lead_id, h
  WHERE NOT sd.imp AND NOT ld.imp AND sd.dia BETWEEN date(h.hoje, '-180 days') AND h.hoje AND julianday(sd.dia) >= julianday(ld.dia)
),
med AS (
  SELECT avg(dias) AS m FROM (
    SELECT dias FROM tp ORDER BY dias LIMIT 2 - (SELECT count(*) FROM tp) % 2 OFFSET (SELECT (count(*) - 1) / 2 FROM tp))
),
novos AS (
  SELECT CASE
      WHEN ld.channel = 'Indicação' OR EXISTS (SELECT 1 FROM territory_people p WHERE p.id = ld.person_id AND coalesce(p.referrer_id, '') <> '') THEN 'Indicação'
      WHEN ld.channel = 'Mídia paga' THEN 'Mídia'
      WHEN ld.source_label = 'Mapeamento' OR ld.source_label LIKE 'Mapeamento · %' THEN 'Mapeamento'
      ELSE 'Outros' END AS origem
  FROM ld, sem
  WHERE ld.status IN ('Lead válido', 'Oportunidade') AND NOT ld.imp AND ld.dia BETWEEN sem.inicio AND sem.hoje
),
mid AS (
  SELECT
    (SELECT coalesce(sum(x.amount_cents), 0) FROM costs x JOIN cities c ON c.id = x.city_id AND c.organization_id = 1 AND c.tracking_mode = 'Detalhado'
      WHERE (x.category = 'Mídia paga' OR x.channel = 'Mídia paga')
        AND substr(x.period, 1, 7) BETWEEN strftime('%Y-%m', h.hoje, 'start of month', '-3 months') AND strftime('%Y-%m', h.hoje, 'start of month', '-1 month')) AS custo,
    (SELECT count(*) FROM ld WHERE ld.channel = 'Mídia paga' AND ld.status IN ('Lead válido', 'Oportunidade')
      AND ld.dia BETWEEN date(h.hoje, 'start of month', '-3 months') AND date(h.hoje, 'start of month', '-1 day')) AS leads
  FROM h
),
tot AS (
  SELECT sem.hoje, sem.inicio, sem.s, med.m, mid.custo, mid.leads AS mid_leads,
    (SELECT count(*) FROM sd WHERE amount_cents > 0 AND dia BETWEEN date(sem.hoje, '-90 days') AND sem.hoje) AS t_n,
    (SELECT avg(amount_cents) FROM sd WHERE amount_cents > 0 AND dia BETWEEN date(sem.hoje, '-90 days') AND sem.hoje) AS t_media,
    (SELECT count(*) FROM coorte) AS c_base,
    (SELECT coalesce(sum(pago), 0) FROM coorte) AS c_pagos,
    (SELECT count(*) FROM tp) AS m_n,
    (SELECT count(*) FROM sd WHERE dia BETWEEN sem.inicio AND sem.hoje) AS v_n,
    (SELECT count(*) FROM novos) AS n_total,
    (SELECT count(*) FROM novos WHERE origem = 'Indicação') AS n_ind,
    (SELECT count(*) FROM novos WHERE origem = 'Mídia') AS n_mid,
    (SELECT count(*) FROM novos WHERE origem = 'Mapeamento') AS n_map,
    (SELECT count(*) FROM novos WHERE origem = 'Outros') AS n_out
  FROM sem, med, mid
)
SELECT
  hoje,
  t_n AS ticket_vendas,
  round(t_media / 100.0, 2) AS ticket_reais,
  CASE WHEN t_n >= 5 THEN 'ok' ELSE 'Sem dados suficientes' END AS ticket_amostra,
  c_base AS conversao_base,
  c_pagos AS conversao_pagos_60d,
  round(100.0 * c_pagos / nullif(c_base, 0), 1) AS conversao_pct,
  CASE WHEN c_base >= 30 AND c_pagos >= 3 THEN 'ok' ELSE 'Sem dados suficientes' END AS conversao_amostra,
  m_n AS tempo_vendas,
  m AS tempo_mediana_bruta,
  CASE WHEN m IS NULL THEN NULL WHEN m > 90 THEN 90 ELSE CAST(m AS INTEGER) + (m > CAST(m AS INTEGER)) END AS tempo_mediana_dias,
  CASE WHEN m_n >= 5 THEN 'ok' ELSE 'Sem dados suficientes' END AS tempo_amostra,
  inicio AS semanas_desde,
  round(s, 2) AS semanas_cobertas,
  v_n AS ritmo_vendas,
  round(v_n / nullif(s, 0), 2) AS ritmo_por_semana,
  CASE WHEN s >= 2 THEN 'ok' ELSE 'Sem dados suficientes' END AS ritmo_amostra,
  n_total AS atend_novos,
  round(n_total / nullif(s, 0), 2) AS atend_por_semana,
  n_ind AS origem_indicacao,
  n_mid AS origem_midia,
  n_map AS origem_mapeamento,
  n_out AS origem_outros,
  CASE WHEN s >= 4 THEN 'ok' ELSE 'Sem dados suficientes' END AS atend_amostra,
  custo AS midia_custo_centavos,
  mid_leads AS midia_atendimentos,
  round(custo / 100.0 / nullif(mid_leads, 0), 2) AS cpl_reais,
  CASE WHEN custo > 0 AND mid_leads >= 10 THEN 'ok' ELSE 'Sem dados suficientes' END AS cpl_amostra
FROM tot
```

**Consulta 2: Calculadora: mapeamento (aproximação), pessoa mapeada → atendimento, vendedores e capacidade, clientes e indicações**

```sql
WITH h AS (SELECT date('now', '-3 hours') AS hoje),
ld AS (
  SELECT l.id, l.status, l.channel, l.person_id, l.consent_revoked_at, lower(trim(l.assigned_to_email)) AS resp,
    (l.source_label = 'Importação da rede por planilha') AS imp,
    CASE WHEN length(l.created_at) = 10 THEN l.created_at WHEN l.created_at LIKE '%-03:00' THEN substr(l.created_at, 1, 10) ELSE date(l.created_at, '-3 hours') END AS dia
  FROM leads l JOIN cities c ON c.id = l.city_id AND c.organization_id = 1 AND c.tracking_mode = 'Detalhado'
),
sem AS (
  SELECT hoje, inicio, (julianday(hoje) - julianday(inicio)) / 7.0 AS s FROM (
    SELECT h.hoje, max(date(h.hoje, '-56 days'), coalesce((SELECT min(dia) FROM ld WHERE NOT imp), h.hoje)) AS inicio FROM h)
),
pm AS (
  SELECT p.id, lower(p.created_by) AS quem,
    CASE WHEN length(p.created_at) = 10 THEN p.created_at WHEN p.created_at LIKE '%-03:00' THEN substr(p.created_at, 1, 10) ELSE date(p.created_at, '-3 hours') END AS dia,
    (EXISTS (SELECT 1 FROM leads l WHERE l.person_id = p.id AND l.source_label LIKE 'Mapeamento%')
      OR EXISTS (SELECT 1 FROM territory_roles r WHERE r.person_id = p.id AND r.source = 'Mapeamento guiado')) AS com_prova
  FROM territory_people p JOIN cities c ON c.id = p.city_id AND c.organization_id = 1 AND c.tracking_mode = 'Detalhado'
  WHERE p.created_by LIKE '%@%'
    AND NOT EXISTS (SELECT 1 FROM territory_roles r WHERE r.person_id = p.id AND (r.source LIKE 'Importação%' OR r.source = 'Acesso ao portal de mentoria'))
    AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.person_id = p.id AND (l.source_label = 'Importação da rede por planilha' OR (l.channel = 'Indicação' AND l.source_label LIKE '%(mentorado)')))
    AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.person_id = p.id AND l.source_label NOT LIKE 'Mapeamento%' AND abs(julianday(l.created_at) - julianday(p.created_at)) * 86400 < 5)
    AND NOT EXISTS (SELECT 1 FROM ambassadors a WHERE a.person_id = p.id AND abs(julianday(a.created_at) - julianday(p.created_at)) * 86400 < 5)
),
spm AS (
  SELECT hoje, inicio, (julianday(hoje) - julianday(inicio)) / 7.0 AS s FROM (
    SELECT h.hoje, max(date(h.hoje, '-56 days'), coalesce((SELECT min(dia) FROM pm), h.hoje)) AS inicio FROM h)
),
ult AS (SELECT pm.* FROM pm, spm WHERE pm.dia BETWEEN spm.inicio AND spm.hoje),
cpm AS (
  SELECT EXISTS (SELECT 1 FROM ld WHERE ld.person_id = pm.id AND ld.status IN ('Lead válido', 'Oportunidade') AND ld.dia <= date(pm.dia, '+30 days')) AS virou
  FROM pm, h WHERE pm.dia BETWEEN date(h.hoje, '-120 days') AND date(h.hoje, '-30 days')
),
eq AS (
  SELECT ld.resp, ld.dia FROM ld
  WHERE ld.status IN ('Lead válido', 'Oportunidade') AND NOT ld.imp AND ld.resp <> ''
    AND ld.resp IN (SELECT lower(trim(u.email)) FROM app_users u WHERE u.organization_id = 1 AND u.active = 1 AND u.role IN ('Administrador', 'Coordenação', 'Líder', 'Comercial'))
),
semana AS (
  SELECT eq.resp, date(eq.dia, 'weekday 0', '-6 days') AS seg, count(*) AS n
  FROM eq, h WHERE eq.dia BETWEEN date(h.hoje, '-90 days') AND h.hoje GROUP BY 1, 2
),
tot AS (
  SELECT sem.s, spm.inicio AS pm_inicio, spm.s AS pm_s,
    (SELECT count(*) FROM ult) AS pm_n,
    (SELECT count(*) FROM ult WHERE com_prova) AS pm_prova,
    (SELECT count(DISTINCT quem) FROM ult) AS nm,
    (SELECT count(*) FROM cpm) AS a_base,
    (SELECT coalesce(sum(virou), 0) FROM cpm) AS a_n,
    (SELECT count(DISTINCT eq.resp) FROM eq WHERE eq.dia BETWEEN date(sem.hoje, '-56 days') AND sem.hoje) AS nv,
    (SELECT max(n) FROM semana) AS kv,
    (SELECT count(DISTINCT coalesce(ld.person_id, 'lead:' || ld.id)) FROM ld WHERE ld.consent_revoked_at IS NULL
      AND EXISTS (SELECT 1 FROM sales s WHERE s.lead_id = ld.id AND s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND s.paid_at <> '')) AS clientes,
    (SELECT count(*) FROM ld WHERE ld.status IN ('Lead válido', 'Oportunidade') AND NOT ld.imp AND ld.dia BETWEEN sem.inicio AND sem.hoje
      AND (ld.channel = 'Indicação' OR EXISTS (SELECT 1 FROM territory_people p WHERE p.id = ld.person_id AND coalesce(p.referrer_id, '') <> ''))) AS ind
  FROM sem, spm
)
SELECT
  pm_n AS mapeadas_aprox,
  pm_prova AS mapeadas_com_prova,
  nm AS mapeadores,
  pm_inicio AS mapeadas_desde,
  round(pm_s, 2) AS mapeadas_semanas,
  round(pm_n / nullif(pm_s, 0), 2) AS mapeadas_por_semana,
  round(pm_n / nullif(pm_s, 0) / nullif(nm, 0), 2) AS por_mapeador_semana,
  CASE WHEN nm >= 1 AND pm_s >= 4 THEN 'ok' ELSE 'Sem dados suficientes' END AS mapeadas_amostra,
  a_base AS mapeada_base,
  a_n AS mapeada_com_atendimento,
  round(100.0 * a_n / nullif(a_base, 0), 1) AS mapeada_atendimento_pct,
  CASE WHEN a_base >= 30 AND a_n >= 3 THEN 'ok' ELSE 'Sem dados suficientes' END AS mapeada_amostra,
  nv AS vendedores_ativos,
  kv AS capacidade_melhor_semana,
  CASE WHEN s >= 4 THEN 'ok' ELSE 'Sem dados suficientes' END AS vendedores_amostra,
  clientes,
  ind AS indicacoes,
  round(ind / nullif(s, 0) / nullif(clientes, 0) * 30.0 / 7.0, 3) AS indicacoes_por_cliente_mes,
  CASE WHEN clientes >= 5 AND ind >= 2 THEN 'ok' ELSE 'Sem dados suficientes' END AS indicacoes_amostra
FROM tot
```

**Consulta 3: Dados a conferir: vendas pagas salvas de novo, importação, oportunidades, cidades em Consolidado, Meta de vendas, responsáveis diferentes e datas**

```sql
WITH h AS (SELECT date('now', '-3 hours') AS hoje),
ld AS (
  SELECT l.id, l.status, l.source_label, l.assigned_to_email, l.created_at, c.tracking_mode
  FROM leads l JOIN cities c ON c.id = l.city_id AND c.organization_id = 1
),
sv AS (
  SELECT s.id, s.lead_id, s.status, s.paid_at, s.created_at, c.tracking_mode,
    (s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND s.paid_at <> '') AS paga,
    (s.created_at LIKE '____-__-__ 12:00:00' OR EXISTS (SELECT 1 FROM leads li WHERE li.id = s.lead_id AND li.source_label = 'Importação da rede por planilha')) AS imp
  FROM sales s JOIN cities c ON c.id = s.city_id AND c.organization_id = 1
),
op AS (SELECT o.lead_id, o.owner_email FROM opportunities o WHERE o.organization_id = 1),
au AS (
  SELECT entity_id, count(*) AS n FROM audit_logs
  WHERE organization_id = 1 AND entity_type = 'sale' AND summary = 'Venda atualizada para Pagamento confirmado.'
  GROUP BY entity_id
)
SELECT
  (SELECT count(*) FROM au) AS vendas_com_confirmacao_na_auditoria,
  (SELECT count(*) FROM au WHERE n > 1) AS vendas_pagas_salvas_mais_de_uma_vez,
  (SELECT coalesce(sum(n - 1), 0) FROM au WHERE n > 1) AS confirmacoes_repetidas,
  (SELECT count(*) FROM au WHERE n > 1 AND au.entity_id IN (SELECT id FROM sv WHERE paga)) AS dessas_pagas_hoje,
  (SELECT count(*) FROM au WHERE au.entity_id NOT IN (SELECT id FROM sales)) AS vendas_apagadas_com_confirmacao,
  (SELECT count(*) FROM sv WHERE imp) AS vendas_importadas,
  (SELECT count(*) FROM sv WHERE imp AND paga) AS vendas_pagas_importadas,
  (SELECT count(*) FROM ld WHERE source_label = 'Importação da rede por planilha') AS atendimentos_importados,
  (SELECT count(*) FROM ld) AS atendimentos_total,
  (SELECT count(*) FROM ld WHERE id NOT IN (SELECT lead_id FROM op)) AS atendimentos_sem_oportunidade,
  (SELECT count(*) FROM ld WHERE status IN ('Lead válido', 'Oportunidade') AND id NOT IN (SELECT lead_id FROM op)) AS validos_sem_oportunidade,
  (SELECT count(*) FROM sv WHERE paga) AS vendas_pagas_total,
  (SELECT count(*) FROM sv WHERE paga AND lead_id NOT IN (SELECT lead_id FROM op)) AS vendas_pagas_sem_oportunidade,
  (SELECT count(*) FROM sv WHERE lead_id NOT IN (SELECT id FROM leads)) AS vendas_sem_atendimento,
  (SELECT count(*) FROM cities WHERE organization_id = 1) AS cidades_total,
  (SELECT count(*) FROM cities WHERE organization_id = 1 AND tracking_mode = 'Consolidado') AS cidades_consolidado,
  (SELECT count(*) FROM ld WHERE tracking_mode <> 'Detalhado') AS atendimentos_em_consolidado,
  (SELECT count(*) FROM sv WHERE paga AND tracking_mode <> 'Detalhado') AS vendas_pagas_em_consolidado,
  (SELECT count(*) FROM cities WHERE organization_id = 1 AND sales_goal <> 100) AS cidades_meta_diferente_100,
  (SELECT group_concat(sales_goal, ', ') FROM (SELECT sales_goal FROM cities WHERE organization_id = 1 AND sales_goal <> 100 ORDER BY sales_goal)) AS valores_meta,
  (SELECT count(*) FROM op JOIN ld ON ld.id = op.lead_id WHERE lower(trim(op.owner_email)) <> lower(trim(ld.assigned_to_email))) AS responsaveis_diferentes,
  (SELECT count(*) FROM op JOIN ld ON ld.id = op.lead_id WHERE trim(ld.assigned_to_email) = '' AND trim(op.owner_email) <> '') AS dos_quais_atendimento_sem_responsavel,
  (SELECT count(*) FROM sv, h WHERE paga AND (CASE WHEN length(sv.paid_at) = 10 THEN sv.paid_at WHEN sv.paid_at LIKE '%-03:00' THEN substr(sv.paid_at, 1, 10) ELSE date(sv.paid_at, '-3 hours') END) > h.hoje) AS vendas_pagas_com_data_futura,
  (SELECT count(*) FROM ld WHERE length(created_at) NOT IN (10, 19, 25) OR date(substr(created_at, 1, 10)) IS NULL) AS atendimentos_data_fora_do_formato,
  (SELECT count(*) FROM sv WHERE paga AND (length(paid_at) NOT IN (10, 19, 25) OR date(substr(paid_at, 1, 10)) IS NULL)) AS pagamentos_data_fora_do_formato
```

**Consulta 4: Locais e vínculos sensíveis (só totais): locais sem setor com pessoas, pessoas por grupo sensível, locais de nome suspeito**

```sql
WITH lig AS (
  SELECT b.id AS local_id, b.place_type AS tipo, trim(b.sector) AS setor, p.place_link AS vinculo
  FROM territory_people p
  JOIN cities c ON c.id = p.city_id AND c.organization_id = 1
  JOIN businesses b ON b.id = p.place_id AND b.organization_id = 1
),
sus AS (
  SELECT b.id,
    ((b.name LIKE '%igreja%' OR b.segment LIKE '%igreja%' OR b.name LIKE '%templo%' OR b.segment LIKE '%templo%') AND trim(b.sector) <> 'Religioso') AS religioso,
    ((b.name LIKE '%sindicato%' OR b.segment LIKE '%sindicato%' OR b.name LIKE '%partido%' OR b.segment LIKE '%partido%') AND trim(b.sector) <> 'Associação / entidade') AS entidade,
    ((b.name LIKE '%cl_nica%' OR b.segment LIKE '%cl_nica%' OR b.name LIKE '%hospital%' OR b.segment LIKE '%hospital%') AND trim(b.sector) <> 'Saúde') AS saude,
    (b.name LIKE '%condom_nio%' OR b.segment LIKE '%condom_nio%' OR b.name LIKE '%residencial%' OR b.segment LIKE '%residencial%') AS moradia
  FROM businesses b JOIN cities c ON c.id = b.city_id AND c.organization_id = 1
  WHERE b.organization_id = 1
)
SELECT
  (SELECT count(*) FROM sus) AS locais_total,
  (SELECT count(DISTINCT local_id) FROM lig) AS locais_com_pessoas,
  (SELECT count(*) FROM lig) AS pessoas_ligadas_a_locais,
  (SELECT count(DISTINCT local_id) FROM lig WHERE setor = '') AS locais_sem_setor_com_pessoas,
  (SELECT count(*) FROM lig WHERE setor = '') AS pessoas_em_locais_sem_setor,
  (SELECT count(*) FROM lig WHERE setor = 'Religioso') AS pessoas_religioso,
  (SELECT count(*) FROM lig WHERE setor = 'Saúde' AND vinculo IN ('Frequenta', 'Membro do network', 'Mentorado')) AS pessoas_saude_fora_do_trabalho,
  (SELECT count(*) FROM lig WHERE setor = 'Associação / entidade') AS pessoas_associacao_entidade,
  (SELECT count(*) FROM lig WHERE (tipo = 'Instituição de ensino' OR setor = 'Educação') AND vinculo = 'Frequenta') AS pessoas_ensino_frequenta,
  (SELECT count(*) FROM sus WHERE religioso OR entidade OR saude OR moradia) AS locais_nome_suspeito,
  (SELECT count(*) FROM sus WHERE religioso) AS suspeito_igreja_templo,
  (SELECT count(*) FROM sus WHERE entidade) AS suspeito_sindicato_partido,
  (SELECT count(*) FROM sus WHERE saude) AS suspeito_clinica_hospital,
  (SELECT count(*) FROM sus WHERE moradia) AS suspeito_condominio_residencial,
  (SELECT count(*) FROM lig WHERE local_id IN (SELECT id FROM sus WHERE religioso OR entidade OR saude OR moradia)) AS pessoas_em_locais_suspeitos
```

**Consulta 5 (opcional): lista de locais a revisar.** Traz nomes de locais e cidades: cole o resultado só na conversa.

```sql
SELECT cidade, local, atividade, tipo, setor, pessoas_ligadas,
  trim(
    CASE WHEN religioso THEN 'fala em igreja ou templo sem o setor Religioso; ' ELSE '' END ||
    CASE WHEN entidade THEN 'fala em sindicato ou partido sem o setor Associação / entidade; ' ELSE '' END ||
    CASE WHEN saude THEN 'fala em clínica ou hospital sem o setor Saúde; ' ELSE '' END ||
    CASE WHEN moradia THEN 'fala em condomínio ou residencial (moradia); ' ELSE '' END ||
    CASE WHEN setor = '' AND pessoas_ligadas > 0 THEN 'sem setor e com pessoas ligadas; ' ELSE '' END ||
    CASE WHEN setor = 'Religioso' AND pessoas_ligadas > 0 THEN 'Religioso com pessoas ligadas; ' ELSE '' END ||
    CASE WHEN setor = 'Saúde' AND fora_trabalho > 0 THEN 'Saúde com vínculo fora do trabalho; ' ELSE '' END ||
    CASE WHEN setor = 'Associação / entidade' AND pessoas_ligadas > 0 THEN 'Associação / entidade com pessoas ligadas; ' ELSE '' END ||
    CASE WHEN (tipo = 'Instituição de ensino' OR setor = 'Educação') AND frequenta > 0 THEN 'ensino com Frequenta; ' ELSE '' END,
  '; ') AS motivo
FROM (
  SELECT c.name AS cidade, b.name AS local, b.segment AS atividade, b.place_type AS tipo, trim(b.sector) AS setor,
    (SELECT count(*) FROM territory_people p JOIN cities pc ON pc.id = p.city_id AND pc.organization_id = 1 WHERE p.place_id = b.id) AS pessoas_ligadas,
    (SELECT count(*) FROM territory_people p JOIN cities pc ON pc.id = p.city_id AND pc.organization_id = 1 WHERE p.place_id = b.id AND p.place_link IN ('Frequenta', 'Membro do network', 'Mentorado')) AS fora_trabalho,
    (SELECT count(*) FROM territory_people p JOIN cities pc ON pc.id = p.city_id AND pc.organization_id = 1 WHERE p.place_id = b.id AND p.place_link = 'Frequenta') AS frequenta,
    ((b.name LIKE '%igreja%' OR b.segment LIKE '%igreja%' OR b.name LIKE '%templo%' OR b.segment LIKE '%templo%') AND trim(b.sector) <> 'Religioso') AS religioso,
    ((b.name LIKE '%sindicato%' OR b.segment LIKE '%sindicato%' OR b.name LIKE '%partido%' OR b.segment LIKE '%partido%') AND trim(b.sector) <> 'Associação / entidade') AS entidade,
    ((b.name LIKE '%cl_nica%' OR b.segment LIKE '%cl_nica%' OR b.name LIKE '%hospital%' OR b.segment LIKE '%hospital%') AND trim(b.sector) <> 'Saúde') AS saude,
    (b.name LIKE '%condom_nio%' OR b.segment LIKE '%condom_nio%' OR b.name LIKE '%residencial%' OR b.segment LIKE '%residencial%') AS moradia
  FROM businesses b JOIN cities c ON c.id = b.city_id AND c.organization_id = 1
  WHERE b.organization_id = 1
) x
WHERE religioso OR entidade OR saude OR moradia
  OR (setor = '' AND pessoas_ligadas > 0)
  OR (setor IN ('Religioso', 'Associação / entidade') AND pessoas_ligadas > 0)
  OR (setor = 'Saúde' AND fora_trabalho > 0)
  OR ((tipo = 'Instituição de ensino' OR setor = 'Educação') AND frequenta > 0)
ORDER BY cidade, local
```

**Consulta 6 (opcional): vendedores ativos e atendimentos com responsável sem login**

```sql
WITH h AS (SELECT date('now', '-3 hours') AS hoje),
ld AS (
  SELECT l.status, lower(trim(l.assigned_to_email)) AS resp,
    CASE WHEN length(l.created_at) = 10 THEN l.created_at WHEN l.created_at LIKE '%-03:00' THEN substr(l.created_at, 1, 10) ELSE date(l.created_at, '-3 hours') END AS dia
  FROM leads l JOIN cities c ON c.id = l.city_id AND c.organization_id = 1 AND c.tracking_mode = 'Detalhado'
  WHERE l.source_label <> 'Importação da rede por planilha'
),
sem AS (
  SELECT hoje, inicio, (julianday(hoje) - julianday(inicio)) / 7.0 AS s FROM (
    SELECT h.hoje, max(date(h.hoje, '-56 days'), coalesce((SELECT min(dia) FROM ld), h.hoje)) AS inicio FROM h)
),
eq AS (
  SELECT ld.resp, ld.dia FROM ld
  WHERE ld.status IN ('Lead válido', 'Oportunidade') AND ld.resp <> ''
    AND ld.resp IN (SELECT lower(trim(u.email)) FROM app_users u WHERE u.organization_id = 1 AND u.active = 1 AND u.role IN ('Administrador', 'Coordenação', 'Líder', 'Comercial'))
),
semana AS (
  SELECT eq.resp, date(eq.dia, 'weekday 0', '-6 days') AS seg, count(*) AS n
  FROM eq, h WHERE eq.dia BETWEEN date(h.hoje, '-90 days') AND h.hoje GROUP BY 1, 2
)
SELECT
  (SELECT count(DISTINCT eq.resp) FROM eq WHERE eq.dia BETWEEN date(sem.hoje, '-56 days') AND sem.hoje) AS vendedores_ativos,
  (SELECT max(n) FROM semana) AS capacidade_melhor_semana,
  (SELECT count(DISTINCT ld.resp) FROM ld WHERE ld.status IN ('Lead válido', 'Oportunidade') AND ld.resp <> '' AND ld.dia BETWEEN date(sem.hoje, '-56 days') AND sem.hoje
    AND ld.resp NOT IN (SELECT resp FROM eq)) AS responsaveis_fora_da_equipe,
  round(sem.s, 2) AS semanas_cobertas,
  CASE WHEN sem.s >= 4 THEN 'ok' ELSE 'Sem dados suficientes' END AS vendedores_amostra
FROM sem
```


### 2.3 O que isso muda no plano

- **Nas primeiras semanas, quase tudo vai dar "Sem dados suficientes".** O ritmo passa a valer com 2 semanas de uso; atendimentos, vendedores e mapeadores, com 4; a conversão, só com atendimentos de 60 a 150 dias atrás. As suas estimativas mantêm a Calculadora útil até lá, e o guia dela explica isso.
- **Tempo até pagar de 0 dia** quer dizer venda registrada no mesmo dia do atendimento. Pelo prompt, com 5 vendas ou mais, a Calculadora usaria esse 0 como valor real e diria que dá para começar atendimentos até o próprio dia do prazo. Por isso proponho o ajuste 14 da parte 5.2: a tela avisa e oferece "Usar minha estimativa".
- **Responsáveis sem login** não entram na divisão da meta pela equipe (Etapa 3). A consulta 6 mostra quantos e-mails são. Com a regra da parte 5.1, as vendas deles aparecem em "sem responsável" em Metas e rotina, e o responsável se troca em "Etapa e autorização" de cada atendimento.
- **Cidade em Consolidado** fica fora das taxas. Se a consulta 3 mostrar alguma (coluna `cidades_consolidado`), veja qual é em Território → Cidades, na coluna "Fonte" da tabela Saúde das cidades. Antes de trocar, me avise aqui: ao mudar "Fonte dos indicadores" para Detalhado no cadastro da cidade, os fechamentos consolidados dela deixam de contar em todos os meses, e os números passados dessa cidade mudam na Visão geral e na Saúde das cidades.

---

## 3. Esboço em 390 px

Desenho simples, sem código, na largura de um celular. Os números são os do exemplo da Calculadora (Cidade Exemplo), que nunca é gravado no banco.

### 3.1 Calculadora (Resultados → Calculadora)

```
┌──────────────────────────────────────┐
│ Calculadora                 (?) Como │
│ [Este mês][Próximo mês][Até uma data]│
│ Onde: Cidade Exemplo ▾               │
├──────────────────────────────────────┤
│ Sua meta                             │
│ Quero [ 40 ] [vendas pagas ▾]        │
│ até [ 28/12 ]                        │
├──────────────────────────────────────┤
│ QUANTO FALTA                  ◔ 4/40 │
│ Faltam 36 vendas (≈ R$ 43.200)       │
│ em 56 dias                           │
│ No ritmo atual: 25/01, 28 dias depois│
│ entre 11/01 e 15/02                  │
├──────────────────────────────────────┤
│ O que precisa acontecer              │
│                    por semana  total │
│ Vendas             5             30  │
│   + 6 já em andamento até 16/11      │
│ Atendimentos novos 25 (hoje 15) 150  │
│   começar até 14/12                  │
│ Pessoas a mapear   72 (hoje 32) 432  │
│ Mapeadores         5 (+3)            │
│ Vendedores         3 (+1)            │
│ ⚠ O que trava: atendimentos; com 25  │
│   por semana, também vendedores      │
├──────────────────────────────────────┤
│ E se…?              Hoje  Com ajustes│
│ Vendedores  [−] 2 [+]                │
│ Mapeadores  [−] 2 [+]                │
│ Conversão   ━━●━━━━  20%             │
│ Indicações  ━●━━━━━  0,2 por mês     │
│ Chega em          25/01   25/01      │
│ [Voltar ao atual]                    │
├──────────────────────────────────────┤
│ O que mais ajuda       chega   ganha │
│ Conversão +5 pontos    11/01 14 dias │
│ +1 mapeador            11/01 14 dias │
│ Indicações +50%        19/01  6 dias │
│ +1 vendedor: sozinho não muda a data │
│   (falta atendimento)                │
│ Menor equipe: +3 mapeadores e        │
│ +1 vendedor, chega em 25/12          │
│ Cada linha com [Simular este]        │
├──────────────────────────────────────┤
│ Bônus da rede: ≈ 4 indicações        │
│ Chegamos lá?   (gráfico) [Ver tabela]│
│ ▸ Taxas da sua empresa               │
│ ▸ Como calculamos                    │
├──────────────────────────────────────┤
│ [Copiar resumo]  [Aplicar como meta] │ ← fixo
└──────────────────────────────────────┘
```

- Uma rolagem só. O rodapé com "Copiar resumo" fica fixo; "Aplicar como meta" chega na Etapa 3.
- "Chegamos lá?" tem o realizado em linha cheia, a projeção tracejada e marcada "Projeção", e a meta como linha de referência.
- Sem histórico, cada taxa diz "Sem dados suficientes: digite sua estimativa" no lugar do número.

### 3.2 Página da pessoa (tela cheia no celular)

```
┌──────────────────────────────────────┐
│ ← Voltar                    (?) Como │
│ Maria                                │
│ ● Cliente: pagamento confirmado      │
│ Cidade Exemplo · Centro              │
│ No mapa: Padaria Pão Dourado         │
│ [Ver no mapa] [Editar] [Copiar link] │
├──────────────────────────────────────┤
│ PRÓXIMO PASSO                        │
│ Maria comprou e ainda não indicou    │
│ ninguém.                             │
│ [      Pedir indicação      ]        │
├──────────────────────────────────────┤
│ [ Resumo ][ Lugares ][ Histórico ]   │
├──────────────────────────────────────┤
│ Atendimento                          │
│ Pago · com João                      │
│ Autorizou contato em 12/10 ·         │
│ WhatsApp · para mentoria             │
│ [Abrir acompanhamento] [Ver venda]   │
│                                      │
│ Rede                                 │
│ Indicada por Ana · Indicou 0         │
│ [Explorar ramo]                      │
│                                      │
│ Como abordar                         │
│ • Peça a indicação de outro dono,    │
│   um nome por vez.                   │
│ [Usar gancho de Indicação] [Copiar]  │
└──────────────────────────────────────┘
```

- Sem telefone nem e-mail na página: o envio continua pela ficha do atendimento.
- O botão do Próximo passo é a ação mais importante agora, a um toque.
- Em "Lugares" (Etapa 5), cada lugar mostra a situação ("Avançar: 1 cliente aqui"), o plano de plantio e "Registrar visita". Em "Histórico", só o dia, sem hora.

### 3.3 Cartão "Como usar" (1ª visita a uma aba)

```
┌──────────────────────────────────────┐
│ (?) Como usar: Agenda                │
│ Saber com quem falar hoje e quando   │
│ voltar. 1º: comece por "Atrasados".  │
│ [Ver como usar]                      │
│ [Fazer agora] [Entendi]              │
└──────────────────────────────────────┘
```

Ao tocar em "Ver como usar", a gaveta sobe de baixo:

```
┌──────────────────────────────────────┐
│ ━━━                                  │
│ Como usar: Agenda                    │
│ 1. Comece por "Atrasados" e depois   │
│    "Hoje".                           │
│ 2. Toque em "Abrir ficha" e use      │
│    "Usar gancho".                    │
│ 3. Depois da conversa, toque em      │
│    "Registrar retorno".              │
│ ┌ Exemplo ─────────────────────────┐ │
│ │ Carla estava atrasada desde      │ │
│ │ segunda. Você usou o gancho de   │ │
│ │ Retomada e registrou o retorno   │ │
│ │ para quinta.                     │ │
│ └──────────────────────────────────┘ │
│ Cuidado: a plataforma não envia      │
│ mensagens sozinha.                   │
│ [Fazer agora: Novo atendimento]      │
│ [Fechar]                             │
└──────────────────────────────────────┘
```

- No mapa, o cartão vira um chip pequeno no canto ("Como usar o mapa" e ×), acima do botão Legenda.
- Nunca aparece junto com as boas-vindas: na 1ª entrada, as boas-vindas vêm primeiro.
- O botão "Como usar" fica no cabeçalho da área e reabre a gaveta a qualquer hora.

---

## 4. Migrações previstas

Sempre no próximo número livre de `drizzle/`. Hoje a última é a `0027_territory_regions.sql`. Se o passo Toque no mapa entrar antes, os números andam um.

| Número provável | Etapa | O que muda | Cuidado no ambiente publicado |
|---|---|---|---|
| 0028 | 1 | Coluna `app_users.guides_seen` (texto, padrão vazio). | Só acrescenta uma coluna. |
| 0029 | 2 | Coluna `territory_people.source` (texto, padrão vazio) e o dia em que a origem passou a ser gravada, numa coluna nova de `settings` (por exemplo, `source_tracked_since`). O passado é preenchido só com prova. | Idempotente: só preenche onde a origem está vazia e pode rodar duas vezes sem mudar nada. |
| 0030 | 3 | Tabela `goals`, com `version`, e os índices. | Só cria. Nenhuma meta é gravada sozinha: a conversão da "Meta de vendas" das cidades só acontece com a sua aprovação. |
| 0031 | 5 | Tabela `person_places` e coluna `territory_actions.business_id`, com os índices. | Só cria e acrescenta. |
| 0032 | 6 | O dia em que a gestão confirmou qual pessoa do mapa é o mentorado, no login dele (`app_users`). | Só acrescenta uma coluna. Até a confirmação, o portal não mostra lugares. |

---

## 5. Decisões

### 5.1 Tabela de decisões

Responda "aprovo" ou diga o que muda em cada linha. A linha do Indicador você já decidiu.

| Decisão | Recomendação |
|---|---|
| O que da semana de uso real entra antes | O que se resolve em até 1 dia entra na Etapa 1. Se a semana mostrar que achar e acompanhar pessoas é mais urgente que a meta, a Página da pessoa (Etapa 4) vem antes da Calculadora (Etapas 2 e 3), e "Onde buscar" entra no fim da Etapa 2. |
| Significado de "Indicador" | **Já decidido por você:** fica a regra que a plataforma já calcula. Indicador é quem indicou alguém, mesmo sem ter comprado. Só os textos que dizem "comprou e indicou" e "Círculo dourado = comprou" são corrigidos (Etapa 1). O cálculo (`db/territory.ts`, `db/followup.ts`, `tests/network-levels.test.mjs`) e as cores do mapa não mudam. Como "Indicador" também é o 1º nível do programa de embaixadores, guias e página dizem "nível na rede". |
| Onde fica a Calculadora e quem usa | Em Resultados → Calculadora, para o Administrador (a empresa toda ou uma cidade), a Coordenação e o Líder (só a cidade deles). O Comercial vê só "Minha meta", em Hoje e em Metas e rotina, sem custos. Embaixador e Mentorado não veem. |
| Quem aplica a meta | O Administrador (a empresa ou qualquer cidade) e a Coordenação (a própria cidade), que já editam a cidade hoje. O Líder divide pela equipe uma meta já aplicada. O Comercial não aplica. A Assessoria Elite aplica como Administrador, e fica marcado no Histórico. |
| Que tipo de meta | Uma meta só (tabela `goals`), com começo e fim: vendas pagas ou receita confirmada, do dia 1º do mês até a data escolhida (o padrão é o mês). Pode ser da empresa, de uma cidade ou de uma pessoa. O plano grava junto as metas de atendimentos e de pessoas mapeadas. A meta diária de frios, quentes e contatos passa a se chamar "Rotina do dia", e a "Meta de embaixadores" fica como está. |
| "Meta de vendas" que já existe nas cidades | Hoje é um número sem prazo que nenhuma tela usa. Mostrar só as cidades da Elite com valor diferente do padrão 100 (no banco de teste, Esmeraldas 30 e Sete Lagoas 20) e transformar em meta só as que você confirmar. O campo sai do cadastro da cidade. Nas empresas assinantes nada é convertido: o Administrador de cada uma define a meta na Calculadora. |
| Salvar simulações | Não salvar: comparar "Hoje" e "Com ajustes" na própria tela, usar "Copiar resumo" e gravar só a meta aplicada, com as estimativas usadas. |
| Quanto histórico a Calculadora usa | Os últimos 90 dias. O ritmo de vendas e os atendimentos por semana olham as últimas 8 semanas, e o tempo até pagar, 180 dias. A conversão só conta atendimentos começados há mais de 60 dias, para dar tempo de a pessoa pagar. Com pouco histórico, a conta divide pelas semanas que existem, sem inventar as que faltam. Abaixo do mínimo, a tela diz "Sem dados suficientes" e pede a sua estimativa. Mínimos: conversão, 30 atendimentos e 3 pagamentos; ticket e tempo até pagar, 5 vendas; ritmo, 2 semanas; atendimentos por semana, vendedores e mapeadores, 4 semanas; pessoa mapeada → atendimento, 30 pessoas e 3 atendimentos; indicações, 5 clientes e 2 indicações; mídia, 10 atendimentos e custo maior que zero. |
| De quem é cada venda e cada atendimento na meta por pessoa | Do responsável que aparece em Metas e rotina. O atendimento que ainda não chegou lá conta para quem está com ele na Agenda. A venda sem ninguém responsável (as importadas pela planilha da rede) conta na cidade e na empresa e aparece como "sem responsável", fora da meta de cada pessoa. A venda cujo responsável não é login ativo da equipe também entra em "sem responsável", para a soma das pessoas fechar com o total da cidade (acréscimo desta Etapa 0). Se a parte 2 achar responsáveis diferentes, a partir da Etapa 3 trocar o responsável em "Etapa e autorização" troca também o da oportunidade, na mesma gravação; os que já divergem só mudam com a sua aprovação (`update_lead`, `opportunities.owner_email` e `leads.assigned_to_email`). |
| Consertos de dados | Hoje, quem salva de novo uma venda já paga troca a data do pagamento pela data em que salvou: isso é consertado já. As datas antigas só mudam com a sua aprovação, usando a primeira confirmação de pagamento que ficou no Histórico, e as vendas importadas pela planilha ficam como estão. Cada pessoa nova no mapa passa a guardar de onde veio (mapeamento, atendimento, portal, importação ou embaixador); nas antigas, só quando houver prova (`record_sale`, `territory_people.source`). |
| Calculadora no plano de assinatura | Incluída em todos os planos. Rever quando houver nomes e preços dos planos. |
| Como abre a Página da pessoa | Por cima da tela em que você está, com um link próprio que dá para copiar e enviar: painel largo no computador, tela cheia no celular. Sem aba nova. A busca rápida (Ctrl+K) abre a página (`&ficha=pessoa:<id>`). |
| Lugares: nome, limites e quem pode ter | "Lugares" (no guia, "lugares de relacionamento"), nunca "rota". Só estabelecimentos do mapa, na cidade da pessoa, até 5 contando o principal. Sem ordem, horário, frequência, linhas no mapa, GPS ou texto livre. Lugares além do principal só para quem autorizou contato ou é Mentorado ou Embaixador ativo, com a confirmação da pessoa a cada lugar. |
| Setores sensíveis (LGPD art. 5º, II e art. 11) | Igreja: nenhuma pessoa ligada, nem como local principal. Saúde: só quem trabalha lá. Associação / entidade: só com a confirmação "Não é sindicato, partido nem entidade religiosa". Escola: "Frequenta" só se a própria pessoa estuda ou trabalha lá. Para ligar pessoas, o local precisa ter setor ("Outro" vale; é um campo a mais só ao cadastrar local que não é Empresa). Vale também para o mapeamento, a edição, as importações, os planos e as visitas. Os vínculos antigos com igreja, ou com Saúde fora do trabalho, não são apagados: até a gestão revisar, a pessoa aparece no centro do bairro ou da cidade, e o nome do local some para quem não é gestão. Os outros vínculos antigos fora da regra (Associação / entidade, escola com "Frequenta" e local sem setor) continuam no ponto e entram em "A revisar". |
| Situação do lugar e plano | Situação automática pelas pessoas da rede ligadas ao lugar: Abrir, Plantar, Avançar ou Dominado. A visita do plano só tem "programada" e "feita". Sem jeito novo de ver o mapa agora. |
| Como o guia aparece e onde guarda o "já vi" | Cartão curto no topo da aba na 1ª visita (no mapa, um chip pequeno), botão "Como usar" no cabeçalho e "Ajuda" na busca rápida (Ctrl+K). O "já vi" fica guardado no login da pessoa (`app_users.guides_seen`), com cópia no aparelho; a Assessoria guarda só no aparelho. Alternativa mais simples: só no aparelho, sem mudar o banco, com o cartão reaparecendo em cada celular ou computador. |
| Visita sem internet e passos do mapa | Nesta rodada, registrar visita precisa de internet; o registro sem internet vem no passo Em campo. O passo Toque no mapa roda num pedido separado, quando a chave do MapTiler estiver no Cloudflare, sem travar nada daqui. |

### 5.2 Exemplo da Calculadora, conferido conta a conta

O exemplo: Cidade Exemplo, hoje 02/11/2026, meta de 40 vendas pagas até 28/12, 4 já pagas, 3 vendas por semana, conversão de 20%, 14 dias até pagar, 15 atendimentos novos por semana, 2 mapeadores, 2 vendedores e 60 clientes.

Um script fora do repositório refez todas as contas com as fórmulas do prompt. **Os 76 números e datas batem.** Os principais:

| O que a tela mostra | A conta | Confere |
|---|---|---|
| Faltam 36 vendas (≈ R$ 43.200) em 56 dias | 40 − 4 = 36; 36 × R$ 1.200 | Sim |
| No ritmo atual: 25/01, 28 dias depois, entre 11/01 e 15/02 | 36 ÷ 3 = 12 semanas (84 dias); a faixa usa 3,6 e 2,4 vendas por semana | Sim |
| 6 vendas já em andamento até 16/11; faltam 30 em 6 semanas, 5 por semana | 3 por semana × 2 semanas até pagar | Sim |
| 25 atendimentos novos por semana (hoje 15), 150 no total, começar até 14/12 | 15 × 5 ÷ 3 = 25 | Sim |
| 72 pessoas a mapear por semana (432 até 14/12), 5 mapeadores (+3) e 3 vendedores (+1) | 18 dos 25 atendimentos vêm do mapeamento | Sim |
| Conversão +5 pontos e +1 mapeador: 11/01; indicações +50%: 19/01; +1 vendedor sozinho não muda a data | cada ajuste sozinho | Sim |
| Menor equipe: +3 mapeadores e +1 vendedor, 25/12, 3 dias antes do prazo | as outras com até 4 pessoas novas chegam depois | Sim |
| Bônus da rede: ≈ 4 indicações | 30 × 0,05 × 6 ÷ 2 = 4,5, arredondado para baixo | Sim |
| Resumo para copiar | igual ao do prompt, letra por letra | Sim |

O script também confirmou um cuidado que o prompt já tem: o computador deixa sobras mínimas nas contas (3 × 1,2 dá 3,5999…), e sem esse cuidado a faixa de "Com ajustes" daria 71 dias em vez de 70.

Ele rodou ainda os casos de borda e 30.000 casos aleatórios. Nenhum deu `NaN` nem `Infinity`, mas alguns casos ficaram sem regra. Proponho estes ajustes. Depois da sua aprovação, eles entram no prompt, na Etapa 2 (o texto técnico de cada um está no Anexo A):

1. **Texto do exemplo.** Na linha "Menor equipe", listar as outras combinações com até 4 pessoas novas, que não chegam a tempo. "+2/+1" quer dizer +2 mapeadores e +1 vendedor: +2/+1 e +2/+2 dão 60 dias; +3/+0 e +4/+0 dão 67; +1/+3 dá 70; +0/+4 dá 84.
2. **Quando o que já está em andamento basta.** A tela diz "O que já está em andamento basta para a meta" e não pede para estender a data. A data-alvo é hoje ou depois. O bônus da rede nunca fica negativo.
3. **Meta batida ou que já chega no ritmo de hoje.** Com a meta batida, aparecem só "Meta batida", o medidor e o gráfico. Quando o ritmo de hoje basta, a tela diz "Mantenha o ritmo de hoje" e "A equipe de hoje basta". Vendedores e mapeadores nunca ficam abaixo de 0.
4. **Ritmo sem dados.** "Com ajustes" sem ajuste também mostra "Sem dados suficientes". Com ajuste, a data vem só das vendas a mais, com o rótulo "conta só o acréscimo".
5. **Tempo até pagar sem dados nunca vira 0.** Sem ele, só "No ritmo atual" aparece, e o resto pede a estimativa.
6. **Capacidade do vendedor sem dados não limita.** "+1 vendedor" e a linha "Vendedores" esperam a estimativa da capacidade.
7. **Conversão sem dados.** O passo "conversão +5 pontos" sai do ranking até a estimativa, como indicações e mídia sem dados. Quando todas as contas dependem dela, "O que mais ajuda" e "Menor combinação" pedem a conversão.
8. **Aviso de participação orgânica** (a parte dos atendimentos novos que não vem de mídia paga, comparada com a meta orgânica de Regras e cálculos). Só aparece quando você simula verba a mais de mídia. A conta usa todos os atendimentos simulados, mesmo os que passam do que os vendedores dão conta, para nunca dar porcentagem negativa.
9. **Meta em receita.** A linha do realizado termina no mesmo ponto em que as projeções começam. "Quanto falta" em reais mostra a diferença real, não vendas × ticket.
10. **Arredondamento.** As vendas que precisam acontecer vão para cima, como os atendimentos; as vendas projetadas e o bônus, para baixo.
11. **Valores no limite.** Quando um número cai exatamente no limite de um aviso (por exemplo, a diferença de 30% entre o ritmo e os atendimentos), a tela não avisa por engano por causa das sobras de conta do computador.
12. **Datas muito distantes.** Uma data projetada a mais de 2 anos aparece como "mais de 2 anos".
13. **Passo sem ganho.** O texto diz o motivo: "falta atendimento", "falta vendedor" ou "a meta já chega no prazo".
14. **Tempo até pagar de 0 dia.** Quando a mediana dá 0 dia, mesmo com 5 vendas ou mais, a tela avisa "Vendas registradas no mesmo dia do atendimento: confira" e oferece "Usar minha estimativa", em vez de usar 0 sem aviso.

### 5.3 Texto das dicas de plantio (para aprovar)

São fixas no código, sem citar Elite nem produto. Variáveis: `{primeiro_nome}`, `{lugar}` e `{empresa}`.

- *Lead ou pessoa sem atendimento, qualquer lugar.* Primeiro, a autorização. Faça: antes de qualquer mensagem, pergunte pessoalmente se {primeiro_nome} aceita contato da {empresa} e para quê, e registre em "Iniciar atendimento". Evite: mandar WhatsApp para quem ainda não autorizou.
- *Cliente · Empresa ou Comércio e varejo · Sócio / dono · Avançar.* Peça a indicação de outro dono. Faça: nas primeiras semanas depois do pagamento, peça um nome por vez. Diga: "{primeiro_nome}, quem do {lugar} ou do seu ramo também quer crescer este ano?" Evite: pedir lista de contatos ou falar com alguém antes de essa pessoa autorizar.
- *Indicador · a indicação ainda não comprou.* Feche o ciclo da indicação. Faça: conte a {primeiro_nome} que a pessoa indicada já foi atendida e agradeça, sem valores nem detalhes da conversa. Evite: cobrar dela o resultado da indicação.
- *Multiplicador · Network / comunidade · Membro do network · Dominado.* Convide para multiplicar de propósito. Faça: agradeça em particular e convide para o programa de embaixadores ou para apresentar a {empresa} no próximo encontro do {lugar}. Evite: expor a pessoa indicada ou prometer recompensa fora das regras do programa.
- *Colaborador · Comércio e varejo ou Alimentação · Plantar.* Plante pelo responsável, não pelo balcão. Faça: peça a {primeiro_nome} que apresente quem decide, combine a visita num horário tranquilo do estabelecimento e leve só material aprovado. Evite: abordar clientes da loja ou atrapalhar o atendimento.
- *Cliente · Esporte e lazer · Frequenta.* Relação antes de negócio. Faça: peça a {primeiro_nome} que apresente você ao dono ou ao professor e proponha uma conversa aberta para alunos que empreendem. Evite: abordar alunos durante o treino. Nunca anote dias ou horários em que ela treina.
- *Qualquer nível · Instituição de ensino · Responsável ou Colaborador.* Fale com a coordenação, não com os alunos. Faça: proponha uma aula aberta ou oficina gratuita, com inscrição em que a própria pessoa autoriza o contato. Evite: pedir lista de alunos e qualquer contato com menores de idade.
- *Lugar institucional · Religioso ou Associação / entidade.* Trabalhe com a instituição, nunca com a lista de quem frequenta. Faça: combine com o responsável o apoio a um evento ou projeto aberto e registre em Rede → Parceiros e eventos. Evite: registrar quem frequenta, abordar durante celebração ou reunião, ou usar lista de membros.
- *Para o mentorado, no portal.* No {lugar}: quem você conhece que quer crescer? Conte para a pessoa antes e, se ela aceitar, use "Indicar alguém". Uma boa ideia: sugerir ao responsável uma conversa curta com a {empresa}.

---

## 6. Riscos e como evitar

- **Lugares e visitas virarem rastreamento de uma pessoa.** Para evitar: o nome "Lugares"; só estabelecimentos; no máximo 5; sem hora, ordem, linhas, GPS ou texto livre; autorização e confirmação a cada lugar; remover, revogar e anonimizar tiram a pessoa das visitas.
- **Dado sensível escondido num local sem setor ou de tipo genérico** (uma igreja cadastrada como "Ponto de encontro", sem setor). Para evitar: setor obrigatório para ligar pessoas, lista de revisão por nome e por "Atividade", e o filtro "A revisar" para a gestão de cada empresa.
- **Vínculos antigos com igreja ou clínica.** Para evitar: até a revisão, a pessoa aparece no centro do bairro ou da cidade e o nome do local some para quem não é gestão (Etapa 4). Nada é apagado sozinho.
- **Repositório público.** Para evitar: nenhum número real e nenhum nome em `docs/` ou em log do GitHub; as consultas do ambiente publicado rodam no painel da Cloudflare, e o resultado fica só na conversa.
- **Taxa errada por amostra pequena ou armadilha de data.** Para evitar: amostra mínima e "Sem dados suficientes"; divisão pelas semanas que os dados cobrem; importação fora das taxas em que a data é retroativa; conserto de `record_sale`; a regra do dia de Brasília; tempo até pagar em dias inteiros.
- **Números diferentes entre telas.** Para evitar: uma função só para o progresso da meta (`goalProgress`), "Como calculamos" com a base de cada tela e o teste de coerência.
- **Vazamento entre funções e entre empresas** (`leads`, `sales`, `costs` e `territory_*` não têm `organization_id`). Para evitar: escopo conferido no servidor, JOIN com `cities.organization_id`, `organization_id` nas tabelas novas e testes de isolamento. O Comercial recebe só os números dele e as premissas sem a base.
- **Homônimos no portal do mentorado.** Para evitar: lugares só depois de a gestão confirmar qual pessoa do mapa é o mentorado.
- **Migração no ambiente publicado, que guarda dados reais.** Para evitar: migrações que só criam ou acrescentam; o preenchimento da origem é idempotente e só marca com prova; nenhuma meta e nenhum exemplo é gravado sozinho.
- **Limites do D1 e peso da página.** Para evitar: consultas agregadas, lotes de 80 ids, no máximo 100 parâmetros e 5 SELECTs por UNION, e telas carregadas sob demanda.
- **Testes que dependem de nomes exatos.** Para evitar: atualizar `tests/navigation.test.mjs` e a lista do `.github/workflows/verificar.yml` em cada etapa; lembrar que `tests/rendered-html.test.mjs` lê o código de `app/territorial-map.tsx`.
- **Expectativa: a Calculadora projeta, não promete.** Para evitar: o selo "Projeção", a faixa "entre X e Y", os avisos fixos e o guia, que diz que uma empresa nova vai ver quase tudo em "Sem dados suficientes".
- **Banco local com uma semana só.** Para evitar decisão errada: os números da parte 2.1 só servem para conferir as consultas; a conferência das taxas reais depende da parte 2.2 e da tela da Etapa 2.
- **Cidade em modo Consolidado fica fora das taxas.** Para evitar: a consulta 3 mostra quantas há, e a coluna "Fonte" de Saúde das cidades mostra quais. A troca para Detalhado só acontece com a sua decisão, porque os fechamentos consolidados da cidade deixam de contar.
- **Atendimentos com responsável sem login** não contam como vendedor nem entram na divisão da meta. Para evitar: as vendas deles entram em "sem responsável", para a soma das pessoas fechar com o total da cidade; a consulta 6 mostra quantos e-mails são.

---

**Pare aqui.** A Etapa 1 só começa depois que você mandar as anotações da semana (parte 1) e os resultados das consultas (parte 2.2), e responder "aprovo" ou o que muda nas partes 5.1, 5.2 e 5.3. O Anexo A, abaixo, é só o texto técnico que entra no prompt depois da sua aprovação; você não precisa lê-lo.

---

## Anexo A — Ajustes às contas, em texto para o prompt

Texto da conferência, com a conta de cada caso, para entrar na Etapa 2 do prompt depois da sua aprovação.

1. Texto do item 7 do exemplo. “As menores não servem: +2/+1 dá 60 dias (01/01); +4/+0 e +3/+0 dão 67 (08/01)”. Só que +4/+0 tem 4 pessoas, como +3/+1, então não é menor. Faltam ainda +2/+2 (60), +1/+3 (70) e +0/+4 (84). Texto: “As outras com até 4 pessoas novas não chegam: +2/+1 e +2/+2 dão 60 dias (01/01); +3/+0 e +4/+0 dão 67 (08/01); com 1 mapeador a mais, 70; sem mapeador, 84.”

2. R = 0 antes de U ≤ 0, e o bônus com U ≤ 0. Com T = 12/11 (D = 10), m = 14, M = 7 (F = 3) e v = 3: t_atual = 7 dias, chega 3 dias antes. E = 3 × 10 ÷ 7 = 4,29 ≥ F, então R = 0, mas U = −0,57 e a regra manda “estenda a data”. Com U ≤ 0 o bônus B = R × r × U ÷ 2 fica negativo: com M = 40 e T = 12/11, B = 31,7 × 0,05 × (−0,57) ÷ 2 = −0,45, mostrado “≈ −1”. Isso apareceu em 919 de 30.000 casos aleatórios. E uma data-alvo antes de hoje dá S < 0 e E negativo (T = 30/10: E = −1,29). Texto: “Se R = 0, a tela diz ‘O que já está em andamento basta para a meta’ e não mostra o funil nem o bônus. Só com R > 0 e U ≤ 0 aparece ‘Para este prazo só contam os atendimentos já em andamento: estenda a data’, também sem o bônus. A data-alvo é hoje ou depois.”

3. Meta batida e meta que já chega (Nn ≤ N). Com M = 10, o que está em andamento já basta: Nn = 0, 0 mapeadores, 0 vendedores, menor combinação +0/+0, e o resumo diria “por exemplo com +0 mapeadores e +0 vendedores”. Com kv = 5 e M = 10, vendedores = 2 + ⌈(0 − 15) ÷ 5⌉ = −1. Deu negativo em 699 de 30.000 casos: acontece quando N > nv × kv e Nn fica bem abaixo de N. Texto: “Com F = 0, a tela mostra só ‘Meta batida’, o Meter e o gráfico. Quando Nn ≤ N, ‘O que precisa acontecer’ diz ‘Mantenha o ritmo de hoje’, sem números de equipe; a menor combinação diz ‘A equipe de hoje basta’; o resumo termina em ‘No ritmo atual chegamos em DD/MM, X dias antes do prazo.’. Vendedores e mapeadores nunca ficam abaixo de 0.”

4. Ritmo sem dados em “Com ajustes”. “Hoje” diz “Sem dados suficientes”, mas sem ajuste v′ = max(0, 0 + 15 × 0,2 − 15 × 0,2) = 0, e “Com ajustes” diz “não chega”. Isso quebra o teste “Com ajustes igual a Hoje”. Texto: “Com o ritmo sem dados, ‘Com ajustes’ sem ajuste também mostra ‘Sem dados suficientes’. Com ajuste, a data vem só das vendas a mais (v′ = N′ × c′ − N × c) e leva o rótulo ‘conta só o acréscimo’.”

5. O tempo até pagar sem dados não pode virar 0. A frase do funil “um valor sem dados entra na conta como 0” parece geral. Com m = 0, o motor faria funil, alavancas e combinação, contra o teste “só No ritmo atual”. Texto, no fim da frase: “(vale para N, v, Pm e nm; o tempo até pagar sem dados nunca vira 0: sem ele, só ‘No ritmo atual’ aparece e o resto pede a premissa)”.

6. Capacidade sem dados (kv ou nv). Pela mesma frase, kv sem dados vira 0, e a capacidade fica max(n′v × 0, 15 + 0) = 15 = N. Aí +1 mapeador fica em 84 dias, só a conversão anda e a combinação diz “Nem com +10 mapeadores e +5 vendedores”. Com nv sem dados (empresa nova, N sem dados, kv = 10 digitado), a capacidade é 0: +1 mapeador sozinho fica em 84, e só com +1 vendedor junto vai a 70. Texto: “Sem kv ou nv com dados, a capacidade não limita (N′ = N′map + N′ind + N′mid + Nout). ‘+1 vendedor’ e a linha ‘Vendedores’ esperam a premissa ‘capacidade de um vendedor por semana’.”

7. Conversão sem dados no ranking e na combinação. Com c sem dados, c′ ÷ c = 1, e o passo “conversão +5 pontos” sai como “sozinho não muda a data” (84 dias), o que engana. No modo absoluto sem c, nenhuma alavanca anda e a combinação diz “Nem com +10 mapeadores e +5 vendedores”, quando o que falta é a premissa. Texto: “Com a conversão sem dados, o passo ‘conversão +5 pontos’ fica fora do ranking até a premissa, como indicações sem r e mídia sem CPL. No modo absoluto sem conversão (e sem capacidade, item 6), ‘O que mais ajuda’ e ‘Menor combinação’ mostram ‘Sem dados suficientes: digite a conversão’ (ou a capacidade).”

8. Participação orgânica. A conta (1 − N′mid ÷ N′) usa N′ já limitado pela capacidade e N′mid sem limite. Com CPL R$ 50 e +R$ 5.000/mês: N′mid = 23,3, soma 38,3, capacidade 20, N′ = 20 → −17% (antes do limite, 39%). E a fórmula avisa mesmo sem mexer na mídia: com mídia de hoje 6 de 15 e critério 70%, dá 60% e avisa. Já a Etapa 3 diz “aviso ao simular mídia”. Texto: “participação orgânica = (1 − N′mid ÷ (N′map + N′ind + N′mid + Nout)) × 100, antes do limite da capacidade; o aviso só aparece com verba extra de mídia maior que 0.”

9. Meta em receita: gráfico e “≈ R$”. A linha cheia (receita paga acumulada ÷ t) só encontra as tracejadas, que partem de P = M − F, quando Pr é múltiplo de t. Com Mr = R$ 48.000, t = R$ 1.200 e Pr = R$ 4.500: F = ⌈43.500 ÷ 1.200⌉ = 37 e P = 3, mas a linha termina em 3,75. Com Pr = R$ 50.400, termina em 42, e o Meter mostra 40 de 40. E “≈ R$” calculado como F × t engana: com Pr = R$ 47.999, a tela diria “Faltam 1 venda (≈ R$ 1.200)” quando falta R$ 1. Texto: “Em meta de receita, cada ponto da linha cheia é a receita paga acumulada até o dia × P ÷ Pr (zero com Pr = 0), para terminar em P = M − F. ‘Quanto falta’ mostra ‘≈ R$ (Mr − Pr)’.”

10. Arredondamento de R e vn. A regra só fala de vendas projetadas (para baixo), mas R e vn são o que precisa acontecer. Com v = 2,875 (23 vendas em 8 semanas): E = 5,75, mostrado 5; R = 30,25 para baixo daria 30, e 5 + 30 = 35, não F = 36. Texto: “R e vn (vendas que precisam acontecer) vão para cima, como os atendimentos; E, as vendas do gráfico e o bônus vão para baixo.”

11. Comparações em ponto flutuante. As 6 casas só valem antes de ⌈ ⌉ e ⌊ ⌋. Exatamente em 30%: com c = 26%, |3 − 3,9000000000000004| = 0,9000000000000004 > 0,8999999999999999 e avisa; com c = 14%, dá 0,8999999999999999 e não avisa. Pela regra (> 30%), nenhum dos dois deveria avisar. Outro caso: v = 1/3 (2 vendas em 6 semanas), F = 1, D = 21, m = 7, N = 7. Aí t_atual = 21 = D (chega no prazo), mas Nn = 7,000000000000001 > 7 liga “O que trava: atendimentos” com “faltam +0”. Texto: “…cada valor vai a 6 casas decimais antes de ⌈ ⌉, ⌊ ⌋ e de qualquer comparação (>, ≥, <, ≤).”

12. Datas muito distantes. Com v′ pequeno, a data vai longe: com v = 0 e +R$ 50/mês de mídia (CPL R$ 500), v′ = 0,0047 e dá 54.014 dias (21/09/2174); com +R$ 1, ano 9419. Acima de 1e8 dias, o Date do JS fica inválido (NaN). Texto: “Data projetada a mais de 2 anos aparece como ‘mais de 2 anos’ (na faixa, no ranking e no gráfico).”

13. Texto do passo sem ganho. O exemplo só define “falta atendimento” (+1 vendedor). Com kv = 5, +1 mapeador e indicações +50% também não ganham, porque a capacidade 15 segura N′ (19 e 16,5 viram 15), e o gargalo geral é “atendimentos e vendedores juntos”. Texto: “Passo sem ganho: +1 vendedor → ‘falta atendimento’; mapeador, indicações ou mídia barrados pela capacidade → ‘falta vendedor’; quando o andamento já decide a data → ‘a meta já chega no prazo’.”

14. Tempo até pagar de 0 dia com amostra suficiente. Com 5 vendas ou mais e mediana 0, o valor continua real, mas quase sempre quer dizer venda registrada no mesmo dia do atendimento, e a Calculadora mandaria começar atendimentos até o próprio dia do prazo. Texto: “Se a mediana do tempo até pagar der 0 dia, a tela mostra ‘Vendas registradas no mesmo dia do atendimento: confira’ ao lado da taxa e oferece ‘Usar minha estimativa’.”

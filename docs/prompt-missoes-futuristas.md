# Prompt — Missões no nível futurista da plataforma

> Para usar: cole este texto em uma nova conversa com o Claude neste repositório (ou peça "siga o docs/prompt-missoes-futuristas.md").
> Rode **depois** que a Etapa 1 do `docs/prompt-plataforma-futurista.md` estiver publicada: este prompt usa a fundação dela (fontes, cores, paleta de gráficos validada e os componentes de `components/elite`).

---

## Contexto

Você está trabalhando na **Elite Expansion X** (repositório `elite-expansion-x`, branch `claude/executar-projeto-2ehft2`): plataforma de expansão por cidades, usada pela Elite Frascaroli Academy e vendida por assinatura (cada empresa assinante tem um ambiente só dela). Stack: Next 16 (vinext) + React 19 em Cloudflare Workers com D1, Tailwind, shadcn/Radix, lucide-react, recharts (carregado sob demanda) e visual **Noite Dourada 2.0**.

## Como as missões estão hoje (ponto de partida)

**Dados.** A tabela `tasks` tem:
- organização, cidade (opcional) e embaixador (opcional);
- título, categoria (Missão, Treinamento, Evento, Conteúdo, Atendimento) e prazo;
- situação (Pendente → Concluída), quem criou e quando concluiu.

**Ações.** `create_task` e `complete_task` ficam em `db/mutations.ts`:
- Administrador, Coordenação e Líder criam (Coordenação e Líder só na própria cidade).
- O Embaixador conclui só as missões dele.
- Concluir uma missão conta para a **ativação** do embaixador (`refreshAmbassadorActivation`).

**Telas.**
- **Gestão:** o cartão "Tarefas e missões" (`Missions` em `app/expansion-dashboard.tsx`), em Rede → Embaixadores. É uma lista simples com 20 itens, sem filtro, sem progresso e sem gráfico.
- **Portal do Embaixador:** o cartão "Missões pendentes", com botão "Concluir". Não mostra histórico, prazo vencido nem conquista.
- **Cadastro:** "+ Novo → Criar tarefa" (`TaskForm` em `app/expansion-forms.tsx`).

**O que falta.** Não há:
- missão que se repete toda semana;
- prova do que foi feito;
- missão que se conclui sozinha pelos dados;
- pontos, nível, sequência ou conquista;
- ranking, quadro ou gráfico.

## O que eu quero

As missões viram o **motor de engajamento** da rede:
- claras para quem cumpre;
- fáceis de acompanhar para quem gerencia;
- no mesmo nível visual das outras abas.

Nada de jogo infantil: é sofisticado, dourado, com propósito comercial.

## Etapa 0 — Diagnóstico (entregar ANTES de mudar telas)

1. **Inventário:**
   - onde as missões aparecem, quem cria e quem conclui;
   - o que conta para a ativação;
   - quantas missões existem por categoria e situação (com os dados de teste).
2. **Proposta**, com o que muda no banco e o que fica igual, para:
   - modelos;
   - missões automáticas;
   - prova;
   - pontos e níveis;
   - conquistas.
3. **Protótipo** da aba nova e do portal (capturas em 1440 px e 390 px), no visual Noite Dourada 2.0.
4. **Riscos:**
   - LGPD (o ranking mostra só o primeiro nome; nada de dados de contato);
   - permissões;
   - isolamento entre empresas;
   - testes.

Pare aqui e espere minha aprovação.

## Etapa 1 — Aba "Missões" na gestão

**Onde fica.** Sub-aba própria em **Rede → Missões**. Hoje as missões são um cartão dentro de Embaixadores.

**Cabeçalho vivo:**
- missões ativas;
- % concluídas no prazo nesta semana;
- missões atrasadas;
- embaixadores com missão em dia (indicadores com minigráfico).

**Quadro (kanban)** com as colunas **Disponíveis · Em andamento · Concluídas · Atrasadas**:
- cartões com categoria, prazo, quem cumpre e progresso;
- concluir pela ficha lateral.

**Ficha lateral da missão:**
- descrição;
- critério de conclusão;
- prova enviada;
- linha do tempo (criada, aceita, prova, concluída);
- quem validou.

**Filtros** numa linha só: cidade, embaixador, categoria, período e situação.

**Ações em lote:** atribuir a vários embaixadores e prorrogar o prazo, conferidas no servidor.

## Etapa 2 — Missões mais inteligentes

**Modelos de missão**, para não recriar toda semana:
- missão semanal que se repete (ex.: "Compartilhar o material aprovado da semana");
- missão de entrada (ex.: "Aceitar as regras", "Concluir o treinamento").

O envio programado diário que já existe gera as missões da semana.

**Missões automáticas**, que se concluem sozinhas pelos dados que já existem:
- "Registrar 3 atendimentos com autorização" (leads do embaixador);
- "1 indicação que virou cliente pago" (vendas confirmadas);
- "Mapear 10 locais no bairro X" (cadastros do mapeador; quando houver, as áreas de varredura).

Mostram o progresso em medidor ("2 de 3").

**Prova**, quando a missão pedir:
- link ou texto curto;
- validação de quem gerencia (aprovar ou devolver com motivo).

Foto só se eu aprovar o armazenamento.

**Ativação:** continua com a mesma regra, agora também com as missões automáticas.

## Etapa 3 — Progresso, níveis e conquistas

**Pontos por missão**, com peso por categoria e configurável em Gestão → Regras e cálculos.

**Níveis ligados aos níveis do embaixador** que já existem (Indicador → Embaixador ativo → Referência → Líder local):
- a plataforma **sugere** a promoção;
- a gestão confirma.

**Sequência:** semanas seguidas com as missões em dia.

**Conquistas**, cada uma com ícone em traço dourado e data:
- primeira indicação;
- primeiro cliente pago;
- 4 semanas em dia.

**Ranking da cidade:**
- ligado por quem gerencia;
- primeiro nome e nível;
- nunca contato nem valor de venda individual para os outros.

## Etapa 4 — Portal do Embaixador (pensado para o celular)

**"Sua semana":**
- as missões em cartões grandes com prazo e progresso;
- botão de concluir ou enviar prova;
- vibração curta ao concluir, onde o aparelho suportar.

**Seu nível:**
- medidor até o próximo nível;
- sequência atual;
- conquistas.

**Histórico** em linha do tempo.

**Materiais da missão:** ao lado da missão que pede, com o link e o QR de indicação (o QR gerado no próprio aparelho).

## Etapa 5 — Gráficos que fazem sentido

Mesmas regras do `dataviz` usadas na plataforma:
- pergunta no título;
- conclusão em uma frase;
- um só eixo;
- "Ver tabela";
- "Sem dados suficientes" em vez de número inventado.

| Onde | Pergunta | Gráfico |
|---|---|---|
| Rede → Missões | A rede está cumprindo? | missões concluídas no prazo × atrasadas por semana (colunas empilhadas, 8 semanas) |
| Rede → Missões | Que tipo de missão funciona? | % concluída por categoria (barras) |
| Rede → Missões | Quem está engajado? | embaixadores por semanas seguidas em dia (barras, o selecionado em destaque) |
| Portal do Embaixador | Como estou indo? | minhas missões concluídas por semana (colunas) + medidor do nível |

## Regras que não mudam

- Permissões no servidor:
  - Administrador, Coordenação e Líder criam e validam (Coordenação e Líder na própria cidade);
  - o Embaixador vê e conclui só as dele.
- Isolamento entre empresas e Assessoria Elite como hoje.
- LGPD:
  - ranking e telas compartilhadas com primeiro nome;
  - prova sem dado de cliente;
  - nada de contato pessoal exposto.
- Missões antigas continuam valendo, com o mesmo histórico.

## Como validar cada etapa

- `npx tsc --noEmit`, lint e `npm test` passando, com testes novos para:
  - modelos que se repetem;
  - missões automáticas;
  - prova e validação;
  - pontos e níveis;
  - permissões por função;
  - isolamento entre empresas.
- Navegador em 1440 px e 390 px nas funções Administrador, Coordenação, Líder, Embaixador e empresa assinante: sem rolagem horizontal e sem erro no console, com capturas antes/depois.
- Movimento reduzido respeitado; axe sem violações graves; paleta dos gráficos validada.
- Publicar no ambiente de teste a cada etapa e atualizar `docs/kit-de-lancamento.md` e `/guia`.

## Entrega

Uma etapa por vez, cada uma com: o que mudou (em palavras simples), capturas antes/depois, testes e o que vem a seguir. Commit e push na branch `claude/executar-projeto-2ehft2`, sem abrir PR.

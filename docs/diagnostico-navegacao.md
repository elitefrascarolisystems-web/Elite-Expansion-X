# Etapa 0 — Diagnóstico da navegação (21/10/2026)

Levantamento feito no código (`app/expansion-dashboard.tsx` e telas ligadas a ele). Nenhuma tela foi alterada.

---

## 1. Inventário: o que existe hoje

### 1.1 Cabeçalho (todas as telas da equipe)

| Item | Quem vê | Observação |
|---|---|---|
| Logo + "Elite Expansion X" | Todos | — |
| Seletor de organização | Quem tem mais de uma (e assessores) | — |
| **Nova organização** | Donos da plataforma | Duplica *Assinaturas → Nova empresa assinante* e cria empresa **sem plano** |
| **Assessores** | Donos da plataforma | Gestão da plataforma no cabeçalho |
| Função, nome, Sair | Todos | — |
| Faixa "Modo assessoria" | Assessoria Elite em empresa cliente | Fica |

### 1.2 Faixa de abertura (repete em todas as abas)

Título fixo **"Expansão e vendas, em um só lugar"** + texto + "Atualizado em", e 6 botões:

| Botão | Quem vê | Abre |
|---|---|---|
| **Mapear** | Adm, Coord, Líder, Comercial | Mapeamento guiado (cidade → local → pessoas) |
| **Novo lead** | Adm, Coord, Líder, Comercial | Cadastro de lead (sem pessoa do mapa) |
| **Registrar venda** | Adm, Coord, Líder, Comercial | Venda e pagamento |
| **Embaixador** | Adm, Coord, Líder | Cadastro de embaixador |
| **Cidade** | Adm | Cadastro de cidade |
| **Exportar** | Todos (se o plano permitir) | CSV **só da tabela de cidades**, apesar do nome genérico |

Ocupa cerca de 200 px no topo de **toda** aba, antes do conteúdo.

### 1.3 Faixas que aparecem acima das abas

- **Sua agenda** (atrasados e de hoje): em todas as abas, exceto Vendas e relacionamento.
- **Barra de filtros** (cidade, período, canal, líder, embaixador): em Início, Cidades, Embaixadores, CRM, Operação local, Custos e **Configurações**. Lá ela não serve para nada. No CRM, aparece junto com os filtros próprios da tela: **dois conjuntos de filtros** na mesma aba.

### 1.4 Abas

| # | Aba | Adm | Coord/Líder | Comercial | O que tem dentro |
|---|---|:-:|:-:|:-:|---|
| 1 | Início | ✔ | ✔ | — | Primeiros passos · Indicadores do mapeamento · 8 indicadores · gráfico receita x custo · alertas · **Saúde das cidades** (resumida) |
| 2 | Cidades | ✔ | ✔ | — | Saúde das cidades (completa) · Nova cidade · Fechamento consolidado · Decisão registrada da cidade |
| 3 | Mapa territorial | ✔ | ✔ | ✔ | Mapa, camadas, filtros, ficha da pessoa ou local, Iniciar atendimento · **Importar pessoas** |
| 4 | Empresas e locais | ✔ | ✔ | ✔ | Lista de empresas e locais · Cadastrar · **Importar empresas** · Exportar |
| 5 | Embaixadores | ✔ | ✔ | — | Título "Embaixadores **e líderes**" (só lista embaixadores) · Cadastrar · Atividade |
| 6 | Vendas e relacionamento | ✔ | ✔ | ✔ (abre aqui) | 5 visões: Minha agenda · Tabela · Método F.E.C.H.A. · Pós-venda · **Indicações** (árvore da rede) |
| 7 | CRM e pagamentos | ✔ | ✔ | ✔ | **Duas listas**: "Oportunidades e próximas ações" e "CRM e vendas confirmadas" (leads) · 4 indicadores repetidos do Início · Nova oportunidade · Lead autorizado · Venda e pagamento |
| 8 | Metas e desempenho | ✔ | ✔ | ✔ | Metas da equipe · Meu relatório diário · totais por pessoa · Exportar |
| 9 | Operação local | ✔ | ✔ | — | Parceiros · Eventos · Materiais · Tarefas e missões |
| 10 | Custos | ✔ | ✔ | — | 4 indicadores (CAC e ROAS repetidos do Início) · eficiência por canal · custos lançados |
| 11 | Time e acessos | ✔ | — | — | Equipe, convites, links de acesso |
| 12 | Portal | ✔ | — | — | Jornada dos mentorados · membros · materiais do portal |
| 13 | Configurações | ✔ | — | — | Plano · critérios de decisão · como calculamos · Assessoria Elite · **últimas alterações (histórico)** |
| 14 | Assinaturas | Donos | — | — | Empresas assinantes |

Embaixador e Mentorado não usam abas: cada um tem o próprio portal.

### 1.5 Janelas (cadastros)

Cidade (criar, configurar, fechamento) · Embaixador (criar, acompanhar, atividade) · Lead (criar, etapa) · Venda e pagamento · Custo · Parceiro · Evento · Material · Tarefa · Critérios · Perfil interno. Fora da lista principal: Mapeamento guiado, Iniciar atendimento, Convidar equipe, Link de acesso, Importar pessoas, Importar empresas, Boas-vindas.

### 1.6 Cliques até as 5 ações mais usadas (Administrador, hoje)

| Ação | Caminho | Cliques |
|---|---|:-:|
| Mapear pessoa | Mapear → cidade → local → pessoa → salvar | 5 |
| Iniciar atendimento | Mapa → pessoa → Iniciar atendimento → salvar (ou no fim do Mapear) | 4 |
| Registrar retorno | Agenda "Abrir atendimento" → Registrar retorno → salvar | 3 |
| Registrar venda | Registrar venda → escolher lead → salvar | 3 |
| Convidar pessoa | Time e acessos (**fora da tela**, precisa rolar as abas) → Convidar equipe → colar → gerar → enviar | 5 |

---

## 2. Sobreposições e pontos de confusão

1. **Abas escondidas.** Em 1440 px a fileira de 14 abas não cabe: na captura feita ao testar as Assinaturas, *Início, Cidades e Mapa* ficaram fora da tela. No celular é pior.
2. **A mesma jornada de venda em dois lugares.** *Vendas e relacionamento* e *CRM e pagamentos* mostram as mesmas oportunidades em listas diferentes. O CRM ainda tem duas listas próprias.
3. **Cinco portas para "começar um atendimento"**, com cinco nomes:
   - "Novo lead" (topo);
   - "Lead autorizado" (CRM);
   - "Nova oportunidade" (CRM);
   - "Cadastrar lead autorizado" (Indicações);
   - "Iniciar atendimento" (mapa).
4. **Venda com três nomes:** "Registrar venda", "Venda e pagamento" e "Venda".
5. **Território em três abas:** Cidades, Mapa e Empresas e locais. A importação fica em duas delas, em lugares diferentes.
6. **Resultados espalhados em quatro abas:**
   - **Início:** 8 indicadores.
   - **CRM:** 4 indicadores, repetidos.
   - **Custos:** 4 indicadores, com CAC e ROAS repetidos.
   - **Metas:** totais por pessoa.

   A tabela "Saúde das cidades" aparece no Início e em Cidades.
7. **Quatro botões de exportar** com nomes diferentes. O "Exportar" do topo exporta só as cidades.
8. **Rede dividida:**
   - Embaixadores em uma aba.
   - Indicações dentro de Vendas.
   - Mentorados em Portal.
   - Parceiros, eventos e materiais em Operação local. O Portal ainda manda o usuário para "Operação local → Material".
9. **Administração espalhada:** Time e acessos, Portal e Configurações, com o histórico de alterações escondido no fim de Configurações. *Nova organização* e *Assessores* ficam no cabeçalho.
10. **Título repetido:** "Expansão e vendas, em um só lugar" ocupa o topo de toda aba e não diz em que área a pessoa está.
11. **Filtros no lugar errado:** a barra global aparece em Configurações e se soma aos filtros próprios do CRM.
12. **"Assinante" com dois sentidos:** papel de pessoa no mapa (cliente que assina um serviço) e empresa assinante da plataforma.
13. **Sobras de código:** o antigo "Planejamento do plano da organização" (rascunho sem efeito) ainda está no servidor, sem tela.

---

## 3. Proposta de organização

### 3.1 Áreas

| Área | Para que serve | Dentro (sub-abas) |
|---|---|---|
| **Hoje** | O que fazer agora | Agenda do dia (atrasados, hoje) · Primeiros passos (enquanto incompletos) · alertas · 4 indicadores-chave · atalhos |
| **Território** | Onde e com quem atuamos | **Mapa** · **Cidades** (saúde, configuração, decisão, fechamento) · **Locais** (empresas, escritórios, networks) · *Importar planilha* dentro de cada um |
| **Vendas** | Do primeiro contato ao pagamento | **Agenda** · **Atendimentos** (uma lista única de oportunidades, em tabela ou quadro) · **Método F.E.C.H.A.** · **Pagamentos** · **Pós-venda** |
| **Rede** | Quem multiplica a operação | **Embaixadores** (com missões) · **Indicações** (árvore) · **Mentorados** (jornada e membros) · **Parceiros e eventos** · **Materiais** |
| **Resultados** | Como estamos indo | **Visão geral** (indicadores, gráfico, saúde das cidades) · **Metas e rotina** (metas, relatório diário) · **Mapeamento** (produção por pessoa) · **Custos e canais** · cada sub-aba com seu *Exportar* |
| **Gestão** | Administração da empresa | **Time e acessos** · **Regras e cálculos** · **Plano** · **Histórico** · **Assessoria Elite** |
| **Plataforma** | Só donos da Elite | **Assinaturas** · **Assessores** |

### 3.2 O que cada função vê

| Função | Áreas | Abre em |
|---|---|---|
| Administrador | Hoje · Território · Vendas · Rede · Resultados · Gestão (+ Plataforma, se dono) | Hoje |
| Coordenação / Líder | Hoje · Território · Vendas · Rede · Resultados | Território (Coordenação) / Hoje (Líder) |
| Comercial | Hoje · Território (Mapa e Locais) · Vendas · Resultados (Metas e rotina) | Vendas → Agenda |
| Embaixador / Mentorado | Portal próprio (só ganha o visual novo) | — |

As permissões continuam exatamente as de hoje. A área só aparece se a pessoa puder usar algo dentro dela.

### 3.3 Navegação

- **Computador:** barra lateral com as áreas (ícone, nome e contador, por exemplo *Vendas · 3* para os retornos de hoje), que pode ser recolhida. As sub-abas ficam no topo da área.
- **Celular:** barra inferior com Hoje, Território, Vendas, Resultados e **Mais** (Rede, Gestão, Plataforma). O Comercial tem só 4 itens.
- **Cabeçalho único:**
  - organização;
  - botão **+ Novo**, com Mapear, Atendimento, Venda e pagamento, Cidade, Embaixador, Custo, Parceiro, Evento, Material, Tarefa e Convidar pessoa, mostrando só o que a função pode fazer;
  - perfil e Sair.
- O título fixo de abertura sai. Cada área ganha o próprio título e uma frase "para que serve".
- **Filtros:** cada área tem os seus, sempre no mesmo lugar. A barra global e a duplicada saem.
- **Endereço:** área e sub-aba ficam na URL (`?org=1&area=vendas&ver=agenda`), então os links levam direto à tela e o botão voltar funciona.

### 3.4 Cliques esperados depois

| Ação | Hoje | Depois |
|---|:-:|:-:|
| Mapear pessoa | 5 | 5 (+ Novo → Mapear; o fluxo é o mesmo) |
| Iniciar atendimento | 4 | 4 |
| Registrar retorno | 3 | 3 (direto da área Hoje) |
| Registrar venda | 3 | 3 |
| Convidar pessoa | 5 (com aba escondida) | 4 (+ Novo → Convidar pessoa) |

---

## 4. Juntar, mover, renomear e retirar

| O quê | Mudança | Por quê |
|---|---|---|
| Vendas e relacionamento + CRM e pagamentos | **Juntar** em *Vendas* | Mesma jornada; acaba com as 3 listas paralelas |
| Duas listas do CRM | **Juntar** em *Atendimentos* (tabela ou quadro) | Uma única fonte de verdade |
| Novo lead / Lead autorizado / Nova oportunidade / Cadastrar lead autorizado / Iniciar atendimento | **Um nome: "Atendimento"**, com duas origens: *pessoa do mapa* ou *contato novo* | Hoje são 5 nomes para a mesma ideia |
| Registrar venda / Venda e pagamento / Venda | **Um nome: "Venda e pagamento"** | Consistência |
| Cidades, Mapa, Empresas e locais | **Juntar** em *Território* (3 sub-abas) | Mesmo assunto |
| Importar pessoas / Importar empresas | **Mover** para um botão *Importar planilha* em Mapa e em Locais | Lugar previsível |
| Indicadores do CRM e de Custos repetidos do Início | **Retirar** as cópias; ficam em *Resultados* | Um número em um só lugar |
| Saúde das cidades no Início | **Retirar** do Início (fica em Território → Cidades e em Resultados) | Duplicada |
| Indicadores do mapeamento (Início) | **Mover** para *Resultados → Mapeamento* | É resultado, não tarefa do dia |
| Metas e desempenho | **Mover** para *Resultados → Metas e rotina* | — |
| Custos | **Mover** para *Resultados → Custos e canais* | — |
| Indicações (dentro de Vendas) | **Mover** para *Rede → Indicações* | É rede, não etapa de venda |
| Operação local | **Dividir** em *Rede → Parceiros e eventos* e *Rede → Materiais*; missões vão para *Embaixadores* | "Operação local" não diz o que tem dentro |
| Portal | **Renomear** para *Rede → Mentorados* | Nome do que é |
| "Embaixadores e líderes" | **Renomear** para *Embaixadores* | Só lista embaixadores |
| Configurações | **Dividir** em *Gestão → Regras e cálculos*, *Plano*, *Histórico* e *Assessoria Elite* | O histórico fica visível |
| Exportar do topo | **Mover** para *Resultados → Visão geral* como "Exportar cidades (CSV)" | O nome dizia mais do que fazia |
| Nova organização e Assessores (cabeçalho) | **Mover** para *Plataforma* | Criar empresa só com plano |
| Título "Expansão e vendas, em um só lugar" | **Retirar** | Ocupa espaço e não orienta |
| Barra global de filtros | **Retirar**; filtros por área | Aparecia onde não servia e duplicava no CRM |
| Rascunho antigo de plano (servidor) | **Retirar** o código | Sem tela e sem efeito |

---

## 5. Riscos e como evitar

| Risco | Como evitar |
|---|---|
| Alguém perder acesso a uma função ou ver o que não devia | As permissões não mudam no servidor. A navegação é montada pela mesma regra (`canPerform`). Teste no navegador para cada uma das 8 visões: 6 funções, empresa assinante e dono. |
| Textos e guias com nomes antigos | Hoje os nomes das abas aparecem em 12 arquivos de telas e regras (inclusive o guia do mapeador) e em 9 documentos. Tudo será atualizado na mesma etapa, inclusive `/guia` e o kit de lançamento. |
| Testes que dependem dos nomes | Só 2 testes citam "Mapa territorial". Serão ajustados, e um teste novo vai conferir as áreas por função. |
| Links antigos | Hoje nenhum link aponta para aba, só `?org=`, que continua igual. Endereços sem `area` abrem na área padrão da função. |
| "Atendimento" juntar duas janelas diferentes | Atendimento por pessoa do mapa e lead de contato novo usam regras diferentes no servidor. A janela única só escolhe a origem; cada caminho chama o mesmo servidor de hoje. |
| Mapa perder altura no celular | Território → Mapa ocupa a tela inteira, com a barra inferior por cima. Testar em 390 px. |
| Mudança grande de uma vez | A entrega vai por etapas. A Etapa 1 muda só a navegação e a organização, reaproveitando os componentes atuais. O visual premium vem na Etapa 2. |

---

## 6. Decisões que preciso de você

1. **Nomes das áreas:** Hoje · Território · Vendas · Rede · Resultados · Gestão · Plataforma. Aprova ou quer outros?
2. **"Atendimento" como nome único** para começar um contato (no lugar de lead, oportunidade e atendimento). Aprova?
3. **Papel "Assinante" no mapa:** renomear para *Cliente assinante*, para não confundir com empresa assinante da plataforma? Ou manter?
4. **Coordenação** abre em Território, e **Líder** em Hoje. Ou os dois em Hoje?
5. **Busca rápida** no cabeçalho (pessoa, local, lead): entra já na Etapa 1 ou fica para depois? Ela precisa de uma consulta nova no servidor, só de leitura.

---

## 7. Situação (Etapa 1 concluída)

Decisões aprovadas: os nomes das áreas, "Atendimento" como nome único, o papel *Cliente assinante* no mapa (com os dados antigos convertidos), Coordenação abrindo em Território e Líder em Hoje, e a busca rápida para depois.

O que ficou diferente do proposto:
- **Atendimentos:** as duas listas viraram uma sub-aba com duas visões, *Acompanhamento* e *Dados das oportunidades*. Assim nada se perde: etapa, temperatura, empresa vinculada e motivo da perda continuam editáveis. Uma lista única de verdade fica para depois.
- **Comercial:** vê também *Rede → Indicações*, porque já usava as indicações dentro de Vendas. Ficam 5 áreas.

Cliques depois da Etapa 1 (Administrador):

| Ação | Antes | Depois |
|---|:-:|:-:|
| Mapear pessoa | 5 | 5 pelo botão *Mapear* em Território → Mapa · 6 pelo + Novo |
| Iniciar atendimento | 4 | 4 |
| Registrar retorno | 3 | 3 |
| Registrar venda | 3 | 4 (+ Novo abre o menu) |
| Convidar pessoa | 5 | 4 |

Registrar venda ganhou um clique pelo "+ Novo"; em *Vendas → Pagamentos* o botão continua direto. Na Etapa 2 dá para pôr atalhos dessas ações no *Hoje*, se quiser.

## 8. Etapa 2 — visual premium (concluída)

- **Tokens únicos** em `app/globals.css` (`--elite-*`): dourados, superfícies, linhas, sombras, raio e curva de movimento. No código as cores viraram classes (`bg-gold`, `text-gold-soft`, `bg-surface`, `text-subtle`…) e não ficaram mais cores soltas nas telas.
- **Superfícies:** cartões em vidro escuro com fio dourado no topo; janelas, menus e painéis no mesmo vidro. O fundo ganhou brilho dourado e uma grade quase invisível.
- **Botão dourado** com gradiente metálico e brilho ao passar o mouse; campos com foco em halo dourado.
- **Cabeçalho de cada área:** ícone em vidro dourado, nome da empresa e título com brilho.
- **Empresa assinante:** o nome dela é a marca principal da barra lateral.
- **Indicadores:** padronizados, com variação contra o mês anterior quando há dois meses com dados. "Sem dados suficientes" aparece como um traço discreto, com o motivo na explicação.
- **Celular:** as tabelas viram cartões (cidades, embaixadores, pagamentos, canais, custos, histórico, time).
- **Telas vazias:** mostram o próximo passo e o botão dele, quando a pessoa pode fazer.
- **Movimento:** a área entra subindo de leve. Para quem pede menos movimento no aparelho, nada se mexe.
- **Acessibilidade:** o texto auxiliar passou a ter contraste AA (antes ~4:1, agora acima de 5:1); o contorno de foco é dourado e visível no teclado.

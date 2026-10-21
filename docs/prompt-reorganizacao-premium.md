# Prompt — Reorganização das abas e visual premium Elite

> Para usar: cole este texto em uma nova conversa com o Claude neste repositório (ou peça "siga o docs/prompt-reorganizacao-premium.md").

---

## Contexto

Você está trabalhando na **Elite Expansion X** (repositório `elite-expansion-x`, branch `claude/executar-projeto-2ehft2`): plataforma de expansão por cidades — mapa, pessoas, locais, atendimento até a venda, embaixadores, mentorados e indicadores. A Elite Frascaroli Academy usa e também vende por assinatura: cada empresa assinante tem um ambiente só dela, com a plataforma inteira.

Stack: Next 16 (vinext) + React 19 em Cloudflare Workers com D1, Tailwind, componentes shadcn/Radix, lucide-react, maplibre. Identidade: preto profundo (#080807), dourado Elite (#c9a227 / #d6b94f), emblema oficial em `public/elite-emblem.png`.

Funções: Administrador, Coordenação (1 cidade), Líder (1 cidade), Comercial/Executivo de Vendas, Embaixador (portal próprio), Mentorado (portal próprio). Donos da plataforma veem ainda a aba Assinaturas.

## Como está hoje (o problema)

A tela principal (`app/expansion-dashboard.tsx`) tem **uma fileira de até 14 abas** no Administrador:

Início · Cidades · Mapa territorial · Empresas e locais · Embaixadores · Vendas e relacionamento · CRM e pagamentos · Metas e desempenho · Operação local · Custos · Time e acessos · Portal · Configurações · Assinaturas

Coordenação e Líder veem 10; Comercial vê 5 (Vendas e relacionamento, Mapa, Empresas e locais, CRM e pagamentos, Metas e desempenho).

Além disso, o topo tem 6 botões de ação (Mapear, Novo lead, Registrar venda, Embaixador, Cidade, Exportar), a agenda, uma barra de filtros que aparece só em algumas abas, e o seletor de organização com "Nova organização" e "Assessores".

Pontos de confusão já percebidos:
- **Vendas e relacionamento** (acompanhamento/agenda) e **CRM e pagamentos** (funil e vendas) tratam da mesma jornada em dois lugares.
- **Mapa territorial**, **Empresas e locais** e **Cidades** são o mesmo território em três abas.
- **Metas e desempenho**, os indicadores do **Início** e **Custos** são três visões de resultado separadas.
- **Portal**, **Time e acessos** e **Configurações** são administração espalhada.
- **Nova organização** no topo duplica a criação de empresa da aba Assinaturas (e cria empresa sem plano).
- Em telas menores, a fileira de abas some para a direita e a pessoa não sabe o que existe.

## O que eu quero

1. **Clareza total**: qualquer pessoa, em qualquer função, entende em 5 segundos onde está, o que precisa fazer hoje e onde fica cada coisa.
2. **Reorganizar a navegação** em poucas áreas com nome claro, no lugar da fileira de abas.
3. **Visual premium futurista, nível Elite**: sofisticado, escuro, dourado, com profundidade e movimento sutil — sem perder legibilidade nem velocidade.
4. **Nada se perde**: toda funcionalidade, permissão, regra de LGPD e limite do plano continua igual. É reorganização e acabamento, não reescrita do servidor.

## Etapa 0 — Diagnóstico (entregar ANTES de mudar qualquer tela)

Leia o código e me entregue, em português simples:

1. **Inventário**: cada aba, cada botão do topo e cada janela (dialog) — o que faz, quem vê (por função), quantos cliques até a ação principal.
2. **Mapa de sobreposições**: o que aparece duplicado ou em lugar inesperado.
3. **Proposta de arquitetura** com as áreas, o que entra em cada uma, e a navegação **por função** (o que o Administrador, a Coordenação/Líder e o Comercial veem). Ponto de partida que aceito ajustar:
   - **Hoje** (comando do dia): agenda, próximos passos, alertas, Primeiros passos, indicadores-chave.
   - **Território**: cidades, mapa, locais/empresas, pessoas, importação — com o botão **Mapear** como ação principal.
   - **Vendas**: um único fluxo do atendimento ao pagamento (acompanhamento + funil + vendas confirmadas), com visão lista/quadro.
   - **Rede**: embaixadores, mentorados (portal), parceiros, eventos e materiais.
   - **Resultados**: metas, desempenho, produção por mapeador, custos e eficiência, relatórios e exportação.
   - **Gestão** (só administração): time e acessos, portal, configurações, plano da empresa, histórico.
   - **Plataforma** (só donos): assinaturas e assessores.
4. **Lista do que juntar, mover, renomear ou retirar**, com o motivo de cada item.
5. **Riscos** (permissões, links que mudam, testes que dependem dos nomes das abas) e como evitar.

Pare aqui e espere minha aprovação.

## Etapa 1 — Navegação nova

- Computador: **barra lateral** com as áreas (ícone + nome), recolhível; dentro da área, sub-abas curtas.
- Celular (390 px): **barra inferior** com até 5 áreas + "Mais"; nada de rolagem horizontal escondida.
- Cabeçalho limpo: organização atual, busca rápida (pessoa, local, lead), um único botão de ação principal **"+ Novo"** (Mapear, Lead, Venda, Cidade, Embaixador) e o perfil.
- Filtros só onde fazem sentido, sempre no mesmo lugar dentro da área.
- A área e a sub-aba ficam na URL (ex.: `?org=1&area=vendas&ver=funil`), para links diretos e o botão voltar funcionar.
- Cada função abre na área que mais usa (Comercial → Vendas; Coordenação → Território; Administrador → Hoje).
- Retirar "Nova organização" do topo (criação só em Assinaturas, com plano).

## Etapa 2 — Sistema visual premium Elite

Criar um padrão único e aplicar em todas as telas:
- **Tokens** (cores, espaçamentos, raios, sombras, tipografia) em `app/globals.css`, sem cores soltas no código.
- Superfícies em camadas: preto profundo, vidro escuro com borda dourada fina, brilho sutil no item ativo.
- Tipografia com hierarquia clara: título da área, subtítulo do que fazer, números grandes nos indicadores.
- Cartões de indicador padronizados (valor, variação, explicação em uma linha).
- Tabelas que viram cartões no celular.
- Estados vazios que ensinam o próximo passo ("Nenhuma cidade ainda — Cadastrar a primeira").
- Movimento sutil (entrada de painéis, hover, carregamento) respeitando `prefers-reduced-motion`.
- Emblema Elite sem quadrado preto; nas empresas assinantes, o nome da empresa em destaque.
- Acessibilidade: contraste AA, foco visível, navegação por teclado, textos de leitor de tela.

## Etapa 3 — Clareza dos textos

- Nomes curtos e iguais em todo lugar (o botão chama a mesma coisa que a tela que ele abre).
- Cada área com uma frase "para que serve" e a ação principal destacada.
- Revisar mensagens de erro e de sucesso: dizer o que aconteceu e o que fazer.

## Regras que não mudam

- Permissões no servidor, isolamento entre empresas, limites do plano e Assessoria Elite continuam como estão.
- LGPD: pessoa nunca marcada na residência; atendimento só com autorização.
- Mentorado e Embaixador continuam com o portal próprio (receber só o novo visual).
- Não quebrar links existentes `/?org=` nem o login.

## Como validar cada etapa

- `npx tsc --noEmit`, lint dos arquivos mexidos e `npm test` (hoje 88 testes) passando; atualizar os testes que dependem dos nomes das abas.
- Teste no navegador por função (Administrador, Coordenação, Líder, Comercial, Embaixador, Mentorado, empresa assinante e dono da plataforma) em **1440 px** e **390 px**: sem rolagem horizontal, sem erro no console, todas as áreas abrindo.
- Capturas de tela antes/depois de cada área.
- Medir: quantos cliques até as 5 ações mais usadas (mapear pessoa, iniciar atendimento, registrar retorno, registrar venda, convidar pessoa) — devem diminuir ou ficar iguais.
- Publicar no ambiente de teste a cada etapa e atualizar `docs/kit-de-lancamento.md` e `/guia` com os nomes novos.

## Entrega

Uma etapa por vez, cada uma com: o que mudou (em palavras simples), capturas antes/depois, testes, e o que vem a seguir. Commit e push na branch `claude/executar-projeto-2ehft2`, sem abrir PR.

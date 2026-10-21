# Kit de lançamento — Elite Expansion X

Tudo o que é preciso para colocar a equipe para mapear e vender na plataforma.

**Endereço:** https://elite-expansion-x-teste.elitefrascarolisystems.workers.dev
**Entrar:** `/entrar` com e-mail e senha · **Guia do mapeador:** `/guia` (página aberta, pode ser enviada a qualquer pessoa)

---

## 1. Antes de convidar (administrador, ~15 min)

1. **Cidades da primeira onda** — aba *Cidades* → *Nova cidade*. Confira se as cidades certas estão cadastradas.
2. **Pontos de referência** — botão *Mapear*: cadastre os Escritórios Elite e os networks principais de cada cidade e marque no mapa. Eles são a base onde as pessoas serão ligadas.
3. **Convide a equipe** — aba *Time e acessos* → *Convidar equipe*. Cole uma pessoa por linha:
   `nome; e-mail; função; cidade; cargo; ciclo de mentoria`
   Ex.: `Flávia Silva; flavia@...; Executiva de Vendas; ; Executiva de Vendas; 2`
4. **Envie os links** — cada pessoa recebe a mensagem pronta (botão *WhatsApp* ou *Copiar mensagem*). O link vale 72 horas e só funciona uma vez.
5. **Acompanhe** — em *Time e acessos* aparece quem já entrou, quem está com convite pendente e de quem o link venceu (*Novo link*).

## 2. Mensagem para o grupo da equipe (copiar e colar)

> Pessoal, a **Elite Expansion X** está no ar! É onde vamos mapear nossas cidades, pessoas, empresas e networks e acompanhar cada atendimento até a venda.
>
> 1. Cada um vai receber no privado um **link pessoal** para criar a senha (vale 72h).
> 2. Depois é só entrar em https://elite-expansion-x-teste.elitefrascarolisystems.workers.dev/entrar
> 3. Antes de começar, leiam o guia (2 minutos): https://elite-expansion-x-teste.elitefrascarolisystems.workers.dev/guia
>
> Regra de ouro: **nunca cadastrar endereço de casa de ninguém** e só iniciar atendimento de quem autorizou o contato. Dúvidas, falem comigo.

## 3. O que cada função faz no primeiro dia

| Função | Vê | Primeiro passo |
|---|---|---|
| **Administrador** | Tudo da organização | Seguir os *Primeiros passos* na aba Início e convidar a equipe |
| **Coordenação** (1 cidade) | A própria cidade | *Mapear*: locais da cidade e as pessoas de cada um |
| **Líder** (1 cidade) | A própria cidade | Conferir o mapa e mapear quem conhece |
| **Comercial / Executivo de Vendas** | O que mapeou e os próprios atendimentos | *Mapear* → *Iniciar atendimento* → seguir o F.E.C.H.A. |
| **Embaixador** | Só o próprio portal | Aceitar as regras, concluir o treinamento, usar o link de indicação |

## 4. Rotina diária (mapeador e vendedor, 10 minutos para começar)

1. **Sua agenda** (aparece ao entrar): resolva primeiro os retornos atrasados e os de hoje.
2. **Mapear**: cidade → local → pessoas, com vínculo e papel.
3. **Iniciar atendimento** de quem autorizou contato: vira lead e oportunidade com o primeiro retorno marcado.
4. **Vendas e relacionamento**: siga o roteiro do Método F.E.C.H.A.; ao registrar o pagamento confirmado, a oportunidade fecha sozinha como *Ganho*.

## 5. Rotina semanal da gestão

- Aba **Início** → *Cobertura por cidade* (locais validados, pessoas ligadas a locais) e *Produção por mapeador* (total e últimos 7 dias).
- **Time e acessos** → quem ainda não entrou.
- **Metas e desempenho** e **CRM e pagamentos** → funil e vendas confirmadas.

## 6. Regras que não mudam (LGPD)

- Pessoa nunca é marcada na residência: aparece no local ligado a ela ou no centro da cidade.
- Registrar só o necessário: nome, cidade, local e vínculo.
- Atendimento/lead só com autorização de contato.
- Cada pessoa usa o próprio login; tudo fica registrado no histórico.

## 7. Validação feita antes do lançamento (21/10/2026)

Cada função foi testada no navegador, do primeiro acesso ao primeiro registro, no computador (1440 px) e no celular (390 px):

| Função | Boas-vindas | Todas as abas sem erro | Celular sem quebra | Fluxo completo |
|---|---|---|---|---|
| Administrador | ✔ | ✔ (12 abas) | ✔ | Mapear → atendimento → agenda → venda paga → *Ganho* ✔ |
| Coordenação | ✔ | ✔ (10 abas) | ✔ | Mapear → atendimento → agenda → venda paga → *Ganho* ✔ |
| Líder | ✔ | ✔ (10 abas) | ✔ | Mapear → atendimento → agenda → venda paga → *Ganho* ✔ |
| Comercial | ✔ | ✔ (5 abas) | ✔ | Mapear → atendimento → venda paga → *Ganho* ✔ (após correção) |
| Embaixador | ✔ | Portal ✔ | ✔ | Treinamento, link de indicação ✔ |

Correção feita na validação: o Executivo de Vendas não conseguia iniciar atendimento de pessoa ligada a um local cadastrado por outra pessoa (o lead era salvo e a oportunidade, recusada). Corrigido, com teste automático.

Testes automáticos: 78 passando. Não verificável neste ambiente (sem internet): imagens do mapa de fundo, busca de endereço real e QR Code — conferir no primeiro uso.

## 8. Portal de mentorados

Mentorados têm um **portal só deles**: a jornada (etapas que marcam como concluídas), o próximo encontro, o contato da equipe, os materiais liberados e o botão **Indicar alguém**. Eles **não veem nada** da operação da equipe.

1. **Convidar** — *Time e acessos* → *Convidar equipe*, com a função `Mentorado` (ex.: `Marina Souza; marina@...; Mentorada exclusiva; Esmeraldas; ; 2`). A mensagem do convite já fala do portal.
2. **Montar a jornada** — aba *Portal* → *Jornada*. Dá para começar com a sugestão e ajustar ao método Elite.
3. **Ligar cada mentorado** — aba *Portal* → *Editar*: contato da equipe e próximo encontro.
4. **Materiais** — *Operação local* → *Material*, com *Para quem: Mentorados ou Todos* e situação *Aprovado*.
5. **Indicações** — o que o mentorado indica entra como lead com origem *Indicação*, direto na agenda do contato dele.

## 9. Empresas assinantes (a plataforma para outras empresas)

A Elite Expansion X é independente de qualquer outra plataforma da Elite (como a Elite Map X). Uma **empresa assinante** usa a plataforma inteira, como a Elite usa, mas **em um ambiente só dela**: cidades, mapa, equipe, vendas, portal de mentorados e indicadores próprios, sem ver nada da Elite nem de outros assinantes.

1. **Criar** — aba *Assinaturas* (só os donos da plataforma veem) → *Nova empresa assinante*: nome da empresa, responsável, plano, valor mensal, data "pago até" e limites. A empresa começa vazia, só dela.
2. **Liberar o acesso** — você entra no ambiente dela pela *Assessoria Elite* (aparece um aviso para o cliente) → *Time e acessos* → *Gerar link* do responsável. A mensagem fala da plataforma de expansão **da empresa**, não da Elite.
3. **O responsável assume** — cria a senha, convida o próprio time e segue os *Primeiros passos* dele.
4. **Acompanhar** — pela *Assessoria Elite*, a Elite pode ver e apoiar o cliente; cada alteração fica marcada no histórico dele, e a aba *Configurações* do cliente mostra quem da Elite tem acesso.
5. **Plano e limites** — em *Assinaturas* → *Plano*: usuários da equipe (mentorados não contam), cidades ativas (as planejadas não contam), e se a empresa pode importar planilhas, exportar relatórios e usar mapas de satélite/Street View. Os limites valem na hora, no servidor: quem já está cadastrado continua; só não entram pessoas ou cidades novas além do limite, com uma mensagem pedindo para falar com a Elite. A empresa vê o próprio plano e o uso em *Configurações*.
6. **Cobrança e suspensão** — a cobrança é feita fora da plataforma. Em *Assinaturas* você vê a receita mensal, quem está com o pagamento vencido e quem vence nos próximos 7 dias. Quem não pagou: *Suspender* (com o motivo). Ninguém da empresa entra (nem a Assessoria Elite) e todos veem o aviso "assinatura suspensa"; os dados ficam guardados. *Reativar* devolve o acesso como estava. Tudo fica no histórico das assinaturas.

## 10. Pendências para depois do lançamento

- E-mails da Flávia e do Fabricio para gerar os logins (ou convidar pela tela).
- Decidir se este endereço de teste vira o oficial ou se criamos um endereço definitivo.
- Sistema de Prospecção Elite 1.0 / Banco de Ganchos (aguardando material).
- Mapas impressos (A3/PDF).
- Cobrança automática da assinatura (boleto/Pix/cartão) e logo de cada empresa assinante (opcional).

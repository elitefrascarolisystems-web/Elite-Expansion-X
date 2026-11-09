# Diagnóstico de simplificação (08/11/2026)

Leitura do código de todas as telas, cadastros e formulários, por função, para deixar a plataforma mais simples e sem confusão. **Nada foi mudado.** Cada item diz o que muda, o que deixaria de existir e o risco. Você aprova item por item (ou por grupo) e eu aplico em partes, com testes e publicação no ambiente de teste.

Sem números reais neste documento: o repositório é público. A consulta do fim (parte 6) conta, no banco real, quanto cada recurso é usado. Rode antes de aprovar as remoções (parte 1): o que for usado de verdade passa para "simplificar" em vez de "tirar".

## A ideia da plataforma (a régua usada aqui)

Mapear pessoas e locais de uma cidade → atender quem autorizou → vender → transformar cliente em indicador e multiplicador → acompanhar a meta. Tudo que não ajuda nesse caminho, ou repete outra tela, é candidato a sair ou a juntar.

## Como está hoje

- **7 áreas, 27 abas** (a gestão vê quase todas; o Comercial vê 9).
- **11 ações** no "+ Novo".
- **Cerca de 35 formulários.** Os maiores:
  - Novo atendimento: 20 campos;
  - Fechamento consolidado da cidade: 16;
  - Cidade: 10;
  - Embaixador: 10;
  - Evento: 10;
  - Material: 10;
  - Atividade do embaixador: 9.
- **Quatro jeitos de registrar "algo que foi feito":**
  - interação no mapa (Ação, Visita, Follow-up, Interação, Missão);
  - atividade do atendimento (Contato, Follow-up, Reunião, Proposta);
  - comando do acompanhamento (F.E.C.H.A.);
  - tarefa ou missão do embaixador.
- **Três "situações" diferentes para um mesmo local:**
  - a situação do cadastro (Identificada, Selecionada, Contato autorizado, Cliente, Cliente assinante, Parceira);
  - a situação do lugar (Abrir, Plantar, Avançar, Dominado);
  - "Parceira" via parceiro vinculado.
- **Duas "Etapas" no mesmo atendimento:**
  - a do lead (Lead informado, Lead válido, Oportunidade, Cancelado);
  - a da oportunidade (Novo, Contato, Qualificado, Reunião, Proposta, Negociação, Ganho, Perdido), mais a temperatura.
- **Duas situações de venda que se confundem com etapa:** "Em negociação" e "Venda confirmada" ficam ao lado de "Pagamento confirmado", e o próprio sistema avisa que "Ganho não significa pagamento confirmado".
- **Palavras misturadas:** "lead", "atendimento" e "oportunidade" aparecem para a mesma coisa (ex.: "Leads válidos", "Meta de leads frios", "Novo atendimento").

---

## 1. Tirar (não faz sentido com a ideia da plataforma ou repete outra coisa)

| # | O quê | Por quê | O que deixa de existir | Risco |
|---|---|---|---|---|
| T1 | "+ Novo → Novo atendimento · pessoa do mapa" | Só leva ao mapa e mostra um aviso; não cadastra nada. "Iniciar atendimento" já está na ficha do mapa e na página da pessoa. | Um item do "+ Novo". | Nenhum. |
| T2 | Campos UTM source, UTM medium, UTM campaign e Campanha no Novo atendimento | Ninguém digita UTM à mão; isso só serviria a um formulário de site. Origem já é coberta por Canal e Quem indicou. | 4 campos (os dados antigos ficam no banco e na cópia LGPD). | Baixo; se houver campanha paga, o Canal "Mídia paga" continua. |
| T3 | Campos Embaixador, Parceiro, Evento e Conteúdo no Novo atendimento | Repetem o Canal: se o canal é Embaixador, aí sim pergunta qual. Hoje aparecem os 4 sempre. | 4 campos fixos (viram 1 pergunta que só aparece conforme o canal). | Baixo. |
| T4 | Situações de venda "Em negociação" e "Venda confirmada" | Negociação é etapa do atendimento, não venda. A venda passa a ter só: Pagamento confirmado, Cancelada, Reembolsada. Acaba o aviso "Ganho não é pagamento". | 2 opções. Vendas antigas nessas situações ficam visíveis como "Em negociação (antiga)" até alguém confirmar ou cancelar. | Médio: confira a consulta da parte 6 (quantas vendas estão nessas situações). |
| T5 | "Registrar atividade" do embaixador (formulário de números autodeclarados por período: ações, conteúdos, eventos, leads indicados, pagamentos atribuídos, custo de apoio) | Os leads e pagamentos reais do embaixador já vêm dos atendimentos dele; os números digitados duplicam e podem divergir. | O formulário e a tabela ambassador_updates passam a só leitura (histórico antigo continua). | Médio: se a gestão usa isso como relatório do embaixador, troque por "Relato" curto (parte 3). |
| T6 | Categorias "Ação", "Follow-up" e "Missão" na interação do mapa | Follow-up é do atendimento; missão é tarefa do embaixador; visita agora é o plantio. Fica "Interação" (conversa com a pessoa) e "Visita" (plantio). | 3 categorias. As antigas aparecem como estão. | Baixo. |
| T7 | Papéis de pessoa "Vendedor" e "Equipe" (Papéis e responsáveis) | Quem é da equipe tem login (Time e acessos); marcar papel na pessoa do mapa duplica e confunde ("Vendedor" vs. função Comercial). | 2 papéis. Os já gravados continuam até a gestão revisar. | Baixo. |
| T8 | Papel de pessoa "Network" | Repete o vínculo "Membro do network" com o local. | 1 papel (vira só o vínculo). | Baixo. |
| T9 | "Fase" da cidade (Preparação, Piloto, Ativa, Em espera) | Repete a "Situação" (Planejada, Ativa, Pausada) e a "Decisão" calculada. | 1 campo no cadastro da cidade e no fechamento consolidado. | Baixo. |
| T10 | Campo "Alcance informativo", "Leads informativos" e "Vendas informativas" no Evento | Números digitados que não entram em nenhum cálculo ("informativo"); os leads reais do evento vêm do Canal "Evento". | 3 campos. | Baixo. |
| T11 | "Versão" do Material | Ninguém controla versão à mão; a data de cadastro já diz qual é o mais novo. | 1 campo. | Nenhum. |

## 2. Juntar (duas coisas que fazem o mesmo)

| # | O quê | Proposta | Ganho |
|---|---|---|---|
| J1 | Vendas → **Atendimentos** e Vendas → **Pagamentos** (as duas listam os atendimentos com etapa e venda) | Uma aba só, "Atendimentos", com o filtro "Com pagamento"; o botão "Registrar venda e pagamento" fica nela. | −1 aba; acaba a dúvida "onde está meu atendimento". |
| J2 | Vendas → **Método F.E.C.H.A.** e Vendas → **Pós-venda** como abas separadas | Viram filtros da Agenda ("Em F.E.C.H.A.", "Pós-venda"); o roteiro do método continua na ficha do atendimento. | −2 abas; Vendas fica com Agenda · Atendimentos · Ganchos. |
| J3 | Vendas → **Ganchos** e Rede → **Materiais** (os dois são textos e peças aprovadas para usar com as pessoas) | Uma biblioteca "Materiais e ganchos", com o tipo (Gancho, Mensagem, Vídeo, Arte, Roteiro). Fica em Rede para a gestão; o Comercial continua achando os ganchos por "Usar gancho" na ficha. | −1 aba; um só lugar para aprovar o que a equipe pode enviar. |
| J4 | Três importações de pessoas: **Importar pessoas** (mapa), **Importar rede** (Indicações) e **Importar empresas** (Locais) | Um botão "Importar planilha" que reconhece o modelo (pessoas e rede viram um modelo só: pessoa, local, vínculo, quem indicou, venda opcional). Empresas continua como modelo separado dentro do mesmo botão. | Menos dúvida sobre qual planilha usar. |
| J5 | **Interação no mapa** e **Atividade do atendimento** | Uma regra: com atendimento, registra no atendimento (Contato, Reunião, Proposta); sem atendimento, "Interação" no mapa. A página da pessoa decide sozinha qual abrir no "Registrar interação". | Acaba "onde eu anoto a conversa?". |
| J6 | **Parceiro** (cadastro em Rede → Parceiros), **Local com situação "Parceira"** e **papel de pessoa "Parceiro"** | O parceiro é um local (estabelecimento) com a marca "Parceiro" e um contato; some o cadastro separado de parceiro e o papel de pessoa. | 1 conceito em vez de 3; o parceiro aparece no mapa como local. Migração dos parceiros antigos para locais, com sua aprovação. |
| J7 | **Situação do cadastro do local** (Identificada…Parceira) e **Situação do lugar** (Abrir…Dominado) | Fica só a situação do lugar (automática) e a marca "Parceiro" (J6). "Cliente" e "Contato autorizado" já são calculados hoje. | Um local tem uma situação só. |
| J8 | **Custo** em 4 lugares (Registrar custo, custo no fechamento consolidado, custo do evento, custo de apoio do embaixador) | Um só: "Registrar custo" (com evento ou embaixador opcional). O consolidado continua só para cidades sem registro detalhado. | Custos e canais passa a bater com tudo. |
| J9 | **Rotina do dia** (frios, quentes, contatos por pessoa e por dia) e **Relatório diário** (impedimentos e plano) | Um cartão "Meu dia" por pessoa: a rotina e o relato juntos, na mesma tela. | −1 formulário. |

## 3. Simplificar (fica, mas mais curto e mais claro)

| # | O quê | Proposta |
|---|---|---|
| S1 | **Novo atendimento** (20 campos) | 6 campos visíveis: Cidade, Nome, WhatsApp ou e-mail, Quem indicou, Canal (com a pergunta extra só quando precisa), Responsável. "Como a autorização foi recebida" e "Finalidade" viram uma caixa com o texto padrão, editável em "Mais detalhes". Etapa começa sempre em "Lead válido". |
| S2 | **Duas etapas no atendimento** | Uma etapa só, a da oportunidade, em 5 passos: Novo · Em conversa · Proposta · Ganho · Perdido (Contato, Qualificado, Reunião e Negociação viram "Em conversa"). "Lead informado / Lead válido / Oportunidade" deixam de aparecer na tela; "Cancelado" vira "Perdido" com o motivo (a revogação continua separada, em "Etapa e autorização" → "Autorização"). Temperatura fica opcional. |
| S3 | **Palavras** | Na tela, uma palavra para cada coisa: **Pessoa** (do mapa), **Atendimento** (a conversa com quem autorizou; some "lead" e "oportunidade" das telas), **Venda** (só com pagamento confirmado), **Local** (estabelecimento) e **Lugar** (o vínculo da pessoa com um local). Ex.: "Leads válidos" → "Atendimentos", "Meta de leads frios" → "Rotina: atendimentos frios". |
| S4 | **Cidade** (10 campos) | Cadastro com Nome, Estado, Líder e Situação. CAC máximo, Orçamento, Meta de embaixadores e Fonte dos indicadores vão para "Mais detalhes" (só a gestão). |
| S5 | **Fechamento consolidado** (16 campos) | Só aparece para cidade marcada como "Consolidado". Mostra 6 campos: período, atendimentos, vendas, receita, custo, observação; o resto em "Mais detalhes". |
| S6 | **Embaixador** (10 campos) | Nome, Cidade, WhatsApp ou e-mail, Nível e Situação. Código único gerado sozinho; Onboarding e Treinamento (%) saem do formulário e vêm do portal do embaixador; Motivo de pausa só aparece quando a situação é "Pausado". As 8 situações viram 4: Em preparação · Ativo · Pausado · Desligado. |
| S7 | **Papéis e responsáveis** (8 situações por papel) | 3 situações: Ativo · Pausado · Encerrado. Papéis que ficam: Mentor, Mentorado, Cliente assinante (depois de T7 e T8). |
| S8 | **Material** (10 campos) | Título, Tipo, Para quem, Link e Instruções; Canal, Validade e Situação com padrão (Aprovado, sem validade). |
| S9 | **Regras e cálculos** | Mostrar as regras em frases ("Uma cidade avança quando tem 5 embaixadores ativos e 3 pagamentos…") com "Editar" para quem quer mudar; os números soltos ficam dentro do editar. "Regra de atribuição" e "Link-base de indicação" só se a empresa usa embaixador com link. |
| S10 | **Hoje** | Na ordem: Quanto falta (meta) → Retornos (agenda) → Plantio → Primeiros passos (só até concluir) → Alertas. Os 4 indicadores (atendimentos, clientes, conversão, receita) ficam em Resultados → Visão geral, que já os tem, ou num bloco recolhido. |
| S11 | **Resultados → Visão geral** e **Custos e canais** | Juntar custos dentro da Visão geral (um bloco "Custo por canal"), já que os filtros e o período são os mesmos. −1 aba. |
| S12 | **Gestão** (até 8 abas para o Administrador) | Agrupar em 4: Equipe (Time e acessos) · Empresa (Identidade, Plano, Regras e cálculos, Avisos por e-mail) · Privacidade (LGPD) · Histórico. Assessoria Elite vira um bloco dentro de Equipe. |
| S13 | **+ Novo** (11 ações) | "No dia a dia": Mapear local e pessoas · Novo atendimento · Registrar venda · Registrar visita. "Cadastros": Cidade, Embaixador, Evento, Material, Custo, Convidar equipe. Tarefa sai do + Novo (fica dentro de Embaixadores). |
| S14 | **Ficha territorial do mapa** e **Página da pessoa** | A ficha do mapa fica curta (nome, onde aparece, situação e 2 botões: "Abrir página da pessoa" e "Iniciar atendimento"); todo o resto (editar, papéis, interação, venda) mora na página da pessoa. |

## 4. Manter como está

Mapa e seus modos · Mapeamento guiado (com setor obrigatório) · Página da pessoa e Lugares · Agenda e acompanhamento · Calculadora e metas · Indicações e árvore da rede · Portal do mentorado e do embaixador · Privacidade (LGPD) · Avisos por e-mail · Busca Ctrl+K · Guias "Como usar" · Bairros · Impressão do mapa · Plataforma (assinaturas, pedidos, assessores).

## 5. Resultado esperado

- **Abas:** de 27 para cerca de 19.
  - Vendas: de 6 para 3 (J1, J2, J3).
  - Resultados: de 5 para 4 (S11).
  - Gestão: de 8 para 4 (S12).
- **"+ Novo":** de 11 para 10 ações, em 2 grupos claros.
- **Novo atendimento:** de 20 para 6 campos visíveis.
- **Situações:** um local tem uma situação só; um atendimento tem uma etapa só; uma venda tem 3 situações.
- **Vocabulário:** Pessoa, Atendimento, Venda, Local, Lugar.

### Ordem sugerida (cada parte com testes, navegador por função, guias e publicação no teste)
1. **Sem risco:** T1, T2, T3, T6, T9, T10, T11, S1, S3, S8, S13.
2. **Vendas:** J1, J2, S2, T4 (precisa da consulta da parte 6).
3. **Rede:** J3, J6, J7, T5, T7, T8, S6, S7 (J6 precisa migrar os parceiros antigos; aprovação sua).
4. **Resultados e Gestão:** J8, J9, S4, S5, S9, S10, S11, S12, S14, J4, J5.

O que já está gravado nunca é apagado: campos e situações que saem da tela continuam no banco e na cópia LGPD, e aparecem marcados como antigos onde ainda houver registros.

## 6. Consulta de uso (rode no banco real; devolve só contagens, nenhum nome)

```sql
SELECT 'cidades consolidadas' AS item, COUNT(*) AS n FROM cities WHERE organization_id = 1 AND tracking_mode = 'Consolidado'
UNION ALL SELECT 'fechamentos consolidados', COUNT(*) FROM city_updates u JOIN cities c ON c.id = u.city_id WHERE c.organization_id = 1
UNION ALL SELECT 'atividades de embaixador (autodeclaradas)', COUNT(*) FROM ambassador_updates a JOIN ambassadors m ON m.id = a.ambassador_id JOIN cities c ON c.id = m.city_id WHERE c.organization_id = 1
UNION ALL SELECT 'tarefas de embaixador', COUNT(*) FROM tasks WHERE organization_id = 1
UNION ALL SELECT 'parceiros (cadastro separado)', COUNT(*) FROM partners p JOIN cities c ON c.id = p.city_id WHERE c.organization_id = 1
UNION ALL SELECT 'eventos', COUNT(*) FROM events e JOIN cities c ON c.id = e.city_id WHERE c.organization_id = 1
UNION ALL SELECT 'materiais', COUNT(*) FROM contents WHERE organization_id = 1
UNION ALL SELECT 'ganchos', COUNT(*) FROM prospect_hooks WHERE organization_id = 1
UNION ALL SELECT 'custos', COUNT(*) FROM costs k JOIN cities c ON c.id = k.city_id WHERE c.organization_id = 1
UNION ALL SELECT 'rotinas do dia', COUNT(*) FROM seller_goals WHERE organization_id = 1
UNION ALL SELECT 'relatos diários', COUNT(*) FROM seller_reports WHERE organization_id = 1
UNION ALL SELECT 'decisões de cidade registradas', COUNT(*) FROM city_decisions WHERE organization_id = 1
UNION ALL SELECT 'vendas Em negociação ou Venda confirmada', COUNT(*) FROM sales s JOIN cities c ON c.id = s.city_id WHERE c.organization_id = 1 AND s.status IN ('Em negociação','Venda confirmada')
UNION ALL SELECT 'atendimentos com UTM ou campanha', COUNT(*) FROM leads l JOIN cities c ON c.id = l.city_id WHERE c.organization_id = 1 AND (l.campaign <> '' OR l.utm_source <> '' OR l.utm_medium <> '' OR l.utm_campaign <> '')
UNION ALL SELECT 'interações do mapa (Ação, Follow-up, Missão)', COUNT(*) FROM territory_actions t JOIN cities c ON c.id = t.city_id WHERE c.organization_id = 1 AND t.category IN ('Ação','Follow-up','Missão')
UNION ALL SELECT 'papéis Vendedor, Equipe ou Network', COUNT(*) FROM territory_roles r JOIN cities c ON c.id = r.city_id WHERE c.organization_id = 1 AND r.role IN ('Vendedor','Equipe','Network')
UNION ALL SELECT 'locais com situação manual (Identificada, Selecionada)', COUNT(*) FROM businesses WHERE organization_id = 1 AND status IN ('Identificada','Selecionada');
```

Mande o resultado (só os números) e eu ajusto o que for usado de verdade: sai da lista "tirar" e vai para "simplificar".

## 7. Andamento

- **Parte 1 (sem risco) — feita.** T1 (sai "Novo atendimento · pessoa do mapa" do + Novo), T2 e T3 (sem UTM e Campanha; um só "Como chegou" com a pergunta extra conforme o canal), T6 (interação do mapa: Interação ou Visita; as antigas aparecem marcadas "(antigo)" ao editar), T9 (Fase da cidade sai das telas; o valor gravado continua), T10 (Evento sem alcance, leads e vendas informativos), T11 (Material sem Versão), S1 (Novo atendimento com 6 campos visíveis e o resto em "Mais detalhes"), S3 ("lead" vira "atendimento" nas telas; "oportunidade" sai junto com a parte 2, que mexe nas abas de Vendas), S8 (Material com 5 campos; Canal, Situação e Validade em "Mais detalhes", com padrão Aprovado) e S13 (+ Novo em dois grupos; Tarefa fica em Rede → Embaixadores). "Registrar visita" no + Novo fica para a parte 3, que trata de Locais e lugares (precisa escolher o local antes).
- **Parte 2 (Vendas) — feita.** J1 (Pagamentos virou o filtro "Com pagamento" de Atendimentos, com o botão "Registrar venda e pagamento" no topo), J2 (Método F.E.C.H.A. e Pós-venda viraram filtros da Agenda; o roteiro continua na ficha), S2 (a etapa aparece em 5 passos: Novo · Em conversa · Proposta · Ganho · Perdido; Contato, Qualificado, Reunião e Negociação aparecem como "Em conversa" e continuam gravadas como estavam; "Lead informado/válido/Oportunidade" saíram da tela, e o atendimento informado por embaixador ou mentorado passa a valer quando alguém abre o acompanhamento; a janela "Etapa e autorização" virou "Responsável e autorização"; temperatura opcional) e T4 (venda com 3 situações; as antigas aparecem como "(antiga)" e num alerta até alguém confirmar ou cancelar; na planilha de rede, "pendente" ou "em negociação" registra só o atendimento). Os endereços antigos (?ver=pagamentos, fecha, posvenda) abrem a aba nova já filtrada. Vendas passou de 6 para 3 abas.
- **Parte 3 (Rede) — feita.** J3 (Ganchos foi para Rede → "Materiais e ganchos"; o Comercial usa por "Usar gancho" na ficha; o endereço antigo leva para lá ou para a Agenda), J6 (o parceiro é um local marcado como parceiro: "Cadastrar parceiro" cria o local, e em Locais há "Marcar como parceiro"; a migração 0033 ligou cada parceiro antigo a um local de mesmo nome na cidade ou criou um local novo com o mesmo ponto no mapa; nada foi apagado), J7 (o cadastro do local não tem mais "Situação"; fica a situação automática e o selo "Parceiro"; editar um local não reexige a situação antiga), T5 ("Registrar atividade" do embaixador saiu da gestão e do portal; o servidor recusa novos números e o histórico continua para leitura; a ativação conta o primeiro atendimento indicado), T7/T8 (Equipe, Vendedor, Network e Parceiro não se criam mais; os já gravados aparecem "(antigo)" e podem ser encerrados), S6 (embaixador com Cidade, Nome, WhatsApp ou e-mail e Nível; código gerado sozinho; 4 situações; motivo só na pausa) e S7 (papéis com Ativo, Pausado ou Encerrado). Também saíram sobras da parte 1: "Fase" no painel da cidade no mapa, a versão nos materiais e o alcance nos eventos; "CPL" virou "Custo por atendimento".
- **Parte 4 (Resultados e Gestão) — feita.** S11 (Custos e canais virou o bloco "Custo por canal" dentro de Resultados → Visão geral), S12 (Gestão em 4 abas: Equipe, com a Assessoria Elite; Empresa, com Identidade, Plano, Regras e cálculos e Avisos por e-mail; Privacidade (LGPD); Histórico; os endereços antigos abrem a aba nova), S10 (Hoje: atalhos, Quanto falta, retornos, plantio, Primeiros passos, alertas e avisos; os 4 números ficam recolhidos em "Números do período"), S4 (cidade com Nome, Estado, Líder e Situação; o resto em "Mais detalhes"), S5 (fechamento consolidado com 6 campos e o resto em "Mais detalhes"; o botão só aparece se houver cidade consolidada), S9 (regras em frases, com os números dentro de "Editar"; o link-base de indicação só aparece com embaixadores), J8 (o evento não pede mais custo; "Registrar custo" é o único lugar, com evento ou embaixador opcional), J9 (Metas e rotina: o relato do dia fica no cartão de cada pessoa, com a rotina e as atividades; botão "Meu dia: relato"), S14 (a ficha da pessoa no mapa mostra o essencial e os botões "Abrir página da pessoa" e "Iniciar atendimento"/"Abrir acompanhamento"; o resto fica em "Mais detalhes" e "Mais ações"), J5 ("Registrar interação" na página da pessoa: com atendimento, abre o acompanhamento; sem, a interação no mapa), J4 ("+ Novo → Importar planilha" com dois modelos: Pessoas e rede, e Empresas e locais; a importação de pessoas do mapa saiu, porque a da rede já traz local, vínculo e papel) e "+ Novo → Registrar visita" (escolhe o local e abre a janela de visita).

### O que não mudou de propósito
- **Rotina do dia (gestão) e relato (cada pessoa)** continuam dois formulários: um é a gestão definindo a rotina de alguém, o outro é a própria pessoa contando o dia. A tela mostra os dois juntos no cartão "Meu dia".
- **Endereços antigos** (Pagamentos, F.E.C.H.A., Pós-venda, Ganchos, Custos, Time, Regras, Identidade, Plano, Avisos, Assessoria) abrem a aba nova; o endereço no navegador pode continuar com o nome antigo.

# Prompt — Elite Expansion X pronta para registros e mapeamento da equipe

> Para usar: copie o bloco abaixo e envie ao Claude nesta mesma sessão (ou numa nova,
> no repositório `elite-expansion-x`, branch `claude/executar-projeto-2ehft2`).
> Preencha antes a seção **"Dados que eu forneço"**.

---

```text
Objetivo: deixar a Elite Expansion X pronta para começarmos os registros reais e
enviarmos os logins para o nosso time fazer os mapeamentos. A plataforma precisa
seguir uma ordem clara: quem entra pela primeira vez deve saber exatamente o que
fazer, em que ordem e onde.

Contexto do que já existe (não refazer):
- Login por e-mail e senha com link de convite (72h, uso único), funções
  Administrador, Coordenação, Líder, Embaixador e Comercial.
- Abas: Visão geral, Mapa territorial, Cidades, Embaixadores, Empresas, Equipe
  comercial, Vendas e relacionamento (Follow-up + Método F.E.C.H.A.), CRM e
  pagamentos, Operação local, Custos, Configurações.
- Mapa com locais por tipo (Empresa, Escritório Elite, Network / comunidade,
  Instituição de ensino, Ponto de encontro) e setor, e pessoas vinculadas a um local.
- Regra LGPD: pessoa nunca aparece na residência; aparece no local vinculado ou no
  centro da cidade.

Execute nesta ordem, testando e publicando ao fim de cada fase:

FASE 1 — Ordem clara na plataforma
1. Criar o painel "Primeiros passos" no topo da Visão geral, com checklist e
   progresso que se atualiza sozinho a partir dos dados:
   ① Cidades cadastradas → ② Equipe convidada → ③ Escritórios e networks no mapa →
   ④ Empresas no mapa → ⑤ Pessoas vinculadas a locais → ⑥ Embaixadores ativos →
   ⑦ Primeiros leads e follow-ups.
   Cada item com botão que leva direto à aba/formulário certo.
2. Reordenar as abas para seguir esse fluxo (Início → Cidades → Mapa → Empresas e
   locais → Pessoas/Embaixadores → Vendas e relacionamento → CRM → Operação →
   Custos → Configurações) e mostrar a cada função só as abas que ela usa.
3. Toda lista vazia deve explicar em uma frase para que serve e ter o botão de
   cadastrar o primeiro registro.
4. Cada formulário com campos obrigatórios marcados, exemplos nos campos e
   mensagens de erro em português dizendo o que corrigir.

FASE 2 — Equipe e logins
1. Convite em lote: colar uma lista (nome; e-mail; função; cidade) e gerar todos
   os links de uma vez, com botão "Copiar mensagem" e "Enviar por WhatsApp" para
   cada pessoa (texto pronto explicando o que fazer ao entrar).
2. Painel da equipe com a situação de cada pessoa: convite gerado, senha
   definida, último acesso, link vencido (com botão "Gerar novo link").
3. Primeira entrada de cada pessoa abre uma tela de boas-vindas curta com o que
   a função dela faz e o primeiro passo dela.

FASE 3 — Mapeamento guiado
1. Fluxo "Mapear" em 3 passos: escolher a cidade → cadastrar ou escolher o local
   (tipo e setor) → cadastrar as pessoas daquele local com o vínculo
   (sócio, colaborador, mentorado, membro do network...).
2. Aviso de possível duplicado (mesmo nome/telefone/endereço na cidade) antes
   de salvar.
3. Importação por planilha (CSV) de locais e pessoas, com pré-visualização,
   validação linha a linha e relatório do que entrou e do que foi recusado.
4. Indicador por cidade: locais mapeados, pessoas vinculadas, pessoas sem local,
   locais aguardando validação de endereço.
5. Registro de quem cadastrou e quando, para o administrador acompanhar a
   produção de cada mapeador.

FASE 4 — Do mapa à venda
1. Garantir o caminho completo: pessoa do mapa → lead → oportunidade →
   follow-up com o roteiro do Método F.E.C.H.A. → venda/pagamento, sem
   redigitar dados.
2. Tarefas de follow-up vencidas aparecendo para o responsável na entrada.

FASE 5 — Validação e entrega
1. Testar cada função (Administrador, Coordenação, Líder, Embaixador,
   Comercial) do primeiro acesso ao primeiro registro, no celular e no
   computador.
2. Rodar os testes, publicar e me enviar:
   - o link de acesso;
   - os links de convite gerados para a equipe;
   - um "Guia do mapeador" de 1 página (o que fazer, em que ordem, regras de
     LGPD) para eu repassar ao time.

Regras:
- Tudo em português, linguagem simples.
- Nunca gravar coordenada de residência de pessoa.
- Não apagar dados já cadastrados; mudanças no banco só por migração.
- Me pergunte apenas o que só eu posso decidir; o resto, decida e siga.
```

---

## Dados que eu forneço (preencher antes de enviar)

1. **Ambiente oficial:** manter `elite-expansion-x-teste` como oficial ou criar um
   endereço definitivo (ex.: `elite-expansion-x`)?
2. **Cidades da primeira onda:** lista de cidades/UF.
3. **Equipe a convidar:** uma linha por pessoa — `nome; e-mail; função; cidade`.
   Funções: Administrador, Coordenação, Líder, Embaixador, Comercial
   (Coordenação, Líder e Embaixador precisam de cidade).
4. **Escritórios Elite e networks** já conhecidos, com endereço.
5. **Planilhas existentes** de empresas, mentorados ou contatos (se houver) para
   importar.
6. **Chave MapTiler** (opcional) para ativar a visão de satélite.

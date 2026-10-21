# Contatos a mapear — agenda e WhatsApp

Nova aba **Contatos a mapear**, para os perfis Administrador, Coordenação, Líder e Comercial. Ela organiza a agenda do celular, que é a mesma lista de contatos do WhatsApp, para transformar conhecidos em leads autorizados.

## Implementado

- Importação do arquivo `.vcf` exportado do Android, do iPhone ou do iCloud, ou do `.csv` do Google Contatos ou de uma planilha com colunas como Nome e Telefone/Celular/WhatsApp. O arquivo é lido no navegador. Só nome, telefones, e-mail, etiquetas e observação são enviados, em lotes de 100. Fotos e endereços são ignorados. Limite: 5.000 contatos por pessoa.
- Números normalizados para o formato do WhatsApp (55 + DDD + número, celular sempre com o 9). Há um DDD padrão para os números salvos sem DDD. Números repetidos e inválidos são separados antes do envio.
- Prévia antes de gravar, como na importação de empresas. Cada contato recebe uma situação: Novo, Já está na sua lista, Já é lead, Pediu para não ser contatado, Repetido no arquivo, Número inválido ou sem DDD. Repetir a importação não duplica contatos.
- Etiquetas da agenda (Família, Igreja, grupos do Google) são mantidas. Também dá para aplicar uma etiqueta e uma cidade a todo o lote.
- Lista com busca por nome ou número, filtros (cidade, etiqueta, situação e temperatura), seleção em lote (definir cidade, adicionar etiqueta) e um mapa por cidade com contatos, a contatar, convidados, leads e quentes.
- **Abrir no WhatsApp** abre a conversa individual em `wa.me` com a mensagem-convite preenchida e marca o contato como Convidado. A mensagem tem os campos `{nome}` e `{meu_nome}` e fica salva no navegador.
- **Autorizou → virar lead** cria o lead pelo mesmo caminho do CRM (`create_lead`), com origem e finalidade da autorização, canal e responsável. Se o número já for lead acessível, o contato é vinculado ao lead existente em vez de duplicado.
- **Remover**: "Pediu para não ser contatado" apaga o contato e bloqueia a reimportação desse número em toda a organização. "Só tirar da minha lista" apenas apaga.
- Cadastro manual de um contato avulso.

## Regras de privacidade

- Contatos importados ficam com autorização pendente. Não viram leads e não aparecem no mapa territorial, nos indicadores ou nas exportações até a autorização ser registrada.
- A lista é privada de quem importou, inclusive para o Administrador. Toda leitura e gravação filtra organização e responsável.
- O bloqueio de quem pediu para não ser contatado guarda apenas um hash SHA-256 do número com a organização, sem nome nem telefone. Leads com autorização revogada também bloqueiam a reimportação.
- Nenhuma mensagem é enviada pela plataforma. O WhatsApp abre uma conversa por vez no aparelho da pessoa. Não há disparo em massa.
- Auditoria: importação (quantidade), conversa aberta, conversão em lead e remoção ou opt-out, sem nome ou telefone no resumo.

## Banco de dados

Migração `0011` apenas aditiva: tabelas `prospect_contacts` e `contact_optouts`. Nenhuma tabela existente foi alterada.

## Como usar

1. No celular, exporte os contatos. Android: app Contatos → Corrigir e gerenciar → Exportar para arquivo. iPhone: Contatos → Listas → segure "Todos os contatos" → Exportar. Google: contacts.google.com → Exportar → CSV do Google.
2. Em Contatos a mapear → Importar agenda, escolha o arquivo, informe o DDD padrão e, se quiser, a cidade e uma etiqueta. Confirme, clique em Validar e depois em Importar.
3. Use o mapa por cidade e os filtros para priorizar. Defina cidade e etiqueta em lote para quem veio sem cidade.
4. Clique em Abrir no WhatsApp e envie o convite. Quando a pessoa aceitar, use "Autorizou → virar lead". O lead segue em Leads e vendas e aparece no mapa.
5. Se a pessoa recusar, use Remover → Pediu para não ser contatado.

## Limites e pendências

- O WhatsApp pessoal não tem acesso oficial para leitura de conversas. O histórico das conversas não é importado. Uma integração futura pela API oficial do WhatsApp Business (Meta) exige conta comercial, número dedicado e credenciais.
- Embaixadores não usam esta aba nesta etapa.
- A importação foi testada com arquivos de exemplo no navegador (Chromium, desktop e 390 px). Exportações reais de cada modelo de celular ainda precisam ser conferidas.

## Verificação

`tests/prospects.test.mjs` cobre normalização de números, leitura de vCard 2.1/3.0/4.0 e CSV do Google, prévia sem gravação, idempotência, isolamento por responsável e cidade, conversão com consentimento, vínculo com lead existente, opt-out e bloqueio por revogação, além da API (login e origem).

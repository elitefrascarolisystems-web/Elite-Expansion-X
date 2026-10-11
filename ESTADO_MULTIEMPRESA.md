# Multiempresa: estado do trabalho (NÃO publicar)

Branch `multiempresa`, sobre a v9 (`main`). Extraído do ChatGPT Sites em 11/10/2026.

## Concluído em 11/10/2026
- **Organização por aba, de ponta a ponta.** Cada aba fica fixa na organização da
  sua URL (`?org=N`). O cliente envia o header `X-Elite-Organization` em toda
  chamada (`tenantFetch`) e o servidor valida o vínculo a cada requisição.
- Sem contexto, ou com contexto malformado, as APIs negam (403). Nenhuma
  organização é escolhida por padrão no servidor.
- A página sem `?org=` (ou com uma org fora do acesso) redireciona para a
  organização padrão da pessoa.
- O cookie `elite-org` foi removido (antes, trocar de organização numa aba mudava
  o destino das escritas das outras).
- **Assessoria Elite** (decisões do dono da plataforma em 11/10/2026: ver e
  editar; visível ao cliente; assessores escolhidos por ele; o cliente não
  desliga). Assessor = registrado em `platform_advisors` E membro ativo da
  Elite. Entra em organização cliente como Administrador, só com `?org=`
  explícito. Concessão e retirada só pelo dono da plataforma, registradas em
  `platform_audit`. O cliente vê a assessoria no painel e as ações dela
  aparecem marcadas no histórico.
- Criar organização exige o responsável do cliente, que vira dono e
  administrador. O dono da plataforma não entra mais como membro.
- Testes: 48/48 no GitHub Actions.

## Ainda pendente
- **Teste real em navegador** do redirecionamento e da troca de organização:
  só foram verificados por testes automatizados e build.
- `db/tenant-admin.ts` (convites com SHA-256, aceite, membros, transferência,
  perfil) **não tem rota nem tela**.
- `requireFeature` (limites de plano) não está aplicado em todos os caminhos.
- Revisar: múltiplas cidades por coordenação, concorrência em convites e
  transferência, acesso por identidade estável (hoje é por e-mail) e todas as
  relações cruzadas entre organizações.
- Migrações 0011 (perfis, convites, limites, platform_audit) e 0012
  (platform_advisors) ainda não foram aplicadas em nenhum banco real.
- O responsável do cliente é cadastrado direto pelo e-mail (sem convite com
  aceite). Quando a tela de convites existir, avaliar migrar para ela.
- O contrato com o cliente precisa prever o acesso da Assessoria Elite aos
  dados (LGPD).

Sem cobrança, convites reais ou liberação de audiência nesta etapa.

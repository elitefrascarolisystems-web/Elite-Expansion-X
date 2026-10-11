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
- Testes: 47/47 no GitHub Actions (os 46 originais adaptados + 1 novo que
  garante que nenhuma API entrega dados sem contexto).

## Ainda pendente
- **Teste real em navegador** do redirecionamento e da troca de organização:
  só foram verificados por testes automatizados e build.
- `db/tenant-admin.ts` (convites com SHA-256, aceite, membros, transferência,
  perfil) **não tem rota nem tela**.
- `db/organizations.ts` ainda adiciona o proprietário da plataforma como
  administrador de toda organização nova. Substituir antes de criar
  organizações de clientes.
- `requireFeature` (limites de plano) não está aplicado em todos os caminhos.
- Revisar: múltiplas cidades por coordenação, concorrência em convites e
  transferência, acesso por identidade estável (hoje é por e-mail) e todas as
  relações cruzadas entre organizações.
- Migração 0011 (organization_profiles, invites, entitlements, platform_audit)
  ainda não foi aplicada em nenhum banco real.

Sem cobrança, convites reais ou liberação de audiência nesta etapa.

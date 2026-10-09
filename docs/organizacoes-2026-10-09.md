# Elite Expansion X — identidade e organizações

## Alterações

- Nome de interface Elite Expansion X; domínio preservado.
- Logo oficial PNG no cabeçalho, portal e acesso restrito. SVG oficial como favicon; originais preservados. Ver `logo-oficial-2026-10-09.md` para hashes e limitações.
- Organização atual no cabeçalho, selecionada exclusivamente entre vínculos ativos da conta autenticada. Troca recarrega os dados; cookie HttpOnly, Secure, SameSite=Strict.
- Criação de organização privada pelo proprietário principal, com a própria conta já identificada. Não cria terceiros, convites, cobranças ou dados demonstrativos. A operação usa UUID para repetição idempotente e transação com auditoria.
- Cidades, usuários, configurações, conteúdos, tarefas e auditoria possuem organization_id. Demais entidades derivam o isolamento pela cidade vinculada. Consultas e mutações aplicam esse escopo no servidor, inclusive no mapa e na geocodificação.
- Configurações e conteúdo global são globais apenas dentro da organização.
- Erros inesperados da API de dashboard não expõem SQL ou detalhes internos e não retornam sucesso.

## Migração e recuperação

Migração aditiva `drizzle/0007_neat_ironclad.sql`: nova tabela organizations, seis colunas e índices de unicidade por organização. Registros anteriores recebem organization_id=1. A inicialização associa essa organização à Elite e à conta proprietária existente. Outras organizações começam vazias.

Backup anterior: `expansion-before-organizations.json`, 18 tabelas, seis registros (quatro cidades, uma configuração e um usuário). Nenhum dado de teste foi inserido em produção.

O script `scripts/verify-organization-migration.mjs <backup.json>` restaura esse backup exclusivamente em SQLite em memória, aplica a migração, compara todas as colunas e valores anteriores, verifica referências e executa a reversão local. Resultado executado: 18 tabelas preservadas, seis registros preservados, referências válidas e reversão local válida.

Recuperação operacional: suspender escritas, capturar novo backup completo e comparar diferenças; preferir correção aditiva no código. Não remover organization_id nem restaurar o snapshot antigo em produção depois de novas escritas: isso perderia vínculos e dados novos. Uma reversão de esquema requer preservação/exportação dos registros criados após a migração e restauração ensaiada em ambiente isolado. O script de verificação não altera produção e não constitui restauração automática do D1. Não reimplantar código anterior sem considerar que ele desconhece o isolamento das novas organizações.

## Verificação e limites

Testes executáveis em SQLite isolado cobrem: organização nova vazia, criação idempotente, mesma cidade em organizações distintas, separação de pessoas/conteúdos/tarefas/usuários, leitura por filtros, mutações com ID alheio, tarefas de outra organização, seleção por conta sem vínculo, cookies forjados e falhas do banco sem vazamento.

Esses testes não são testes em dispositivos. Chrome, Safari, iPhone, Android, contraste renderizado e interação visual continuam pendentes. Não houve acesso ao navegador de QA exigido pelo fluxo Sites nesta sessão.

Esta entrega é a base multiempresa, não a conclusão dos 75 itens do briefing. Permanecem: funções SaaS adicionais, planos sem cobrança, onboarding especializado, CRM ampliado/importações, metas de vendedores, relatórios e pontuação territorial avançados. A unicidade dos códigos de embaixador ainda é global.

Nenhuma variável externa está configurada no ambiente publicado. Satélite, híbrido, Street View, diretório comercial licenciado e 3D de edificações dependem da integração e das credenciais apropriadas. Não foram ativados serviços pagos. A inclinação do mapa atual não é anunciada como 3D real.

## Manual curto

Administrador: confira a organização no cabeçalho antes de cadastrar cidades, pessoas e atividades. Use Nova organização apenas para uma empresa real autorizada. Cadastre pessoas no território com função e cidade; localização pessoal usa somente referência municipal. Associe o cadastro existente ao embaixador ou lead para evitar dupla contagem.

Líder: opera a cidade vinculada ao seu perfil; registre treinamento, atividades e resultados autorizados. Contagem territorial acompanha os filtros e a cidade.

Embaixador: usa seu portal, materiais, aceite, treinamento, tarefas e resultados próprios. Não recebe dados de outros embaixadores ou contatos pessoais no mapa.

## Próximos passos do piloto

7 dias: validar telas em dispositivos reais e cadastrar responsável autorizado de Esmeraldas, sem preencher métricas ausentes artificialmente.
30 dias: medir leads consentidos, pagamentos confirmados e custos atribuíveis por período; revisar treinamento e qualidade dos registros.
60 dias: comparar resultados do piloto com metas aprovadas. Belo Horizonte, Contagem e Betim permanecem condicionadas aos resultados e à qualidade dos dados.

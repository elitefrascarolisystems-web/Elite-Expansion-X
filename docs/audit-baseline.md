# Elite Territory Map — auditoria inicial

Base: versão 5, commit 76b1eaffb8442cd9b45e4194fefc95f922648681.

Banco consultado em 08/10/2026: 4 cidades, 1 administrador, 1 configuração; demais 11 tabelas vazias. Cópia lógica integral capturada fora do repositório antes das alterações. Não é um snapshot transacional do serviço; nenhuma escrita de produção foi realizada nesta auditoria.

- P0: Coordenação recebia acesso global mesmo com cidade atribuída.
- P1: Validação de data de evento exigia AAAA-MM em campo AAAA-MM-DD.
- P1: Mapa era representação CSS, sem cartografia, navegação geográfica ou registros de localização persistentes.
- P1: Não existia identidade única entre lead e embaixador.
- P2: Filtros do mapa alteravam pessoas da lista, mas não removiam pontos sem resultado.
- P2: Não havia seleção de parceiro/evento no mapa nem formulário de localização.

Arquitetura mantida: React/Vinext, Worker Cloudflare, D1 SQLite, componentes existentes e autenticação Sites. Novas tabelas serão aditivas. Nenhum acesso, mensagem, campanha ou pagamento real será criado.

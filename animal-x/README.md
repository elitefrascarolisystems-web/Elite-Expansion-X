# Animal X — atlas de anatomia veterinária 3D

Versão 0.1.0 · 22/10/2026 · Fase 1 do [prompt-mestre](../docs/animal-x/prompt-mestre.md), com as [referências de mercado](../docs/animal-x/referencias-mercado-2026-10-22.md).

A Animal X é um atlas de anatomia veterinária 3D, interativo e multiespécie, que funciona sem internet. É a versão animal do Human X 360, e herda os princípios, a segurança e a arquitetura dele. Serve para ensinar e para explicar ao tutor; não é ferramenta de diagnóstico. O público é formado por médicos-veterinários especialistas, professores, estudantes e universidades.

**Situação honesta desta versão.** O espécime é um **cão esquemático feito pela equipe**: as formas são geradas por código, a partir de proporções aproximadas de um cão de porte médio, e não são medidas de um espécime real. O kit licenciado (TC de Edinburgh, Pixelbeaker, Massey, Cornell…) não pôde ser baixado neste ambiente, porque a rede bloqueou os sites. Por isso, cada tela da plataforma marca o modelo como esquemático. Nomes em inglês, definições e parte do latim vêm do Uberon, com fonte. Nomes em português, resumos e textos para o tutor são da equipe e ainda não foram revisados.

## O que existe

| Recurso | Situação |
|---|---|
| Atlas 3D com 53 estruturas, divididas em 82 peças e 9 sistemas: esqueleto, músculos esquemáticos, nervoso, cardiovascular, respiratório, digestório, linfático, urinário e silhueta translúcida | Existe e foi testado |
| Visualização: girar, aproximar, selecionar, isolar, ocultar, desfazer, transparência por sistema, rótulos e vistas prontas | Existe e foi testado |
| Ficha da estrutura em português, latim e inglês, com definição, hierarquia do Uberon, fonte em cada campo e status de revisão | Existe e foi testado |
| Anatomia comparada ligada pelo ID do Uberon, com fichas de rúmen, retículo, omaso, abomaso e casco, todas sem 3D | Existe; outras espécies aguardam fonte |
| Especialidades: 8 pontos de partida prontos e 7 marcados como "sem conteúdo", com o motivo | Existe |
| Ferramentas: cortes transversal, sagital e dorsal; medida aproximada; caneta; exportação de imagem | Existe; exportação testada |
| 4 tours guiados, com definições do Uberon em cada passo | Existe e foi testado |
| Explicar ao tutor: 7 cenas em linguagem simples, com aviso fixo e sem guardar nada | Existe e foi testado |
| Avaliação: quiz por sistema, com perguntas geradas do catálogo e ainda não revisadas | Existe |
| Modo apresentação: roteiro de 7 passos, avanço por teclado ou passador, tela cheia | Existe e foi testado |
| Contas, 8 papéis, revisão profissional auditada, biblioteca, laboratório do animal e X AI por regras locais | Existe e foi testado |
| Funciona sem internet depois da primeira visita (service worker) | Existe e foi testado |
| PostgreSQL com migrations travadas e conferidas por SHA-256; backup AES-256-GCM | Existe e foi testado com PostgreSQL 16 |
| Modelos licenciados de cão, gato, cavalo e boi | Aguardando download e conferência de licença |
| Cortes de TC e RM (NiiVue), Gaussian splats de peças reais, realidade virtual | Planejado |
| Oclusão de ambiente, bloom e desfoque de fundo | Fora desta versão: nos testes, o GTAO apagava a silhueta e o bloom criava halo |
| Turmas e relatórios para instituições | Planejado (tela mostra o plano) |
| Imagem Docker, Compose e Caddy | Arquivos prontos; Compose validado; a imagem não foi construída (o Docker Hub recusou o download com 429) |

## Como rodar

Requer Node.js 22 ou mais novo.

```bash
cd animal-x
npm ci
npm run build
npm start            # http://127.0.0.1:4310, modo demonstração em memória
```

**Modo demonstração.** Sem `DATABASE_URL`, o servidor guarda tudo em memória e cria uma conta de administrador temporária, com e-mail e senha mostrados no terminal. Tudo some quando o servidor para. O atlas, os tours, o tutor e o quiz não precisam de conta.

**PostgreSQL local, persistente.** É o equivalente ao "PostgreSQL embutido" do Human X:

```bash
npm run db:local                 # cria e inicia o cluster em data/pg
export DATABASE_URL=postgres://animalx@127.0.0.1:54329/animalx
ANIMALX_ADMIN_EMAIL=voce@exemplo.br ANIMALX_ADMIN_SENHA='uma-senha-longa' npm run admin:create
npm start
```

**Backup.**
- Gerar: `npm run backup`, que grava em `backups/` o arquivo `animalx-AAAAMMDD-HHMMSS.dump.axb`, cifrado com AES-256-GCM.
- Chave: fica em `data/backup.chave` (permissão 0600) ou em `ANIMALX_BACKUP_CHAVE`.
- Restaurar: `npm run backup:restore -- <arquivo>`. Antes de restaurar, o script faz uma cópia do estado atual.
- Backup diário: `ANIMALX_BACKUP_DIARIO=1`.

**Produção com Docker.** Siga a ordem:
1. Copie `env.exemplo` para `.env` e preencha.
2. Rode `docker compose up -d`.

Esse fluxo sobe o app, o PostgreSQL 17 e o Caddy com HTTPS. A imagem ainda não foi construída e testada; veja a tabela acima.

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | PostgreSQL; sem ela, o modo é memória |
| `ANIMALX_PORTA`, `ANIMALX_HOST` | Porta (4310) e endereço (127.0.0.1) |
| `ANIMALX_COOKIE_SEGURO=1` | Cookie com `Secure`, atrás de HTTPS |
| `ANIMALX_CONFIAR_PROXY=1` | Usa `X-Forwarded-For` e `X-Forwarded-Proto` (atrás do Caddy) |
| `ANIMALX_CADASTRO_ABERTO=0` | Fecha o cadastro público |
| `ANIMALX_ADMIN_EMAIL`, `ANIMALX_ADMIN_SENHA` | Cria o administrador no início |
| `ANIMALX_BACKUP_CHAVE`, `ANIMALX_BACKUP_DIARIO` | Chave do backup (32 bytes em base64) e backup diário |

## Princípios aplicados

- **Offline.** Motor 3D, fontes tipográficas, catálogo e espécime vão dentro do pacote. Não há nenhuma chamada externa: a política CSP `default-src 'self'` bloqueia todas.
- **Só licenças verificáveis.** Em uso estão: Uberon (CC BY 3.0, licença lida no GitHub, grau D), three.js (MIT), Inter e Space Grotesk (OFL-1.1) e node-postgres (MIT). O teste de conteúdo falha se aparecer qualquer licença NC ou ND. Os textos das licenças vão em `dist/licencas/`.
- **Honestidade científica.** Nada nasce revisado. Só o papel revisor muda o status, e a marcação "Revisado" exige uma nota com a evidência. Cada campo da ficha mostra a sua fonte.
- **Latim.** O termo só leva o Uberon como fonte quando coincide com um sinônimo latino registrado lá. O Uberon tem erros: para "spinal cord", ele lista "fissura cerebro-cerebellaris". Todo termo latino aparece com a nota "Conferir com a NAV".
- **Separação de papéis.** O administrador gerencia contas e auditoria, mas não lê laboratório, biblioteca nem animais de ninguém. Isso é verificado em teste, inclusive com PostgreSQL.
- **Integridade anatômica.** Nenhum modelo é deformado para virar outra espécie. A anatomia comparada mostra "aguardando fonte" até haver dados próprios de cada espécie.
- **Lições do Human X aplicadas:**
  - o login leva o mesmo tempo para e-mail existente e inexistente;
  - o limite de requisições limpa a memória antiga;
  - a troca de senha tem limite de tentativas e encerra as outras sessões;
  - o X AI não cria registros a partir da conversa;
  - os scripts não dependem de caminhos fixos.

## Segurança

- **Senhas:** scrypt (N=2¹⁵, r=8, p=1) com sal próprio.
- **Sessão:**
  - token aleatório de 256 bits; o banco guarda só o SHA-256 dele;
  - cookie `HttpOnly; SameSite=Strict`, com `Secure` em produção.
- **Escrita:** exige o cabeçalho próprio da aplicação, origem igual à do servidor e token CSRF ligado à sessão.
- **Limites de tentativas:** por IP e por e-mail no login, por IP no cadastro e por pessoa na troca de senha.
- **Cabeçalhos:**
  - CSP sem `unsafe-inline`;
  - `frame-ancestors 'none'`, `nosniff`, `no-referrer`.
- **Auditoria:** login (o e-mail entra como hash), papéis, revisões, senha, animais e backups. Nenhum dado de saúde entra no resumo.

## Renderização

- **Motor:** three.js r186 com `WebGPURenderer`. Ele volta sozinho para WebGL 2 em três casos: quando o WebGPU falha no início, quando a placa perde o dispositivo e quando o usuário escolhe "Forçar WebGL 2".
- **Compatibilidade:** uma correção remove o `swizzle: 'rgba'` neutro que versões do Chrome anteriores à forma final da especificação recusam.
- **Níveis de detalhe:**

  | Nível | Triângulos | Geometria | Recursos |
  |---|---|---|---|
  | Leve | 82,7 mil | 5,0 MB | Sem sombras |
  | Balanceado | 166 mil | 9,2 MB | Sombras 1024, verniz úmido |
  | Alto | 384 mil | 20,7 MB | Dispersão subsuperficial em músculos e órgãos, sheen no osso, sombras 2048 |

  Valores medidos no Chromium do ambiente de testes.
- **Silhueta:** campo de distância com união suave de cápsulas, poligonizado por marching cubes, com material de contorno tipo holograma.

## Verificação

```bash
npm run lint          # ESLint
npm test              # build + 35 testes (segurança, API, PostgreSQL real, conteúdo, licenças, build)
npm run verify        # confere dist/ contra o inventário SHA-256
npm run test:visual   # 9 testes de ponta a ponta no Chromium
```

Resultados em 22/10/2026, neste ambiente:
- **Lint:** sem erros.
- **Unidade:** 35 de 35 testes passando, com PostgreSQL 16 real (migrations, trava contra migration alterada, backup adulterado recusado e restauração conferida).
- **Integridade:** os 14 arquivos do pacote conferidos.
- **Navegador:** 9 de 9 testes passando:
  - renderização em WebGL 2;
  - WebGPU com volta automática;
  - clique numa estrutura abrindo a ficha;
  - 21 rotas sem erro;
  - celular de 390 px sem rolagem horizontal;
  - cadastro, laboratório e X AI;
  - apresentação e especialidade abertas direto da tela inicial;
  - tour por teclado e apresentação de 7 passos;
  - uso sem internet.

**O que não foi verificado:**
- **Imagem WebGPU numa placa de vídeo real.** Neste ambiente, sem GPU, o WebGPU perde o dispositivo e o teste confirma a volta para WebGL 2.
- **Safari, iPhone, Android e Vision Pro.**
- **Imagem Docker.**
- **Desempenho numa máquina comum.** Os quadros por segundo foram medidos só no renderizador por software.

## Estrutura

```
animal-x/
  content/      catálogo-base, estruturas geradas do Uberon, fontes e licenças
  scripts/      build, integridade, Uberon, migrations, admin, backup, PostgreSQL local
  server/       servidor HTTP nativo, segurança, papéis, armazéns (memória e PostgreSQL), migrations
  web/          interface (telas, ficha, palco 3D, X AI) e visualizador (especime-cao.js, materiais, geometria)
  tests/        testes de unidade e, em tests/visual, de navegador
```

Para levar a pasta a um repositório próprio, mantendo o histórico, use `git subtree split --prefix animal-x -b animal-x` e envie o branch para o repositório novo.

## Próximos passos

1. Numa sessão com acesso a Sketchfab, Edinburgh, Cornell e NIH, baixar o kit inicial. Para cada arquivo, arquivar a página da licença com data e SHA-256, converter para glTF com Meshopt e KTX2, e trocar as peças esquemáticas uma a uma.
2. Pedir à WAVA autorização para usar a NAV, e ao revisor científico a revisão dos 53 termos.
3. Levar às universidades o Projeto Acervo Aberto: TC de cadáver doado e fotogrametria de peças, publicados em CC BY e com coautoria.
4. Validar em GPU real o pós-processamento (GTAO, bloom e desfoque de fundo) e o desempenho por nível.
5. Fase 2: gato, equino e bovino com fontes próprias; cortes de TC e RM com NiiVue; turmas.

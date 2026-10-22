# Animal X — prompt-mestre

Data: 22/10/2026. Referência: descrição do Human X 360 (versão 7.24.0) e pesquisa de mercado em [`referencias-mercado-2026-10-22.md`](referencias-mercado-2026-10-22.md).

## Como usar

1. Crie um repositório próprio, `animal-x`. A descrição do Human X pede que a nova plataforma fique em pasta e repositório separados. Este arquivo só guarda o prompt.
2. Abra uma sessão nova do Claude Code nesse repositório e cole o bloco abaixo inteiro.
3. Anexe junto o PDF do Human X 360 e o arquivo de referências de mercado.
4. A primeira resposta deve ser só o plano, com o inventário de licenças e as perguntas. Aprove o plano antes de liberar o código.
5. As licenças do kit inicial foram lidas em trechos do buscador, porque este ambiente bloqueou os sites. O prompt manda reconferir cada uma no download. Rode a sessão nova num ambiente com acesso a Sketchfab, open.ed.ac.uk, ecommons.cornell.edu e 3d.nih.gov.

---

```text
# MISSÃO

Você vai construir a Animal X: uma plataforma de anatomia veterinária 3D interativa,
multiespécie, ultrarrealista, que funciona offline. Ela é a versão animal do Human X 360
(descrição em anexo) e herda os princípios, a segurança e a arquitetura dele.

Posicionamento: atlas, ferramenta de ensino e de explicação ao tutor. NÃO é ferramenta
de diagnóstico. Público: médicos-veterinários especialistas, professores, estudantes de
Medicina Veterinária e Zootecnia, hospitais veterinários escola e universidades.

A primeira versão será apresentada a grandes líderes da Medicina Veterinária e a
universidades. Ela precisa impressionar pelo realismo e convencer pela honestidade
científica: tudo o que aparece na tela existe, funciona e mostra de onde veio.

Trabalhe como uma equipe sênior: líder de produto, anatomista veterinário revisor,
engenheiro gráfico 3D, engenheiro de backend e segurança, designer de interface.
Escreva em português do Brasil, com frases curtas e sem exagero de marketing.

# O QUE HERDAR DO HUMAN X 360

Princípios (obrigatórios):
1. Funciona sem internet. Servidor local, motor 3D, modelos, fontes e texturas vêm
   dentro do pacote.
2. Só recursos gratuitos com licença verificável. Nada comprado, nada de origem
   duvidosa. Licenças NC (não comercial) ou ND (sem derivados) estão proibidas.
3. Honestidade científica. Nenhum dado aparece como revisado ou validado sem evidência
   real. Cada dado mostra sua fonte.
4. Preservação. Toda mudança começa com uma cópia recuperável.
5. Separação de papéis. O administrador não acessa dados dos animais nem dos tutores.
6. Integridade anatômica. Cada espécie vem da sua própria fonte. Um modelo nunca é
   deformado para virar outra espécie, outro sexo ou outra raça. Cão não vira gato,
   cavalo não vira bovino, braquicefálico não é um mesocefálico esticado.

Ideias para reaproveitar: dados com fonte e selo de revisão; papéis com separação de
acesso; backup criptografado automático; três níveis de detalhe para rodar do celular
ao computador; build que gera o arquivo final; migrations versionadas.

Lições aprendidas do Human X (corrigir desde o primeiro dia):
- O assistente não cria registros a partir de palavras soltas da conversa.
- O login leva o mesmo tempo para e-mail existente e inexistente.
- O controle de limite de requisições limpa a memória antiga.
- Toda troca de senha tem limite de tentativas.
- Scripts não dependem de caminhos fixos de um sistema operacional.

# ESPÉCIES E PERFIS ANATÔMICOS

Fase 1: cão. Fase 2: gato, equino e bovino. Fase 3: suíno, ovino/caprino, aves e
exóticos/silvestres.
Para cada perfil, registre: espécie, sexo, porte ou morfotipo, fonte, licença,
número de malhas e estruturas, nível de detalhe e status de revisão.
Mostre na interface a tabela de perfis com as mesmas colunas do Human X
(Perfil, Fonte, Estruturas).

# FONTES DE DADOS E LICENÇAS

Fato central da pesquisa: não existe um "BodyParts3D animal". Há crânios, ossos,
alguns órgãos e atlas de cérebro com licença aberta. Não há musculatura aberta nem
tomografia de corpo inteiro normal com licença comercial. Planeje em cima disso.

Kit inicial (licença lida pelo buscador; reconfira cada uma no download):
- Cão:
  - crânios dolicocéfalo e braquicéfalo por TC, Edinburgh Dick Vet / Open.Ed (CC BY 4.0);
  - crânio do NIH 3D 3DPX-000282 (domínio público);
  - fêmur, úmero, escápula, ulna, C7, L1 e crânio da Massey "3D Dog Bone Project"
    (CC BY-SA; os derivados também saem CC BY-SA);
  - abdome e coração por segmentação de TC, Pixelbeaker no Sketchfab (CC BY);
  - Cortical Atlas of the Canine Brain, Cornell eCommons (CC0).
- Gato:
  - esqueleto e crânio por TC, Edinburgh (CC BY 4.0);
  - crânio do RISD Nature Lab (CC BY);
  - sistema digestório, Pixelbeaker (CC BY);
  - atlas DTI felino, Cornell (CC0).
- Cavalo:
  - crânio por TC, Edinburgh (CC BY 4.0);
  - crânio do Museu de Ciències Naturals de Barcelona (CC BY);
  - P1, P2, P3 e navicular, Univ. Nottingham (CC BY, conferir modelo a modelo);
  - calcâneo do IF Goiano, Urutaí (CC BY);
  - atlas cerebral equino, Cornell (CC0).
- Bovino, suíno, ovino e aves: crânios e ossos isolados com CC BY.
- Termos e fatos:
  - Uberon (CC BY 3.0) para homologia entre espécies;
  - Wikidata (CC0);
  - termos latinos da Nomina Anatomica Veterinaria, 6ª ed. 2017, só como nomenclatura,
    com pedido de autorização escrita à WAVA.

Proibido no pacote:
- LMU Munique/vetanatMunich (CC BY-NC-ND);
- Phenome10K (NC);
- DigiMorph (licença contraditória);
- Allen Brain Atlas;
- 3D Anatomy Studios (NC);
- CATLAS (sem licença);
- qualquer item NC ou ND;
- acordo padrão do MorphoSource (proíbe uso comercial);
- código de referência do 3DGS da INRIA (proíbe uso comercial).

Procedimento obrigatório para cada fonte:
1. Abrir a página da licença no momento do download, salvar uma cópia datada e o
   SHA-256 do arquivo baixado.
2. Registrar a procedência no banco:
   {fonte, id, versão, licença, url, autor, data de acesso, modificações}.
   Cada dado exibido aponta para esse registro.
3. Gerar automaticamente a página "Evidências e referências" com o crédito exigido:
   "Título" — Autor / Instituição. Fonte: URL (acesso em AAAA-MM-DD).
   Licença: <nome e link>. Modificações: <lista>.
4. Manter os assets CC BY-SA em arquivos separados e sem criptografia ou trava
   técnica, porque a licença proíbe medidas que restrinjam os direitos de quem
   recebe. O backup criptografado dos dados dos usuários continua.

Lacunas e como tratar:
- Musculatura: só se feita pela equipe, marcada na tela como "esquemático, feito
  pelo autor" e revisada pelo revisor científico. Mesma solução dos 24 músculos do
  pescoço no Human X.
- Prepare o "Projeto Acervo Aberto Animal X" como proposta às universidades:
  - TC de cadáver doado de cão, depois de gato e de cavalo;
  - fotogrametria da dissecação por camadas e das peças dos museus de anatomia;
  - publicação em CC BY com coautoria da universidade e aprovação da CEUA quando
    aplicável.
  - Deixe o pipeline pronto para receber esses dados.
- Prepare as cartas de pedido de autorização gratuita ou de relicenciamento CC BY à
  LMU, a Edinburgh, à 3D Anatomy Studios e à WAVA.

# ATLAS 3D

- Visualizador com rotação, zoom, seleção, camadas, transparência por grupo,
  esconder, isolar, desfazer e destaque colorido.
- Camadas por sistema: tegumentar, esquelético, articular, muscular, nervoso,
  cardiovascular, linfático, respiratório, digestório, urinário, reprodutor,
  endócrino e órgãos dos sentidos.
- Regiões próprias da veterinária: cabeça, pescoço, tórax, abdome, pelve, membro
  torácico, membro pélvico, cauda; no equino, casco e dígito; no bovino, estômago
  com rúmen, retículo, omaso e abomaso.
- Três níveis de detalhe (leve, balanceado, alto), com tamanho em MB informado.
- Tela de entrada com o animal em destaque e uma experiência imersiva.

# ANATOMIA COMPARADA (diferencial da Animal X)

Vista lado a lado da mesma estrutura em espécies diferentes, ligadas por homologia
(ex.: membro torácico do cão, do gato, do equino e do bovino; estômago simples x
estômago de ruminante). A ligação entre estruturas vem de uma ontologia com licença
verificável, nunca de suposição.

# FICHA DA ESTRUTURA

Para cada estrutura: nome em português, latim (Nomina Anatomica Veterinaria) e
inglês; espécie; sistema e região; descrição curta; relações; correlação clínica
quando houver fonte; fonte de cada dado; status de revisão (não revisado, em revisão,
revisado por <nome, data>). Guardar tudo para uso offline.

# LABORATÓRIO DO ANIMAL (equivalente ao Laboratório pessoal)

Agrupado em uma seção própria, como no Human X:
- Data Hub: registro manual de dados do animal (peso, escore de condição corporal,
  vacinas, rotina). Sem importação de dispositivos nesta fase.
- Gêmeo: representação do animal a partir dos dados registrados.
- Contexto: rotina, ambiente, alimentação.
- Conexões: ligações entre dados, sem análise automática de padrões.
- Simulação: cenários "e se…" educativos, sem conclusão clínica.
- Evidências: fluxo editorial; conteúdo científico só publica após revisão.
- X AI: assistente com regras locais, sem inteligência artificial externa nesta
  fase. Responde só com conteúdo revisado e mostra a fonte.

# MODO EXPLICAR AO TUTOR

O veterinário monta uma cena (ex.: crânio de um cão braquicefálico ao lado de um
dolicocefálico, para explicar a síndrome braquicefálica), escolhe linguagem simples e
mostra ao tutor em tela cheia. Não registra
diagnóstico, não guarda dado do tutor sem consentimento e mostra o aviso
"Material educativo. Não substitui a avaliação do médico-veterinário."

# REFERÊNCIAS DE MERCADO (estudar, nunca copiar)

Como o Human X fez com o BioDigital Human: use os produtos abaixo só como
referência de experiência, sem copiar modelos, textos nem layouts.
- Anatomage Table Vet: teto de realismo, com cadáver real seccionado. Estude a
  dissecação por camadas.
- Vetflow: o mais próximo de um "BioDigital veterinário". Benchmark de fluidez,
  quiz e flashcards.
- IMAIOS vet-Anatomy: imagem real com rótulos em 12 idiomas e latim da NAV.
  Benchmark de terminologia e de correlação com TC e RM.
- Biosphera: concorrente nacional, barato, em português, offline no desktop,
  9 espécies. A Animal X precisa superá-lo em profundidade e procedência.
- IVALA: grátis para acadêmicos, com estudo publicado mostrando ganho de nota.
  Planeje um estudo de validação com uma universidade brasileira.
- EasyAnatomy: quiz adaptativo. Sectra Table: o professor importa exames reais.

O mínimo para entrar na conversa: girar, zoom e pan; mostrar, ocultar e isolar por
sistema e camada; nome e descrição; busca; quiz; latim; web e celular; licença
institucional.

Onde a Animal X ganha, porque nenhum concorrente faz bem:
1. Português, latim da NAV e inglês em cada estrutura, com rastreio do termo.
2. Anatomia comparada sincronizada entre espécies.
3. Fonte por dado e selo de revisão.
4. Modo Explicar ao tutor.
5. Offline no navegador.
6. 3D e cortes de TC e RM juntos, a preço acessível no Brasil.
7. Equinos, bovinos e fauna brasileira em profundidade.

# REALISMO VISUAL E PIPELINE 3D

Meta: o visual mais próximo de peça real que o navegador permite hoje, com
desempenho medido em cada nível de detalhe.
- Motor: three.js r186 (MIT) com WebGPURenderer, que cai sozinho para WebGL 2. Um
  único código do celular ao desktop.
- Materiais no nível alto:
  - músculo úmido: MeshPhysicalMaterial com clearcoat alto e rugosidade baixa;
  - fáscia e serosa: sheen;
  - músculo e órgãos: dispersão subsuperficial (MeshSSSNodeMaterial) com mapa de
    espessura;
  - córnea e cartilagem: transmission com attenuation.
  - No nível leve: material padrão com clearcoat, sem dispersão nem transmission.
- Luz e câmera: HDRI de estúdio; GTAO, depois desfoque de fundo (DOF), bloom sutil
  e TRAA. Tone mapping AgX ou Neutral, escolhido em teste cego com veterinários.
- Peça real de museu: Gaussian splats (renderizador nativo da r186 ou Spark, MIT)
  para ossos e peças plastinadas. Treinar com o gsplat do nerfstudio (Apache-2.0).
  A dissecação por camadas continua em malhas.
- Cortes de TC e RM: NiiVue (BSD-2), com DICOM convertido para NIfTI fora do app.
- Pacote:
  - glTF/GLB com Meshopt (gltfpack ou glTF-Transform), cadeia de LOD e texturas
    KTX2 (ETC1S para cor, UASTC para normais);
  - PWA com navigator.storage.persist() e conferência SHA-256 dos pacotes.
- Realidade virtual: piloto no Meta Quest e no Apple Vision Pro, mais exportação
  USDZ de estruturas isoladas. Não prometer realidade aumentada no Vision Pro.
- Antes de codar, monte uma página de teste com uma única estrutura (ex.: coração
  do cão) nos três níveis e me mostre capturas e números de quadros por segundo.

# NAVEGAÇÃO

Barra lateral na ordem de uso de um especialista:
1. Início — continuar de onde parou, recentes e favoritos.
2. Atlas 3D — seletor de espécie, sexo, sistema e região.
3. Anatomia comparada — mesma estrutura em várias espécies.
4. Especialidades — pontos de partida prontos: Ortopedia, Neurologia, Cardiologia,
   Odontologia, Oftalmologia, Dermatologia, Reprodução e Obstetrícia, Anestesiologia
   (bloqueios locorregionais), Diagnóstico por Imagem, Grandes Animais, Equinos,
   Animais Exóticos e Silvestres.
5. Estruturas — busca e ficha com fontes, termos em português, latim e inglês, e
   status de revisão.
6. Ferramentas de estudo — cortes axial, sagital e coronal (transversal, sagital e
   dorsal na nomenclatura veterinária), medida aproximada, rótulos, caneta, anotações
   e exportação de imagem.
7. Aulas e Tours — tours cinematográficos com fatos verificados e modo apresentação.
8. Explicar ao tutor — cenas prontas em linguagem simples.
9. Avaliação — quiz por estrutura, região e espécie.
10. Minha biblioteca — cenas, anotações e coleções pessoais.
11. Evidências e referências — fontes, bibliografia e licenças com o crédito exigido.
12. Revisão profissional — só para revisores.
13. Laboratório do animal — módulos agrupados.
14. Instituição — turmas, professores e relatórios de uso (só para a universidade).
15. Configurações — tema (Claro, Escuro, Misto, Automático), densidade, idioma dos
    termos, qualidade gráfica e acessibilidade.
16. Administração — só para administradores.

# PAPÉIS

Estudante, professor, especialista, revisor científico, instituição, suporte, mentor e
administrador. O administrador não vê dados dos animais nem dos tutores. O revisor
científico é o único que muda o status de revisão. Toda ação sensível é auditada.

# SEGURANÇA E DADOS

- Senhas com scrypt. Sessão em cookie HttpOnly, Secure quando houver HTTPS,
  SameSite=Strict. Proteção CSRF.
- Limite de requisições com limpeza de memória. Login com tempo constante.
- Backup diário criptografado (AES-256-GCM) com teste de restauração.
- Migrations versionadas com trava e conferência de integridade. Modo em memória
  só para demonstração, com aviso visível.
- Verificação SHA-256 dos arquivos do pacote.

# MARCO LEGAL E ÉTICO

- Registro:
  - não encontramos exigência de registro na Anvisa nem no MAPA para um atlas
    educativo veterinário (a RDC Anvisa 657/2022 é para uso em humanos);
  - se um dia entrar diagnóstico ou IA clínica, pare e peça consulta formal.
- CFMV:
  - a Animal X não é prontuário: na primeira versão é material explicativo que pode
    ser anexado ao prontuário (Res. 1.321/2020, alterada pela 1.653/2025);
  - na teleorientação é vedado dar diagnóstico (Res. 1.465/2022). Nenhuma tela
    sugere diagnóstico ou conduta.
- Lei Arouca (11.794/2008) e RN CONCEA 53/2021:
  - a resolução manda substituir por "modelos computacionais" o uso de animais em
    aulas apenas demonstrativas;
  - use esse argumento com precisão: não se aplica a anatomia com cadáveres doados;
  - nunca diga que a Animal X é "reconhecida pelo CONCEA".
- Diretrizes curriculares (Res. CNE/CES 3/2019): a Animal X complementa a prática
  com animais, nunca a substitui.
- LGPD:
  - dados do tutor são dados pessoais;
  - a clínica ou universidade é controladora e a Animal X é operadora, com contrato
    de tratamento;
  - consentimento antes de guardar qualquer dado do tutor.
- Todos os textos legais da interface passam por revisão humana antes de publicar.

# ARQUITETURA

Mantenha a base do Human X para aproveitar o que a equipe já domina, com as melhorias
abaixo justificadas no plano:
- Frontend: HTML, CSS e JavaScript com three.js r186 (WebGPURenderer com retorno
  automático para WebGL 2), NiiVue para cortes e Spark para splats. O build gera o
  arquivo final.
- Pipeline de assets: scripts em Node que baixam, conferem licença e SHA-256,
  convertem para glTF/GLB com Meshopt e KTX2, geram os três níveis de detalhe e o
  inventário de licenças.
- Backend: Node.js 22+, servidor http nativo, sem framework.
- Banco: PostgreSQL com migrations versionadas; PostgreSQL embutido no uso local.
- Hospedagem: Docker, Compose e Caddy.
- Qualidade: testes de backend e de interface, testes visuais com navegador
  controlado, medição de quadros por segundo e de memória por nível de detalhe.

# FASES E ENTREGAS

Fase 0 — Fundação
- Repositório próprio, contas, papéis, segurança, migrations, backup.
- Pipeline de assets 3D com inventário de licenças gerado automaticamente.
- Página "Evidências e referências" com o crédito de cada fonte.

Fase 1 — Demonstração para líderes e universidades (cão)
Só com o que o kit inicial licenciado permite. O que faltar vira lacuna declarada,
não modelo improvisado.
- Atlas do cão: crânios, ossos disponíveis, abdome, coração e cérebro, no nível de
  realismo mais alto que as fontes permitirem. Músculos só esquemáticos e marcados.
- Ficha da estrutura com português, latim e inglês e fonte em cada dado.
- Três tours cinematográficos:
  1. crânio braquicefálico x dolicocefálico;
  2. coração e grandes vasos;
  3. cérebro com o atlas cortical.
- Modo Explicar ao tutor com as mesmas três cenas.
- Anatomia comparada: crânio do cão, do gato e do cavalo, todos por TC da mesma
  fonte (Edinburgh), lado a lado e ligados pelo Uberon.
- Modo apresentação para palco: tela cheia, roteiro, avanço por teclado ou
  passador, funciona sem internet.
- Pacote do Projeto Acervo Aberto: proposta de uma página, termo de parceria
  modelo e o fluxo de digitalização pronto para receber os dados.

Fase 2 — Gato, equino e bovino; joelho do cão (ligamento cruzado cranial) e membro
distal equino quando houver fonte; cortes de TC e RM com NiiVue; quiz; biblioteca;
revisão profissional; instituição e turmas.

Fase 3 — Corpo completo de cão, gato e cavalo com os dados do Acervo Aberto;
Gaussian splats de peças reais; piloto de realidade virtual; mais espécies e fauna
brasileira; estudo de validação de aprendizagem com universidade parceira.

# CRITÉRIOS DE ACEITE

- Nada na tela é simulado sem aviso. Dado sem fonte não aparece.
- Toda estrutura tem nome em latim (NAV), português, inglês, fonte e status.
- Funciona com a rede desligada, do início ao fim da demonstração.
- Nível balanceado roda fluido em notebook comum; nível leve roda em celular
  intermediário. Meça e informe os números reais.
- Licenças conferidas no download, com cópia datada da página e SHA-256;
  nenhum arquivo sem licença no pacote; créditos gerados automaticamente.
- Nenhum asset NC ou ND, e nenhum asset CC BY-SA criptografado.
- Testes passando, com a contagem informada no relatório.

# COMO TRABALHAR

1. Primeiro, só o plano: arquitetura, inventário de fontes com licença e crédito,
   lista de riscos e no máximo 10 perguntas. Espere minha aprovação.
2. Depois, construa por fases, com commits pequenos e descritivos.
3. Ao fim de cada fase, entregue um relatório: o que existe e funciona, o que foi
   testado e como, o que ficou pendente e por quê. Não chame de pronto o que não
   foi verificado.

# ROTEIRO DA APRESENTAÇÃO (entregar junto com a Fase 1)

Roteiro de 7 minutos para a demonstração ao vivo:
1. Abertura com o animal em tela cheia, com a rede desligada à vista do público.
2. Atlas: camadas, isolar, transparência.
3. Ficha com latim, português, inglês, fonte e status de revisão.
4. Tour braquicefálico x dolicocefálico e a mesma cena no Modo Explicar ao tutor.
5. Anatomia comparada: crânio de cão, gato e cavalo.
6. Proposta para universidades: Projeto Acervo Aberto, turmas, avaliação e
   o argumento da RN CONCEA 53/2021 dito com precisão.
7. Encerramento com as próximas fases e o que já existe hoje.
Inclua uma versão de 2 minutos e as respostas para as 10 perguntas mais prováveis
de reitores, coordenadores de curso e líderes do setor.
```

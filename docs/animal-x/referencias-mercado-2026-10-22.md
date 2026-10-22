# Animal X — referências de mercado, dados abertos e marco legal

Data: 22/10/2026. Base: descrição do Human X 360 (versão 7.24.0). Prompt de construção: [`prompt-mestre.md`](prompt-mestre.md).

**Como a pesquisa foi feita.** Três frentes de busca na web: mercado, dados com licença, e realismo com marco legal. O ambiente bloqueou o acesso direto a quase todos os sites, como Sketchfab, Smithsonian, Cornell, Edinburgh, CFMV e Planalto. Por isso, a maior parte dos fatos vem dos trechos que o buscador extraiu das páginas citadas. Só o GitHub abriu diretamente, e por ele foram conferidos o three.js e a licença do Uberon. Cada licença traz um grau:

- **D**: lida diretamente na fonte.
- **B**: lida no trecho do buscador. Reconferir no momento do download.
- **NV**: não verificada.

Preços e adoção valem para a data da pesquisa e precisam ser conferidos antes de entrar em material de apresentação.

## Resumo para decisão

1. **Não existe um "BioDigital Human" para animais.** Nenhum produto reúne web, várias espécies, comparação entre elas, fonte por dado e plano acessível. Os mais próximos são o Vetflow (Áustria) e o IVALA (EUA).
2. **O teto de realismo é o Anatomage Table Vet,** feito com cadáver real de cão seccionado. Custa dezenas de milhares de dólares em hardware e não tem cavalo. A Animal X disputa pela web, pelo uso offline, pelo preço e pela profundidade em equinos e bovinos.
3. **O concorrente nacional direto é a Biosphera:** brasileira, barata, em português, offline no desktop e com 9 espécies. A Animal X se diferencia com fonte por dado, latim da NAV com revisão, anatomia comparada e Modo Explicar ao tutor.
4. **Não existe um "BodyParts3D animal" aberto.** Há crânios, ossos, alguns órgãos e atlas de cérebro com licença aberta. Não há musculatura aberta nem tomografia de corpo inteiro normal com licença comercial. Esta é a maior descoberta da pesquisa.
5. **A lacuna de dados vira proposta para as universidades:** digitalizar, em parceria com escolas veterinárias brasileiras, cadáveres doados e peças de museu, e publicar com licença aberta e coautoria. O Brasil passaria a ter o primeiro corpo animal aberto do mundo.
6. **O realismo cabe no navegador hoje.** Three.js r186 com WebGPU, material com dispersão subsuperficial, aspecto molhado, Gaussian splats para peças reais e NiiVue para cortes de tomografia e ressonância.
7. **Um atlas educativo veterinário não parece exigir registro na Anvisa nem no MAPA** (não verificado expressamente). O argumento ético mais forte para universidades é a RN CONCEA 53/2021, desde que apresentado com precisão.

## 1. Mercado: as referências

| Produto | Origem | Espécies | Base do realismo | Destaques | Preço público | Lição para a Animal X |
|---|---|---|---|---|---|---|
| Anatomage Table Vet [1][2][3] | EUA | Cão (carro-chefe), gato, camundongo, rã, macaco rhesus. Cavalo não encontrado | Cadáver real congelado sem embalsamamento, seccionado, cores reais | Mesa touch em tamanho real, dissecação virtual por camadas, 285 casos animais com laudos | Não público. Cotação de 2023 de uma mesa não veterinária: US$ 68.000 [6] | Teto de "tecido real". Disputar por web, preço e espécies de grande porte |
| IMAIOS vet-Anatomy [11][12] | França | Cão, gato, cavalo, bovino, camundongo | Raio X, TC e RM reais, mais ilustrações | Rótulos interativos, 12 idiomas com latim da NAV, web e celular | US$ 124,99/ano [11] | Padrão-ouro de imagem com NAV, mas não é corpo 3D navegável. Unir 3D e TC/RM |
| Biosphera [16][17] | **Brasil** | Cão, gato, cavalo, boi, porco, rato, ave, peixe, rã | Modelagem ilustrada | Sistemas, camadas, legendas, RA, Apple Vision no app equino, desktop offline, latim | iOS de US$ 28,99 a 33,99; desktop equino de R$ 237 a 356 [16][17][18] | Concorrente nacional direto. Diferenciar por fonte por dado, revisão, comparação e explicação ao tutor |
| Vetflow [22][23] | Áustria | Cão, gato, cavalo, bovino, porco | Modelos baseados em TC real | Camadas, quiz, flashcards, wiki em latim, português, web e celular | Freemium | O mais próximo de um "BioDigital veterinário". Benchmark direto de experiência de uso |
| IVALA [25][26] | EUA (dentro da VIN) | Cão (lista atual NV) | Reconstruções de TC e RM | Navegador, remover estruturas, testes | Grátis para estudantes e acadêmicos | Tem evidência publicada: notas maiores em estudo controlado. Planejar estudo de validação no Brasil |
| EasyAnatomy [27] | Canadá | Cão | TC e RM, feito com professores | Quiz adaptativo com mais de 800 questões, RA | Não encontrado | Gamificação e quiz adaptativo |
| Sectra Table [31] | Suécia | Qualquer exame | Renderização volumétrica de exames reais | Mesa multitouch, casos próprios | Não público | Deixar o professor importar exames |
| Animal Anatomy XR [29] | NV | Cão, gato | Não declarado | Realidade virtual no Quest e no PS VR2 | US$ 24,99 | RV barata existe. Considerar WebXR |
| Horse Anatomy: Equine 3D [33] | — | Cavalo | Não declarado | Casco, cabeça e pelve | US$ 9,99, avaliação 3,1★ | O nicho equino é mal atendido |

Sem oferta veterinária encontrada: Visible Body, Complete Anatomy, Primal Pictures e BioDigital [34][36].

**Projetos acadêmicos que valem visita ou parceria.**
- **Virginia Tech:** visualizador em realidade virtual com cão, cavalo e boi [37][38].
- **Colorado State e UC Davis:** RV com peças escaneadas [39][52].
- **LMU Munique:** "Visible Dog", feito de criossecções com TC e RM, e cerca de 300 peças escaneadas [46][47].
- **Liverpool:** fluxo publicado de fotogrametria de peças embalsamadas [48].
- **RVC:** membro distal equino com corte, TC, RM e ultrassom do mesmo animal [49].
- **Utrecht:** Centro de Plastinação e RV [44].
- **Japão:** cão no HoloLens 2 com renderização em nuvem [51].
- **Brasil:**
  - ADAV/UFLA, registrado no MEC [53];
  - atlas seccional do cão da UFRA [54];
  - fotogrametria de ossos equinos na UFAPE [55];
  - FAM-SP com SynDaver [56];
  - digitalização de crânios silvestres [57].

## 2. Ultrarrealismo: os cinco benchmarks visuais

Ordenados pelo método de captura documentado. As imagens não foram comparadas lado a lado.

1. **Anatomage Table Vet:** tecido real em cores reais, segmentado [3].
2. **Visible Dog (LMU):** criossecções coloridas com TC e RM [46].
3. **Fotogrametria de peças dissecadas** (Liverpool, LMU, UC Davis): textura fotográfica real [48][47][52].
4. **Plastinação** (Body Worlds "Animal Inside Out", Utrecht): referência física de cor e textura [64][44].
5. **SynDaver Surgical Canine:** referência física e tátil. Um consultor da VIN o avalia como "80% normal", contra 40% de um cadáver descongelado [58][60].

Vetflow, IVALA e IMAIOS têm geometria fiel, vinda de TC, mas não são fotorrealistas. A Animal X pode ser a primeira a unir geometria de TC e textura fotográfica de peça real no navegador.

## 3. O que todos os líderes têm

Girar, zoom e pan; mostrar, ocultar e isolar por sistema e camada; nome e descrição de cada estrutura; busca; quiz e flashcards; vários idiomas com latim; versões web e celular; geometria de TC ou RM; licença institucional. Sem isso, a Animal X não entra na conversa.

## 4. Lacunas que a Animal X pode ocupar

1. **Termos em português, latim da NAV e inglês, com rastreio de cada termo.** Nenhum produto 3D faz isso. A NAV 6ª edição (2017) é gratuita e teve um editor no Rio de Janeiro [65].
2. **Anatomia comparada sincronizada:** a mesma estrutura em espécies diferentes, lado a lado.
3. **Fonte por dado:** de qual espécime, exame ou referência veio cada estrutura. Nenhum produto mostra.
4. **Modo Explicar ao tutor:** nenhum produto tem.
5. **Offline no navegador:** só a Biosphera desktop funciona offline.
6. **3D e imagem clínica correlacionados, no navegador, a preço acessível no Brasil.**
7. **Equinos e bovinos em profundidade, e fauna brasileira.**

## 5. Dados 3D e terminologia com licença

Regra herdada do Human X: só recursos gratuitos com licença verificável. Licenças NC e ND ficam de fora.

### Usar

| Fonte | Conteúdo | Licença | Grau |
|---|---|---|---|
| Edinburgh Dick Vet, Open.Ed [D1] | Esqueletos e crânios por TC (Tobias Schwarz): cavalo, gato, crânio de cão dolicocéfalo e braquicéfalo | CC BY 4.0 | B |
| Pixelbeaker (Sketchfab) [D2] | Segmentação de TC: abdome e coração do cão, sistema digestório do gato | CC BY | B |
| Cornell eCommons [D3] | Atlas cortical do cérebro do cão (30 cães, NIfTI), atlas do cérebro equino, atlas DTI felino | CC0 1.0 | B |
| IF Goiano, Urutaí (Sketchfab) [D4] | Calcâneo equino de peça real. Único acervo veterinário brasileiro aberto encontrado | CC BY | B |
| Museu de Ciències Naturals de Barcelona, RISD Nature Lab, Univ. Dundee [D5] | Crânios de cavalo, cão, gato, ovino e suíno | CC BY | B |
| NIH 3D, "Dog Skull" 3DPX-000282 [D6] | Crânio de cão | Domínio público | B |
| Figshare [D7] | RM de cérebro de dingo e de cão | CC0 | B |
| Uberon [D8] | Ontologia de anatomia entre espécies; tem rúmen, omaso, abomaso e estruturas equinas | CC BY 3.0 | **D** |
| Wikidata [D9] | Fatos de estruturas, com ligação ao Uberon (propriedade P1554) | CC0 | B |

### Usar com cuidado

| Fonte | Motivo |
|---|---|
| Massey "3D Dog Bone Project" [D10] | Fêmur, úmero, escápula, ulna, C7, L1 e crânio são CC BY-SA, e os derivados também saem CC BY-SA. Rádio, fíbula e atlas são CC BY-NC: excluir |
| Nottingham SVMS [D11] | Falanges e navicular equinos CC BY; outros modelos da conta são NC ou sem licença. Conferir um a um |
| Smithsonian Open Access [D12] | Só os itens CC0. Quase não há espécies domésticas; serve para exóticos e comparação |
| MorphoSource [D13] | Só mídias CC0 ou CC BY **e** com acordo que permita uso comercial. O acordo padrão proíbe |
| TCIA ICDC-Glioma; Figshare Yorkshire [D14] | CC BY 4.0, mas mostram anatomia com doença |
| NAV 6ª ed. (WAVA) [D15] | PDF sem licença explícita. Usar só os termos latinos como nomenclatura e pedir autorização escrita à WAVA |
| SNOMED CT VetSCT [D16] | Exige licença de afiliado. O Brasil é membro do SNOMED desde 2018 |
| Sisson, *Anatomy of the Domestic Animals* (1914) [D17] | Provavelmente em domínio público pela idade; conferir o status do scan |

### Não usar

- **LMU Munique (vetanatMunich):** são os melhores ossos (mais de 600), mas CC BY-NC-ND.
- **Phenome10K:** NC.
- **DigiMorph:** licença contraditória.
- **Allen Brain Atlas:** exige permissão escrita.
- **3D Anatomy Studios, gato por TC:** NC.
- **CATLAS:** sem licença.
- **Esqueleto de gato do Tavernier:** NC.
- **Coleções da UZH, FU Berlin e UGA:** sem download nem licença.
- **Visible Dog e Visible Korean:** sem distribuição pública.
- **Código de referência do 3DGS (INRIA):** proíbe uso comercial.

### Kit inicial por espécie

- **Cão:**
  - crânios de Edinburgh, do NIH e de TC (CC BY);
  - ossos CC BY-SA da Massey;
  - abdome e coração do Pixelbeaker;
  - atlas cortical de Cornell;
  - termos do Uberon e do Wikidata.
- **Gato:**
  - esqueleto e crânio de Edinburgh, crânio do RISD;
  - digestório do Pixelbeaker;
  - atlas DTI de Cornell.
- **Cavalo:**
  - crânios de Edinburgh e de Barcelona;
  - falanges e navicular de Nottingham, calcâneo do IF Goiano;
  - atlas cerebral de Cornell.
  - Esqueletos completos só com ressalva: o de Reading (arqueológico, sem dígitos) e o de Diego Luján (artístico).
- **Bovino, suíno, ovino e aves:** crânios e ossos isolados com CC BY, e os termos dos estômagos de ruminantes no Uberon.

## 6. Lacunas de dados e como fechar

1. **Falta:** um modelo aberto com esqueleto articulado, músculos e órgãos de cão, gato ou cavalo.
2. **Falta:** musculatura aberta, de qualquer espécie doméstica.
3. **Falta:** tomografia ou ressonância de corpo inteiro normal com licença comercial.
4. A NAV não tem licença explícita nem códigos, e o Uberon não liga seus termos à NAV.
5. Aves e exóticos têm só ossos isolados.

**Caminhos dentro da regra:**

- **Projeto Acervo Aberto Animal X.** Com uma ou mais escolas veterinárias brasileiras:
  - escanear por TC um cadáver doado de cão, e depois de gato e cavalo;
  - fotografar a dissecação por camadas (fotogrametria);
  - publicar o resultado como CC BY, com coautoria da universidade e aprovação da CEUA quando aplicável.
  - Isso fecha as lacunas 1 a 3 e coloca o Brasil na frente.
- **Pedir autorização escrita e gratuita, ou relicenciamento CC BY,** à LMU, a Edinburgh e à 3D Anatomy Studios.
- **Pedir autorização à WAVA** para usar a NAV, e criar a ponte NAV–Uberon como contribuição aberta.
- **Até lá:** musculatura só se for feita pela equipe, marcada como "esquemático, feito pelo autor" e revisada, como os 24 músculos do pescoço no Human X.

## 7. Tecnologia de realismo recomendada

**Motor:**
- Three.js r186 (MIT), lançado em 24/09/2026, com WebGPURenderer. Ele cai sozinho para WebGL 2 quando o navegador não suporta WebGPU, então um único código serve do celular ao desktop [T1][T2].
- WebGPU já roda no Safari 26, no Chrome desktop e Android 12+, e no Firefox para Windows e Mac ARM [T3].

**Materiais de tecido** [T4][T5]:
- **Desktop:**
  - músculo úmido: clearcoat alto, rugosidade baixa;
  - fáscia e serosa: sheen;
  - músculo e órgãos: dispersão subsuperficial (`MeshSSSNodeMaterial`) com mapa de espessura;
  - córnea e cartilagem: transmission com attenuation.
- **Celular:** material padrão com clearcoat, sem dispersão e sem transmission.

**Iluminação e pós-processamento:**
- HDRI de estúdio.
- Cadeia: GTAO, depois DOF (o desfoque de fundo), bloom sutil e TRAA.
- Tone mapping AgX ou Neutral, escolhido em teste cego com veterinários [T6].

**Peças reais:**
- Gaussian splats para o modo "peça real de museu" (ossos e peças plastinadas), com o renderizador nativo da r186 ou com o Spark (MIT) [T1][T7].
- Para treinar os splats, usar o gsplat do nerfstudio (Apache-2.0), não o código da INRIA [T8].
- A dissecação por camadas continua em malhas.

**Cortes de TC e RM:** NiiVue (BSD-2), com conversão de DICOM para NIfTI fora do app [T9].

**Pacote:**
- glTF/GLB com Meshopt (gltfpack ou glTF-Transform), cadeia de LOD e texturas KTX2 [T10].
- PWA com `navigator.storage.persist()` para o uso offline no navegador.

**Realidade virtual e aumentada** [T11][T12]:
- Piloto de realidade virtual no Quest e no Vision Pro, e exportação USDZ de estruturas isoladas.
- Não prometer realidade aumentada no Vision Pro: o WebXR de lá ainda não suporta AR.

**Demos que mostram o nível visual** (exemplos oficiais do three.js e do Spark):
- `threejs.org/examples/#webgpu_materials_sss`
- `#webgpu_postprocessing_ssgi`
- `#webgpu_gaussian_splat`
- `sparkjs.dev/examples`

## 8. Marco legal e ético (Brasil)

**Registro.**
- A RDC Anvisa 657/2022 trata de software como dispositivo médico, e o conceito de dispositivo médico se refere a uso em seres humanos [L1].
- O Decreto 5.053/2004 define produto veterinário como substância ou preparação, sem citar software [L2].
- Não foi encontrada exigência de registro para um atlas educativo veterinário, mas também não há manifestação expressa da Anvisa ou do MAPA.
- Se a plataforma passar a apoiar diagnóstico ou usar IA clínica, fazer consulta formal.

**CFMV.**
- A Res. 1.321/2020, alterada pela 1.653/2025, rege documentos e prontuário [L3][L4]:
  - guarda mínima de 5 anos;
  - duas vias;
  - evolução com data, hora e CRMV.
  - Na primeira versão, a Animal X é material explicativo que pode ser anexado ao prontuário, não o prontuário.
- A Res. 1.465/2022 rege a telemedicina veterinária [L5]:
  - a teleconsulta exige relação prévia veterinário-animal-responsável;
  - na teleorientação, é vedado dar diagnóstico.
  - A Animal X é apoio visual; a responsabilidade clínica continua do veterinário.
- Não foi encontrada resolução do CFMV sobre inteligência artificial.

**Lei Arouca e CONCEA** (o argumento para universidades):
- **Lei 11.794/2008** [L6][L7]:
  - cabe ao CONCEA acompanhar técnicas alternativas;
  - as práticas de ensino devem ser registradas para evitar repetir procedimentos com animais.
- **RN CONCEA 53/2021** [L8]:
  - proíbe o uso de animais em aulas apenas demonstrativas e observacionais;
  - manda substituí-lo por vídeos, "modelos computacionais" ou outros recursos;
  - tem exceções (pós-graduação, produção, sanidade, inspeção);
  - alcança só aulas com eutanásia ou distresse.
  - **Ressalva:** para anatomia com cadáveres doados, o argumento é ético e logístico, não obrigação legal.
  - Se a RN 53 segue em vigor após consolidações do CONCEA: NV.
- **RN 54/2022:** lista métodos alternativos validados. Não dizer que a Animal X é "reconhecida pelo CONCEA" [L9].

**Diretrizes curriculares (Res. CNE/CES 3/2019)** [L10]:
- exigem metodologias ativas;
- mantêm práticas com animais como indispensáveis.
- Posicionar a Animal X como complemento da prática, nunca como substituta.

**LGPD.**
- Dados do tutor são dados pessoais. A clínica ou a universidade é controladora, e a Animal X é operadora, com contrato de tratamento [L11].
- Normas da ANPD a observar:
  - regime simplificado para pequeno porte;
  - comunicação de incidente;
  - cláusulas-padrão se houver nuvem no exterior.
- Integração futura possível: o Cadastro Nacional de Animais Domésticos (SinPatinhas), criado pela Lei 15.046/2024 (conferir) [L12].

**CC BY-SA em produto comercial** [L13]:
- O uso comercial é permitido, com crédito.
- O modelo alterado continua BY-SA.
- É proibido aplicar travas técnicas, como DRM ou criptografia, que restrinjam os direitos de quem recebe.
- Na prática:
  - manter os assets BY-SA em arquivos separados e sem criptografia no pacote;
  - ter uma tela de créditos.
- O backup criptografado dos dados dos usuários não é afetado.

## 9. Conferir antes da apresentação

- **Licenças grau B:** reconferir no download e arquivar uma cópia da página da licença com data.
- **Preços e adoção dos concorrentes:** os números da tabela 1.
- **RN CONCEA 53/2021:** se continua em vigor.
- **Lei 15.046/2024:** o texto do SinPatinhas.
- **Res. CFMV 879/2008:** a situação atual.
- **NAV:** a resposta da WAVA sobre o uso.

## Fontes

Mercado
- [1] https://anatomage.com/table-vet
- [2] https://eu.anatomage.com/wp-content/uploads/2025/11/ANATOMAGE-TableVet-SpecSheet.pdf
- [3] https://es.anatomage.com/wp-content/uploads/2023/02/2022-Anatomage-Table-Vet-brochure-2.pdf
- [6] https://www.unf.edu/procurement/files/Certified.so.AnatomagePriceQuotation.pdf
- [11] https://apps.apple.com/us/app/id1036140513
- [12] https://www.imaios.com/en/vet-anatomy/dog/dog-whole-body
- [16] https://biosphera3d.com.br/produto/software-anatomia-equina-3d/
- [17] https://apps.apple.com/us/app/3d-horse-anatomy/id742451266
- [18] https://apps.apple.com/app/id821000408
- [22] https://vetflow.com/about
- [23] https://apps.apple.com/app/id6470383838
- [25] https://www.vin.com/apputil/project/DefaultAdv1.aspx?pid=25521
- [26] https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6024603/
- [27] https://apps.apple.com/us/app/id1131383423
- [29] https://www.meta.com/experiences/anatomy-xr-bundle/2352048235252501/
- [31] https://medical.sectra.com/news-press-releases/news-item/E391EF5CEB5654FD
- [33] https://apps.apple.com/us/app/id542541355
- [34] https://visiblebody.com/teaching-anatomy
- [36] https://www.citeline.com/en/products-services/clinical/primal-pictures
- [37] https://virtualanimalproject.vetmed.vt.edu/
- [38] https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7524623/
- [39] https://interniche.org/as_/node/5941
- [44] https://www.uu.nl/en/organisation/faculty-of-veterinary-medicine/research/research-centres-facilities/centre-of-excellence-for-plastination-and-virtual-reality
- [46] https://virtual-body.org/gallery/visible-dog
- [47] https://lrz.de/presse/ereignisse/2020-07-02_Learning-Library-for-Three-Dimensional-Animal-Models
- [48] https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11996711/
- [49] https://learn.rvc.ac.uk/mod/forum/discuss.php?d=25626
- [51] https://blogs.windows.com/japan/2022/06/07/digital-anatomy-for-veterinary-medicine-by-kdl-hab/?amp=1
- [52] https://www.vetmed.ucdavis.edu/vr-links
- [53] https://vitrinetecnologica.mec.gov.br/programas-de-computador/2971-programas-computador2973
- [54] https://repositorio.ufra.edu.br/jspui/bitstream/123456789/1693/1/ATLAS%20DE%20ANATOMIA%20SECIONAL%20DO%20C%C3%83O.pdf
- [55] https://www.scielo.br/j/cr/a/WwrpvXBw4Rss3k9TxfWs6hd/?lang=en
- [56] https://blogs.correiobraziliense.com.br/maisbichos/3273-2/
- [57] http://www.scielo.br/j/cab/a/ntH9tD9vMDDBgSkyxNKbP9y/?lang=pt
- [58] https://dvm360.com/view/realistic-dog-model-created-effort-replace-canine-cadavers-veterinary-surgical-teaching
- [60] https://www.vin.com/doc/?id=8158109
- [64] https://news.wttw.com/2013/03/25/animal-inside-out
- [65] https://www.vetmed.uni-leipzig.de/fileadmin/Fakult%C3%A4t_VMF/Institut_Veterin%C3%A4r-Anatomisches/Dokumente/NAV_6th-Edition-2017.pdf

Dados
- [D1] https://open.ed.ac.uk/3d-skeletons-and-skulls/
- [D2] https://sketchfab.com/3d-models/3d-canine-anatomy-normal-abdomen-962de878d2e94b75b10075931f0edaa3 · https://sketchfab.com/3d-models/normal-canine-heart-anatomy-5b4dec17040248948059e998b46f0b86 · https://sketchfab.com/3d-models/normal-feline-anatomy-digestive-system-ab92a2a9d9024447b0ed4c080ad17106
- [D3] https://ecommons.cornell.edu/items/2b2e5e6a-42d7-4f68-8039-53f220c9d838 · https://ecommons.cornell.edu/handle/1813/64533.2 · https://ecommons.cornell.edu/handle/1813/58775.2
- [D4] https://sketchfab.com/3d-models/equine-calcaneus-veterinary-anatomy-3d-model-4679638454724e7e91bae18be05f0769
- [D5] https://sketchfab.com/3d-models/equus-caballus-skull-4b84a1b3bb194e27aa6d1619329c4032 · https://sketchfab.com/3d-models/domestic-cat-skull-bb6b8398029c45ef9da4e4ff04d2d9d9 · https://sketchfab.com/3d-models/pig-skull-270c6920fd1247c0b048989e64b96b53
- [D6] https://3d.nih.gov/entries/3DPX-000282
- [D7] https://figshare.com/articles/dataset/Dicom_data_MRI_Alpine_dingo_and_domestic_dog_brain/20514693
- [D8] https://github.com/obophenotype/uberon/blob/master/LICENSE
- [D9] https://www.wikidata.org/wiki/Wikidata:Licensing · https://www.wikidata.org/wiki/Property:P1554
- [D10] https://sketchfab.com/3d-models/3d-dog-bone-project-femur-863aec077bf5434a8ada996c10532009
- [D11] https://sketchfab.com/3d-models/equine-limb-p1-p2-p3-navicular-3ee32a605ed54787a9b2a0d11695e927
- [D12] https://dashboard.si.edu/openaccess/faq
- [D13] https://www.morphosource.org/
- [D14] https://www.cancerimagingarchive.net/collection/icdc-glioma/ · https://figshare.com/articles/dataset/CT_and_MRI_scan_of_a_2yo_male_dog_Yorkshire_Terrier/29039192
- [D15] https://www.wava-amav.org/wava-documents.html
- [D16] https://vtsl.vetmed.vt.edu/extension/
- [D17] https://archive.org/details/cu31924001263270

Tecnologia
- [T1] https://github.com/mrdoob/three.js/releases/tag/r186
- [T2] https://github.com/mrdoob/three.js/blob/dev/src/renderers/webgpu/WebGPURenderer.js
- [T3] https://web.dev/blog/webgpu-supported-major-browsers
- [T4] https://github.com/mrdoob/three.js/blob/dev/src/materials/MeshPhysicalMaterial.js
- [T5] https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_materials_sss.html
- [T6] https://github.com/mrdoob/three.js/blob/dev/examples/files.json
- [T7] https://github.com/sparkjsdev/spark
- [T8] https://github.com/graphdeco-inria/gaussian-splatting/blob/main/LICENSE.md · https://github.com/nerfstudio-project/gsplat
- [T9] https://github.com/niivue/niivue
- [T10] https://github.com/zeux/meshoptimizer · https://github.com/donmccurdy/glTF-Transform
- [T11] https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/
- [T12] https://www.uploadvr.com/visionos-2-apple-vision-pro-webxr/

Marco legal
- [L1] https://antigo.anvisa.gov.br/documents/10181/5141677/RDC_657_2022_COMP.pdf/d2da154d-bd76-40ba-87ee-3d9baadb5dd3
- [L2] https://planalto.gov.br/ccivil_03/_Ato2004-2006/2004/Decreto/D5053.htm
- [L3] https://manual.cfmv.gov.br/arquivos/resolucao/1321.pdf
- [L4] https://manual.cfmv.gov.br/arquivos/resolucao/1653.pdf
- [L5] https://www.mattosfilho.com.br/unico/telemedicina-veterinaria-aprovada-regulamentada-brasil/
- [L6] https://www2.camara.leg.br/legin/fed/lei/2008/lei-11794-8-outubro-2008-581883-normaatualizada-pl.html
- [L7] https://legis.senado.leg.br/norma/582216/publicacao/15745691
- [L8] https://ses.sp.bvs.br/wp-content/uploads/2021/05/U_RN-MCTI-CONCEA-53_190521.pdf
- [L9] https://www.unoesc.edu.br/wp-content/uploads/2026/08/Metodos-Alternativos-reconhecidos-pelo-CONCEA_MCTI-—-Ministerio-da-Ciencia-Tecnologia-e-Inovacao.pdf
- [L10] https://portal.mec.gov.br/docman/agosto-2019-pdf/120701-rces003-19/file
- [L11] https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- [L12] https://legis.senado.leg.br/norma/39953577/publicacao/39960014
- [L13] https://creativecommons.org/licenses/by-sa/4.0/legalcode · https://wiki.creativecommons.org/wiki/4.0/ShareAlike

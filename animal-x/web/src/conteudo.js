// Roteiros de tours, especialidades, cenas para o tutor e modo apresentação.
// Textos da equipe Animal X, não revisados: a interface mostra esse status.
// As definições exibidas junto vêm do Uberon, com a fonte indicada.

export const TOURS = [
  {
    id: 'torax',
    titulo: 'Tórax: coração e pulmões',
    resumo: 'Da parede do tórax ao coração, passando pelos pulmões e pelo diafragma.',
    passos: [
      { titulo: 'A caixa torácica', texto: 'O tórax é delimitado pelas vértebras torácicas, pelas costelas e pelo esterno. O modelo mostra treze pares de costelas, número usual no cão.', vista: 'torax', isolar: ['vertebra_toracica', 'costela', 'esterno', 'pulmao', 'coracao'], opacidades: { respiratorio: 0.35, cardiovascular: 0.35 }, realcar: ['costela', 'esterno', 'vertebra_toracica'] },
      { titulo: 'Pulmões', texto: 'Os pulmões ocupam a maior parte da cavidade torácica, um de cada lado. A face medial de cada pulmão recebe a impressão do coração.', vista: 'torax', isolar: ['pulmao', 'coracao', 'traqueia', 'costela', 'vertebra_toracica'], opacidades: { esqueletico: 0.3 }, realcar: ['pulmao'] },
      { titulo: 'Coração', texto: 'O coração fica entre os pulmões, com a base voltada dorsocranialmente e o ápice ventrocaudalmente.', vista: 'coracao', isolar: ['coracao', 'aorta', 'pulmao', 'traqueia'], opacidades: { respiratorio: 0.22 }, realcar: ['coracao'] },
      { titulo: 'Aorta', texto: 'A aorta sai do coração, forma um arco e segue caudalmente, ventral às vértebras torácicas.', vista: 'coracao', isolar: ['coracao', 'aorta', 'vertebra_toracica'], opacidades: { esqueletico: 0.3 }, realcar: ['aorta'] },
      { titulo: 'Diafragma', texto: 'O diafragma separa o tórax do abdome. Logo atrás dele ficam o fígado e o estômago.', vista: { posicao: [0.12, 0.45, 0.62], alvo: [-0.05, 0.36, 0] }, isolar: ['diafragma', 'pulmao', 'figado', 'estomago', 'coracao'], opacidades: { respiratorio: 0.5 }, realcar: ['diafragma'] },
    ],
  },
  {
    id: 'membro-pelvico',
    titulo: 'Membro pélvico: do quadril aos dedos',
    resumo: 'Ossos e músculos principais do membro pélvico, com o joelho em destaque.',
    passos: [
      { titulo: 'Quadril e coxa', texto: 'O fêmur articula-se ao osso do quadril no acetábulo e desce até o joelho.', vista: 'membroPelvico', isolar: ['osso_coxal', 'femur', 'sacro', 'vertebra_lombar', 'patela', 'tibia', 'fibula'], realcar: ['osso_coxal', 'femur'] },
      { titulo: 'Joelho', texto: 'A patela fica na face cranial do joelho, dentro do tendão do músculo quadríceps femoral. Ligamentos e meniscos não estão representados nesta versão.', vista: 'joelho', isolar: ['femur', 'patela', 'tibia', 'fibula', 'm_quadriceps_femoral'], opacidades: { muscular: 0.45 }, realcar: ['patela'] },
      { titulo: 'Músculos da coxa', texto: 'O quadríceps femoral estende o joelho. Na face lateral e caudal da coxa ficam o bíceps femoral e o semitendíneo.', vista: 'membroPelvico', isolar: ['esqueletico', 'm_quadriceps_femoral', 'm_biceps_femoral', 'm_semitendineo', 'm_gluteo_medio'], opacidades: { esqueletico: 0.4 }, realcar: ['m_quadriceps_femoral', 'm_biceps_femoral', 'm_semitendineo'] },
      { titulo: 'Jarrete', texto: 'O músculo gastrocnêmio se insere no calcâneo, a ponta do jarrete, e estende o tarso.', vista: { posicao: [-0.18, 0.18, 0.4], alvo: [-0.34, 0.14, 0.07] }, isolar: ['tibia', 'fibula', 'tarso', 'metatarso', 'm_gastrocnemio', 'femur'], opacidades: { muscular: 0.6 }, realcar: ['m_gastrocnemio', 'tarso'] },
      { titulo: 'Pé', texto: 'Metatarsos e falanges formam o pé. O modelo simplifica os dedos e não mostra o primeiro dedo.', vista: { posicao: [-0.12, 0.08, 0.32], alvo: [-0.32, 0.03, 0.07] }, isolar: ['tarso', 'metatarso', 'falanges_pe'], realcar: ['metatarso', 'falanges_pe'] },
    ],
  },
  {
    id: 'digestorio',
    titulo: 'Sistema digestório',
    resumo: 'Da boca ao intestino grosso, com fígado, baço e pâncreas.',
    passos: [
      { titulo: 'Boca e dentes', texto: 'A mandíbula sustenta os dentes inferiores. Os músculos masseter e temporal fecham a boca.', vista: 'cabeca', isolar: ['cranio', 'mandibula', 'dentes', 'm_masseter', 'm_temporal'], realcar: ['dentes'] },
      { titulo: 'Esôfago', texto: 'O esôfago leva o alimento pelo pescoço e pelo tórax até o estômago. A traqueia corre ao lado, levando o ar.', vista: { posicao: [0.42, 0.62, 0.62], alvo: [0.15, 0.45, 0] }, isolar: ['esofago', 'traqueia', 'estomago', 'vertebra_cervical'], opacidades: { esqueletico: 0.3 }, realcar: ['esofago'] },
      { titulo: 'Estômago e glândulas', texto: 'O estômago do cão é simples. O fígado fica logo atrás do diafragma; o baço acompanha o estômago do lado esquerdo.', vista: 'abdome', isolar: ['estomago', 'figado', 'baco', 'pancreas', 'diafragma'], opacidades: { respiratorio: 0.3 }, realcar: ['estomago', 'figado', 'baco', 'pancreas'] },
      { titulo: 'Intestinos', texto: 'O intestino delgado forma alças no abdome; o intestino grosso segue até o reto. As alças do modelo são ilustrativas.', vista: 'abdome', isolar: ['intestino_delgado', 'intestino_grosso', 'estomago', 'bexiga'], realcar: ['intestino_delgado', 'intestino_grosso'] },
    ],
  },
  {
    id: 'nervoso',
    titulo: 'Sistema nervoso central',
    resumo: 'Encéfalo e medula espinhal dentro do crânio e da coluna.',
    passos: [
      { titulo: 'Encéfalo', texto: 'O encéfalo fica protegido pelo crânio. A superfície do modelo é decorativa e não representa sulcos reais.', vista: 'encefalo', isolar: ['encefalo', 'cranio', 'mandibula'], opacidades: { esqueletico: 0.25 }, realcar: ['encefalo'] },
      { titulo: 'Medula espinhal', texto: 'A medula espinhal corre dentro do canal vertebral, do pescoço até a região lombar.', vista: 'coluna', isolar: ['medula_espinhal', 'encefalo', 'vertebra_cervical', 'vertebra_toracica', 'vertebra_lombar', 'sacro'], opacidades: { esqueletico: 0.3 }, realcar: ['medula_espinhal'] },
    ],
  },
];

export const ESPECIALIDADES = [
  { id: 'ortopedia', titulo: 'Ortopedia', descricao: 'Esqueleto e músculos esquemáticos dos membros.', cena: { vista: 'geral', isolar: ['esqueletico', 'muscular'] } },
  { id: 'cardiologia', titulo: 'Cardiologia', descricao: 'Coração e aorta entre os pulmões.', cena: { vista: 'coracao', isolar: ['cardiovascular', 'respiratorio', 'costela'], opacidades: { respiratorio: 0.25, esqueletico: 0.3 } } },
  { id: 'neurologia', titulo: 'Neurologia', descricao: 'Encéfalo e medula espinhal com a coluna translúcida.', cena: { vista: 'coluna', isolar: ['nervoso', 'esqueletico'], opacidades: { esqueletico: 0.25 } } },
  { id: 'odontologia', titulo: 'Odontologia', descricao: 'Crânio, mandíbula, dentes e músculos da mastigação.', cena: { vista: 'cabeca', isolar: ['cranio', 'mandibula', 'dentes', 'm_masseter', 'm_temporal'] } },
  { id: 'gastro', titulo: 'Gastroenterologia', descricao: 'Esôfago, estômago, intestinos, fígado, pâncreas e baço.', cena: { vista: 'abdome', isolar: ['digestorio', 'linfatico'] } },
  { id: 'pneumologia', titulo: 'Pneumologia', descricao: 'Traqueia, pulmões e diafragma.', cena: { vista: 'torax', isolar: ['respiratorio', 'cardiovascular'], opacidades: { cardiovascular: 0.5 } } },
  { id: 'nefrologia', titulo: 'Nefrologia e urologia', descricao: 'Rins e bexiga com a coluna lombar.', cena: { vista: 'abdome', isolar: ['urinario', 'vertebra_lombar', 'sacro', 'osso_coxal'] } },
  { id: 'reabilitacao', titulo: 'Reabilitação', descricao: 'Músculos esquemáticos sobre o esqueleto.', cena: { vista: 'lateral', isolar: ['esqueletico', 'muscular'], opacidades: { muscular: 0.85 } } },
];

// Especialidades do roteiro sem conteúdo nesta versão, com o motivo.
export const ESPECIALIDADES_PENDENTES = [
  { titulo: 'Anestesiologia', motivo: 'Bloqueios locorregionais exigem nervos periféricos, que não estão no modelo.' },
  { titulo: 'Diagnóstico por imagem', motivo: 'Cortes de TC e RM dependem dos dados licenciados e do visualizador volumétrico.' },
  { titulo: 'Oftalmologia', motivo: 'O olho não está representado.' },
  { titulo: 'Dermatologia', motivo: 'A pele aparece só como silhueta, sem camadas.' },
  { titulo: 'Reprodução e obstetrícia', motivo: 'Órgãos reprodutores não estão representados.' },
  { titulo: 'Equinos e grandes animais', motivo: 'Aguardando fontes licenciadas de cavalo e boi.' },
  { titulo: 'Exóticos e silvestres', motivo: 'Aguardando fontes licenciadas.' },
];

export const CENAS_TUTOR = [
  { id: 'coracao', titulo: 'O coração', estruturas: ['coracao', 'aorta'], contexto: ['pulmao', 'costela'], vista: 'coracao', opacidades: { respiratorio: 0.2, esqueletico: 0.25 }, abertura: 'Vamos ver onde fica o coração do seu animal e para que ele serve.' },
  { id: 'pulmoes', titulo: 'Os pulmões', estruturas: ['pulmao', 'traqueia', 'diafragma'], contexto: ['coracao', 'costela'], vista: 'torax', opacidades: { esqueletico: 0.25 }, abertura: 'Estes são os órgãos da respiração.' },
  { id: 'rins', titulo: 'Os rins e a bexiga', estruturas: ['rim', 'bexiga'], contexto: ['vertebra_lombar', 'osso_coxal'], vista: 'abdome', opacidades: { esqueletico: 0.3 }, abertura: 'Os rins limpam o sangue e produzem a urina.' },
  { id: 'joelho', titulo: 'O joelho', estruturas: ['patela', 'femur', 'tibia', 'm_quadriceps_femoral'], contexto: ['fibula'], vista: 'joelho', opacidades: { muscular: 0.4 }, abertura: 'Este é o joelho da pata de trás.' },
  { id: 'dentes', titulo: 'A boca e os dentes', estruturas: ['dentes', 'mandibula', 'm_masseter'], contexto: ['cranio'], vista: 'cabeca', opacidades: {}, abertura: 'Vamos olhar a boca e os dentes.' },
  { id: 'digestao', titulo: 'Estômago e intestinos', estruturas: ['estomago', 'intestino_delgado', 'intestino_grosso', 'figado'], contexto: ['diafragma'], vista: 'abdome', opacidades: { respiratorio: 0.3 }, abertura: 'Este é o caminho da comida dentro da barriga.' },
  { id: 'coluna', titulo: 'A coluna e a medula', estruturas: ['medula_espinhal', 'vertebra_toracica', 'vertebra_lombar'], contexto: ['encefalo', 'vertebra_cervical'], vista: 'coluna', opacidades: { esqueletico: 0.45 }, abertura: 'A coluna protege os nervos que levam as mensagens do cérebro.' },
];

export const AVISO_TUTOR = 'Material educativo. Não substitui a avaliação do médico-veterinário.';

// Roteiro de 7 passos para a demonstração ao vivo.
export const APRESENTACAO = [
  { titulo: 'Animal X', subtitulo: 'Atlas de anatomia veterinária 3D, multiespécie e offline', texto: 'Tudo o que aparece aqui roda neste computador, sem internet.', cena: { vista: 'geral', mostrarTudo: true }, girar: true },
  { titulo: 'Atlas por camadas', subtitulo: 'Sistemas, isolar, transparência', texto: 'Cada sistema liga e desliga; qualquer estrutura pode ser isolada ou deixada translúcida.', cena: { vista: 'lateral', isolar: ['esqueletico', 'cardiovascular', 'respiratorio', 'digestorio', 'urinario', 'nervoso', 'linfatico'], opacidades: { respiratorio: 0.55 } } },
  { titulo: 'Fonte em cada dado', subtitulo: 'Latim, português, inglês e status de revisão', texto: 'Nome, definição e latim vêm do Uberon com a versão e o SHA-256 registrados. O que é da equipe aparece como não revisado.', cena: { vista: 'coracao', isolar: ['coracao', 'aorta', 'pulmao'], opacidades: { respiratorio: 0.2 }, selecionar: 'coracao' }, ficha: 'coracao' },
  { titulo: 'Tours cinematográficos', subtitulo: 'Tórax, membro pélvico, digestório, sistema nervoso', texto: 'Cada passo mostra a estrutura em destaque e a fonte do que é dito.', cena: { vista: 'joelho', isolar: ['femur', 'patela', 'tibia', 'fibula', 'm_quadriceps_femoral'], opacidades: { muscular: 0.45 }, realcar: ['patela'] } },
  { titulo: 'Explicar ao tutor', subtitulo: 'Linguagem simples, em tela cheia', texto: 'O veterinário mostra a cena ao tutor. Nada é registrado como diagnóstico.', cena: { vista: 'abdome', isolar: ['rim', 'bexiga', 'vertebra_lombar', 'osso_coxal'], opacidades: { esqueletico: 0.3 }, realcar: ['rim'] }, aviso: true },
  { titulo: 'Anatomia comparada', subtitulo: 'Mesma estrutura, várias espécies, ligadas pelo Uberon', texto: 'Cão, gato, cavalo e boi entram à medida que as fontes licenciadas são conferidas. Hoje: cão esquemático e fichas de ruminantes sem 3D.', cena: { vista: 'torax', isolar: ['estomago', 'figado', 'baco', 'costela'], opacidades: { esqueletico: 0.25 }, realcar: ['estomago'] } },
  { titulo: 'Proposta para universidades', subtitulo: 'Projeto Acervo Aberto Animal X', texto: 'Digitalizar, com escolas veterinárias brasileiras, cadáveres doados e peças de museu, e publicar com licença aberta e coautoria. Complementa a prática com animais; não a substitui.', cena: { vista: 'geral', mostrarTudo: true }, girar: true, fases: true },
];

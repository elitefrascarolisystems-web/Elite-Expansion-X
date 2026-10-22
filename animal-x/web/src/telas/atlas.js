import { COMPARADA, ESTRUTURAS, FONTES, SISTEMAS, buscar, estrutura, nome, regiao, sistema } from '../catalogo.js';
import { ESPECIALIDADES, ESPECIALIDADES_PENDENTES, CENAS_TUTOR } from '../conteudo.js';
import { api, local, persistir, preferencias, registrarRecente, sessao } from '../estado.js';
import { ficha, seloRevisao } from '../ficha.js';
import { aoMedir, aoSelecionar, aplicarCena, montarPalco, palco } from '../palco.js';
import { avisar, botao, campo, dialogo, h, icone, limpar, selo } from '../ui.js';

const NOMES_VISTAS = { geral: 'Geral', lateral: 'Lateral', dorsal: 'Dorsal', cranial: 'Cranial', cabeca: 'Cabeça', torax: 'Tórax', abdome: 'Abdome', membroToracico: 'Membro torácico', membroPelvico: 'Membro pélvico' };

function avisoEspecime() {
  return h('div', { class: 'ax-faixa ax-faixa--aviso', role: 'note' }, icone('alerta', 16),
    h('span', {}, 'Cão esquemático feito pela equipe: formas aproximadas, não medidas de um espécime real. Os modelos licenciados entram quando forem baixados e conferidos.'));
}

// Painel de camadas: sistemas, opacidade, vistas e ações de visibilidade.
function painelCamadas() {
  const v = palco.visualizador;
  const corpo = h('div', { class: 'ax-camadas' });
  const desenhar = () => {
    const visiveis = v.sistemasVisiveis();
    limpar(corpo,
      h('h3', {}, 'Sistemas'),
      SISTEMAS.map((s) => h('div', { class: 'ax-camada' },
        h('label', { class: 'ax-alternador' },
          h('input', { type: 'checkbox', checked: visiveis[s.id], onChange: (e) => { v.definirSistema(s.id, e.target.checked); } }),
          h('i', { class: 'ax-cor' }), h('span', {}, s.pt)),
        s.id === 'tegumentar' ? null : h('input', {
          type: 'range', min: '0.1', max: '1', step: '0.05', value: String(v.opacidades[s.id] ?? 1),
          'aria-label': `Opacidade: ${s.pt}`, onInput: (e) => v.definirOpacidade(s.id, Number(e.target.value)),
        }))),
      h('h3', {}, 'Vistas'),
      h('div', { class: 'ax-grade-botoes' }, Object.entries(NOMES_VISTAS).map(([id, rotulo]) => botao(rotulo, { classe: 'ax-btn--pequeno', onClick: () => v.irPara(id) }))),
      h('h3', {}, 'Visibilidade'),
      h('div', { class: 'ax-grade-botoes' },
        botao('Mostrar tudo', { icone: 'tudo', classe: 'ax-btn--pequeno', onClick: () => { v.mostrarTudo(); desenhar(); } }),
        botao('Desfazer', { icone: 'desfazer', classe: 'ax-btn--pequeno', onClick: () => { if (!v.desfazer()) avisar('Nada para desfazer.'); desenhar(); } }),
        botao('Rótulos', { icone: 'rotulo', classe: `ax-btn--pequeno ${v.mostrarRotulos ? 'ax-btn--ativo' : ''}`, pressionado: v.mostrarRotulos, onClick: () => { v.definirRotulos(!v.mostrarRotulos); desenhar(); } })));
    corpo.querySelectorAll('.ax-cor').forEach((el, i) => { el.style.background = SISTEMAS[i].cor; });
  };
  desenhar();
  return { corpo, desenhar };
}

export function telaAtlas({ parametro, navegar }) {
  const lateral = h('aside', { class: 'ax-painel ax-painel--direita', 'aria-label': 'Ficha da estrutura' });
  const palcoHost = h('div', { class: 'ax-palco-host' });
  const camadas = h('aside', { class: 'ax-painel ax-painel--esquerda', 'aria-label': 'Camadas' });
  const raiz = h('div', { class: 'ax-tela-3d' }, camadas, palcoHost, lateral);
  montarPalco(palcoHost);
  let painel;

  const mostrarFicha = (info) => {
    if (!info) {
      limpar(lateral, h('div', { class: 'ax-painel-vazio' },
        h('h2', {}, 'Cão esquemático'),
        h('p', {}, 'Clique numa estrutura para abrir a ficha. Arraste para girar, role para aproximar, clique com o botão direito e arraste para mover.'),
        avisoEspecime(),
        h('h3', {}, 'Estruturas recentes'),
        local.recentes.length ? h('ul', { class: 'ax-lista-links' }, local.recentes.map((id) => h('li', {}, h('a', { href: `#/atlas/${id}` }, nome(id, preferencias.idiomaTermos))))) : h('p', { class: 'ax-nota' }, 'Nenhuma ainda.')));
      return;
    }
    registrarRecente(info.estrutura);
    const v = palco.visualizador;
    limpar(lateral, ficha(info.estrutura, {
      lado: info.lado,
      acoes: {
        focar: () => v.focar(info.estrutura),
        isolar: () => { v.isolar([info.estrutura]); painel?.desenhar(); v.focar(info.estrutura); },
        ocultar: () => { v.ocultar(info.chave); painel?.desenhar(); },
        tutor: () => {
          const cena = CENAS_TUTOR.find((c) => c.estruturas.includes(info.estrutura));
          navegar(cena ? `tutor/${cena.id}` : `tutor/estrutura:${info.estrutura}`);
        },
      },
    }), h('div', { class: 'ax-grade-botoes' },
      botao('Salvar cena', { icone: 'salvar', classe: 'ax-btn--pequeno', onClick: () => salvarCena() }),
      botao('Ver na comparada', { icone: 'comparada', classe: 'ax-btn--pequeno', onClick: () => navegar(`comparada/${info.estrutura}`) })));
  };

  const desligar = aoSelecionar((info) => {
    mostrarFicha(info);
    local.ultimaCena = palco.visualizador.estadoCena();
    persistir();
  });

  palco.pronto.then(() => {
    painel = painelCamadas();
    limpar(camadas, painel.corpo);
    if (parametro && estrutura(parametro)) {
      // Link direto: mostra o sistema da estrutura sobre o esqueleto translúcido.
      const e = estrutura(parametro);
      const opacidades = e.sistema === 'esqueletico' ? {} : { esqueletico: 0.22 };
      aplicarCena({ isolar: [e.sistema, 'esqueletico'], opacidades, selecionar: parametro }, { animar: false })
        .then(() => { painel.desenhar(); palco.visualizador.focar(parametro); });
    } else {
      mostrarFicha(palco.visualizador.selecionada ? { ...palco.visualizador.malhas.get(palco.visualizador.selecionada).userData } : null);
    }
  }).catch(() => {});
  mostrarFicha(null);
  return { elemento: raiz, sair: desligar };
}

export async function salvarCena() {
  if (!sessao.usuario) {
    avisar('Entre na sua conta para salvar cenas na biblioteca.', 'erro');
    return;
  }
  const titulo = h('input', { type: 'text', maxlength: '120', required: true, value: `Cena de ${new Date().toLocaleDateString('pt-BR')}` });
  dialogo('Salvar cena na biblioteca', campo('Título', titulo), {
    acoes: [{ rotulo: 'Salvar', classe: 'ax-btn--primario', acao: async (fechar) => {
      try {
        await api('/api/biblioteca', { metodo: 'POST', corpo: { tipo: 'cena', titulo: titulo.value, dados: palco.visualizador.estadoCena() } });
        avisar('Cena salva em Minha biblioteca.');
        fechar();
      } catch (erro) {
        avisar(erro.message, 'erro');
      }
    } }],
  });
}

export function telaComparada({ parametro }) {
  const ESPECIES = [
    { id: 'cao', nome: 'Cão', estado: 'Esquemático (equipe)', ok: true },
    { id: 'gato', nome: 'Gato', estado: 'Aguardando fonte', fontes: FONTES.planejadas.filter((f) => f.especies.includes('gato')) },
    { id: 'equino', nome: 'Equino', estado: 'Aguardando fonte', fontes: FONTES.planejadas.filter((f) => f.especies.includes('equino')) },
    { id: 'bovino', nome: 'Bovino', estado: 'Aguardando fonte', fontes: [] },
  ];
  const detalhe = h('section', { class: 'ax-cartao' });
  const palcoHost = h('div', { class: 'ax-palco-host ax-palco-host--compacto' });
  const escolher = (id) => {
    const e = estrutura(id);
    if (!e) return;
    aplicarCena({ isolar: [id], vista: undefined });
    palco.pronto.then(() => palco.visualizador.focar(id));
    limpar(detalhe,
      h('h2', {}, e.pt, ' ', h('small', { class: 'ax-latim' }, e.latim.termo)),
      h('p', {}, h('strong', {}, e.uberon.id), ' — a mesma classe do Uberon serve a todas as espécies; a homologia vem da ontologia, não de suposição.'),
      h('table', { class: 'ax-tabela' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Espécie'), h('th', {}, 'Modelo 3D'), h('th', {}, 'Fontes previstas'))),
        h('tbody', {}, ESPECIES.map((sp) => h('tr', {},
          h('td', {}, sp.nome),
          h('td', {}, sp.ok ? selo(sp.estado, 'aviso') : selo(sp.estado, 'neutro')),
          h('td', {}, sp.ok ? 'Substituir pelos modelos do kit inicial (TC de Edinburgh, Pixelbeaker, Massey).' : sp.fontes.length ? sp.fontes.map((f) => `${f.titulo} (${f.licenca.nome}, grau ${f.grau})`).join('; ') : 'Nenhuma fonte aberta encontrada; depende do Projeto Acervo Aberto.'))))),
      h('p', { class: 'ax-nota' }, 'Nenhum modelo é deformado para virar outra espécie: cada espécie entra com a sua própria fonte.'));
  };
  const lista = h('ul', { class: 'ax-lista-selecao' }, ESTRUTURAS.filter((e) => e.sistema !== 'tegumentar').map((e) =>
    h('li', {}, h('button', { type: 'button', onClick: () => { escolher(e.id); history.replaceState(null, '', `#/comparada/${e.id}`); } }, h('span', {}, e.pt), h('small', {}, e.uberon.id)))));
  const ruminantes = h('section', { class: 'ax-cartao' },
    h('h2', {}, 'Estruturas sem modelo 3D nesta versão'),
    h('p', { class: 'ax-nota' }, 'Fichas com nome e definição do Uberon (CC BY 3.0). O 3D entra com fontes licenciadas.'),
    h('div', { class: 'ax-grade-cartoes' }, COMPARADA.map((c) => h('article', { class: 'ax-mini' },
      h('h3', {}, c.pt, ' ', h('small', {}, c.uberon.id)),
      h('p', {}, c.uberon.definicao ?? '—'),
      h('p', { class: 'ax-nota' }, `Espécies: ${c.especies.join(', ')} · Fonte: Uberon`)))));
  montarPalco(palcoHost);
  const raiz = h('div', { class: 'ax-comparada' },
    h('div', { class: 'ax-comparada-topo' }, h('div', { class: 'ax-painel ax-painel--lista' }, h('h3', {}, 'Escolha a estrutura'), lista), palcoHost, detalhe),
    ruminantes);
  escolher(parametro && estrutura(parametro) ? parametro : 'estomago');
  return { elemento: raiz };
}

export function telaEspecialidades({ navegar }) {
  return { elemento: h('div', { class: 'ax-pagina' },
    h('p', { class: 'ax-intro' }, 'Pontos de partida prontos. Cada um abre o atlas com os sistemas e a vista certos.'),
    h('div', { class: 'ax-grade-cartoes' }, ESPECIALIDADES.map((esp) => h('button', {
      type: 'button', class: 'ax-cartao ax-cartao--acao',
      onClick: async () => { navegar('atlas'); await aplicarCena(esp.cena); },
    }, h('h3', {}, esp.titulo), h('p', {}, esp.descricao)))),
    h('h2', {}, 'Ainda sem conteúdo nesta versão'),
    h('div', { class: 'ax-grade-cartoes' }, ESPECIALIDADES_PENDENTES.map((p) => h('div', { class: 'ax-cartao ax-cartao--pendente' }, h('h3', {}, p.titulo), h('p', {}, p.motivo))))) };
}

export function telaEstruturas({ parametro, navegar }) {
  const busca = h('input', { type: 'search', placeholder: 'Buscar em português, latim, inglês ou ID do Uberon', 'aria-label': 'Buscar estrutura' });
  const filtroSistema = h('select', { 'aria-label': 'Sistema' }, h('option', { value: '' }, 'Todos os sistemas'), SISTEMAS.map((s) => h('option', { value: s.id }, s.pt)));
  const filtroStatus = h('select', { 'aria-label': 'Status de revisão' }, h('option', { value: '' }, 'Qualquer status'), h('option', { value: 'nao_revisado' }, 'Não revisado'), h('option', { value: 'em_revisao' }, 'Em revisão'), h('option', { value: 'revisado' }, 'Revisado'));
  const lista = h('ul', { class: 'ax-lista-estruturas' });
  const detalhe = h('section', { class: 'ax-painel ax-painel--ficha' });
  const contador = h('p', { class: 'ax-nota' });
  const abrir = (id) => {
    limpar(detalhe, ficha(id, { acoes: { focar: () => navegar(`atlas/${id}`) } }), botao('Ver no 3D', { icone: 'atlas', classe: 'ax-btn--primario', onClick: () => navegar(`atlas/${id}`) }));
    history.replaceState(null, '', `#/estruturas/${id}`);
  };
  const filtrar = () => {
    const itens = buscar(busca.value).filter((e) => (!filtroSistema.value || e.sistema === filtroSistema.value)
      && (!filtroStatus.value || (sessao.revisoes[e.id]?.status ?? 'nao_revisado') === filtroStatus.value));
    contador.textContent = `${itens.length} de ${ESTRUTURAS.length} estruturas`;
    limpar(lista, itens.map((e) => h('li', {}, h('button', { type: 'button', onClick: () => abrir(e.id) },
      h('span', { class: 'ax-nome' }, e.pt), h('span', { class: 'ax-latim' }, e.latim.termo), h('span', { class: 'ax-en' }, e.en),
      h('span', { class: 'ax-meta' }, sistema(e.sistema)?.pt, ' · ', regiao(e.regiao)?.pt), seloRevisao(e.id)))));
  };
  [busca, filtroSistema, filtroStatus].forEach((el) => el.addEventListener('input', filtrar));
  filtrar();
  if (parametro && estrutura(parametro)) abrir(parametro);
  else limpar(detalhe, h('p', { class: 'ax-painel-vazio' }, 'Escolha uma estrutura para ver a ficha com as fontes.'));
  return { elemento: h('div', { class: 'ax-estruturas' }, h('div', { class: 'ax-estruturas-lista' }, h('div', { class: 'ax-filtros' }, busca, filtroSistema, filtroStatus), contador, lista), detalhe) };
}

export function telaFerramentas() {
  const v = () => palco.visualizador;
  const palcoHost = h('div', { class: 'ax-palco-host' });
  const caneta = h('canvas', { class: 'ax-caneta', 'aria-hidden': 'true' });
  palcoHost.append(caneta);
  montarPalco(palcoHost);
  palcoHost.append(caneta);
  const resultadoMedida = h('p', { class: 'ax-medida', 'aria-live': 'polite' }, 'Ative a medida e clique em dois pontos.');
  let modoCaneta = false;
  const LIMITES = { transversal: [-0.6, 0.6], sagital: [-0.15, 0.15], dorsal: [0, 0.7] };
  const NOMES = { transversal: 'Transversal', sagital: 'Sagital (mediano)', dorsal: 'Dorsal' };
  const cortes = Object.keys(LIMITES).map((tipo) => {
    const [min, max] = LIMITES[tipo];
    const ativo = h('input', { type: 'checkbox' });
    const faixa = h('input', { type: 'range', min: String(min), max: String(max), step: '0.005', value: String((min + max) / 2), 'aria-label': `Posição do corte ${NOMES[tipo]}` });
    const atualizar = () => v().definirCorte(tipo, ativo.checked ? Number(faixa.value) * (tipo === 'dorsal' ? 1 : 1) : null);
    ativo.addEventListener('change', atualizar);
    faixa.addEventListener('input', atualizar);
    return h('div', { class: 'ax-corte' }, h('label', { class: 'ax-alternador' }, ativo, h('span', {}, NOMES[tipo])), faixa);
  });
  const desligarMedida = aoMedir(({ metros }) => {
    resultadoMedida.textContent = `Distância aproximada: ${(metros * 100).toFixed(1)} cm (modelo esquemático, não usar como medida real).`;
  });
  // Caneta: desenho livre sobre a tela, incluído na imagem exportada.
  const ctx = caneta.getContext('2d');
  const ajustarCaneta = () => {
    const r = palcoHost.getBoundingClientRect();
    caneta.width = r.width * devicePixelRatio;
    caneta.height = r.height * devicePixelRatio;
    caneta.style.width = `${r.width}px`;
    caneta.style.height = `${r.height}px`;
  };
  let desenhando = false;
  caneta.addEventListener('pointerdown', (e) => {
    desenhando = true;
    const r = caneta.getBoundingClientRect();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo((e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio);
  });
  caneta.addEventListener('pointermove', (e) => {
    if (!desenhando) return;
    const r = caneta.getBoundingClientRect();
    ctx.lineTo((e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio);
    ctx.stroke();
  });
  const pararDesenho = () => { desenhando = false; };
  window.addEventListener('pointerup', pararDesenho);
  const botaoCaneta = botao('Caneta', { icone: 'caneta', onClick: (e) => {
    modoCaneta = !modoCaneta;
    if (modoCaneta) ajustarCaneta();
    caneta.classList.toggle('ax-caneta--ativa', modoCaneta);
    e.currentTarget.classList.toggle('ax-btn--ativo', modoCaneta);
  } });
  const exportar = async () => {
    const blob = await v().capturarImagem();
    const bitmap = await createImageBitmap(blob);
    const tela = document.createElement('canvas');
    tela.width = bitmap.width;
    tela.height = bitmap.height;
    const c2 = tela.getContext('2d');
    c2.drawImage(bitmap, 0, 0);
    if (caneta.width) c2.drawImage(caneta, 0, 0, tela.width, tela.height);
    c2.fillStyle = 'rgba(7,11,18,.7)';
    c2.fillRect(0, tela.height - 28, tela.width, 28);
    c2.fillStyle = '#e5edf5';
    c2.font = `${12 * (tela.width / palcoHost.clientWidth || 1)}px sans-serif`;
    c2.fillText('Animal X · cão esquemático (não é espécime real) · Uberon CC BY 3.0', 10, tela.height - 10);
    const link = h('a', { href: tela.toDataURL('image/png'), download: `animal-x-${Date.now()}.png` });
    link.click();
    avisar('Imagem exportada.');
  };
  const painel = h('aside', { class: 'ax-painel ax-painel--direita' },
    h('h2', {}, 'Ferramentas de estudo'),
    h('h3', {}, 'Cortes'),
    h('p', { class: 'ax-nota' }, 'Corte sem tampa: o interior aparece oco.'),
    cortes,
    h('h3', {}, 'Medida aproximada'),
    botao('Medir', { icone: 'regua', onClick: (e) => {
      const ativo = !v().modoMedida;
      v().definirModoMedida(ativo);
      e.currentTarget.classList.toggle('ax-btn--ativo', ativo);
      resultadoMedida.textContent = ativo ? 'Clique em dois pontos de superfície.' : 'Medida desligada.';
    } }),
    resultadoMedida,
    h('h3', {}, 'Rótulos, caneta e imagem'),
    h('div', { class: 'ax-grade-botoes' },
      botao('Rótulos', { icone: 'rotulo', onClick: (e) => { v().definirRotulos(!v().mostrarRotulos); e.currentTarget.classList.toggle('ax-btn--ativo', v().mostrarRotulos); } }),
      botaoCaneta,
      botao('Limpar caneta', { icone: 'lixo', onClick: () => ctx.clearRect(0, 0, caneta.width, caneta.height) }),
      botao('Exportar imagem', { icone: 'baixar', classe: 'ax-btn--primario', onClick: exportar }),
      botao('Salvar cena', { icone: 'salvar', onClick: () => salvarCena() })));
  return {
    elemento: h('div', { class: 'ax-tela-3d ax-tela-3d--ferramentas' }, palcoHost, painel),
    sair: () => {
      window.removeEventListener('pointerup', pararDesenho);
      desligarMedida();
      v()?.definirModoMedida(false);
      for (const tipo of Object.keys(LIMITES)) v()?.definirCorte(tipo, null);
    },
  };
}


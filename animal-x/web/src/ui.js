// Utilitários de interface: criação de elementos, ícones, avisos e diálogos.
// Nada de innerHTML com dados: todo texto entra como nó de texto.

export function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos ?? {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (chave === 'class') el.className = valor;
    else if (chave === 'dataset') Object.assign(el.dataset, valor);
    else if (chave.startsWith('on') && typeof valor === 'function') el.addEventListener(chave.slice(2).toLowerCase(), valor);
    else if (chave === 'value') el.value = valor;
    else if (chave === 'checked') el.checked = Boolean(valor);
    else el.setAttribute(chave, valor === true ? '' : String(valor));
  }
  anexar(el, filhos);
  return el;
}

function anexar(el, filhos) {
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
}

export function limpar(el, ...filhos) {
  el.replaceChildren();
  anexar(el, filhos);
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';
// Ícones de traço simples (24×24), desenhados para o Animal X.
const CAMINHOS = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  atlas: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 3v18M4 7.5l8 4.5 8-4.5',
  comparada: 'M4 6h7v12H4zM13 6h7v12h-7zM7.5 10v4M16.5 10v4',
  especialidades: 'M12 3v18M3 12h18M6 6l12 12M18 6L6 18',
  estruturas: 'M4 5h16M4 10h16M4 15h10M4 20h7M18 15l3 3-3 3',
  ferramentas: 'M14 4l6 6-9 9H5v-6zM12 6l6 6',
  tours: 'M8 5v14l11-7z',
  tutor: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  avaliacao: 'M9 11l2 2 4-4M5 4h14v16H5z',
  biblioteca: 'M5 4h4v16H5zM10 4h4v16h-4zM15 5l4-1 3 15-4 1z',
  evidencias: 'M7 4h8l4 4v12H7zM15 4v4h4M10 12h6M10 16h6',
  revisao: 'M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7zM9 12l2 2 4-4',
  laboratorio: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9',
  instituicao: 'M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  configuracoes: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  administracao: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  apresentacao: 'M3 4h18v12H3zM12 16v4M8 20h8M10 8l4 2-4 2z',
  sair: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  entrar: 'M15 4h4v16h-4M11 8l4 4-4 4M15 12H4',
  olho: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  olhoFechado: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.3 7.3C3.8 9 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.3-1',
  isolar: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  desfazer: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  tudo: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  foco: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  estrela: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  camera: 'M4 7h3l2-3h6l2 3h3v12H4zM12 10a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  regua: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  rotulo: 'M4 4h9l7 8-7 8H4zM8 12h.01',
  corte: 'M4 4l16 16M4 12h16M12 4v16',
  caneta: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  fechar: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  anterior: 'M15 5l-7 7 7 7',
  proximo: 'M9 5l7 7-7 7',
  pausar: 'M8 5v14M16 5v14',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z',
  alerta: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  offline: 'M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  salvar: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  lixo: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  baixar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  tela: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  enviar: 'M4 12l16-8-6 16-2-7z',
};

export function icone(nome, tamanho = 18) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', tamanho);
  svg.setAttribute('height', tamanho);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const caminho = document.createElementNS(SVG, 'path');
  caminho.setAttribute('d', CAMINHOS[nome] ?? CAMINHOS.info);
  svg.append(caminho);
  return svg;
}

export function botao(rotulo, { icone: nomeIcone, onClick, classe = '', titulo, tipo = 'button', desativado = false, pressionado } = {}) {
  return h('button', {
    type: tipo,
    class: `ax-btn ${classe}`.trim(),
    title: titulo ?? (nomeIcone && !rotulo ? undefined : undefined),
    'aria-label': !rotulo ? titulo : undefined,
    'aria-pressed': pressionado === undefined ? undefined : String(Boolean(pressionado)),
    disabled: desativado,
    onClick,
  }, nomeIcone ? icone(nomeIcone) : null, rotulo ? h('span', {}, rotulo) : null);
}

let caixaAvisos;
export function avisar(mensagem, tipo = 'info', duracao = 4200) {
  caixaAvisos ??= document.body.appendChild(h('div', { class: 'ax-avisos', role: 'status', 'aria-live': 'polite' }));
  const el = h('div', { class: `ax-aviso ax-aviso--${tipo}` }, icone(tipo === 'erro' ? 'alerta' : 'info', 16), h('span', {}, mensagem));
  caixaAvisos.append(el);
  setTimeout(() => el.remove(), duracao);
}

export function dialogo(titulo, conteudo, { acoes = [] } = {}) {
  const fechar = () => {
    fundo.remove();
    document.removeEventListener('keydown', tecla);
  };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  const fundo = h('div', { class: 'ax-dialogo-fundo', onClick: (e) => { if (e.target === fundo) fechar(); } },
    h('div', { class: 'ax-dialogo', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      h('header', {}, h('h2', {}, titulo), botao('', { icone: 'fechar', titulo: 'Fechar', classe: 'ax-btn--icone', onClick: fechar })),
      h('div', { class: 'ax-dialogo-corpo' }, conteudo),
      acoes.length ? h('footer', {}, acoes.map((a) => botao(a.rotulo, { classe: a.classe, onClick: () => a.acao(fechar) }))) : null));
  document.body.append(fundo);
  document.addEventListener('keydown', tecla);
  fundo.querySelector('input, select, textarea, button')?.focus();
  return fechar;
}

export function selo(texto, tipo = 'neutro') {
  return h('span', { class: `ax-selo ax-selo--${tipo}` }, texto);
}

export function dataBr(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
}

export function dataHoraBr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function campo(rotulo, entrada, ajuda) {
  return h('label', { class: 'ax-campo' }, h('span', {}, rotulo), entrada, ajuda ? h('small', {}, ajuda) : null);
}

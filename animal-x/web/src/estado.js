// Estado da aplicação, preferências locais e cliente da API.

const CHAVE = 'animalx:v1';

function ler() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
  } catch {
    return {};
  }
}

function gravar(dados) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    // Navegação privada ou armazenamento bloqueado: segue sem guardar.
  }
}

const salvo = ler();

export const preferencias = {
  tema: 'escuro',
  qualidade: 'balanceado',
  idiomaTermos: 'pt',
  densidade: 'confortavel',
  reduzirMovimento: false,
  forcarWebGL: false,
  ...(salvo.preferencias ?? {}),
};

export const local = {
  recentes: salvo.recentes ?? [],
  favoritos: salvo.favoritos ?? [],
  ultimaCena: salvo.ultimaCena ?? null,
  ultimaRota: salvo.ultimaRota ?? null,
  recordeQuiz: salvo.recordeQuiz ?? 0,
};

export function persistir() {
  gravar({ preferencias, ...local });
}

export function definirPreferencia(chave, valor) {
  preferencias[chave] = valor;
  persistir();
  ouvintes.forEach((f) => f('preferencias', chave));
}

export function registrarRecente(id) {
  local.recentes = [id, ...local.recentes.filter((x) => x !== id)].slice(0, 8);
  persistir();
}

export function alternarFavorito(id) {
  local.favoritos = local.favoritos.includes(id) ? local.favoritos.filter((x) => x !== id) : [id, ...local.favoritos];
  persistir();
  return local.favoritos.includes(id);
}

const ouvintes = new Set();
export function ouvir(f) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

export const sessao = { usuario: null, csrf: null, modo: null, cadastroAberto: true, papeis: {}, statusRevisao: {}, revisoes: {}, servidor: false };

export function notificar(tipo) {
  ouvintes.forEach((f) => f(tipo));
}

export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const cabecalhos = { Accept: 'application/json' };
  if (metodo !== 'GET') {
    cabecalhos['Content-Type'] = 'application/json';
    cabecalhos['X-AnimalX'] = '1';
    if (sessao.csrf) cabecalhos['X-CSRF-Token'] = sessao.csrf;
  }
  let resposta;
  try {
    resposta = await fetch(caminho, { method: metodo, headers: cabecalhos, body: corpo ? JSON.stringify(corpo) : undefined, credentials: 'same-origin' });
  } catch {
    throw new Error('Sem conexão com o servidor. O atlas continua funcionando offline; contas, biblioteca e laboratório precisam do servidor.');
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw Object.assign(new Error(dados.erro ?? `Erro ${resposta.status}`), { status: resposta.status });
  return dados;
}

export async function carregarSessao() {
  try {
    const dados = await api('/api/sessao');
    Object.assign(sessao, dados, { servidor: true });
    const { revisoes } = await api('/api/revisoes');
    sessao.revisoes = revisoes;
  } catch {
    sessao.servidor = false;
  }
  notificar('sessao');
}

export async function entrar(email, senha) {
  const dados = await api('/api/entrar', { metodo: 'POST', corpo: { email, senha } });
  sessao.usuario = dados.usuario;
  sessao.csrf = dados.csrf;
  notificar('sessao');
}

export async function cadastrar(nome, email, senha) {
  const dados = await api('/api/cadastro', { metodo: 'POST', corpo: { nome, email, senha } });
  sessao.usuario = dados.usuario;
  sessao.csrf = dados.csrf;
  notificar('sessao');
}

export async function sair() {
  await api('/api/sair', { metodo: 'POST' }).catch(() => {});
  sessao.usuario = null;
  sessao.csrf = null;
  notificar('sessao');
}

export function statusRevisao(id) {
  return sessao.revisoes?.[id] ?? { status: 'nao_revisado' };
}

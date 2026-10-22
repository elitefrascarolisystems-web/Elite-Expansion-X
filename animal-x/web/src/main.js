import { carregarSessao, local, ouvir, persistir, preferencias, sair, sessao } from './estado.js';
import { aoTrocarBackend, iniciarPalco, palco, temaDoPalco } from './palco.js';
import { abrirApresentacao, telaAvaliacao, telaTours, telaTutor } from './telas/aprender.js';
import { telaAtlas, telaComparada, telaEspecialidades, telaEstruturas, telaFerramentas } from './telas/atlas.js';
import {
  telaAdministracao, telaBiblioteca, telaConfiguracoes, telaEntrar, telaEvidencias, telaInicio, telaInstituicao, telaLaboratorio, telaRevisao,
} from './telas/conta.js';
import { avisar, botao, h, icone, limpar } from './ui.js';

// Navegação na ordem de uso de um especialista.
const ROTAS = [
  { id: 'inicio', titulo: 'Início', icone: 'inicio', tela: telaInicio },
  { id: 'atlas', titulo: 'Atlas 3D', icone: 'atlas', tela: telaAtlas, palco: true },
  { id: 'comparada', titulo: 'Anatomia comparada', icone: 'comparada', tela: telaComparada, palco: true },
  { id: 'especialidades', titulo: 'Especialidades', icone: 'especialidades', tela: telaEspecialidades },
  { id: 'estruturas', titulo: 'Estruturas', icone: 'estruturas', tela: telaEstruturas },
  { id: 'ferramentas', titulo: 'Ferramentas de estudo', icone: 'ferramentas', tela: telaFerramentas, palco: true },
  { id: 'tours', titulo: 'Aulas e tours', icone: 'tours', tela: telaTours, palco: true },
  { id: 'tutor', titulo: 'Explicar ao tutor', icone: 'tutor', tela: telaTutor, palco: true },
  { id: 'avaliacao', titulo: 'Avaliação', icone: 'avaliacao', tela: telaAvaliacao, palco: true },
  { id: 'biblioteca', titulo: 'Minha biblioteca', icone: 'biblioteca', tela: telaBiblioteca },
  { id: 'evidencias', titulo: 'Evidências e referências', icone: 'evidencias', tela: telaEvidencias },
  { id: 'revisao', titulo: 'Revisão profissional', icone: 'revisao', tela: telaRevisao },
  { id: 'laboratorio', titulo: 'Laboratório do animal', icone: 'laboratorio', tela: telaLaboratorio },
  { id: 'instituicao', titulo: 'Instituição', icone: 'instituicao', tela: telaInstituicao, papeis: ['instituicao', 'professor', 'admin'] },
  { id: 'configuracoes', titulo: 'Configurações', icone: 'configuracoes', tela: telaConfiguracoes },
  { id: 'administracao', titulo: 'Administração', icone: 'administracao', tela: telaAdministracao, papeis: ['admin', 'suporte'] },
  { id: 'entrar', titulo: 'Entrar', icone: 'entrar', tela: telaEntrar, oculta: true },
];

const app = document.getElementById('app');
const nav = h('nav', { class: 'ax-nav', 'aria-label': 'Navegação principal' });
const conta = h('div', { class: 'ax-conta' });
const rede = h('div', { class: 'ax-status' });
const lateral = h('aside', { class: 'ax-lateral', id: 'ax-lateral' },
  h('a', { class: 'ax-marca', href: '#/inicio' }, h('img', { src: 'icone.svg', alt: '', width: '32', height: '32' }), h('span', {}, 'Animal X'), h('small', {}, 'Atlas veterinário 3D')),
  h('div', { class: 'ax-especime' }, h('span', { class: 'ax-ponto' }), 'Cão · esquemático'),
  nav,
  botao('Modo apresentação', { icone: 'apresentacao', classe: 'ax-btn--apresentar', onClick: () => abrirApresentacao() }),
  conta,
  rede);
const titulo = h('h1', { class: 'ax-titulo' });
const conteudo = h('section', { class: 'ax-conteudo', id: 'conteudo', tabindex: '-1' });
const topo = h('header', { class: 'ax-topo' },
  botao('', { icone: 'menu', titulo: 'Menu', classe: 'ax-btn--icone ax-so-celular', onClick: () => document.body.classList.toggle('ax-menu-aberto') }),
  titulo,
  h('span', { class: 'ax-topo-aviso' }, 'Ensino e explicação ao tutor · não é diagnóstico'));
limpar(app, h('div', { class: 'ax-app' }, lateral, h('main', { class: 'ax-principal' }, topo, conteudo)));
app.classList.remove('ax-carregando');

let telaAtual = null;

function aplicarTema() {
  const tema = preferencias.tema === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro') : preferencias.tema;
  document.documentElement.dataset.tema = tema;
  document.documentElement.dataset.densidade = preferencias.densidade;
  document.documentElement.dataset.movimento = preferencias.reduzirMovimento ? 'reduzido' : 'normal';
  palco.visualizador?.definirTema?.(temaDoPalco());
}

function desenharNav(rotaAtual) {
  const papel = sessao.usuario?.papel;
  limpar(nav, ROTAS.filter((r) => !r.oculta && (!r.papeis || r.papeis.includes(papel))).map((r) =>
    h('a', { href: `#/${r.id}`, class: `ax-nav-item ${r.id === rotaAtual ? 'ax-nav-item--ativo' : ''}`, 'aria-current': r.id === rotaAtual ? 'page' : undefined },
      icone(r.icone), h('span', {}, r.titulo))));
  limpar(conta, sessao.usuario
    ? [h('div', { class: 'ax-usuario' }, h('strong', {}, sessao.usuario.nome), h('small', {}, sessao.usuario.papelNome)),
      botao('Sair', { icone: 'sair', classe: 'ax-btn--fantasma ax-btn--pequeno', onClick: async () => { await sair(); avisar('Sessão encerrada.'); navegar('inicio'); } })]
    : sessao.servidor ? botao('Entrar', { icone: 'entrar', classe: 'ax-btn--fantasma', onClick: () => navegar('entrar') }) : null);
}

function desenharRede() {
  const offline = !navigator.onLine;
  const sw = navigator.serviceWorker?.controller ? 'pronto para uso offline' : 'cache offline ainda não ativo';
  limpar(rede, icone('offline', 14), h('span', {}, offline ? 'Sem internet · atlas funcionando' : `Online · ${sw}`),
    sessao.modo === 'memoria' ? h('small', {}, 'Servidor em modo demonstração (memória)') : null);
}

export function navegar(rota) {
  if (location.hash === `#/${rota}`) rotear();
  else location.hash = `#/${rota}`;
}

function rotear() {
  const [id = 'inicio', ...resto] = location.hash.replace(/^#\/?/, '').split('/');
  const rota = ROTAS.find((r) => r.id === id) ?? ROTAS[0];
  const parametro = resto.length ? decodeURIComponent(resto.join('/')) : null;
  telaAtual?.sair?.();
  document.body.classList.remove('ax-menu-aberto');
  if (rota.palco) iniciarPalco().catch((erro) => avisar(`Não foi possível iniciar o 3D: ${erro.message}`, 'erro', 10000));
  let tela;
  try {
    tela = rota.tela({ parametro, navegar });
  } catch (erro) {
    console.error(erro);
    tela = { elemento: h('div', { class: 'ax-pagina' }, h('p', { class: 'ax-erro' }, `Erro ao abrir a tela: ${erro.message}`)) };
  }
  telaAtual = tela;
  titulo.textContent = rota.titulo;
  document.title = `${rota.titulo} · Animal X`;
  conteudo.className = `ax-conteudo ${rota.palco ? 'ax-conteudo--palco' : ''}`;
  limpar(conteudo, tela.elemento);
  desenharNav(rota.id);
  local.ultimaRota = rota.id;
  persistir();
}

// Telas que dependem da conta são redesenhadas quando a sessão chega ou muda.
const DEPENDEM_DA_SESSAO = new Set(['entrar', 'biblioteca', 'laboratorio', 'revisao', 'administracao', 'configuracoes', 'instituicao']);
ouvir((tipo) => {
  if (tipo === 'preferencias') aplicarTema();
  if (tipo === 'sessao') {
    const atual = location.hash.replace(/^#\/?/, '').split('/')[0] || 'inicio';
    if (DEPENDEM_DA_SESSAO.has(atual)) rotear();
    else desenharNav(atual);
    desenharRede();
  }
});
// Depois que um dispositivo WebGPU se perde, o three.js ainda pode rejeitar
// promessas internas do dispositivo antigo. O atlas já seguiu em WebGL 2.
window.addEventListener('unhandledrejection', (e) => {
  if (/Instance dropped|device (is )?lost|Device Lost/i.test(String(e.reason?.message ?? e.reason))) {
    e.preventDefault();
    console.warn('Erro do dispositivo WebGPU descartado:', e.reason?.message ?? e.reason);
  }
});
aoTrocarBackend((backend) => avisar(`A placa de vídeo não manteve o WebGPU; o atlas continua em ${backend}.`, 'info', 7000));
matchMedia('(prefers-color-scheme: light)').addEventListener('change', aplicarTema);
window.addEventListener('hashchange', rotear);
window.addEventListener('online', desenharRede);
window.addEventListener('offline', desenharRede);
document.addEventListener('ax:apresentar', () => abrirApresentacao());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.body.classList.remove('ax-menu-aberto');
});

aplicarTema();
desenharRede();
rotear();
carregarSessao();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(desenharRede).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', desenharRede);
}

// Gancho para os testes automatizados.
window.__ax = { palco, navegar, sessao };

import { ESTRUTURAS, SISTEMAS, UBERON, estrutura, nome } from '../catalogo.js';
import { APRESENTACAO, AVISO_TUTOR, CENAS_TUTOR, TOURS } from '../conteudo.js';
import { local, persistir, preferencias } from '../estado.js';
import { ficha } from '../ficha.js';
import { aplicarCena, iniciarPalco, montarPalco, palco } from '../palco.js';
import { botao, h, icone, limpar, selo } from '../ui.js';

const SELO_EQUIPE = () => selo('Texto da equipe · não revisado', 'aviso');

function fontesDoPasso(passo) {
  const ids = (passo.realcar ?? []).filter((id) => estrutura(id));
  if (!ids.length) return null;
  return h('details', { class: 'ax-fontes-passo' },
    h('summary', {}, `Definições do Uberon (${ids.length})`),
    ids.map((id) => {
      const e = estrutura(id);
      return h('p', {}, h('strong', {}, `${e.pt} — ${e.uberon.id}: `), e.uberon.definicao ?? 'Sem definição no Uberon.');
    }),
    h('p', { class: 'ax-nota' }, `Uberon ${UBERON.dataVersion}, CC BY 3.0.`));
}

export function telaTours({ parametro, navegar }) {
  const tour = TOURS.find((t) => t.id === parametro);
  if (!tour) {
    return { elemento: h('div', { class: 'ax-pagina' },
      h('p', { class: 'ax-intro' }, 'Tours guiados pelo cão esquemático. Cada passo destaca as estruturas e mostra a definição do Uberon.'),
      h('div', { class: 'ax-grade-cartoes' }, TOURS.map((t) => h('button', { type: 'button', class: 'ax-cartao ax-cartao--acao', onClick: () => navegar(`tours/${t.id}`) },
        h('h3', {}, t.titulo), h('p', {}, t.resumo), h('p', { class: 'ax-nota' }, `${t.passos.length} passos`))))) };
  }
  let i = 0;
  let timer = null;
  const palcoHost = h('div', { class: 'ax-palco-host' });
  const legenda = h('div', { class: 'ax-legenda-tour', 'aria-live': 'polite' });
  montarPalco(palcoHost);
  palcoHost.append(legenda);
  const parar = () => { clearInterval(timer); timer = null; };
  const ir = (n) => {
    i = Math.max(0, Math.min(tour.passos.length - 1, n));
    const p = tour.passos[i];
    aplicarCena({ vista: p.vista, isolar: p.isolar, opacidades: p.opacidades, realcar: p.realcar });
    limpar(legenda,
      h('p', { class: 'ax-sobretitulo' }, `${tour.titulo} · ${i + 1}/${tour.passos.length}`),
      h('h2', {}, p.titulo),
      h('p', {}, p.texto),
      h('div', { class: 'ax-legenda-selos' }, SELO_EQUIPE(), selo('Modelo esquemático', 'aviso')),
      fontesDoPasso(p),
      h('div', { class: 'ax-progresso' }, tour.passos.map((_, k) => h('i', { class: k <= i ? 'ax-feito' : '' }))),
      h('div', { class: 'ax-controles-tour' },
        botao('', { icone: 'anterior', titulo: 'Passo anterior', classe: 'ax-btn--icone', desativado: i === 0, onClick: () => { parar(); ir(i - 1); } }),
        botao(timer ? 'Pausar' : 'Reproduzir', { icone: timer ? 'pausar' : 'tours', onClick: () => {
          if (timer) parar();
          else timer = setInterval(() => (i < tour.passos.length - 1 ? ir(i + 1) : parar()), 7000);
          ir(i);
        } }),
        botao('', { icone: 'proximo', titulo: 'Próximo passo', classe: 'ax-btn--icone', desativado: i === tour.passos.length - 1, onClick: () => { parar(); ir(i + 1); } }),
        botao('Todos os tours', { classe: 'ax-btn--fantasma', onClick: () => navegar('tours') })));
  };
  const teclas = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { parar(); ir(i + 1); }
    if (e.key === 'ArrowLeft') { parar(); ir(i - 1); }
  };
  document.addEventListener('keydown', teclas);
  palco.pronto.then(() => ir(0));
  return { elemento: h('div', { class: 'ax-tela-3d ax-tela-3d--cheia' }, palcoHost), sair: () => { parar(); document.removeEventListener('keydown', teclas); } };
}

export function telaTutor({ parametro, navegar }) {
  let cena = CENAS_TUTOR.find((c) => c.id === parametro);
  if (!cena && parametro?.startsWith('estrutura:')) {
    const id = parametro.slice(10);
    if (estrutura(id)) cena = { id: parametro, titulo: estrutura(id).pt, estruturas: [id], contexto: [], vista: undefined, opacidades: {}, abertura: '' };
  }
  if (!cena) {
    return { elemento: h('div', { class: 'ax-pagina' },
      h('p', { class: 'ax-intro' }, 'Cenas prontas em linguagem simples para mostrar ao tutor, em tela cheia. Nada é guardado e nada é registrado como diagnóstico.'),
      h('div', { class: 'ax-faixa ax-faixa--info' }, icone('info', 16), h('span', {}, AVISO_TUTOR)),
      h('div', { class: 'ax-grade-cartoes' }, CENAS_TUTOR.map((c) => h('button', { type: 'button', class: 'ax-cartao ax-cartao--acao', onClick: () => navegar(`tutor/${c.id}`) },
        h('h3', {}, c.titulo), h('p', {}, c.abertura))))) };
  }
  const palcoHost = h('div', { class: 'ax-palco-host' });
  montarPalco(palcoHost);
  const texto = h('div', { class: 'ax-tutor-texto' },
    h('h1', {}, cena.titulo),
    cena.abertura ? h('p', { class: 'ax-tutor-abertura' }, cena.abertura) : null,
    cena.estruturas.map((id) => h('p', {}, h('strong', {}, `${estrutura(id).pt}: `), estrutura(id).tutor)),
    h('p', { class: 'ax-tutor-aviso' }, icone('info', 16), AVISO_TUTOR),
    h('p', { class: 'ax-nota' }, 'Textos da equipe, não revisados. Modelo esquemático.'));
  const raiz = h('div', { class: 'ax-tutor' }, palcoHost, texto,
    h('div', { class: 'ax-tutor-barra' },
      botao('Outras cenas', { icone: 'anterior', classe: 'ax-btn--fantasma', onClick: () => navegar('tutor') }),
      botao('Tela cheia', { icone: 'tela', onClick: () => (document.fullscreenElement ? document.exitFullscreen() : raiz.requestFullscreen?.()) })));
  palco.pronto.then(async () => {
    await aplicarCena({ vista: cena.vista, isolar: [...cena.estruturas, ...cena.contexto], opacidades: cena.opacidades, realcar: cena.estruturas }, { animar: false });
    palco.visualizador.focar(cena.estruturas);
    palco.visualizador.definirRotulos(false);
  });
  return { elemento: raiz };
}

export function telaAvaliacao() {
  const palcoHost = h('div', { class: 'ax-palco-host' });
  montarPalco(palcoHost);
  const painel = h('aside', { class: 'ax-painel ax-painel--direita' });
  const filtro = h('select', { 'aria-label': 'Sistema do quiz' }, h('option', { value: '' }, 'Todos os sistemas'), SISTEMAS.filter((s) => s.id !== 'tegumentar').map((s) => h('option', { value: s.id }, s.pt)));
  let pontos = 0;
  let total = 0;
  let atual = null;
  const sortear = (lista, n) => [...lista].sort(() => Math.random() - 0.5).slice(0, n);
  const pergunta = async () => {
    const candidatas = ESTRUTURAS.filter((e) => e.sistema !== 'tegumentar' && (!filtro.value || e.sistema === filtro.value));
    atual = sortear(candidatas, 1)[0];
    const opcoes = sortear([atual, ...sortear(ESTRUTURAS.filter((e) => e.id !== atual.id && e.sistema !== 'tegumentar'), 3)], 4);
    await aplicarCena({ isolar: [atual.id, ...ESTRUTURAS.filter((e) => e.sistema === 'esqueletico').map((e) => e.id)], opacidades: { esqueletico: atual.sistema === 'esqueletico' ? 0.18 : 0.15 }, realcar: [atual.id] });
    palco.visualizador.definirRotulos(false);
    palco.visualizador.focar(atual.id);
    limpar(painel,
      h('h2', {}, 'Qual é a estrutura em destaque?'),
      h('div', { class: 'ax-filtros' }, filtro),
      h('div', { class: 'ax-opcoes' }, opcoes.map((op) => botao(nome(op.id, preferencias.idiomaTermos), { onClick: (e) => responder(op, e.currentTarget) }))),
      h('p', { class: 'ax-placar' }, `Acertos: ${pontos}/${total} · recorde: ${local.recordeQuiz}`),
      h('p', { class: 'ax-nota' }, 'Perguntas geradas do catálogo. Ainda não revisadas por professor.'));
  };
  const responder = (op, el) => {
    total += 1;
    const certo = op.id === atual.id;
    if (certo) pontos += 1;
    if (pontos > local.recordeQuiz) { local.recordeQuiz = pontos; persistir(); }
    painel.querySelectorAll('.ax-opcoes button').forEach((b) => { b.disabled = true; });
    el.classList.add(certo ? 'ax-btn--certo' : 'ax-btn--errado');
    painel.append(
      h('p', { class: certo ? 'ax-resultado ax-resultado--certo' : 'ax-resultado ax-resultado--errado' }, certo ? 'Certo!' : `Era: ${nome(atual.id, preferencias.idiomaTermos)}`),
      ficha(atual.id, { compacta: true }),
      botao('Próxima pergunta', { icone: 'proximo', classe: 'ax-btn--primario', onClick: pergunta }));
  };
  filtro.addEventListener('change', pergunta);
  palco.pronto.then(pergunta);
  return { elemento: h('div', { class: 'ax-tela-3d ax-tela-3d--ferramentas' }, palcoHost, painel) };
}

// Modo apresentação: sobreposição de palco com o roteiro de 7 passos.
export function abrirApresentacao() {
  let i = 0;
  let giro = null;
  const palcoHost = h('div', { class: 'ax-palco-host' });
  const legenda = h('div', { class: 'ax-apresentacao-legenda', 'aria-live': 'polite' });
  const estadoRede = h('span', { class: 'ax-rede' });
  const raiz = h('div', { class: 'ax-apresentacao', role: 'dialog', 'aria-label': 'Modo apresentação' }, palcoHost, legenda,
    h('div', { class: 'ax-apresentacao-barra' },
      estadoRede,
      h('span', { class: 'ax-nota' }, '← → avança · F tela cheia · Esc sai')));
  document.body.append(raiz);
  const pronto = iniciarPalco();
  montarPalco(palcoHost);
  const anterior = document.querySelector('.ax-palco-host:not(.ax-apresentacao .ax-palco-host)');
  const atualizarRede = () => {
    estadoRede.replaceChildren(icone('offline', 14), document.createTextNode(navigator.onLine ? ' Online' : ' Sem internet: funcionando'));
  };
  atualizarRede();
  const girar = (ativo) => {
    clearInterval(giro);
    giro = null;
    if (!ativo || preferencias.reduzirMovimento) return;
    giro = setInterval(() => {
      const v = palco.visualizador;
      if (v.voo) return;
      const alvo = v.controles.target;
      const p = v.camera.position.clone().sub(alvo);
      const a = 0.0035;
      v.camera.position.set(alvo.x + p.x * Math.cos(a) - p.z * Math.sin(a), v.camera.position.y, alvo.z + p.x * Math.sin(a) + p.z * Math.cos(a));
    }, 16);
  };
  const ir = async (n) => {
    i = Math.max(0, Math.min(APRESENTACAO.length - 1, n));
    const p = APRESENTACAO[i];
    girar(false);
    await aplicarCena(p.cena);
    if (p.cena.selecionar) palco.visualizador.selecionar(p.cena.selecionar);
    girar(p.girar);
    limpar(legenda,
      h('p', { class: 'ax-sobretitulo' }, `${i + 1} / ${APRESENTACAO.length}`),
      h('h1', {}, p.titulo),
      h('p', { class: 'ax-apresentacao-sub' }, p.subtitulo),
      h('p', {}, p.texto),
      p.ficha ? h('div', { class: 'ax-apresentacao-ficha' }, ficha(p.ficha, { compacta: true })) : null,
      p.aviso ? h('p', { class: 'ax-tutor-aviso' }, icone('info', 16), AVISO_TUTOR) : null,
      p.fases ? h('ol', { class: 'ax-fases' },
        h('li', {}, h('strong', {}, 'Hoje: '), 'atlas do cão esquemático, fonte em cada dado, tours, tutor, quiz, contas e papéis, offline.'),
        h('li', {}, h('strong', {}, 'Fase 2: '), 'gato, equino e bovino com fontes licenciadas; cortes de TC e RM; turmas.'),
        h('li', {}, h('strong', {}, 'Fase 3: '), 'corpo completo com o Acervo Aberto; peças reais; realidade virtual; estudo de validação.')) : null,
      h('div', { class: 'ax-progresso' }, APRESENTACAO.map((_, k) => h('i', { class: k <= i ? 'ax-feito' : '' }))));
  };
  const fechar = () => {
    girar(false);
    document.removeEventListener('keydown', teclas);
    window.removeEventListener('online', atualizarRede);
    window.removeEventListener('offline', atualizarRede);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    raiz.remove();
    if (anterior) montarPalco(anterior);
  };
  const teclas = (e) => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(i + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(i - 1); }
    else if (e.key === 'Escape') fechar();
    else if (e.key.toLowerCase() === 'f') (document.fullscreenElement ? document.exitFullscreen() : raiz.requestFullscreen?.())?.catch?.(() => {});
  };
  document.addEventListener('keydown', teclas);
  window.addEventListener('online', atualizarRede);
  window.addEventListener('offline', atualizarRede);
  raiz.append(botao('', { icone: 'fechar', titulo: 'Sair da apresentação', classe: 'ax-btn--icone ax-apresentacao-fechar', onClick: fechar }));
  pronto.then(() => ir(0)).catch(() => limpar(legenda, h('h1', {}, 'Animal X'), h('p', {}, 'Não foi possível iniciar o 3D neste navegador.')));
  return fechar;
}


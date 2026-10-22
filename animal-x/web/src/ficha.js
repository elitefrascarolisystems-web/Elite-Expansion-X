// Ficha da estrutura: cada dado aparece com a sua fonte.
import { UBERON, estrutura, fonte, regiao, sistema } from './catalogo.js';
import { alternarFavorito, local, sessao, statusRevisao } from './estado.js';
import { botao, dataHoraBr, h, selo } from './ui.js';

const ROTULO_STATUS = { nao_revisado: 'Não revisado', em_revisao: 'Em revisão', revisado: 'Revisado' };
const TIPO_STATUS = { nao_revisado: 'aviso', em_revisao: 'info', revisado: 'ok' };

export function seloRevisao(id) {
  const r = statusRevisao(id);
  return selo(ROTULO_STATUS[r.status] ?? r.status, TIPO_STATUS[r.status] ?? 'neutro');
}

function etiquetaFonte(idFonte) {
  const f = fonte(idFonte);
  const curto = { uberon: 'Uberon', 'animalx-traducao': 'Equipe · não revisado', 'animalx-esquematico': 'Esquemático · equipe' }[idFonte] ?? f?.titulo ?? idFonte;
  return h('span', { class: `ax-fonte ax-fonte--${idFonte === 'uberon' ? 'externa' : 'propria'}`, title: f?.credito ?? '' }, curto);
}

function linha(rotulo, valor, idFonte) {
  return h('div', { class: 'ax-ficha-linha' },
    h('dt', {}, rotulo, idFonte ? etiquetaFonte(idFonte) : null),
    h('dd', {}, valor));
}

export function ficha(id, { lado = null, acoes = {}, compacta = false } = {}) {
  const e = estrutura(id);
  if (!e) return h('p', { class: 'ax-vazio' }, 'Estrutura não encontrada.');
  const rev = statusRevisao(id);
  const favorita = local.favoritos.includes(id);
  const u = e.uberon;
  return h('article', { class: 'ax-ficha', 'aria-label': `Ficha: ${e.pt}` },
    h('header', {},
      h('p', { class: 'ax-sobretitulo' }, sistema(e.sistema)?.pt ?? e.sistema, ' · ', regiao(e.regiao)?.pt ?? e.regiao, lado ? ` · lado ${lado}` : ''),
      h('h2', {}, e.pt),
      h('p', { class: 'ax-latim' }, e.latim.termo),
      h('div', { class: 'ax-ficha-selos' }, seloRevisao(id), selo('Geometria esquemática', 'aviso'), selo(u.id, 'neutro'))),
    h('dl', {},
      linha('Português', e.pt, e.fontes.pt),
      linha('Latim', h('span', {}, e.latim.termo, h('small', { class: 'ax-nota' }, e.latim.nota),
        e.latim.outrosNoUberon.length ? h('small', { class: 'ax-nota' }, `Outros termos latinos no Uberon: ${e.latim.outrosNoUberon.join('; ')}`) : null), e.fontes.latim),
      linha('Inglês', e.en, 'uberon'),
      compacta ? null : linha('Descrição', e.resumo, e.fontes.resumo),
      u.definicao ? linha('Definição (inglês)', h('span', {}, `“${u.definicao}”`, h('small', { class: 'ax-nota' }, `Referências do Uberon: ${u.refsDefinicao.join(', ') || '—'}`)), 'uberon') : null,
      compacta || !u.isA.length ? null : linha('É um(a)', u.isA.map((x) => x.nome).join(' · '), 'uberon'),
      compacta || !u.partOf.length ? null : linha('Parte de', u.partOf.map((x) => x.nome).join(' · '), 'uberon'),
      compacta ? null : linha('Geometria', 'Forma gerada pela equipe a partir de proporções aproximadas. Não usar como referência de medida.', 'animalx-esquematico'),
      rev.status !== 'nao_revisado' ? linha('Revisão', h('span', {}, `${ROTULO_STATUS[rev.status]} por ${rev.revisorNome ?? '—'} em ${dataHoraBr(rev.atualizadoEm)}`, rev.nota ? h('small', { class: 'ax-nota' }, rev.nota) : null)) : null),
    h('footer', { class: 'ax-ficha-acoes' },
      acoes.focar ? botao('Focar', { icone: 'foco', onClick: acoes.focar }) : null,
      acoes.isolar ? botao('Isolar', { icone: 'isolar', onClick: acoes.isolar }) : null,
      acoes.ocultar ? botao('Ocultar', { icone: 'olhoFechado', onClick: acoes.ocultar }) : null,
      acoes.tutor ? botao('Explicar ao tutor', { icone: 'tutor', onClick: acoes.tutor }) : null,
      botao(favorita ? 'Favorita' : 'Favoritar', {
        icone: 'estrela',
        classe: favorita ? 'ax-btn--ativo' : '',
        pressionado: favorita,
        onClick: (ev) => {
          const agora = alternarFavorito(id);
          ev.currentTarget.classList.toggle('ax-btn--ativo', agora);
          ev.currentTarget.setAttribute('aria-pressed', String(agora));
          ev.currentTarget.querySelector('span').textContent = agora ? 'Favorita' : 'Favoritar';
        },
      })),
    compacta ? null : h('p', { class: 'ax-rodape-fonte' }, `Uberon ${UBERON.dataVersion} · SHA-256 ${UBERON.sha256.slice(0, 16)}… · CC BY 3.0`),
    sessao.usuario?.papel === 'revisor' ? h('p', { class: 'ax-nota' }, 'Você é revisor: altere o status em Revisão profissional.') : null);
}

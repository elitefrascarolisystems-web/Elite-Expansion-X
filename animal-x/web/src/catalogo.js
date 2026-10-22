// Catálogo de estruturas, fontes e textos, embutido no pacote (funciona offline).
import dados from '../../content/estruturas.json';
import fontes from '../../content/fontes.json';

export const UBERON = dados.uberon;
export const SISTEMAS = dados.sistemas;
export const REGIOES = dados.regioes;
export const ESTRUTURAS = dados.estruturas;
export const COMPARADA = dados.comparada;
export const FONTES = fontes;

const porId = new Map(ESTRUTURAS.map((e) => [e.id, e]));
const fontePorId = new Map([...fontes.emUso, ...fontes.planejadas].map((f) => [f.id, f]));

export const estrutura = (id) => porId.get(id) ?? null;
export const fonte = (id) => fontePorId.get(id) ?? null;
export const sistema = (id) => SISTEMAS.find((s) => s.id === id) ?? null;
export const regiao = (id) => REGIOES.find((r) => r.id === id) ?? null;

export function nome(id, idioma = 'pt') {
  const e = porId.get(id);
  if (!e) return id;
  if (idioma === 'la') return e.latim.termo;
  if (idioma === 'en') return e.en;
  return e.pt;
}

export function nomeComLado(id, lado, idioma = 'pt') {
  const base = nome(id, idioma);
  if (!lado) return base;
  const sufixo = { pt: { esquerdo: 'esquerdo', direito: 'direito' }, la: { esquerdo: 'sinister', direito: 'dexter' }, en: { esquerdo: 'left', direito: 'right' } }[idioma] ?? {};
  return `${base} (${sufixo[lado] ?? lado})`;
}

const sem = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Busca por português, latim, inglês, sinônimos e ID do Uberon.
export function buscar(consulta) {
  const q = sem(consulta.trim());
  if (!q) return ESTRUTURAS;
  return ESTRUTURAS.filter((e) => [e.pt, e.en, e.latim.termo, e.uberon.id, ...e.uberon.sinonimosExatos, ...e.latim.outrosNoUberon]
    .some((t) => sem(String(t)).includes(q)));
}

// Encontra estruturas citadas num texto livre (usado pelo X AI).
export function citadas(texto) {
  const t = ` ${sem(texto)} `;
  const achadas = [];
  for (const e of ESTRUTURAS) {
    const termos = [e.pt.replace(/\s*\(.*\)/, ''), e.en, e.latim.termo, ...e.uberon.sinonimosExatos]
      .map((x) => sem(x)).filter((x) => x.length >= 3);
    const singulares = termos.map((x) => x.replace(/s$/, ''));
    if ([...termos, ...singulares].some((x) => new RegExp(`[^a-z]${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z]`).test(t))) achadas.push(e);
  }
  return achadas;
}

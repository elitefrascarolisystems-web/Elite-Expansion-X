// Palco 3D único, compartilhado pelas telas: o mesmo visualizador é movido
// para a tela ativa, sem recriar a cena.
import { nomeComLado } from './catalogo.js';
import { preferencias } from './estado.js';
import { h } from './ui.js';
import { Visualizador } from './viewer/visualizador.js';

const ouvintesSelecao = new Set();
const ouvintesMedida = new Set();
const ouvintesBackend = new Set();
let dica;

export const palco = {
  elemento: h('div', { class: 'ax-palco' }),
  visualizador: null,
  pronto: null,
  erro: null,
};

export function iniciarPalco() {
  if (palco.pronto) return palco.pronto;
  dica = h('div', { class: 'ax-dica', hidden: true });
  palco.elemento.append(dica);
  palco.visualizador = new Visualizador(palco.elemento, {
    rotuloDe: (estrutura, lado) => nomeComLado(estrutura, lado, preferencias.idiomaTermos),
    aoSelecionar: (info) => ouvintesSelecao.forEach((f) => f(info)),
    aoMedir: (m) => ouvintesMedida.forEach((f) => f(m)),
    aoTrocarBackend: (backend, motivo) => ouvintesBackend.forEach((f) => f(backend, motivo)),
    aoPassar: (info) => {
      if (!info) {
        dica.hidden = true;
        return;
      }
      const r = palco.elemento.getBoundingClientRect();
      dica.textContent = nomeComLado(info.estrutura, info.lado, preferencias.idiomaTermos);
      dica.style.transform = `translate(${info.x - r.left + 14}px, ${info.y - r.top + 14}px)`;
      dica.hidden = false;
    },
  });
  palco.visualizador.reduzirMovimento = preferencias.reduzirMovimento;
  palco.pronto = palco.visualizador
    .iniciar({ qualidade: preferencias.qualidade, forcarWebGL: preferencias.forcarWebGL, tema: temaDoPalco() })
    .then((v) => {
      window.__axPronto = true;
      return v;
    })
    .catch((erro) => {
      palco.erro = erro;
      throw erro;
    });
  return palco.pronto;
}

export function temaDoPalco() {
  if (preferencias.tema === 'claro') return 'claro';
  if (preferencias.tema === 'auto') return matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro';
  return 'escuro';
}

export function montarPalco(alvo) {
  alvo.append(palco.elemento);
  palco.visualizador?.redimensionar?.();
}

export function aoSelecionar(f) {
  ouvintesSelecao.add(f);
  return () => ouvintesSelecao.delete(f);
}

export function aoMedir(f) {
  ouvintesMedida.add(f);
  return () => ouvintesMedida.delete(f);
}

export function aoTrocarBackend(f) {
  ouvintesBackend.add(f);
  return () => ouvintesBackend.delete(f);
}

// Aplica uma cena descrita por dados: vista, isolar (estruturas ou
// sistemas), opacidades, realce e seleção.
export async function aplicarCena(cena = {}, { animar = true } = {}) {
  // Inicia o palco se ainda não existir (por exemplo, vindo da tela inicial).
  await iniciarPalco();
  const v = palco.visualizador;
  v.registrar();
  for (const m of v.malhas.values()) m.visible = true;
  if (cena.isolar?.length) {
    const lista = new Set(cena.isolar);
    for (const m of v.malhas.values()) m.visible = lista.has(m.userData.estrutura) || lista.has(m.userData.sistema) || lista.has(m.userData.chave);
  } else if (!cena.mostrarTudo && cena.ocultarPele !== false) {
    for (const m of v.malhas.values()) if (m.userData.sistema === 'tegumentar') m.visible = Boolean(cena.mostrarPele);
  }
  v.opacidades = { ...(cena.opacidades ?? {}) };
  v.aplicarOpacidades();
  for (const tipo of Object.keys(v.cortes)) v.definirCorte(tipo, null);
  v.realcar(cena.realcar ?? []);
  v.selecionar(cena.selecionar ?? null);
  if (cena.vista) v.irPara(cena.vista, animar ? 1100 : 0);
}

// Materiais por nível de qualidade.
//   leve: material padrão, sem verniz nem dispersão (celular).
//   balanceado: material físico com verniz (aspecto úmido) e brilho.
//   alto: dispersão subsuperficial em músculos e órgãos, sheen no osso.

import * as THREE from 'three/webgpu';
import { abs, color, dot, float, normalView, positionViewDirection, pow } from 'three/tsl';

export const CORES = {
  esqueletico: '#e6d8bd',
  dente: '#f3ede0',
  muscular: '#a3362d',
  nervoso: '#e6c06a',
  cardiovascular: '#b02c2c',
  respiratorio: '#de968f',
  digestorio: '#c97a52',
  linfatico: '#7b3a5a',
  urinario: '#9b4a3c',
  pele: '#5fd4e6',
};

const UMIDOS = new Set(['muscular', 'cardiovascular', 'respiratorio', 'digestorio', 'linfatico', 'urinario', 'nervoso']);

function pele(qualidade) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide });
  // Contorno tipo holograma: mais opaco nas bordas (fresnel).
  const fresnel = float(1).sub(abs(dot(normalView, positionViewDirection))).clamp(0, 1);
  m.colorNode = color(CORES.pele);
  m.opacityNode = pow(fresnel, float(qualidade === 'leve' ? 2.2 : 2.6)).mul(0.82).add(0.025);
  return m;
}

export function criarMaterial(tipo, qualidade) {
  if (tipo === 'pele') return pele(qualidade);
  const cor = new THREE.Color(CORES[tipo] ?? '#cccccc');
  if (qualidade === 'leve') {
    return new THREE.MeshStandardNodeMaterial({ color: cor, roughness: tipo === 'esqueletico' ? 0.7 : 0.5, metalness: 0 });
  }
  const umido = UMIDOS.has(tipo);
  const parametros = {
    color: cor,
    roughness: tipo === 'esqueletico' ? 0.62 : tipo === 'dente' ? 0.28 : 0.44,
    metalness: 0,
    clearcoat: umido ? 0.8 : tipo === 'dente' ? 0.5 : 0.06,
    clearcoatRoughness: umido ? 0.2 : 0.4,
  };
  if (qualidade === 'alto' && umido) {
    const m = new THREE.MeshSSSNodeMaterial(parametros);
    // Luz atravessando o tecido, tingida de vermelho-alaranjado.
    m.thicknessColorNode = color(cor.clone().lerp(new THREE.Color('#ff6a4d'), 0.55));
    m.thicknessDistortionNode = float(0.12);
    m.thicknessAmbientNode = float(0.015);
    m.thicknessAttenuationNode = float(0.7);
    m.thicknessPowerNode = float(2.4);
    m.thicknessScaleNode = float(5.0);
    return m;
  }
  const m = new THREE.MeshPhysicalNodeMaterial(parametros);
  if (qualidade === 'alto' && tipo === 'esqueletico') {
    m.sheen = 0.35;
    m.sheenRoughness = 0.6;
    m.sheenColor = new THREE.Color('#fff4e0');
  }
  return m;
}

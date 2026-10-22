// Cão esquemático de demonstração, feito pela equipe Animal X.
//
// Formas geradas por código a partir de proporções aproximadas de um cão de
// porte médio (cerca de 55 cm de cernelha). Não é anatomia medida de um
// espécime real e não deve ser usado como referência de medida. Quando o kit
// licenciado (TC de Edinburgh, Pixelbeaker, Massey…) for baixado e conferido,
// estas peças são substituídas pelas malhas reais.
//
// Eixos: +X cranial, +Y dorsal, +Z lado esquerdo. Unidade: metro.

import * as THREE from 'three/webgpu';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { V, curva, elipsoide, espelharZ, mesclar, musculo, ossoLongo, placa, tubo } from './geometria.js';

export const ESPECIME = {
  id: 'cao-esquematico',
  especie: 'Canis familiaris',
  nome: 'Cão esquemático de demonstração',
  fonte: 'animalx-esquematico',
  porte: 'Médio (cerca de 55 cm de cernelha)',
  sexo: 'Não representado',
  aviso: 'Modelo esquemático feito pela equipe. Não é anatomia medida de um espécime real.',
};

// Centros dos corpos vertebrais.
const COLUNA = {
  cervical: [[0.315, 0.575], [0.292, 0.553], [0.268, 0.530], [0.246, 0.506], [0.227, 0.484], [0.210, 0.465], [0.194, 0.450]],
  toracica: Array.from({ length: 13 }, (_, i) => [0.176 - i * 0.0205, 0.442 + Math.sin((i / 12) * Math.PI * 0.9) * 0.022 + i * 0.0012]),
  lombar: Array.from({ length: 7 }, (_, i) => [-0.094 - i * 0.0265, 0.474 - i * 0.0012 + Math.sin((i / 6) * Math.PI) * 0.006]),
  sacro: [[-0.282, 0.465], [-0.302, 0.462], [-0.322, 0.458]],
};
const CAUDA = curva([V(-0.338, 0.455), V(-0.40, 0.442), V(-0.455, 0.40), V(-0.495, 0.335), V(-0.515, 0.255)]);

const ESPINHOSO_TORACICO = [0.085, 0.092, 0.089, 0.082, 0.074, 0.066, 0.058, 0.050, 0.044, 0.040, 0.036, 0.034, 0.033];

const LARGURA_COSTELA = [0.045, 0.058, 0.07, 0.08, 0.088, 0.094, 0.097, 0.098, 0.096, 0.092, 0.086, 0.079, 0.07];
const ALTURA_COSTELA = [0.15, 0.165, 0.178, 0.188, 0.193, 0.193, 0.19, 0.184, 0.176, 0.162, 0.146, 0.128, 0.105];
const ESTERNO = Array.from({ length: 9 }, (_, i) => [0.205 - i * 0.026, 0.292 - i * 0.0042]);

const MEMBRO_TORACICO = {
  ombro: V(0.214, 0.37, 0.083),
  cotovelo: V(0.128, 0.245, 0.078),
  olecrano: V(0.098, 0.272, 0.077),
  carpo: V(0.148, 0.068, 0.074),
  dedos: V(0.2, 0.008, 0.074),
};
const MEMBRO_PELVICO = {
  acetabulo: V(-0.335, 0.405, 0.058),
  joelho: V(-0.272, 0.243, 0.074),
  jarrete: V(-0.346, 0.098, 0.072),
  calcaneo: V(-0.373, 0.118, 0.07),
  dedos: V(-0.288, 0.008, 0.072),
};

function vertebra(centro, { rCorpo, comp, espinhoso = 0, inclinacao = 0, transverso = 0, angTransverso = -0.3, d }) {
  const [x, y] = centro;
  const partes = [];
  const corpo = new THREE.CylinderGeometry(rCorpo, rCorpo * 1.05, comp, Math.max(8, Math.round(14 * d)));
  corpo.rotateZ(Math.PI / 2);
  corpo.translate(x, y, 0);
  partes.push(corpo);
  // Arco vertebral (anel sobre o canal).
  const arco = new THREE.TorusGeometry(rCorpo * 0.85, rCorpo * 0.32, 6, Math.max(8, Math.round(12 * d)), Math.PI);
  arco.rotateY(Math.PI / 2);
  arco.translate(x, y + rCorpo * 0.95, 0);
  partes.push(arco);
  if (espinhoso > 0) {
    const topo = V(x - Math.sin(inclinacao) * espinhoso, y + rCorpo * 1.8 + Math.cos(inclinacao) * espinhoso, 0);
    partes.push(ossoLongo(V(x, y + rCorpo * 1.6, 0), topo, { rProx: rCorpo * 0.45, rDist: rCorpo * 0.35, rDiaf: rCorpo * 0.26, d: d * 0.6, achatar: 0.45 }));
  }
  if (transverso > 0) {
    for (const lado of [1, -1]) {
      const fim = V(x + Math.sin(angTransverso) * transverso * 0.3, y + Math.sin(angTransverso) * transverso * 0.5, lado * (rCorpo + transverso));
      partes.push(ossoLongo(V(x, y + rCorpo * 0.3, lado * rCorpo * 0.6), fim, { rProx: rCorpo * 0.35, rDist: rCorpo * 0.3, rDiaf: rCorpo * 0.22, d: d * 0.5, achatar: 0.5 }));
    }
  }
  return mesclar(partes);
}

function cranio(d) {
  const partes = [];
  // Caixa craniana com crista sagital discreta.
  partes.push(elipsoide(V(0.367, 0.607, 0), V(0.055, 0.042, 0.036), {
    d,
    deformar: (p, u) => {
      if (u.y > 0.6) p.y += 0.006 * Math.exp(-(u.z ** 2) / 0.01);
    },
  }));
  // Focinho (rostro) afinando até o plano nasal.
  partes.push(tubo(curva([V(0.395, 0.6, 0), V(0.45, 0.597, 0), V(0.5, 0.592, 0), V(0.534, 0.586, 0)]),
    (t) => 0.034 * (1 - t * 0.48), { d, segmentos: 20, radiais: 18, elipse: 0.82 }));
  partes.push(elipsoide(V(0.534, 0.586, 0), V(0.012, 0.0177, 0.0146), { d: d * 0.6 }));
  // Arcos zigomáticos.
  for (const z of [1, -1]) {
    partes.push(tubo(curva([V(0.338, 0.59, z * 0.03), V(0.37, 0.585, z * 0.05), V(0.41, 0.588, z * 0.046), V(0.43, 0.595, z * 0.03)]),
      0.0055, { d, segmentos: 16, radiais: 8 }));
  }
  return mesclar(partes);
}

function mandibula(d) {
  const partes = [];
  for (const z of [1, -1]) {
    partes.push(tubo(curva([V(0.392, 0.598, z * 0.04), V(0.388, 0.57, z * 0.042), V(0.43, 0.556, z * 0.034), V(0.49, 0.556, z * 0.022), V(0.532, 0.562, z * 0.008)]),
      (t) => 0.0085 - t * 0.003, { d, segmentos: 28, radiais: 10, elipse: 0.55 }));
  }
  partes.push(elipsoide(V(0.531, 0.562, 0), V(0.008, 0.007, 0.012), { d: d * 0.5 }));
  return mesclar(partes);
}

function dentes(d) {
  const partes = [];
  const arcada = (yBase, sentido, zFator) => {
    const pontos = [
      [0.538, 0.004, 0.0045, 'incisivo'], [0.536, 0.009, 0.0045, 'incisivo'], [0.533, 0.014, 0.0045, 'incisivo'],
      [0.523, 0.019, 0.012, 'canino'],
      [0.507, 0.022, 0.006, 'pre'], [0.492, 0.025, 0.007, 'pre'], [0.476, 0.029, 0.008, 'pre'], [0.457, 0.033, 0.011, 'pre'],
      [0.437, 0.036, 0.009, 'molar'], [0.421, 0.038, 0.007, 'molar'],
    ];
    for (const z of [1, -1]) {
      for (const [x, zz, alt, tipo] of pontos) {
        const r = tipo === 'canino' ? 0.0042 : tipo === 'incisivo' ? 0.0022 : 0.0035;
        const g = new THREE.ConeGeometry(r, alt, Math.max(6, Math.round(8 * d)));
        if (sentido < 0) g.rotateZ(Math.PI);
        g.translate(x, yBase + (sentido * alt) / 2, z * zz * zFator);
        partes.push(g);
      }
    }
  };
  arcada(0.574, -1, 1);
  arcada(0.562, 1, 0.92);
  return mesclar(partes);
}

function costela(i, lado, d) {
  const [xv, yv] = COLUNA.toracica[i];
  const w = LARGURA_COSTELA[i];
  const h = ALTURA_COSTELA[i];
  const dx = 0.02 + i * 0.0035;
  const pontos = [
    V(xv, yv + 0.004, lado * 0.012),
    V(xv - 0.006, yv - 0.006, lado * w * 0.72),
    V(xv - dx * 0.6, yv - h * 0.38, lado * w),
    V(xv - dx, yv - h * 0.72, lado * w * 0.86),
    V(xv - dx * 0.95, yv - h, lado * w * 0.5),
  ];
  const osso = tubo(curva(pontos), (t) => 0.0045 - t * 0.001, { d, segmentos: 30, radiais: 8, elipse: 0.55 });
  const partes = [osso];
  // Cartilagem costal até o esterno (costelas 1 a 9) ou até o arco costal.
  const fim = pontos[4];
  let alvo;
  if (i < 9) {
    const [xs, ys] = ESTERNO[Math.min(i, 8)];
    alvo = V(xs, ys, lado * 0.008);
  } else if (i < 12) {
    alvo = V(fim.x + 0.03, fim.y - 0.01, lado * w * 0.38);
  }
  if (alvo) {
    const meio = fim.clone().lerp(alvo, 0.5).add(V(-0.008, -0.01, 0));
    partes.push(tubo(curva([fim, meio, alvo]), 0.0032, { d, segmentos: 14, radiais: 6, elipse: 0.6 }));
  }
  return mesclar(partes);
}

function escapula(d) {
  // Contorno no plano da escápula: U ao longo do eixo dorsoventral, V cranial.
  const origem = V(0.214, 0.38, 0.078);
  const topo = V(0.128, 0.538, 0.052);
  const u = V(0, 0, 0).subVectors(topo, origem).normalize();
  const v = V(1, 0, 0).sub(u.clone().multiplyScalar(u.x)).normalize();
  const comp = origem.distanceTo(topo);
  const contorno = [];
  // Contorno oval alongado: colo estreito junto à glenoide, borda dorsal larga.
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const t = (1 - Math.cos(a)) / 2;
    const largura = 0.011 + 0.026 * Math.sin(Math.min(1, t * 1.25) * Math.PI / 2) ** 1.4;
    contorno.push([t * comp * 1.02, Math.sin(a) * largura + (Math.sin(a) > 0 ? 0.004 * t : 0)]);
  }
  const lamina = placa(contorno, { origem, u, v, espessura: 0.0025, d });
  // Espinha da escápula e cavidade glenoidal.
  const espinha = tubo(curva([origem.clone().add(u.clone().multiplyScalar(0.035)).add(V(0, 0, 0.006)), origem.clone().add(u.clone().multiplyScalar(comp * 0.6)).add(V(0, 0, 0.012)), topo.clone().add(V(0, 0, 0.006))]),
    (t) => 0.0035 + Math.sin(t * Math.PI) * 0.0035, { d, segmentos: 18, radiais: 8, elipse: 0.5 });
  const glenoide = elipsoide(origem.clone().add(u.clone().multiplyScalar(-0.006)), V(0.014, 0.012, 0.012), { d: d * 0.6 });
  return mesclar([lamina, espinha, glenoide]);
}

function ossoCoxal(d) {
  const ac = MEMBRO_PELVICO.acetabulo;
  const crista = V(-0.232, 0.495, 0.05);
  const partes = [];
  // Ílio: lâmina da crista ilíaca ao acetábulo.
  const u = V(0, 0, 0).subVectors(crista, ac).normalize();
  const v = V(0, 1, 0).sub(u.clone().multiplyScalar(u.y)).normalize();
  const comp = ac.distanceTo(crista);
  partes.push(placa([[0, -0.01], [comp * 0.5, -0.016], [comp, -0.03], [comp * 1.04, 0.0], [comp, 0.026], [comp * 0.45, 0.012], [0, 0.01]], { origem: ac, u, v, espessura: 0.004, d }));
  // Ísquio até a tuberosidade isquiática e púbis até a sínfise.
  partes.push(tubo(curva([ac, V(-0.37, 0.405, 0.05), V(-0.402, 0.412, 0.04)]), (t) => 0.007 + t * 0.003, { d, segmentos: 16, radiais: 8, elipse: 0.6 }));
  partes.push(tubo(curva([ac, V(-0.345, 0.38, 0.03), V(-0.352, 0.37, 0.004)]), 0.005, { d, segmentos: 12, radiais: 8, elipse: 0.6 }));
  partes.push(tubo(curva([V(-0.352, 0.37, 0.004), V(-0.38, 0.375, 0.02), V(-0.402, 0.405, 0.035)]), 0.004, { d, segmentos: 12, radiais: 8, elipse: 0.6 }));
  // Acetábulo em anel.
  const anel = new THREE.TorusGeometry(0.013, 0.004, 8, Math.max(10, Math.round(16 * d)));
  anel.translate(ac.x, ac.y, ac.z + 0.004);
  partes.push(anel);
  return mesclar(partes);
}

function dedos(inicio, fim, { r, d, garras = true }) {
  const partes = [];
  const desvios = [-0.012, -0.004, 0.004, 0.012];
  for (const dz of desvios) {
    const a = inicio.clone().add(V(0, 0, dz * 0.7));
    const meio = inicio.clone().lerp(fim, 0.55).add(V(0, 0.004, dz));
    const b = fim.clone().add(V(-Math.abs(dz) * 0.4, 0, dz * 1.1));
    partes.push(ossoLongo(a, meio, { rProx: r * 1.2, rDist: r, rDiaf: r * 0.7, d: d * 0.5 }));
    partes.push(ossoLongo(meio, b, { rProx: r, rDist: r * 0.9, rDiaf: r * 0.65, d: d * 0.5 }));
    if (garras) {
      const g = new THREE.ConeGeometry(r * 0.8, r * 3.2, 6);
      orientar0(g, b, b.clone().add(V(0.012, -0.006, 0)));
      partes.push(g);
    }
  }
  return mesclar(partes);
}

function orientar0(geo, a, b) {
  geo.translate(0, geo.parameters?.height ? geo.parameters.height / 2 : 0, 0);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  geo.translate(a.x, a.y, a.z);
}

function metas(inicio, fim, { r, d }) {
  const partes = [];
  for (const dz of [-0.011, -0.0037, 0.0037, 0.011]) {
    partes.push(ossoLongo(inicio.clone().add(V(0, 0, dz * 0.6)), fim.clone().add(V(0, 0, dz)), { rProx: r * 1.25, rDist: r * 1.15, rDiaf: r * 0.75, d: d * 0.6 }));
  }
  return mesclar(partes);
}

// Campo de distância com união suave de cápsulas para a silhueta.
function silhueta(d) {
  const resolucao = d < 0.8 ? 56 : d < 1.3 ? 76 : 96;
  const capsulas = [];
  const cap = (a, b, ra, rb, ez = 1) => capsulas.push({ a, b, ra, rb, ez });
  cap(V(0.37, 0.606, 0), V(0.39, 0.6, 0), 0.06, 0.055, 0.8);
  cap(V(0.4, 0.598, 0), V(0.55, 0.582, 0), 0.044, 0.026, 0.95);
  cap(V(0.39, 0.565, 0), V(0.53, 0.558, 0), 0.03, 0.018, 1.2);
  cap(V(0.335, 0.575, 0), V(0.2, 0.455, 0), 0.055, 0.078, 0.85);
  cap(V(0.175, 0.395, 0), V(-0.06, 0.4, 0), 0.142, 0.135, 0.72);
  cap(V(-0.06, 0.41, 0), V(-0.27, 0.44, 0), 0.118, 0.085, 0.82);
  cap(V(-0.255, 0.45, 0), V(-0.37, 0.435, 0), 0.085, 0.07, 0.95);
  const pontosCauda = CAUDA.getSpacedPoints(6);
  for (let i = 0; i < pontosCauda.length - 1; i++) cap(pontosCauda[i], pontosCauda[i + 1], 0.028 - i * 0.003, 0.025 - i * 0.003);
  for (const z of [1, -1]) {
    const mt = MEMBRO_TORACICO;
    const mp = MEMBRO_PELVICO;
    const zz = (p) => V(p.x, p.y, p.z * z);
    cap(V(0.16, 0.47, 0.055 * z), zz(mt.ombro), 0.05, 0.048);
    cap(zz(mt.ombro), zz(mt.cotovelo), 0.046, 0.036);
    cap(zz(mt.cotovelo), zz(mt.carpo), 0.03, 0.019);
    cap(zz(mt.carpo), V(0.17, 0.018, mt.carpo.z * z), 0.019, 0.019);
    cap(V(0.17, 0.018, mt.carpo.z * z), zz(mt.dedos), 0.02, 0.018, 1.2);
    cap(V(-0.29, 0.43, 0.06 * z), zz(mp.joelho), 0.075, 0.045);
    cap(zz(mp.joelho), zz(mp.jarrete), 0.04, 0.019);
    cap(zz(mp.calcaneo), V(-0.33, 0.02, mp.jarrete.z * z), 0.016, 0.017);
    cap(V(-0.33, 0.02, mp.jarrete.z * z), zz(mp.dedos), 0.02, 0.018, 1.2);
  }
  const k = 0.03;
  const min = V(-0.6, -0.012, -0.17);
  const max = V(0.62, 0.72, 0.17);
  const mc = new MarchingCubes(resolucao, new THREE.MeshBasicMaterial(), false, false, 300_000);
  const tam = mc.size;
  const campo = mc.field;
  const p = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ap = new THREE.Vector3();
  for (let z = 0; z < tam; z++) {
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        // Mesmo mapeamento do MarchingCubes: índice i -> -1 + 2i/tam no espaço local.
        p.set(
          min.x + ((x / tam) * (max.x - min.x)),
          min.y + ((y / tam) * (max.y - min.y)),
          min.z + ((z / tam) * (max.z - min.z)),
        );
        let dist = Infinity;
        for (const c of capsulas) {
          const pz = p.z / c.ez;
          ab.subVectors(c.b, c.a);
          ap.set(p.x - c.a.x, p.y - c.a.y, pz - c.a.z / c.ez);
          const t = Math.min(1, Math.max(0, ap.dot(ab) / ab.lengthSq()));
          const r = c.ra + (c.rb - c.ra) * t;
          const dx = ap.x - ab.x * t;
          const dy = ap.y - ab.y * t;
          const dz = ap.z - (ab.z / c.ez) * t;
          const dc = Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
          // União suave (smooth minimum polinomial).
          const h = Math.max(k - Math.abs(dist - dc), 0) / k;
          dist = Math.min(dist, dc) - h * h * k * 0.25;
        }
        campo[x + y * tam + z * tam * tam] = mc.isolation - dist * 900;
      }
    }
  }
  mc.update();
  const n = mc.count;
  const pos = mc.positionArray.slice(0, n * 3);
  const nor = mc.normalArray.slice(0, n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  // Do espaço local [-1, 1] para o mundo.
  const centro = min.clone().add(max).multiplyScalar(0.5);
  const meia = max.clone().sub(min).multiplyScalar(0.5);
  // Normais do gradiente do campo (suaves); a escala não uniforme exige a
  // inversa transposta, que aqui é dividir por cada fator de escala.
  for (let i = 0; i < n; i++) {
    const nx = nor[i * 3] / meia.x;
    const ny = nor[i * 3 + 1] / meia.y;
    const nz = nor[i * 3 + 2] / meia.z;
    const len = Math.hypot(nx, ny, nz) || 1;
    nor[i * 3] = nx / len;
    nor[i * 3 + 1] = ny / len;
    nor[i * 3 + 2] = nz / len;
  }
  const posAttr = geo.attributes.position;
  for (let i = 0; i < n; i++) {
    posAttr.setXYZ(i, pos[i * 3] * meia.x + centro.x, pos[i * 3 + 1] * meia.y + centro.y, pos[i * 3 + 2] * meia.z + centro.z);
  }
  geo.computeBoundingSphere();
  mc.geometry.dispose();
  return geo;
}

// Gera as partes do espécime. d controla o nível de detalhe.
export function gerarCao(d = 1) {
  const partes = [];
  const add = (estrutura, sistema, geometria, { lado = null, material = sistema } = {}) => {
    partes.push({ chave: lado ? `${estrutura}:${lado}` : estrutura, estrutura, lado, sistema, material, geometria });
  };
  const bilateral = (estrutura, sistema, geoEsquerda, opcoes = {}) => {
    add(estrutura, sistema, geoEsquerda, { ...opcoes, lado: 'esquerdo' });
    add(estrutura, sistema, espelharZ(geoEsquerda), { ...opcoes, lado: 'direito' });
  };

  // Esqueleto axial.
  add('cranio', 'esqueletico', cranio(d));
  add('mandibula', 'esqueletico', mandibula(d));
  add('dentes', 'digestorio', dentes(d), { material: 'dente' });
  add('vertebra_cervical', 'esqueletico', mesclar(COLUNA.cervical.map((c, i) => vertebra(c, {
    rCorpo: 0.0105, comp: i === 0 ? 0.014 : 0.02, espinhoso: i === 1 ? 0.02 : i === 6 ? 0.03 : 0.008,
    inclinacao: -0.2, transverso: i === 0 ? 0.03 : 0.014, d,
  }))));
  add('vertebra_toracica', 'esqueletico', mesclar(COLUNA.toracica.map((c, i) => vertebra(c, {
    rCorpo: 0.0098, comp: 0.016, espinhoso: ESPINHOSO_TORACICO[i], inclinacao: i < 10 ? 0.45 - i * 0.04 : -0.1, transverso: 0.008, d,
  }))));
  add('vertebra_lombar', 'esqueletico', mesclar(COLUNA.lombar.map((c) => vertebra(c, {
    rCorpo: 0.0125, comp: 0.022, espinhoso: 0.032, inclinacao: -0.3, transverso: 0.03, angTransverso: 0.3, d,
  }))));
  add('sacro', 'esqueletico', mesclar([
    ...COLUNA.sacro.map((c) => vertebra(c, { rCorpo: 0.011, comp: 0.02, espinhoso: 0.012, transverso: 0.022, d })),
  ]));
  const pontosCauda = CAUDA.getSpacedPoints(20);
  add('vertebra_caudal', 'esqueletico', mesclar(pontosCauda.slice(0, 20).map((p, i) => {
    const r = 0.0085 - i * 0.00028;
    const g = elipsoide(p, V(0.0085 - i * 0.0001, r, r), { d: d * 0.4 });
    return g;
  })));
  const costelasE = [];
  for (let i = 0; i < 13; i++) costelasE.push(costela(i, 1, d));
  bilateral('costela', 'esqueletico', mesclar(costelasE));
  add('esterno', 'esqueletico', mesclar(ESTERNO.map(([x, y], i) => elipsoide(V(x, y, 0), V(i === 8 ? 0.016 : 0.011, 0.007, 0.0085), { d: d * 0.5 }))));

  // Membro torácico (lado esquerdo; o direito é espelhado).
  const mt = MEMBRO_TORACICO;
  bilateral('escapula', 'esqueletico', escapula(d));
  bilateral('umero', 'esqueletico', ossoLongo(mt.ombro, mt.cotovelo, { rProx: 0.018, rDist: 0.015, rDiaf: 0.0085, d }));
  bilateral('radio', 'esqueletico', ossoLongo(V(0.133, 0.24, 0.08), mt.carpo.clone().add(V(0.003, 0.004, 0.003)), { rProx: 0.0085, rDist: 0.011, rDiaf: 0.0062, d, achatar: 0.8 }));
  bilateral('ulna', 'esqueletico', ossoLongo(mt.olecrano, mt.carpo.clone().add(V(-0.006, 0.008, -0.004)), { rProx: 0.0095, rDist: 0.005, rDiaf: 0.0052, d, achatar: 0.7 }));
  bilateral('carpo', 'esqueletico', elipsoide(mt.carpo.clone().add(V(0.002, -0.006, 0)), V(0.011, 0.01, 0.014), { d: d * 0.6 }));
  bilateral('metacarpo', 'esqueletico', metas(V(0.152, 0.052, mt.carpo.z), V(0.172, 0.02, mt.carpo.z), { r: 0.0042, d }));
  bilateral('falanges_mao', 'esqueletico', dedos(V(0.173, 0.018, mt.carpo.z), mt.dedos, { r: 0.0035, d }));

  // Membro pélvico.
  const mp = MEMBRO_PELVICO;
  bilateral('osso_coxal', 'esqueletico', ossoCoxal(d));
  bilateral('femur', 'esqueletico', mesclar([
    ossoLongo(mp.acetabulo.clone().add(V(0, 0, 0.006)), mp.joelho, { rProx: 0.0145, rDist: 0.016, rDiaf: 0.0085, d }),
    elipsoide(V(-0.325, 0.418, 0.078), V(0.009, 0.012, 0.007), { d: d * 0.5 }),
  ]));
  bilateral('patela', 'esqueletico', elipsoide(mp.joelho.clone().add(V(0.017, 0.012, 0.002)), V(0.006, 0.009, 0.0055), { d: d * 0.5 }));
  bilateral('tibia', 'esqueletico', ossoLongo(mp.joelho.clone().add(V(0, -0.004, 0)), mp.jarrete, { rProx: 0.016, rDist: 0.011, rDiaf: 0.0075, d }));
  bilateral('fibula', 'esqueletico', ossoLongo(mp.joelho.clone().add(V(-0.01, -0.01, 0.01)), mp.jarrete.clone().add(V(-0.004, 0.006, 0.008)), { rProx: 0.0045, rDist: 0.004, rDiaf: 0.0024, d: d * 0.7 }));
  bilateral('tarso', 'esqueletico', mesclar([
    elipsoide(mp.jarrete.clone().add(V(0.002, -0.014, 0)), V(0.012, 0.014, 0.013), { d: d * 0.6 }),
    ossoLongo(mp.jarrete.clone().add(V(-0.004, -0.01, 0)), mp.calcaneo, { rProx: 0.007, rDist: 0.0075, rDiaf: 0.0055, d: d * 0.6 }),
  ]));
  bilateral('metatarso', 'esqueletico', metas(V(-0.344, 0.074, mp.jarrete.z), V(-0.327, 0.02, mp.jarrete.z), { r: 0.0042, d }));
  bilateral('falanges_pe', 'esqueletico', dedos(V(-0.326, 0.018, mp.jarrete.z), mp.dedos, { r: 0.0035, d }));

  // Sistema nervoso.
  add('encefalo', 'nervoso', elipsoide(V(0.365, 0.608, 0), V(0.044, 0.03, 0.03), {
    d: d * 1.3,
    deformar: (p, u) => {
      const giros = 1 + 0.035 * Math.sin(u.x * 22 + Math.sin(u.y * 9) * 2) * Math.sin(u.y * 18 + u.z * 6);
      p.multiplyScalar(giros);
      p.z *= 1 - 0.18 * Math.exp(-(u.z ** 2) / 0.004) * Math.max(0, u.y);
      if (u.x < -0.55) p.y -= 0.006 * (-(u.x) - 0.55);
    },
  }));
  const canal = [...COLUNA.cervical, ...COLUNA.toracica, ...COLUNA.lombar.slice(0, 6)].map(([x, y]) => V(x, y + 0.0105, 0));
  add('medula_espinhal', 'nervoso', tubo(curva(canal), 0.0042, { d, segmentos: 120, radiais: 10 }));

  // Coração e aorta.
  const base = V(0.118, 0.372, 0.008);
  const apice = V(0.062, 0.284, 0.014);
  const eixo = V(0, 0, 0).subVectors(apice, base);
  add('coracao', 'cardiovascular', elipsoide(base.clone().lerp(apice, 0.5), V(0.036, 0.052, 0.034), {
    d,
    rotacao: [0, 0, Math.atan2(eixo.x, -eixo.y)],
    deformar: (p, u) => {
      // Afina em direção ao ápice e marca o sulco entre os ventrículos.
      const k = (1 - u.y) / 2;
      p.x *= 1 - 0.38 * k ** 1.4;
      p.z *= 1 - 0.38 * k ** 1.4;
      p.x *= 1 - 0.06 * Math.exp(-((u.z - 0.25) ** 2) / 0.01);
    },
  }));
  add('aorta', 'cardiovascular', tubo(curva([V(0.112, 0.37, 0.004), V(0.118, 0.405, 0.004), V(0.095, 0.428, 0.004), V(0.06, 0.432, 0.002), V(0.0, 0.438, 0), V(-0.09, 0.448, 0)]),
    (t) => 0.0078 - t * 0.0016, { d, segmentos: 60, radiais: 12 }));

  // Respiratório.
  add('traqueia', 'respiratorio', tubo(curva([V(0.338, 0.535, 0), V(0.29, 0.51, 0), V(0.23, 0.465, 0), V(0.175, 0.42, 0), V(0.125, 0.392, 0)]),
    0.0078, { d, segmentos: 70, radiais: 12, onda: { amplitude: 0.09, frequencia: 34 } }));
  const pulmao = (lado) => {
    const c = V(0.058, 0.382, lado * 0.044);
    return elipsoide(c, V(0.105, 0.072, 0.042), {
      d,
      deformar: (p, u) => {
        // Face medial achatada.
        if (u.z * lado < -0.2) p.z *= 0.6;
        // Base caudal inclinada, acompanhando o diafragma (mais caudal no dorso).
        const wx = p.x + c.x;
        const wy = p.y + c.y;
        const limite = -0.075 + 0.62 * (0.44 - wy);
        if (wx < limite) p.x = limite - c.x + (wx - limite) * 0.15;
        // Ápice cranial mais alto e afilado.
        if (u.x > 0.4) p.y += (u.x - 0.4) * 0.03;
        // Impressão do coração na face medial.
        const cor = Math.exp(-(((wx - 0.09) ** 2) / 0.0018 + ((wy - 0.33) ** 2) / 0.0028));
        if (u.z * lado < 0.4) p.z += lado * cor * 0.024;
      },
    });
  };
  add('pulmao', 'respiratorio', pulmao(1), { lado: 'esquerdo' });
  add('pulmao', 'respiratorio', pulmao(-1), { lado: 'direito' });
  add('diafragma', 'respiratorio', (() => {
    const g = new THREE.SphereGeometry(0.1, Math.max(16, Math.round(30 * d)), Math.max(8, Math.round(14 * d)), 0, Math.PI * 2, 0, Math.PI * 0.36);
    g.scale(0.62, 1, 0.62);
    g.rotateZ(-Math.PI / 2 + 0.42);
    g.scale(1, 1.05, 0.88);
    g.translate(-0.11, 0.335, 0);
    return g;
  })());

  // Digestório.
  add('esofago', 'digestorio', tubo(curva([V(0.34, 0.548, 0.004), V(0.28, 0.522, 0.008), V(0.2, 0.452, 0.01), V(0.12, 0.415, 0.006), V(0.03, 0.418, 0.008), V(-0.045, 0.41, 0.016)]),
    0.0056, { d, segmentos: 70, radiais: 10 }));
  add('figado', 'digestorio', elipsoide(V(-0.062, 0.348, -0.004), V(0.03, 0.07, 0.085), {
    d,
    rotacao: [0, 0, -0.35],
    deformar: (p, u) => {
      if (u.x > 0) p.x *= 0.7;
      p.x += 0.006 * Math.sin(u.z * 9) * (u.x < 0 ? 1 : 0);
      p.y += 0.004 * Math.sin(u.z * 7 + 1);
    },
  }));
  add('estomago', 'digestorio', tubo(curva([V(-0.046, 0.41, 0.018), V(-0.07, 0.418, 0.045), V(-0.1, 0.39, 0.052), V(-0.115, 0.345, 0.03), V(-0.098, 0.318, -0.01), V(-0.078, 0.322, -0.034)]),
    (t) => 0.012 + Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.022 * (1 - t * 0.4), { d, segmentos: 50, radiais: 18 }));
  add('baco', 'linfatico', tubo(curva([V(-0.105, 0.405, 0.068), V(-0.13, 0.36, 0.074), V(-0.15, 0.315, 0.06), V(-0.152, 0.29, 0.035)]),
    (t) => 0.007 + Math.sin(t * Math.PI) * 0.006, { d, segmentos: 30, radiais: 12, elipse: 0.4 }));
  add('pancreas', 'digestorio', tubo(curva([V(-0.112, 0.335, 0.03), V(-0.095, 0.322, 0.005), V(-0.098, 0.318, -0.02), V(-0.13, 0.335, -0.045), V(-0.165, 0.35, -0.05)]),
    0.0055, { d, segmentos: 40, radiais: 8, elipse: 0.6 }));
  // Intestino delgado: alças ilustrativas, não o trajeto real.
  const alcas = [V(-0.078, 0.322, -0.034), V(-0.1, 0.33, -0.05), V(-0.16, 0.355, -0.055)];
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    alcas.push(V(
      -0.135 - 0.075 * t + 0.022 * Math.sin(i * 1.9),
      0.29 + 0.028 * Math.sin(i * 1.3 + 0.5) + 0.02 * (i % 2),
      0.05 * Math.sin(i * 0.85) * (1 - t * 0.3),
    ));
  }
  alcas.push(V(-0.2, 0.335, -0.035), V(-0.185, 0.345, -0.038));
  add('intestino_delgado', 'digestorio', tubo(curva(alcas, 0.6), 0.0088, { d, segmentos: 320, radiais: 10 }));
  add('intestino_grosso', 'digestorio', tubo(curva([V(-0.185, 0.345, -0.038), V(-0.16, 0.37, -0.045), V(-0.12, 0.385, -0.035), V(-0.115, 0.392, 0.0), V(-0.125, 0.39, 0.035), V(-0.19, 0.405, 0.03), V(-0.26, 0.415, 0.016), V(-0.32, 0.425, 0.004), V(-0.355, 0.43, 0)]),
    (t) => 0.0125 - t * 0.0025, { d, segmentos: 90, radiais: 12 }));

  // Urinário.
  const rim = (centro, lado) => elipsoide(centro, V(0.026, 0.015, 0.014), {
    d,
    rotacao: [0, 0, -0.15],
    deformar: (p, u) => {
      if (u.z * lado < -0.2) p.z += lado * 0.007 * Math.exp(-(u.x ** 2) / 0.08) * Math.exp(-(u.y ** 2) / 0.3);
    },
  });
  add('rim', 'urinario', rim(V(-0.142, 0.432, 0.034), 1), { lado: 'esquerdo' });
  add('rim', 'urinario', rim(V(-0.118, 0.437, -0.034), -1), { lado: 'direito' });
  add('bexiga', 'urinario', elipsoide(V(-0.282, 0.33, 0), V(0.034, 0.024, 0.024), {
    d,
    deformar: (p, u) => { if (u.x < 0) p.multiplyScalar(1 + u.x * 0.35); },
  }));

  // Músculos esquemáticos (lado esquerdo; o direito é espelhado).
  bilateral('m_temporal', 'muscular', elipsoide(V(0.362, 0.626, 0.03), V(0.036, 0.017, 0.007), { d, rotacao: [0.6, 0, -0.15] }));
  bilateral('m_masseter', 'muscular', elipsoide(V(0.404, 0.574, 0.046), V(0.026, 0.016, 0.006), { d, rotacao: [0, 0, -0.3] }));
  bilateral('m_trapezio', 'muscular', musculo(V(0.235, 0.528, 0.014), V(0.13, 0.475, 0.07), { espessura: 0.026, bojo: V(-0.005, 0.02, 0.02), elipse: 0.22, d, normalPlano: V(0, 0.55, 1).normalize() }));
  bilateral('m_latissimo_dorso', 'muscular', musculo(V(-0.07, 0.49, 0.045), V(0.165, 0.34, 0.09), { espessura: 0.034, bojo: V(0.0, 0.03, 0.045), elipse: 0.18, d, normalPlano: V(0, 0.25, 1).normalize() }));
  bilateral('m_triceps_braquial', 'muscular', musculo(V(0.15, 0.43, 0.082), V(0.098, 0.275, 0.08), { espessura: 0.024, bojo: V(-0.022, 0.0, 0.006), elipse: 0.75, d }));
  bilateral('m_biceps_braquial', 'muscular', musculo(V(0.22, 0.385, 0.08), V(0.138, 0.232, 0.078), { espessura: 0.011, bojo: V(0.01, 0, 0.002), elipse: 0.85, d }));
  bilateral('m_gluteo_medio', 'muscular', musculo(V(-0.24, 0.49, 0.05), V(-0.326, 0.428, 0.08), { espessura: 0.021, bojo: V(0, 0.01, 0.012), elipse: 0.6, d }));
  bilateral('m_quadriceps_femoral', 'muscular', musculo(V(-0.315, 0.415, 0.072), V(-0.253, 0.262, 0.078), { espessura: 0.026, bojo: V(0.022, 0, 0.004), elipse: 0.85, d }));
  bilateral('m_biceps_femoral', 'muscular', musculo(V(-0.4, 0.418, 0.06), V(-0.285, 0.225, 0.086), { espessura: 0.034, bojo: V(-0.02, 0, 0.022), elipse: 0.42, d }));
  bilateral('m_semitendineo', 'muscular', musculo(V(-0.405, 0.405, 0.045), V(-0.282, 0.205, 0.058), { espessura: 0.016, bojo: V(-0.035, -0.005, 0), elipse: 0.8, d }));
  bilateral('m_gastrocnemio', 'muscular', musculo(V(-0.287, 0.252, 0.068), mp.calcaneo.clone().add(V(-0.002, 0.004, 0)), { espessura: 0.016, bojo: V(-0.018, 0, 0.002), elipse: 0.8, d, tendao: 0.3 }));

  // Silhueta translúcida.
  add('pele', 'tegumentar', silhueta(d), { material: 'pele' });

  return partes;
}

// Pontos de câmera úteis (posição e alvo) para atalhos, especialidades e tours.
export const VISTAS = {
  geral: { posicao: [0.55, 0.62, 1.32], alvo: [-0.01, 0.33, 0] },
  lateral: { posicao: [0, 0.38, 1.45], alvo: [0, 0.34, 0] },
  dorsal: { posicao: [0, 1.6, 0.001], alvo: [0, 0.34, 0] },
  cranial: { posicao: [1.4, 0.45, 0], alvo: [0, 0.38, 0] },
  cabeca: { posicao: [0.62, 0.68, 0.32], alvo: [0.43, 0.59, 0] },
  torax: { posicao: [0.36, 0.5, 0.72], alvo: [0.05, 0.37, 0] },
  coracao: { posicao: [0.26, 0.42, 0.46], alvo: [0.09, 0.34, 0] },
  abdome: { posicao: [0.0, 0.47, 0.7], alvo: [-0.15, 0.36, 0] },
  membroToracico: { posicao: [0.35, 0.28, 0.48], alvo: [0.16, 0.22, 0.07] },
  membroPelvico: { posicao: [-0.12, 0.28, 0.55], alvo: [-0.31, 0.24, 0.07] },
  joelho: { posicao: [-0.14, 0.27, 0.25], alvo: [-0.27, 0.245, 0.07] },
  encefalo: { posicao: [0.48, 0.7, 0.2], alvo: [0.365, 0.605, 0] },
  coluna: { posicao: [0.0, 0.85, 0.75], alvo: [-0.02, 0.45, 0] },
};

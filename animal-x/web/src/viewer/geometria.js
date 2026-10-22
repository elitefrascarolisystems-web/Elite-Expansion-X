// Construtores de geometria para o espécime esquemático.
// Eixos: +X cranial, +Y dorsal, +Z lado esquerdo do animal. Unidade: metro.

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
export { V };

// Normaliza a geometria para não indexada com normal (e sem uv), para que
// peças diferentes possam ser mescladas numa só malha.
export function padronizar(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  for (const nome of Object.keys(geo.attributes)) if (nome !== 'position' && nome !== 'normal') geo.deleteAttribute(nome);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  return geo;
}

export function mesclar(geometrias) {
  const lista = geometrias.filter(Boolean).map(padronizar);
  if (lista.length === 1) return lista[0];
  return mergeGeometries(lista, false);
}

// Orienta uma geometria construída ao longo de +Y (de 0 a comprimento) para
// ir do ponto a ao ponto b.
export function orientar(geo, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  geo.applyQuaternion(q);
  geo.translate(a.x, a.y, a.z);
  return geo;
}

// Osso longo: diáfise fina com epífises arredondadas, por perfil de revolução.
export function ossoLongo(a, b, { rProx, rDist, rDiaf, d = 1, achatar = 1 }) {
  const comp = a.distanceTo(b);
  const n = Math.max(10, Math.round(22 * d));
  const pontos = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Epífises: bulbos nas pontas; diáfise com leve cintura.
    const prox = Math.exp(-((t - 0.06) ** 2) / 0.006) * (rProx - rDiaf);
    const dist = Math.exp(-((t - 0.94) ** 2) / 0.006) * (rDist - rDiaf);
    let r = rDiaf * (1 + 0.12 * Math.cos(Math.PI * 2 * t)) + prox + dist;
    if (t === 0 || t === 1) r = 0.0001;
    else if (t < 0.03) r *= Math.sin((t / 0.03) * Math.PI / 2);
    else if (t > 0.97) r *= Math.sin(((1 - t) / 0.03) * Math.PI / 2);
    pontos.push(new THREE.Vector2(Math.max(r, 0.0001), t * comp));
  }
  const geo = new THREE.LatheGeometry(pontos, Math.max(8, Math.round(16 * d)));
  if (achatar !== 1) geo.scale(1, 1, achatar);
  return orientar(geo, a, b);
}

// Tubo ao longo de uma curva com raio variável e seção elíptica.
export function tubo(curva, raio, { d = 1, segmentos = 48, radiais = 12, elipse = 1, onda = null, tampas = true, normalPlano = null } = {}) {
  const nSeg = Math.max(6, Math.round(segmentos * d));
  const nRad = Math.max(6, Math.round(radiais * d));
  // Com normalPlano, a seção achatada fica paralela a uma superfície (por
  // exemplo, um músculo em lâmina sobre a parede do tórax).
  const quadros = normalPlano ? quadrosComPlano(curva, nSeg, normalPlano) : curva.computeFrenetFrames(nSeg, false);
  const posicoes = [];
  const indices = [];
  const pontos = curva.getSpacedPoints(nSeg);
  for (let i = 0; i <= nSeg; i++) {
    const t = i / nSeg;
    let r = typeof raio === 'function' ? raio(t) : raio;
    if (onda) r *= 1 + onda.amplitude * Math.sin(t * onda.frequencia * Math.PI * 2);
    const N = quadros.normals[i];
    const B = quadros.binormals[i];
    for (let j = 0; j <= nRad; j++) {
      const ang = (j / nRad) * Math.PI * 2;
      const c = Math.cos(ang) * r;
      const s = Math.sin(ang) * r * elipse;
      posicoes.push(
        pontos[i].x + N.x * c + B.x * s,
        pontos[i].y + N.y * c + B.y * s,
        pontos[i].z + N.z * c + B.z * s,
      );
    }
  }
  for (let i = 0; i < nSeg; i++) {
    for (let j = 0; j < nRad; j++) {
      const a = i * (nRad + 1) + j;
      const b = (i + 1) * (nRad + 1) + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (tampas) {
    for (const [i, sentido] of [[0, -1], [nSeg, 1]]) {
      const centro = posicoes.length / 3;
      posicoes.push(pontos[i].x, pontos[i].y, pontos[i].z);
      for (let j = 0; j < nRad; j++) {
        const a = i * (nRad + 1) + j;
        if (sentido < 0) indices.push(centro, a + 1, a);
        else indices.push(centro, a, a + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function quadrosComPlano(curva, nSeg, normalPlano) {
  const normals = [];
  const binormals = [];
  for (let i = 0; i <= nSeg; i++) {
    const t = curva.getTangentAt(i / nSeg).normalize();
    // B: eixo fino (ao longo da normal da superfície); N: eixo largo.
    const b = normalPlano.clone().sub(t.clone().multiplyScalar(normalPlano.dot(t))).normalize();
    normals.push(new THREE.Vector3().crossVectors(b, t).normalize());
    binormals.push(b);
  }
  return { normals, binormals };
}

export function curva(pontos, tensao = 0.5) {
  return new THREE.CatmullRomCurve3(pontos, false, 'catmullrom', tensao);
}

// Elipsoide com deformação opcional por vértice.
export function elipsoide(centro, raios, { d = 1, deformar = null, rotacao = null } = {}) {
  const geo = new THREE.SphereGeometry(1, Math.max(12, Math.round(32 * d)), Math.max(8, Math.round(22 * d)));
  const pos = geo.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const unit = p.clone();
    p.set(p.x * raios.x, p.y * raios.y, p.z * raios.z);
    if (deformar) deformar(p, unit);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  if (rotacao) geo.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotacao)));
  geo.translate(centro.x, centro.y, centro.z);
  geo.computeVertexNormals();
  return geo;
}

// Placa achatada a partir de um contorno 2D, posicionada num plano definido
// por origem, eixo U e eixo V.
export function placa(contorno, { origem, u, v, espessura = 0.004, d = 1 }) {
  const forma = new THREE.Shape(contorno.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: espessura,
    bevelEnabled: true,
    bevelThickness: espessura * 0.6,
    bevelSize: espessura * 0.8,
    bevelSegments: Math.max(1, Math.round(2 * d)),
    curveSegments: Math.max(4, Math.round(10 * d)),
  });
  geo.translate(0, 0, -espessura / 2);
  const w = new THREE.Vector3().crossVectors(u, v).normalize();
  const m = new THREE.Matrix4().makeBasis(u.clone().normalize(), v.clone().normalize(), w);
  geo.applyMatrix4(m);
  geo.translate(origem.x, origem.y, origem.z);
  return geo;
}

// Espelha uma geometria para o lado direito (Z negativo) mantendo as faces
// voltadas para fora.
export function espelharZ(geo) {
  const g = padronizar(geo.clone());
  g.scale(1, 1, -1);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i += 3) {
    for (const attr of [pos, nor]) {
      const x = attr.getX(i + 1); const y = attr.getY(i + 1); const z = attr.getZ(i + 1);
      attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
      attr.setXYZ(i + 2, x, y, z);
    }
  }
  return g;
}

// Músculo fusiforme entre origem e inserção, com barriga deslocada por
// "bojo" (vetor) e seção elíptica.
export function musculo(origem, insercao, { espessura, bojo = V(0, 0, 0), elipse = 0.6, d = 1, tendao = 0.12, normalPlano = null }) {
  const meio = origem.clone().lerp(insercao, 0.5).add(bojo);
  const c = new THREE.QuadraticBezierCurve3(origem, meio, insercao);
  const raio = (t) => {
    const base = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.8;
    const ponta = t < tendao ? t / tendao : t > 1 - tendao ? (1 - t) / tendao : 1;
    return Math.max(0.0012, espessura * base * (0.35 + 0.65 * ponta));
  };
  return tubo(c, raio, { d, segmentos: 28, radiais: 14, elipse, normalPlano });
}

/**
 * Grade de hexágonos do modo Cobertura, calculada no próprio aparelho (uma biblioteca pronta
 * pesaria ~400 KB). Os hexágonos são regulares na projeção do mapa (Web Mercator) e o tamanho é
 * corrigido pela latitude de referência: perto da cidade, cada um cobre quase a mesma área no chão.
 */
const EARTH = 6378137;
const SQRT3 = Math.sqrt(3);

export type HexPoint = { latitude: number; longitude: number };
export type Hex = {
  /** "q,r": posição do hexágono na grade. */
  id: string;
  /** Quantos pontos caíram neste hexágono (0 nos vizinhos vazios). */
  count: number;
  center: [lng: number, lat: number];
  /** Contorno fechado (7 vértices, o último igual ao primeiro), em [lng, lat]. */
  ring: [number, number][];
};

function project(lng: number, lat: number): [number, number] {
  const clamped = Math.max(-85, Math.min(85, lat));
  return [EARTH * lng * Math.PI / 180, EARTH * Math.log(Math.tan(Math.PI / 4 + clamped * Math.PI / 360))];
}
function unproject(x: number, y: number): [number, number] {
  return [x / EARTH * 180 / Math.PI, (2 * Math.atan(Math.exp(y / EARTH)) - Math.PI / 2) * 180 / Math.PI];
}
/** Arredonda coordenadas fracionárias para o hexágono mais próximo (coordenadas cúbicas). */
function roundAxial(q: number, r: number): [number, number] {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq + 0, rr + 0];
}

/** Raio (do centro ao vértice) que deixa o hexágono com ~30 px na tela em cada faixa de aproximação. */
export function hexRadiusForZoom(zoom: number): number {
  if (zoom < 9) return 8000;
  if (zoom < 11) return 2500;
  if (zoom < 13) return 700;
  if (zoom < 15) return 200;
  return 80;
}
/** Área de um hexágono regular com esse raio, em m². */
export function hexArea(radiusMeters: number): number {
  return 3 * SQRT3 / 2 * radiusMeters * radiusMeters;
}
/** "≈ 1,3 km²" ou "≈ 10 ha", para a legenda. */
export function hexAreaLabel(radiusMeters: number): string {
  const area = hexArea(radiusMeters);
  const number = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: value < 10 ? 1 : 0 });
  return area >= 1e6 ? `≈ ${number(area / 1e6)} km²` : `≈ ${number(area / 1e4)} ha`;
}

/**
 * Conta os pontos por hexágono. Devolve os hexágonos com pontos e, à parte, os vizinhos vazios
 * deles: é ali, colado no que já foi mapeado, que costuma estar o próximo lugar para mapear.
 */
export function hexBins(points: HexPoint[], radiusMeters: number, referenceLatitude?: number): { hexes: Hex[]; neighbors: Hex[] } {
  if (!points.length || !(radiusMeters > 0)) return { hexes: [], neighbors: [] };
  const latitudes = points.map((p) => p.latitude).sort((a, b) => a - b);
  const reference = referenceLatitude ?? latitudes[Math.floor(latitudes.length / 2)];
  // Na projeção, as distâncias crescem com 1/cos(latitude); o raio acompanha para valer em metros no chão.
  const size = radiusMeters / Math.cos(reference * Math.PI / 180);
  const counts = new Map<string, number>();
  for (const point of points) {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;
    const [x, y] = project(point.longitude, point.latitude);
    const [q, r] = roundAxial((SQRT3 / 3 * x - y / 3) / size, (2 / 3 * y) / size);
    const id = `${q},${r}`;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const shape = (q: number, r: number, count: number): Hex => {
    const cx = size * (SQRT3 * q + SQRT3 / 2 * r), cy = size * 1.5 * r;
    const ring: [number, number][] = [];
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI / 180 * (60 * (i % 6) - 30);
      ring.push(unproject(cx + size * Math.cos(angle), cy + size * Math.sin(angle)));
    }
    return { id: `${q},${r}`, count, center: unproject(cx, cy), ring };
  };
  const hexes: Hex[] = [];
  const neighbors = new Map<string, Hex>();
  for (const [id, count] of counts) {
    const [q, r] = id.split(",").map(Number);
    hexes.push(shape(q, r, count));
    for (const [dq, dr] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) {
      const key = `${q + dq},${r + dr}`;
      if (!counts.has(key) && !neighbors.has(key)) neighbors.set(key, shape(q + dq, r + dr, 0));
    }
  }
  return { hexes: hexes.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)), neighbors: [...neighbors.values()] };
}

/**
 * Faixas da legenda (no máximo 5), do menor ao maior: o início de cada faixa, sempre inteiro e
 * crescente, numa escala que abre espaço para os valores baixos (os mais comuns).
 */
export function countBins(max: number, classes = 5): number[] {
  if (!(max >= 1)) return [];
  if (max <= classes) return Array.from({ length: Math.floor(max) }, (_, i) => i + 1);
  const starts: number[] = [];
  for (let i = 0; i < classes; i++) {
    const start = Math.max(1, Math.round(1 + (max - 1) * (i / classes) ** 2));
    if (!starts.includes(start) && start <= max) starts.push(start);
  }
  return starts;
}
/** Em que faixa cai um valor (0 = a primeira). */
export function binIndex(starts: number[], value: number): number {
  let index = 0;
  starts.forEach((start, i) => { if (value >= start) index = i; });
  return index;
}
/** "1", "2–3", "26–40": o texto de cada faixa da legenda. */
export function binLabels(starts: number[], max: number): string[] {
  return starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] - 1 : max;
    return end > start ? `${start}–${end}` : String(start);
  });
}

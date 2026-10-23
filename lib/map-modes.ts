import type { Feature, FeatureCollection, Point, Polygon } from "geojson";

import { STAGES, TEMPERATURES } from "@/lib/commercial";
import { binIndex, type Hex } from "@/lib/hexgrid";
import type { TerritoryPlacesResponse } from "@/lib/territory-types";

/**
 * Modos de ver o mapa. Calor, Cobertura, Funil, Linha do tempo e Cidade acesa usam só locais
 * e centros de cidade (nunca a posição de uma pessoa); Explorar mostra os cadastros e agrupa no mapa.
 */
export const MAP_MODES = [
  { id: "explorar", label: "Explorar", description: "Agrupamentos que se abrem ao clicar, cartão ao passar o mouse e ficha ao lado." },
  { id: "calor", label: "Calor", description: "Onde está a força e onde está o vazio." },
  { id: "cobertura", label: "Cobertura", description: "Locais mapeados em cada área. Os vizinhos vazios mostram onde mapear a seguir." },
  { id: "funil", label: "Funil", description: "Cada local na etapa mais avançada dos atendimentos ligados a ele." },
  { id: "linha-do-tempo", label: "Linha do tempo", description: "A expansão mês a mês." },
  { id: "cidade-acesa", label: "Cidade acesa", description: "Prédios em 3D e uma torre de luz em cada local mapeado." },
] as const;
export type MapMode = (typeof MAP_MODES)[number]["id"];

export function parseMode(value: string | null | undefined): MapMode {
  return MAP_MODES.find((mode) => mode.id === value)?.id ?? "explorar";
}
/** Endereço com o modo ("&modo=calor"); o Explorar é o padrão e não aparece. */
export function withMode(href: string, mode: MapMode): string {
  const url = new URL(href);
  if (mode === "explorar") url.searchParams.delete("modo"); else url.searchParams.set("modo", mode);
  return url.toString();
}

/**
 * Cores dos modos para o fundo do mapa. Sequencial (Calor, Cobertura): do "pouco" ao "muito";
 * no fundo claro o muito é o dourado escuro, no escuro é o dourado claro (o pouco se aproxima do fundo).
 * Ordinal (Funil): do primeiro contato ao ganho; o passo mais perto do fundo ainda passa de 2:1.
 * Validadas com o validador de paleta (fundo #121212 no escuro, #f8f4f0 no claro).
 */
export function modePalette(dark: boolean) {
  return {
    sequential: dark ? ["#866915", "#a8841c", "#c9a227", "#e2c35a", "#f3e3a3"] : ["#f3e3a3", "#e2c35a", "#c9a227", "#a8841c", "#866915"],
    stages: dark ? ["#866915", "#a8841c", "#c9a227", "#f3e3a3"] : ["#c9a227", "#a8841c", "#866915", "#5c480f"],
    lost: dark ? "#77756d" : "#9a978f",
    surface: dark ? "#121212" : "#ffffff",
    /** Venda confirmada: cor de situação "bom", sempre com rótulo na legenda. */
    sale: "#0ca30c",
    tower: dark ? "#e2c35a" : "#c9a227",
  };
}
/** Cores das faixas da legenda: com menos faixas, espalha pela escala inteira. */
export function rampFor(count: number, ramp: string[]): string[] {
  if (count <= 1) return [ramp[ramp.length - 1]];
  return Array.from({ length: count }, (_, i) => ramp[Math.round(i * (ramp.length - 1) / (count - 1))]);
}

const WON = STAGES.indexOf("Ganho"), LOST = STAGES.indexOf("Perdido");
const isOpen = (stage: number) => stage !== WON && stage !== LOST;

export const HEAT_METRICS = [
  { id: "locais", label: "Locais mapeados", unit: ["local mapeado", "locais mapeados"] },
  { id: "abertos", label: "Atendimentos abertos", unit: ["atendimento aberto", "atendimentos abertos"] },
  { id: "vendas", label: "Vendas confirmadas", unit: ["venda confirmada", "vendas confirmadas"] },
  { id: "atividade", label: "Atividade (30 dias)", unit: ["registro nos últimos 30 dias", "registros nos últimos 30 dias"] },
] as const;
export type HeatMetric = (typeof HEAT_METRICS)[number]["id"];

/** Peso de cada local no calor, pela medida escolhida. */
export function heatWeights(data: TerritoryPlacesResponse, metric: HeatMetric): number[] {
  const weights = data.spots.map((spot) => metric === "locais" ? Number(spot.kind === "business") : metric === "atividade" ? spot.recent : 0);
  if (metric === "abertos" || metric === "vendas") {
    for (const [spot, stage, , , paid, count] of data.deals) if (metric === "abertos" ? isOpen(stage) : paid !== "") weights[spot] += count;
  }
  return weights;
}
/** Atendimentos abertos em cada local (altura das torres e cartão do local). */
export function openBySpot(data: TerritoryPlacesResponse): number[] {
  return heatWeights(data, "abertos");
}

export const FUNNEL_GROUPS = [
  { label: "Novo e Contato", stages: ["Novo", "Contato"] },
  { label: "Qualificado e Reunião", stages: ["Qualificado", "Reunião"] },
  { label: "Proposta e Negociação", stages: ["Proposta", "Negociação"] },
  { label: "Ganho", stages: ["Ganho"] },
  { label: "Perdido", stages: ["Perdido"] },
] as const;
export type Temperature = "" | (typeof TEMPERATURES)[number];
export const TEMPERATURE_OPTIONS: { value: Temperature; label: string }[] = [{ value: "", label: "Todas" }, ...TEMPERATURES.map((t) => ({ value: t, label: t }))];
const groupOf = (stage: number) => FUNNEL_GROUPS.findIndex((group) => (group.stages as readonly string[]).includes(STAGES[stage]));

export type FunnelSpot = { spot: number; stage: number; group: number; open: number; won: number; lost: number; total: number; hot: number };
/**
 * Etapa mais avançada dos atendimentos de cada local, com o filtro de temperatura.
 * Ganho vence tudo; Perdido só aparece quando todos os atendimentos do local foram perdidos.
 */
export function funnelSpots(data: TerritoryPlacesResponse, temperature: Temperature = ""): FunnelSpot[] {
  const wanted = temperature ? TEMPERATURES.indexOf(temperature) : -1;
  const hot = TEMPERATURES.indexOf("Quente");
  const rows = new Map<number, FunnelSpot>();
  for (const [spot, stage, temp, , , count] of data.deals) {
    if (wanted >= 0 && temp !== wanted) continue;
    const row = rows.get(spot) ?? { spot, stage: -1, group: -1, open: 0, won: 0, lost: 0, total: 0, hot: 0 };
    row.total += count;
    if (stage === WON) row.won += count; else if (stage === LOST) row.lost += count; else row.open += count;
    if (temp === hot && isOpen(stage)) row.hot += count;
    if (stage !== LOST && stage > row.stage) row.stage = stage;
    rows.set(spot, row);
  }
  return [...rows.values()].map((row) => {
    const stage = row.stage < 0 ? LOST : row.stage;
    return { ...row, stage, group: groupOf(stage) };
  }).sort((a, b) => a.spot - b.spot);
}
export function funnelTotals(rows: FunnelSpot[]) {
  const byGroup = FUNNEL_GROUPS.map(() => 0);
  for (const row of rows) byGroup[row.group] += 1;
  return { places: rows.length, open: rows.reduce((n, r) => n + r.open, 0), won: rows.reduce((n, r) => n + r.won, 0), hot: rows.reduce((n, r) => n + r.hot, 0), byGroup };
}

/** Meses de "2026-01" a "2026-03", inclusive. */
export function monthRange(first: string, last: string): string[] {
  const months: string[] = [];
  let [year, month] = first.split("-").map(Number);
  const [endYear, endMonth] = last.split("-").map(Number);
  while ((year < endYear || (year === endYear && month <= endMonth)) && months.length < 600) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return months;
}
/** A régua da linha do tempo: do primeiro mês com cadastro ou atendimento até o mês atual (no máximo 60 meses). */
export function timelineMonths(data: TerritoryPlacesResponse, current: string, limit = 60): string[] {
  const valid = (value: string) => /^\d{4}-\d{2}$/.test(value) && value <= current;
  const seen = [...data.spots.map((spot) => spot.mapped.slice(0, 7)), ...data.deals.flatMap(([, , , opened, paid]) => [opened, paid])].filter(valid);
  if (!seen.length) return [];
  return monthRange(seen.reduce((a, b) => (a < b ? a : b)), current).slice(-limit);
}
export type TimelineSpot = { spot: number; fresh: boolean; paid: boolean };
/**
 * O mapa num mês: os locais cadastrados até ali (os do mês em destaque) e onde já havia venda
 * confirmada. O centro da cidade só aparece quando tem venda confirmada.
 */
export function timelineFrame(data: TerritoryPlacesResponse, month: string) {
  const paidAt = new Map<number, string>();
  let sales = 0, newSales = 0;
  for (const [spot, , , , paid, count] of data.deals) {
    if (!paid || paid > month) continue;
    sales += count;
    if (paid === month) newSales += count;
    if (!paidAt.has(spot) || paid < paidAt.get(spot)!) paidAt.set(spot, paid);
  }
  const spots: TimelineSpot[] = [];
  let mapped = 0, newMapped = 0;
  data.spots.forEach((spot, index) => {
    const at = spot.mapped.slice(0, 7);
    const visible = spot.kind === "business" ? Boolean(at) && at <= month : paidAt.has(index);
    if (!visible) return;
    if (spot.kind === "business") { mapped += 1; if (at === month) newMapped += 1; }
    spots.push({ spot: index, fresh: spot.kind === "business" && at === month, paid: paidAt.has(index) });
  });
  return { month, spots, mapped, newMapped, sales, newSales };
}
/** Novos locais e vendas confirmadas por mês, para as barras da régua e a tabela. */
export function timelineSeries(data: TerritoryPlacesResponse, months: string[]) {
  const index = new Map(months.map((month, i) => [month, i]));
  const mapped = months.map(() => 0), sales = months.map(() => 0);
  for (const spot of data.spots) { const i = index.get(spot.mapped.slice(0, 7)); if (spot.kind === "business" && i !== undefined) mapped[i] += 1; }
  for (const [, , , , paid, count] of data.deals) { const i = index.get(paid); if (i !== undefined) sales[i] += count; }
  return { mapped, sales };
}

/** Altura da torre de luz (m): pessoas ligadas ao local e atendimentos abertos nele. */
export function towerHeight(people: number, open: number): number {
  return Math.min(480, 40 + 28 * (people + open));
}
/** Longe, a torre engrossa e cresce na mesma proporção, para continuar visível (1× a partir da aproximação 15). */
export function towerScale(zoom: number): number {
  return Math.min(16, Math.max(1, 2 ** (15 - Math.floor(zoom))));
}
/** Quadrado de lado 2×meia-largura em volta do ponto, em [lng, lat]. */
export function squareRing(longitude: number, latitude: number, halfMeters: number): [number, number][] {
  const dLat = halfMeters / 111320, dLng = halfMeters / (111320 * Math.cos(latitude * Math.PI / 180));
  return [[longitude - dLng, latitude - dLat], [longitude + dLng, latitude - dLat], [longitude + dLng, latitude + dLat], [longitude - dLng, latitude + dLat], [longitude - dLng, latitude - dLat]];
}

// Coleções para o mapa: cada feição tem um id numérico (para destacar com feature-state) e o índice do local.
type Props = Record<string, string | number | boolean>;
const point = (id: number, longitude: number, latitude: number, properties: Props): Feature<Point, Props> => ({ type: "Feature", id, geometry: { type: "Point", coordinates: [longitude, latitude] }, properties });
const collection = <G extends Point | Polygon>(features: Feature<G, Props>[]): FeatureCollection<G, Props> => ({ type: "FeatureCollection", features });

export function heatCollection(data: TerritoryPlacesResponse, weights: number[]) {
  return collection(data.spots.flatMap((spot, i) => weights[i] > 0 ? [point(i, spot.longitude, spot.latitude, { spot: i, weight: weights[i] })] : []));
}
export function hexCollection(hexes: Hex[], starts: number[]) {
  return collection(hexes.map((hex, i): Feature<Polygon, Props> => ({ type: "Feature", id: i, geometry: { type: "Polygon", coordinates: [hex.ring] }, properties: { hex: i, count: hex.count, bin: hex.count ? binIndex(starts, hex.count) : -1 } })));
}
export function funnelCollection(data: TerritoryPlacesResponse, rows: FunnelSpot[]) {
  return collection(rows.map((row) => { const spot = data.spots[row.spot]; return point(row.spot, spot.longitude, spot.latitude, { spot: row.spot, group: row.group, size: row.open + row.won, city: spot.kind === "city" }); }));
}
export function timelineCollection(data: TerritoryPlacesResponse, spots: TimelineSpot[]) {
  return collection(spots.map((item) => { const spot = data.spots[item.spot]; return point(item.spot, spot.longitude, spot.latitude, { spot: item.spot, fresh: item.fresh, paid: item.paid, city: spot.kind === "city" }); }));
}
export function towerCollection(data: TerritoryPlacesResponse, open: number[], scale = 1) {
  return collection(data.spots.flatMap((spot, i): Feature<Polygon, Props>[] => spot.kind !== "business" ? [] : [{ type: "Feature", id: i, geometry: { type: "Polygon", coordinates: [squareRing(spot.longitude, spot.latitude, 7 * scale)] }, properties: { spot: i, height: towerHeight(spot.people, open[i] ?? 0) * scale } }]));
}

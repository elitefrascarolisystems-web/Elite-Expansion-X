/**
 * Contas dos componentes visuais (minigráfico, medidor, número que conta e
 * linha do tempo). Funções puras, testadas em tests/elite-components.test.mjs.
 */

/** Pontos de um minigráfico: a linha e a área sob ela, dentro de `width` × `height`. */
export function sparkline(values: number[], width: number, height: number, pad = 2) {
  const clean = values.map((value) => (Number.isFinite(value) ? value : 0));
  if (clean.length < 2) return null;
  const min = Math.min(...clean), max = Math.max(...clean);
  const span = max - min || 1;
  const step = (width - pad * 2) / (clean.length - 1);
  const points = clean.map((value, index) => ({
    x: Math.round((pad + index * step) * 10) / 10,
    // Série toda igual: linha no meio, sem fingir subida ou descida.
    y: Math.round((max === min ? height / 2 : height - pad - ((value - min) / span) * (height - pad * 2)) * 10) / 10,
  }));
  const line = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const first = points[0], last = points[points.length - 1];
  return { line, area: `M${first.x},${height} L${line.replaceAll(" ", " L")} L${last.x},${height} Z`, last };
}

/** Parte de um total em %, entre 0 e 100 (sem total, 0). */
export function percentOf(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

const FIGURE = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/;

/**
 * O texto de um indicador com o primeiro número na fração `progress` do valor
 * final, no mesmo formato (ex.: "R$ 4.500" → "R$ 2.250" em 0,5). Em 1, o texto original.
 */
export function figureAt(text: string, progress: number) {
  const match = text.match(FIGURE);
  if (!match || progress >= 1) return text;
  const raw = match[0];
  const decimals = raw.includes(",") ? raw.split(",")[1].length : 0;
  const value = Number(raw.replaceAll(".", "").replace(",", ".")) * Math.max(0, progress);
  const shown = value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: raw.includes(".") });
  return text.slice(0, match.index) + shown + text.slice((match.index ?? 0) + raw.length);
}

const SP = "America/Sao_Paulo";
const dayKey = (time: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: SP }).format(new Date(time));

/** Itens da linha do tempo agrupados por dia (Brasília), do mais novo para o mais antigo: "Hoje", "Ontem" ou a data. */
export function groupByDay<T extends { at: string }>(items: T[], now = Date.now()) {
  const today = dayKey(now), yesterday = dayKey(now - 86_400_000);
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    const time = Date.parse(item.at);
    if (!Number.isFinite(time)) continue;
    const key = dayKey(time);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].map(([key, list]) => ({
    key,
    label: key === today ? "Hoje" : key === yesterday ? "Ontem" : `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`,
    items: list,
  }));
}

/** Mês curto de um período "AAAA-MM" (ex.: "out/26"). */
export function monthLabel(period: string) {
  const date = new Date(`${period.slice(0, 7)}-15T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return period;
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date).replace(".", "");
  return `${month}/${period.slice(2, 4)}`;
}

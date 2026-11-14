/**
 * Cor da empresa: troca o dourado da plataforma (botões, destaques, abas ativas, brilhos) pela cor escolhida.
 * Paleta fechada, com contraste conferido nos dois temas (tests/accent.test.mjs):
 * - tema escuro: botão com texto preto e texto colorido no fundo escuro;
 * - tema claro: botão com texto branco e texto colorido no fundo claro.
 * A Elite e as telas de entrada usam sempre o dourado.
 */
export type AccentTones = { gold: string; hover: string; soft: string; light: string; pale: string; deep: string };
export type Accent = { label: string; dark: AccentTones; light: AccentTones };

export const DEFAULT_ACCENT = "dourado";

export const ACCENTS = {
  dourado: { label: "Dourado",
    dark: { gold: "#c9a227", hover: "#ddbd48", soft: "#d6b94f", light: "#e8c766", pale: "#f3e3a3", deep: "#a78624" },
    light: { gold: "#7f6411", hover: "#6b540d", soft: "#765d10", light: "#735a0f", pale: "#66500c", deep: "#5c480b" } },
  azul: { label: "Azul",
    dark: { gold: "#60a5fa", hover: "#93c5fd", soft: "#7cb5fb", light: "#93c5fd", pale: "#bfdbfe", deep: "#3b82f6" },
    light: { gold: "#1d4ed8", hover: "#1e40af", soft: "#1d4ed8", light: "#1e40af", pale: "#1e3a8a", deep: "#1e3a8a" } },
  verde: { label: "Verde",
    dark: { gold: "#34d399", hover: "#6ee7b7", soft: "#5ee0b0", light: "#6ee7b7", pale: "#a7f3d0", deep: "#10b981" },
    light: { gold: "#047857", hover: "#065f46", soft: "#047857", light: "#065f46", pale: "#064e3b", deep: "#064e3b" } },
  turquesa: { label: "Turquesa",
    dark: { gold: "#22d3ee", hover: "#67e8f9", soft: "#4fdcf2", light: "#67e8f9", pale: "#a5f3fc", deep: "#06b6d4" },
    light: { gold: "#0e7490", hover: "#155e75", soft: "#0e7490", light: "#155e75", pale: "#164e63", deep: "#164e63" } },
  roxo: { label: "Roxo",
    dark: { gold: "#a78bfa", hover: "#c4b5fd", soft: "#b7a1fb", light: "#c4b5fd", pale: "#ddd6fe", deep: "#8b5cf6" },
    light: { gold: "#6d28d9", hover: "#5b21b6", soft: "#6d28d9", light: "#5b21b6", pale: "#4c1d95", deep: "#4c1d95" } },
  vinho: { label: "Vinho",
    dark: { gold: "#fb7185", hover: "#fda4af", soft: "#fc8a9b", light: "#fda4af", pale: "#fecdd3", deep: "#f43f5e" },
    light: { gold: "#be123c", hover: "#9f1239", soft: "#be123c", light: "#9f1239", pale: "#881337", deep: "#881337" } },
  laranja: { label: "Laranja",
    dark: { gold: "#fb923c", hover: "#fdba74", soft: "#fca55a", light: "#fdba74", pale: "#fed7aa", deep: "#f97316" },
    light: { gold: "#b53c0a", hover: "#9a3412", soft: "#ad3a0a", light: "#9a3412", pale: "#7c2d12", deep: "#7c2d12" } },
  grafite: { label: "Grafite",
    dark: { gold: "#d4d4d8", hover: "#e4e4e7", soft: "#d4d4d8", light: "#e4e4e7", pale: "#f4f4f5", deep: "#a1a1aa" },
    light: { gold: "#3f3f46", hover: "#27272a", soft: "#3f3f46", light: "#27272a", pale: "#18181b", deep: "#18181b" } },
} satisfies Record<string, Accent>;

export type AccentKey = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];
export const isAccent = (value: unknown): value is AccentKey => typeof value === "string" && value in ACCENTS;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

function block(selector: string, t: AccentTones) {
  return `${selector}{--elite-gold:${t.gold};--elite-gold-hover:${t.hover};--elite-gold-soft:${t.soft};--elite-gold-light:${t.light};--elite-gold-pale:${t.pale};--elite-gold-deep:${t.deep};--elite-gold-rgb:${rgb(t.gold)};--chart-1:${t.gold};--chart-seq-2:${t.light};--chart-seq-3:${t.gold};--chart-seq-4:${t.deep}}`;
}

/** CSS da cor da empresa para os dois temas; vazio no dourado (o padrão já está no CSS global). */
export function accentCss(key: string | null | undefined): string {
  if (!isAccent(key) || key === DEFAULT_ACCENT) return "";
  const accent = ACCENTS[key];
  return block(":root", accent.dark) + block('html[data-theme="light"]', accent.light);
}

/** Contraste WCAG entre duas cores #rrggbb (1 a 21). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

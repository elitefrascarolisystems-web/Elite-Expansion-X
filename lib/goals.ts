/*
 * Metas com período (tabela `goals`): regras puras usadas pelo servidor e pelas telas.
 * Meta é só o que a gestão aplicou na Calculadora; a "Rotina do dia" (seller_goals) não é meta.
 */
import { z } from "zod";

import { addDays, daysBetween, shortDate } from "@/lib/goal-calculator";

export const GOAL_METRICS = ["Vendas pagas", "Receita confirmada", "Atendimentos", "Pessoas mapeadas"] as const;
export type GoalMetricAny = (typeof GOAL_METRICS)[number];
export type GoalScope = "Empresa" | "Cidade" | "Pessoa";
export const SALES_METRICS: GoalMetricAny[] = ["Vendas pagas", "Receita confirmada"];

export type Goal = {
  id: string; scope: GoalScope; cityId: number | null; ownerEmail: string; metric: GoalMetricAny;
  /** Centavos em "Receita confirmada". */
  target: number; periodStart: string; periodEnd: string; status: "Ativa" | "Substituída"; version: number;
  createdAt: string;
};

export const GOAL_CONFLICT = "Outra pessoa alterou este registro agora há pouco. Atualize a página e repita a alteração.";
export const ONLY_MANAGEMENT = "Somente a gestão define metas.";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const replace = z.array(z.object({ id: z.string().min(1).max(64), version: z.number().int().min(1) })).max(500);
/** Premissas da foto: número ou vazio, com a origem. Nada de texto livre além da origem fixa. */
const rate = z.object({ value: z.number().finite().nullable(), source: z.enum(["real", "sem-dados", "consolidado", "estimativa"]) });

export const applyInput = z.object({
  cityId: z.number().int().positive().nullable(),
  metric: z.enum(["Vendas pagas", "Receita confirmada"]),
  target: z.number().int().min(0).max(1_000_000_000_00),
  periodStart: day, periodEnd: day,
  assumptions: z.record(z.string().max(24), rate).refine((v) => Object.keys(v).length <= 24, "Premissas demais."),
  plan: z.object({ leads: z.number().int().min(0).max(1_000_000), people: z.number().int().min(0).max(1_000_000).nullable(), startBy: day }).nullable(),
  replace,
}).refine((v) => v.periodStart <= v.periodEnd, "O fim do período vem antes do início.");

export const splitInput = z.object({
  goalId: z.string().min(1).max(64),
  rows: z.array(z.object({
    email: z.string().email().max(200),
    sales: z.number().int().min(0).max(1_000_000_000_00),
    leads: z.number().int().min(0).max(1_000_000).nullable(),
    people: z.number().int().min(0).max(1_000_000).nullable(),
  })).min(1).max(200),
  replace,
});

/** Duas metas se sobrepõem quando têm o mesmo escopo, a mesma métrica e períodos que se cruzam. */
export const overlaps = (a: Pick<Goal, "periodStart" | "periodEnd">, b: Pick<Goal, "periodStart" | "periodEnd">) => a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd;

/** Semanas do plano (do início até a data de começar), sem arredondar; no mínimo 1. */
export const planWeeks = (g: Pick<Goal, "periodStart" | "periodEnd">) => Math.max(1, daysBetween(g.periodStart, g.periodEnd) / 7);
/** "Semana: x de y atendimentos": y = meta ÷ semanas do plano. Some depois da data de começar. */
export function weeklyTarget(g: Pick<Goal, "periodStart" | "periodEnd" | "target">, today: string): number | null {
  if (today < g.periodStart || today > g.periodEnd) return null;
  return Math.ceil(Number((g.target / planWeeks(g)).toFixed(6)));
}

/** Segunda e domingo da semana de `today` (Brasília). */
export function weekOf(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  const monday = addDays(today, -((weekday + 6) % 7));
  return { start: monday, end: addDays(monday, 6) };
}

export const formatTarget = (metric: GoalMetricAny, target: number) => metric === "Receita confirmada"
  ? (target / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
  : `${target.toLocaleString("pt-BR")} ${metric === "Vendas pagas" ? (target === 1 ? "venda paga" : "vendas pagas") : metric === "Atendimentos" ? (target === 1 ? "atendimento" : "atendimentos") : (target === 1 ? "pessoa mapeada" : "pessoas mapeadas")}`;

/** Texto da confirmação de "Aplicar como meta": exatamente o que será gravado. */
export function applySummary(input: { scopeName: string; metric: GoalMetricAny; target: number; periodStart: string; periodEnd: string; plan: { leads: number; people: number | null; startBy: string; from: string } | null; replaced: { target: number; metric: GoalMetricAny }[] }) {
  const lines = [`Meta ${input.scopeName.startsWith("da ") || input.scopeName.startsWith("de ") ? input.scopeName : `de ${input.scopeName}`}: ${formatTarget(input.metric, input.target)} de ${shortDate(input.periodStart)} a ${shortDate(input.periodEnd)}.`];
  if (input.plan) lines.push(`Plano de ${shortDate(input.plan.from)} até ${shortDate(input.plan.startBy)}: ${formatTarget("Atendimentos", input.plan.leads)}${input.plan.people !== null ? ` e ${formatTarget("Pessoas mapeadas", input.plan.people)}` : ""}.`);
  if (input.replaced.length) lines.push(`Substitui a meta atual (${input.replaced.map((r) => r.metric === "Receita confirmada" ? formatTarget(r.metric, r.target) : r.target.toLocaleString("pt-BR")).join(", ")}).`);
  return lines.join(" ");
}

/** Divide a meta em proporção ao que cada um fez (maior resto); sem base, em partes iguais. A soma fecha com o total. */
export function proportionalSplit(total: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0);
  const base = sum > 0 ? weights.map((w) => Math.max(0, w) / sum) : weights.map(() => 1 / weights.length);
  const raw = base.map((share) => share * total);
  const out = raw.map((x) => Math.floor(Number(x.toFixed(6))));
  let rest = total - out.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(Number(x.toFixed(6))) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k].i]++;
  return out;
}

/** "out/2026: 30 → 27 (90%)" */
export function historyLine(g: Pick<Goal, "metric" | "target" | "periodStart" | "periodEnd">, realized: number) {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const sameMonth = g.periodStart.slice(0, 7) === g.periodEnd.slice(0, 7);
  const label = sameMonth ? `${months[Number(g.periodStart.slice(5, 7)) - 1]}/${g.periodStart.slice(0, 4)}` : `${shortDate(g.periodStart)} a ${shortDate(g.periodEnd, true)}`;
  const fmt = (n: number) => g.metric === "Receita confirmada" ? formatTarget(g.metric, n) : n.toLocaleString("pt-BR");
  const pct = g.target > 0 ? ` (${Math.round(realized / g.target * 100)}%)` : "";
  return `${label}: ${fmt(g.target)} → ${fmt(realized)}${pct}`;
}

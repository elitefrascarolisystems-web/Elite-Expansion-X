import { z } from "zod";
import "./zod-pt";

/** Recursos que o plano pode liberar ou não (os demais vêm sempre com a plataforma). */
export const PLAN_FEATURES = [
  ["imports", "Importar planilhas"],
  ["exports", "Exportar relatórios"],
  ["externalMaps", "Mapas de satélite e Street View"],
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number][0];

/** Plano da organização e quanto já usa (para a própria empresa ver em Configurações). */
export type PlanUsage = {
  plan: string;
  userLimit: number | null;
  cityLimit: number | null;
  /** Usuários da equipe: mentorados não ocupam vaga. */
  users: number;
  /** Cidades com situação Ativa. */
  cities: number;
  imports: boolean;
  exports: boolean;
  externalMaps: boolean;
};

const limit = z.union([z.number().int().min(1).max(100000), z.null()]);
const date = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato dia/mês/ano."), z.null()]);

export const subscriptionSchema = z.object({
  organizationId: z.number().int().positive(),
  plan: z.string().trim().max(60).default(""),
  priceCents: z.number().int().min(0).max(100000000).default(0),
  paidUntil: date.default(null),
  notes: z.string().trim().max(1000).default(""),
  userLimit: limit.default(null),
  cityLimit: limit.default(null),
  imports: z.boolean().default(true),
  exports: z.boolean().default(true),
  externalMaps: z.boolean().default(true),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export const statusSchema = z.object({
  organizationId: z.number().int().positive(),
  active: z.boolean(),
  reason: z.string().trim().min(5, "Escreva o motivo (mínimo 5 letras).").max(500),
});

export const newSubscriberSchema = subscriptionSchema.omit({ organizationId: true }).extend({
  requestId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().toLowerCase().email().max(254),
});

export type SubscriberRow = {
  id: number;
  name: string;
  ownerEmail: string;
  ownerName: string;
  active: boolean;
  createdAt: string;
  plan: string;
  priceCents: number;
  paidUntil: string | null;
  notes: string;
  userLimit: number | null;
  cityLimit: number | null;
  imports: boolean;
  exports: boolean;
  externalMaps: boolean;
  users: number;
  mentorados: number;
  cities: number;
  people: number;
  leads: number;
  lastActivity: string | null;
  lastLogin: string | null;
  ownerJoined: boolean;
};
export type SubscriptionAudit = { organizationId: number; actor: string; action: string; reason: string; at: string };
export type SubscriptionsData = { subscribers: SubscriberRow[]; audit: SubscriptionAudit[]; today: string };

export type PaymentState = { label: string; tone: "ok" | "warn" | "late" | "none" };

/** Situação do pagamento pela data “pago até” (a cobrança é feita fora da plataforma). */
export function paymentState(paidUntil: string | null, today: string): PaymentState {
  if (!paidUntil) return { label: "Sem data de pagamento", tone: "none" };
  const days = Math.round((Date.parse(paidUntil) - Date.parse(today)) / 86400000);
  if (days < 0) return { label: `Vencida há ${-days} ${-days === 1 ? "dia" : "dias"}`, tone: "late" };
  if (days <= 7) return { label: days === 0 ? "Vence hoje" : `Vence em ${days} ${days === 1 ? "dia" : "dias"}`, tone: "warn" };
  return { label: "Em dia", tone: "ok" };
}

export const seatLimitMessage = (limit: number) => `O plano permite ${limit} ${limit === 1 ? "usuário" : "usuários"} da equipe e todas as vagas estão ocupadas. Fale com a Elite para ampliar o plano.`;
export const cityLimitMessage = (limit: number) => `O plano permite ${limit} ${limit === 1 ? "cidade ativa" : "cidades ativas"} e o limite foi atingido. Deixe uma cidade como Planejada ou fale com a Elite para ampliar o plano.`;
export const FEATURE_BLOCKED: Record<PlanFeature, string> = {
  imports: "Importar planilhas não está incluído no plano da sua empresa. Fale com a Elite para liberar.",
  exports: "Exportar relatórios não está incluído no plano da sua empresa. Fale com a Elite para liberar.",
  externalMaps: "Mapas de satélite e Street View não estão incluídos no plano da sua empresa.",
};

import "./zod-pt";
import { z } from "zod";
import { ACTIONS, type ActionName } from "@/lib/expansion-permissions";
import { USER_ROLES } from "@/lib/expansion-types";

const shortText = z.string().trim().min(1).max(160);
const optionalText = z.string().trim().max(500).default("");
const noteText = z.string().trim().max(2000).default("");
const id = z.number().int().positive();
const optionalId = z.number().int().positive().nullable().optional();
const nonNegative = z.number().int().min(0);
const emailOrEmpty = z.union([z.literal(""), z.string().trim().email().max(254)]);
const webUrlOrEmpty = z.string().trim().max(1000).refine((value) => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Informe um link iniciado por http ou https.");
const month = z.string().regex(/^\d{4}-\d{2}$/, "Informe o período no formato AAAA-MM.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(value + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value; }, 'Informe uma data válida no formato AAAA-MM-DD.');

export const actionNameSchema = z.enum(ACTIONS);

export const actionSchemas: Record<ActionName, z.ZodTypeAny> = {
  create_city: z.object({
    name: shortText,
    state: z.string().trim().min(2).max(2).transform((value) => value.toUpperCase()),
    phase: z.enum(["Preparação", "Piloto", "Ativa", "Em espera"]),
    leaderName: optionalText,
    targetCacCents: nonNegative,
    ambassadorGoal: z.number().int().positive(),
    salesGoal: z.number().int().positive(),
    status: z.enum(["Planejada", "Ativa", "Pausada"]),
    budgetCents: nonNegative,
    trackingMode: z.enum(["Consolidado", "Detalhado"]),
    notes: noteText,
  }),
  update_city: z.object({
    cityId: id,
    phase: z.enum(["Preparação", "Piloto", "Ativa", "Em espera"]),
    leaderName: optionalText,
    targetCacCents: nonNegative,
    ambassadorGoal: z.number().int().positive(),
    salesGoal: z.number().int().positive(),
    status: z.enum(["Planejada", "Ativa", "Pausada"]),
    budgetCents: nonNegative,
    trackingMode: z.enum(["Consolidado", "Detalhado"]),
    notes: noteText,
  }),
  create_ambassador: z.object({
    personId: z.string().uuid().optional(),
    cityId: id,
    name: shortText,
    code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Use letras, números, hífen ou sublinhado."),
    email: emailOrEmpty.default(""),
    whatsapp: z.string().trim().max(30).default(""),
    whatsappAuthorized: z.boolean().default(false),
    level: z.enum(["Indicador", "Embaixador ativo", "Referência", "Líder local"]),
    status: z.enum(["Convidado", "Em análise", "Aprovado", "Em treinamento", "Ativo", "Inativo", "Pausado", "Desligado"]),
  }).superRefine((value, context) => {
    if (value.whatsapp && !value.whatsappAuthorized) {
      context.addIssue({ code: "custom", path: ["whatsappAuthorized"], message: "Confirme a autorização antes de registrar o WhatsApp." });
    }
  }),
  update_ambassador: z.object({
    ambassadorId: id,
    level: z.enum(["Indicador", "Embaixador ativo", "Referência", "Líder local"]),
    status: z.enum(["Convidado", "Em análise", "Aprovado", "Em treinamento", "Ativo", "Inativo", "Pausado", "Desligado"]),
    onboardingStatus: z.enum(["Pendente", "Em andamento", "Concluído"]),
    trainingProgress: z.number().int().min(0).max(100),
    whatsappAuthorized: z.boolean(),
    pauseReason: optionalText,
  }),
  record_city: z.object({
    cityId: id,
    period: month,
    reach: nonNegative,
    leads: nonNegative,
    organicLeads: nonNegative,
    sales: nonNegative,
    revenueCents: nonNegative,
    costCents: nonNegative,
    mediaCostCents: nonNegative,
    refunds: nonNegative,
    satisfaction: z.number().int().min(0).max(10),
    partners: nonNegative,
    events: nonNegative,
    note: noteText,
    phase: z.enum(["Preparação", "Piloto", "Ativa", "Em espera"]),
    status: z.enum(["Planejada", "Ativa", "Pausada"]),
  }).superRefine((value, context) => {
    if (value.organicLeads > value.leads) context.addIssue({ code: "custom", path: ["organicLeads"], message: "Leads orgânicos não podem superar os leads totais." });
    if (value.mediaCostCents > value.costCents) context.addIssue({ code: "custom", path: ["mediaCostCents"], message: "O custo de mídia não pode superar o custo total." });
    if (value.refunds > value.sales) context.addIssue({ code: "custom", path: ["refunds"], message: "Reembolsos não podem superar os pagamentos informados." });
  }),
  record_ambassador: z.object({
    ambassadorId: id,
    period: month,
    leads: nonNegative,
    sales: nonNegative,
    actions: nonNegative,
    contents: nonNegative,
    events: nonNegative,
    costCents: nonNegative,
    note: noteText,
  }),
  create_lead: z.object({
    personId: z.string().uuid().optional(),
    cityId: id,
    ambassadorId: optionalId,
    partnerId: optionalId,
    eventId: optionalId,
    contentId: optionalId,
    name: shortText,
    email: emailOrEmpty.default(""),
    whatsapp: z.string().trim().max(30).default(""),
    status: z.enum(["Lead informado", "Lead válido", "Oportunidade"]),
    channel: z.enum(["Mídia paga", "Embaixador", "Parceiro", "Evento", "Conteúdo", "Orgânico", "Outro"]),
    sourceLabel: optionalText,
    campaign: optionalText,
    utmSource: optionalText,
    utmMedium: optionalText,
    utmCampaign: optionalText,
    consentAccepted: z.literal(true, { message: "Confirme a autorização do contato." }),
    consentSource: shortText,
    consentPurpose: shortText,
    assignedToEmail: emailOrEmpty.default(""),
  }).refine((value) => Boolean(value.email || value.whatsapp), {
    message: "Informe o WhatsApp ou o e-mail do lead.",
    path: ["whatsapp"],
  }),
  update_lead: z.object({
    leadId: id,
    status: z.enum(["Lead informado", "Lead válido", "Oportunidade", "Cancelado"]),
    assignedToEmail: emailOrEmpty.default(""),
    consentRevoked: z.boolean().default(false),
    consentRevocationReason: optionalText,
  }).superRefine((value, context) => {
    if (value.consentRevoked && !value.consentRevocationReason) {
      context.addIssue({ code: "custom", path: ["consentRevocationReason"], message: "Informe o motivo da revogação." });
    }
  }),
  record_sale: z.object({
    leadId: id,
    product: shortText,
    amountCents: nonNegative,
    status: z.enum(["Em negociação", "Venda confirmada", "Pagamento confirmado", "Cancelada", "Reembolsada"]),
  }).superRefine((value, context) => {
    // Venda confirmada ou paga sem valor contaria cliente pago sem receita.
    if (["Venda confirmada", "Pagamento confirmado"].includes(value.status) && value.amountCents <= 0) {
      context.addIssue({ code: "custom", path: ["amountCents"], message: "Informe o valor da venda." });
    }
  }),
  create_cost: z.object({
    cityId: id,
    ambassadorId: optionalId,
    partnerId: optionalId,
    eventId: optionalId,
    category: z.enum(["Mídia paga", "Evento", "Material", "Ferramenta", "Recompensa autorizada", "Outro"]),
    channel: z.enum(["Mídia paga", "Embaixador", "Parceiro", "Evento", "Conteúdo", "Orgânico", "Outro"]),
    period: month,
    amountCents: z.number().int().positive(),
    note: noteText,
  }),
  create_partner: z.object({
    cityId: id,
    name: shortText,
    type: shortText,
    contactName: optionalText,
    whatsapp: z.string().trim().max(30).default(""),
    status: z.enum(["Em conversa", "Ativo", "Pausado", "Encerrado"]),
    nextAction: optionalText,
  }),
  create_event: z.object({
    cityId: id,
    partnerId: optionalId,
    name: shortText,
    eventDate: date,
    status: z.enum(["Planejado", "Confirmado", "Realizado", "Cancelado"]),
    ownerName: optionalText,
    costCents: nonNegative,
    reach: nonNegative,
    leads: nonNegative,
    sales: nonNegative,
  }),
  create_content: z.object({
    cityId: optionalId,
    title: shortText,
    type: z.enum(["Mensagem", "Vídeo", "Arte", "Roteiro", "Treinamento"]),
    channel: z.enum(["WhatsApp", "Instagram", "Presencial", "E-mail", "Geral"]),
    version: z.string().trim().min(1).max(20),
    status: z.enum(["Em revisão", "Aprovado", "Retirado"]),
    url: webUrlOrEmpty.default(""),
    instructions: noteText,
    expiresAt: z.union([z.literal(""), date]).nullable().optional(),
  }),
  create_task: z.object({
    cityId: optionalId,
    ambassadorId: optionalId,
    title: shortText,
    category: z.enum(["Missão", "Treinamento", "Evento", "Conteúdo", "Atendimento"]),
    dueDate: z.union([z.literal(""), date]).nullable().optional(),
  }),
  complete_task: z.object({ taskId: id }),
  complete_training: z.object({ ambassadorId: id }),
  accept_terms: z.object({ ambassadorId: id, accepted: z.literal(true) }),
  update_settings: z.object({
    referralBaseUrl: z.string().trim().max(1000).refine((value) => {
      if (!value) return true;
      try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol); } catch { return false; }
    }, "Informe um link válido iniciado por http ou https."),
    attributionModel: z.literal("Origem principal declarada"),
    minActiveAmbassadors: nonNegative,
    minConfirmedPayments: nonNegative,
    minActivePartners: nonNegative,
    minDataPeriods: nonNegative,
    inactivityDays: nonNegative,
    organicGoalPercent: z.number().int().min(0).max(100),
  }),
  create_user: z.object({
    email: z.string().trim().email().max(254),
    name: shortText,
    role: z.enum(USER_ROLES),
    cityId: optionalId,
    ambassadorId: optionalId,
    title: z.string().trim().max(80).default(""),
    mentorshipCycle: z.number().int().min(0).max(10).default(0),
  }).superRefine((value, context) => {
    if (["Líder", "Embaixador", "Coordenação"].includes(value.role) && !value.cityId) {
      context.addIssue({ code: "custom", path: ["cityId"], message: "Selecione a cidade deste perfil." });
    }
    if (value.role === "Embaixador" && !value.ambassadorId) {
      context.addIssue({ code: "custom", path: ["ambassadorId"], message: "Selecione o embaixador deste perfil." });
    }
  }),
};

export function parseActionPayload(action: ActionName, data: unknown) {
  return actionSchemas[action].parse(data) as Record<string, unknown>;
}

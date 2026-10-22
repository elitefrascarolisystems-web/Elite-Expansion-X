import { z } from "zod";

/**
 * Direitos do titular (LGPD, art. 18) atendidos pela gestão da empresa:
 * cópia dos dados, correção, revogação da autorização e exclusão por anonimização.
 * Prazo de resposta completa: 15 dias a partir do pedido (art. 19, II).
 */
export const PRIVACY_KINDS = ["acesso", "correcao", "revogacao", "anonimizacao"] as const;
export type PrivacyKind = (typeof PRIVACY_KINDS)[number];
export const PRIVACY_KIND_LABEL: Record<PrivacyKind, string> = {
  acesso: "Cópia dos dados", correcao: "Correção", revogacao: "Revogação da autorização", anonimizacao: "Exclusão (anonimização)",
};
export const PRIVACY_CHANNELS = ["E-mail", "WhatsApp", "Telefone", "Presencial", "Outro"] as const;
export const RESPONSE_DAYS = 15;
/** Nome que fica no lugar do titular anonimizado (com um código para diferenciar). */
export const ANONYMOUS_LABEL = "Titular anonimizado";
/** Texto que substitui anotações livres sobre o titular. */
export const REMOVED_NOTE = "[removido a pedido do titular]";

const subject = z.string().regex(/^(person:[0-9a-f-]{36}|lead:[1-9][0-9]*|ambassador:[1-9][0-9]*)$/, "Escolha o titular na busca.");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do pedido.");

export const privacyRequestSchema = z.object({
  subject,
  channel: z.enum(PRIVACY_CHANNELS, { errorMap: () => ({ message: "Informe por onde o pedido chegou." }) }),
  receivedAt: day,
  note: z.string().trim().max(300, "Observação: no máximo 300 caracteres.").default(""),
});
export const correctionSchema = privacyRequestSchema.extend({
  name: z.string().trim().min(2, "Nome: pelo menos 2 letras.").max(200),
  email: z.union([z.literal(""), z.string().trim().max(200).email("E-mail inválido.")]).optional(),
  whatsapp: z.string().trim().max(40).optional().refine((v) => !v || /^\d{10,13}$/.test(v.replace(/\D/g, "")), "WhatsApp: DDD e número (10 a 13 dígitos)."),
});
export const anonymizeSchema = privacyRequestSchema.extend({
  confirm: z.literal(true, { errorMap: () => ({ message: "Confirme que entende que a anonimização não pode ser desfeita." }) }),
});

export type PrivacySubject = { ref: string; name: string; city: string; place: string; sources: string[]; anonymized: boolean };
export type PrivacyDetails = PrivacySubject & {
  email: string; whatsapp: string; consent: "vigente" | "revogada" | "sem contato";
  counts: { roles: number; actions: number; activities: number; history: number; sale: boolean; updates: number };
  platformAccess: string[];
};
export type PrivacyRequestRow = {
  id: string; kind: PrivacyKind; subjectLabel: string; channel: string; receivedAt: string; completedAt: string;
  note: string; actorEmail: string; deadline: string; days: number; onTime: boolean;
};

/** Último dia para responder: data do pedido + 15 dias. */
export function deadlineOf(receivedAt: string) {
  const date = new Date(`${receivedAt}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + RESPONSE_DAYS);
  return date.toISOString().slice(0, 10);
}
/** Dias entre o pedido e o atendimento (o mesmo dia conta 0). */
export function daysBetween(from: string, to: string) {
  return Math.max(0, Math.round((Date.parse(`${to.slice(0, 10)}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000));
}

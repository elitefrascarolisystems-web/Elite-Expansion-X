import { z } from "zod";
import "./zod-pt";
import { TEMPERATURES } from "./commercial";

/** Canais de origem aceitos no lead (os mesmos do cadastro de lead). */
export const LEAD_CHANNELS = ["Mídia paga", "Embaixador", "Parceiro", "Evento", "Conteúdo", "Orgânico", "Outro"] as const;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD.");

/**
 * "Iniciar atendimento": a pessoa do mapa vira lead e oportunidade de uma vez,
 * sem redigitar nome, cidade nem local. Só pede o contato, a autorização e o
 * primeiro retorno.
 */
export const startAttendanceSchema = z.object({
  personId: z.string().uuid(),
  email: z.union([z.string().trim().toLowerCase().email().max(254), z.literal("")]).default(""),
  whatsapp: z.string().trim().max(30).default(""),
  channel: z.enum(LEAD_CHANNELS).default("Orgânico"),
  consentAccepted: z.literal(true, { message: "Confirme que a pessoa autorizou o contato." }),
  consentSource: z.string().trim().min(3).max(200),
  consentPurpose: z.string().trim().min(3).max(200),
  ownerEmail: z.string().trim().toLowerCase().email(),
  temperature: z.enum(TEMPERATURES).default("Morno"),
  nextAction: z.string().trim().min(3, "Diga qual é o próximo passo (ex.: primeiro contato pelo WhatsApp).").max(500),
  dueDate: day,
}).refine((v) => Boolean(v.email || v.whatsapp.replace(/\D/g, "")), { message: "Informe o WhatsApp ou o e-mail da pessoa.", path: ["whatsapp"] });
export type StartAttendance = z.infer<typeof startAttendanceSchema>;

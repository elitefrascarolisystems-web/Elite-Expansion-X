import { z } from "zod";
import "./zod-pt";

/** Pedido de apresentação/assinatura enviado pela página pública /conheca. */
export const TEAM_SIZES = ["Só eu", "2 a 5 pessoas", "6 a 15 pessoas", "16 a 50 pessoas", "Mais de 50 pessoas"] as const;
export const REQUEST_STATUSES = ["Novo", "Em conversa", "Virou assinante", "Descartado"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
/** Envios aceitos do mesmo endereço por hora (o resto é recusado com aviso). */
export const REQUESTS_PER_HOUR = 5;

export const publicRequestSchema = z.object({
  company: z.string().trim().min(2, "Informe o nome da empresa.").max(120),
  contactName: z.string().trim().min(2, "Informe o seu nome.").max(120),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
  whatsapp: z.string().trim().max(40).refine((v) => /^\d{10,13}$/.test(v.replace(/\D/g, "")), "WhatsApp: DDD e número."),
  city: z.string().trim().min(2, "Informe a cidade e o estado.").max(120),
  teamSize: z.enum(TEAM_SIZES, { errorMap: () => ({ message: "Escolha o tamanho da equipe." }) }),
  message: z.string().trim().max(1000, "Mensagem: no máximo 1000 caracteres.").default(""),
  consent: z.literal(true, { errorMap: () => ({ message: "Para responder, precisamos da sua autorização de contato." }) }),
  /** Campo invisível: pessoas deixam vazio, robôs preenchem. */
  website: z.string().max(200).default(""),
});

export const requestUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(REQUEST_STATUSES),
  note: z.string().trim().max(1000).default(""),
  organizationId: z.number().int().positive().nullable().default(null),
});

export type SubscriptionRequestRow = {
  id: string; company: string; contactName: string; email: string; whatsapp: string; city: string; teamSize: string;
  message: string; status: RequestStatus; note: string; organizationId: number | null; handledBy: string; createdAt: string; updatedAt: string;
};

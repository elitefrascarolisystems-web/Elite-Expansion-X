import { z } from "zod";
import "./zod-pt";

/** Públicos do portal e de materiais. */
export const PORTAL_AUDIENCES = ["Mentorados"] as const;
export const CONTENT_AUDIENCES = ["Embaixadores", "Mentorados", "Todos"] as const;
/** Público do portal: hoje só mentorados usam o portal. */
export const PORTAL_AUDIENCE = "Mentorados" as const;
export const MAX_REFERRALS_PER_DAY = 20;

const day = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);

export const stepToggleSchema = z.object({ stepId: z.number().int().positive(), done: z.boolean() });
export const referSchema = z.object({
  name: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().max(30).default(""),
  email: z.union([z.string().trim().toLowerCase().email().max(254), z.literal("")]).default(""),
  cityId: z.number().int().positive(),
  regionId: z.string().uuid().nullable().default(null),
  note: z.string().trim().max(500).default(""),
  consent: z.literal(true, { message: "Confirme que a pessoa autorizou o contato." }),
}).refine((v) => Boolean(v.whatsapp.replace(/\D/g, "") || v.email), { message: "Informe o WhatsApp ou o e-mail de quem você está indicando.", path: ["whatsapp"] });

export const stepSchema = z.object({
  id: z.number().int().positive().optional(),
  audience: z.enum(PORTAL_AUDIENCES),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(600).default(""),
});
export const mapMemberSchema = z.object({ userId: z.number().int().positive() });
export const memberSchema = z.object({
  userId: z.number().int().positive(),
  personId: z.string().uuid().nullable().default(null),
  ownerEmail: z.union([z.string().trim().toLowerCase().email(), z.literal("")]).default(""),
  nextMeetingAt: z.union([z.string().refine(day, "Informe data e hora do encontro."), z.literal(""), z.null()]).default(null),
  nextMeetingNote: z.string().trim().max(300).default(""),
});

export type PortalStep = { id: number; title: string; description: string; doneAt: string | null };
export type PortalData = {
  member: { name: string; email: string; role: "Mentorado"; title: string; mentorshipCycle: number; cityName: string; welcomed: boolean; guidesSeen: string[]; organizationName: string };
  owner: { name: string; email: string; title: string } | null;
  nextMeeting: { at: string; note: string } | null;
  place: { name: string; link: string } | null;
  steps: PortalStep[];
  materials: { id: number; title: string; type: string; url: string; instructions: string }[];
  referrals: { name: string; createdAt: string; status: "Recebida" | "Em conversa" | "Virou cliente" }[];
  cities: { id: number; name: string }[];
  /** Bairros cadastrados por cidade, para a indicação cair no lugar certo do mapa. */
  regions: { id: string; cityId: number; name: string }[];
};
export type PortalAdminData = {
  steps: (Omit<PortalStep, "doneAt"> & { audience: string; position: number })[];
  members: { userId: number; name: string; email: string; role: string; cityId: number | null; cityName: string; personId: string | null; personName: string; ownerEmail: string; nextMeetingAt: string | null; nextMeetingNote: string; done: number; total: number; referrals: number; hasPassword: boolean }[];
};

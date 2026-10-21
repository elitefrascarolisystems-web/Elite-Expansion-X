import type { AccessView, LeadRecord } from "@/lib/expansion-types";

export const ACTIONS = [
  "create_city",
  "update_city",
  "create_ambassador",
  "update_ambassador",
  "record_city",
  "record_ambassador",
  "create_lead",
  "update_lead",
  "record_sale",
  "create_cost",
  "create_partner",
  "create_event",
  "create_content",
  "create_task",
  "complete_task",
  "complete_training",
  "accept_terms",
  "update_settings",
  "create_user",
] as const;

export type ActionName = (typeof ACTIONS)[number];

const roleActions: Record<AccessView["role"], readonly ActionName[]> = {
  Administrador: ACTIONS,
  Coordenação: ACTIONS.filter((action) => !["update_settings", "create_user", "create_city"].includes(action)),
  Líder: [
    "create_ambassador",
    "update_ambassador",
    "record_city",
    "record_ambassador",
    "create_lead",
    "update_lead",
    "record_sale",
    "create_cost",
    "create_partner",
    "create_event",
    "create_content",
    "create_task",
    "complete_task",
  ],
  Embaixador: ["record_ambassador", "create_lead", "complete_task", "complete_training", "accept_terms"],
  Comercial: ["create_lead", "update_lead", "record_sale"],
  // Portal: nenhuma ação da equipe.
  Mentorado: [],
  Assinante: [],
};

export function canPerform(access: AccessView, action: ActionName) {
  return access.active && roleActions[access.role].includes(action);
}

export function canAccessCity(access: AccessView, cityId: number) {
  if (!access.active) return false;
  if (access.role === "Administrador") return true;
  if (access.role === "Comercial" && access.cityId === null) return true;
  return access.cityId === cityId;
}

export function canAccessAmbassador(access: AccessView, ambassadorId: number, cityId: number) {
  if (!canAccessCity(access, cityId)) return false;
  if (access.role === "Embaixador") return access.ambassadorId === ambassadorId;
  return access.role !== "Comercial";
}

export function canAccessLead(access: AccessView, lead: Pick<LeadRecord, "cityId" | "ambassadorId" | "assignedToEmail">) {
  if (!access.active) return false;
  if (access.role === "Administrador") return true;
  if (["Líder", "Coordenação"].includes(access.role)) return access.cityId !== null && access.cityId === lead.cityId;
  if (access.role === "Embaixador") return access.ambassadorId !== null && access.ambassadorId === lead.ambassadorId;
  return access.role === "Comercial" && lead.assignedToEmail.toLowerCase() === access.email.toLowerCase();
}

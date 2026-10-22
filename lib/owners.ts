import type { DashboardData } from "@/lib/expansion-types";

/**
 * Quem pode ser responsável por um local ou atendimento numa cidade: alguém
 * ativo da equipe da empresa (a mesma regra que o servidor confere em db/commercial.ts).
 */
export function eligibleOwners(data: DashboardData, cityId: number) {
  return data.users.filter((u) => u.active && ["Administrador", "Coordenação", "Líder", "Comercial"].includes(u.role)
    && (u.cityId === cityId || (u.cityId === null && ["Administrador", "Comercial"].includes(u.role))));
}

/**
 * Responsável padrão: quem está usando a plataforma. Pela Assessoria Elite, quem
 * usa não faz parte da equipe da empresa; aí o padrão é alguém dela (de
 * preferência um administrador), para o local ou atendimento ter um dono na empresa.
 */
export function defaultOwnerEmail(data: DashboardData, cityId: number) {
  const self = data.access.email.toLowerCase();
  if (!data.access.isAdvisory) return self;
  const list = eligibleOwners(data, cityId);
  return (list.find((u) => u.role === "Administrador") ?? list[0])?.email.toLowerCase() ?? self;
}

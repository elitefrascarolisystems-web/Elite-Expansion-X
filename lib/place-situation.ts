/*
 * Situação de um lugar (é do lugar, nunca nota da pessoa), pelas pessoas distintas da rede ligadas a ele
 * (principal ou extra), no escopo de quem vê e sem os vínculos a revisar.
 */
export type PlaceSituation = "Abrir" | "Plantar" | "Avançar" | "Dominado" | "Institucional";
export const SITUATIONS: PlaceSituation[] = ["Abrir", "Plantar", "Avançar", "Dominado"];

export function placeSituation(p: { sector?: string | null; people: number; clients: number; multipliers: number }): { situation: PlaceSituation; text: string } {
  if (p.sector === "Religioso") return { situation: "Institucional", text: "Lugar institucional: trabalhe com a instituição, sem ligar pessoas." };
  if (p.multipliers >= 1 || p.clients >= 3) return { situation: "Dominado", text: `Dominado: ${p.clients} ${p.clients === 1 ? "cliente" : "clientes"}${p.multipliers ? ` e ${p.multipliers} ${p.multipliers === 1 ? "multiplicador" : "multiplicadores"}` : ""} aqui` };
  if (p.clients >= 1) return { situation: "Avançar", text: `Avançar: ${p.clients} ${p.clients === 1 ? "cliente" : "clientes"} aqui` };
  if (p.people >= 1) return { situation: "Plantar", text: `Plantar: ${p.people} ${p.people === 1 ? "pessoa da rede" : "pessoas da rede"}, nenhum cliente ainda` };
  return { situation: "Abrir", text: "Abrir: ninguém da rede ligado aqui ainda" };
}

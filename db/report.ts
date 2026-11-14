/**
 * Relatório executivo do mês: o que o painel não guarda por mês.
 * Metas como estavam no fim do mês, mapeamento novo, decisões registradas e atendimentos.
 * Os números de atendimentos, vendas, receita e custo vêm do mesmo cálculo do painel (no navegador).
 */
import { database } from "@/db/runtime";
import { brazilToday } from "@/db/calculator";
import { goalProgress, type GoalProgress } from "@/db/goals";
import type { AccessView } from "@/lib/expansion-types";

export class ReportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type MonthlyReport = {
  month: string;
  /** Último dia considerado: o fim do mês ou hoje, no mês corrente. */
  asOf: string;
  goals: GoalProgress;
  mapping: { cityId: number; name: string; places: number; people: number }[];
  decisions: { city: string; decision: string; reason: string; nextAction: string; reviewDate: string | null; at: string; by: string }[];
  opportunities: { created: number; won: number; lost: number };
};

/** Gestão da empresa e de cada cidade. Vendedor vê o próprio resultado em Vendas. */
export const REPORT_ROLES = ["Administrador", "Coordenação", "Líder"];

const lastDay = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

export async function monthlyReport(access: AccessView, month: string): Promise<MonthlyReport> {
  if (!access.active || !REPORT_ROLES.includes(access.role)) throw new ReportError("O relatório do mês é da gestão da empresa.", 403);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ReportError("Escolha um mês válido.");
  const today = brazilToday();
  if (month > today.slice(0, 7)) throw new ReportError("Escolha um mês que já começou.");
  const end = lastDay(month), asOf = end < today ? end : today;
  const org = access.organizationId;
  // Coordenação e Liderança: só a própria cidade (como no restante da plataforma).
  const own = access.role !== "Administrador";
  if (own && !access.cityId) throw new ReportError("Sem cidade definida para o seu acesso.", 403);
  const city = own ? " AND c.id=?" : "";
  const scope = (args: unknown[]) => (own ? [...args, access.cityId] : args);
  const db = database();
  const all = async (sql: string, args: unknown[]) => (await db.prepare(sql).bind(...args).all()).results;

  const [goals, mapping, decisions, opportunities] = await Promise.all([
    goalProgress(access, { today: asOf }),
    all(`SELECT c.id,c.name,
        (SELECT count(*) FROM businesses b WHERE b.city_id=c.id AND substr(b.created_at,1,7)=?) AS places,
        (SELECT count(*) FROM territory_people p WHERE p.city_id=c.id AND substr(p.created_at,1,7)=?) AS people
      FROM cities c WHERE c.organization_id=?${city} ORDER BY c.name LIMIT 500`, scope([month, month, org])),
    all(`SELECT c.name AS city,r.decision,r.reason,r.next_action,r.review_date,r.created_at,r.owner_email
      FROM city_decisions r JOIN cities c ON c.id=r.city_id
      WHERE r.organization_id=? AND substr(r.created_at,1,7)=?${city} ORDER BY r.created_at DESC LIMIT 20`, scope([org, month])),
    all(`SELECT
        (SELECT count(*) FROM opportunities o JOIN cities c ON c.id=o.city_id WHERE o.organization_id=? AND substr(o.created_at,1,7)=?${city}) AS created,
        (SELECT count(DISTINCT e.opportunity_id) FROM opportunity_stage_events e JOIN opportunities o ON o.id=e.opportunity_id JOIN cities c ON c.id=o.city_id
          WHERE e.organization_id=? AND e.to_stage='Ganho' AND substr(e.created_at,1,7)=?${city}) AS won,
        (SELECT count(DISTINCT e.opportunity_id) FROM opportunity_stage_events e JOIN opportunities o ON o.id=e.opportunity_id JOIN cities c ON c.id=o.city_id
          WHERE e.organization_id=? AND e.to_stage='Perdido' AND substr(e.created_at,1,7)=?${city}) AS lost`,
      [...scope([org, month]), ...scope([org, month]), ...scope([org, month])]),
  ]);
  const totals = opportunities[0] ?? {};
  return {
    month, asOf, goals,
    mapping: mapping.map((r) => ({ cityId: Number(r.id), name: String(r.name), places: Number(r.places ?? 0), people: Number(r.people ?? 0) })),
    decisions: decisions.map((r) => ({ city: String(r.city), decision: String(r.decision), reason: String(r.reason ?? ""), nextAction: String(r.next_action ?? ""),
      reviewDate: r.review_date ? String(r.review_date) : null, at: String(r.created_at), by: String(r.owner_email ?? "") })),
    opportunities: { created: Number(totals.created ?? 0), won: Number(totals.won ?? 0), lost: Number(totals.lost ?? 0) },
  };
}

import { database } from "@/db/runtime";
import { rowDue, type Followup } from "@/lib/followup";
import type { AccessView, AgendaView } from "@/lib/expansion-types";

const LIMIT_ITEMS = 8;
const spDay = (time: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(time));

/**
 * Agenda de quem entrou: retornos atrasados e de hoje das oportunidades sob a
 * responsabilidade dela, com a mesma regra de vencimento do Follow-up.
 */
export async function getAgenda(access: AccessView, now = Date.now()): Promise<AgendaView | undefined> {
  if (!access.active || access.role === "Embaixador" || access.isAdvisory) return undefined;
  const rows = (await database().prepare(`
    SELECT o.id, o.lead_id, o.stage, o.temperature, o.next_action, o.due_date, o.followup_json,
      l.name AS lead_name, c.name AS city_name, s.status AS payment_status, s.paid_at
    FROM opportunities o
    JOIN leads l ON l.id=o.lead_id AND l.consent_revoked_at IS NULL AND l.status<>'Cancelado'
    JOIN cities c ON c.id=o.city_id
    LEFT JOIN sales s ON s.lead_id=o.lead_id
    WHERE o.organization_id=? AND lower(o.owner_email)=lower(?) AND o.stage<>'Perdido'
    ORDER BY o.due_date LIMIT 500`).bind(access.organizationId, access.email).all()).results;
  const today = spDay(now);
  const items: AgendaView["items"] = [];
  let late = 0, dueToday = 0, upcoming = 0;
  for (const row of rows) {
    const followup = JSON.parse(String(row.followup_json || "{}")) as Followup;
    const due = rowDue({ followup, due_date: String(row.due_date), stage: String(row.stage), payment_status: row.payment_status ? String(row.payment_status) : null, paid_at: row.paid_at ? String(row.paid_at) : null }, now);
    if (!due) continue;
    const time = Date.parse(due);
    const when = time < now ? "late" : spDay(time) === today ? "today" : "upcoming";
    if (when === "late") late++; else if (when === "today") dueToday++; else { upcoming++; continue; }
    items.push({ opportunityId: String(row.id), leadId: Number(row.lead_id), leadName: String(row.lead_name), cityName: String(row.city_name), nextAction: String(row.next_action ?? ""), stage: String(row.stage), temperature: String(row.temperature), dueAt: due, late: when === "late" });
  }
  items.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  return { late, today: dueToday, upcoming, items: items.slice(0, LIMIT_ITEMS) };
}

import { database } from "@/db/runtime";
import type { AccessView } from "@/lib/expansion-types";
import { addDays, daysBetween, MINIMUMS } from "@/lib/goal-calculator";

/**
 * Taxas da Calculadora, por SQL agregado no servidor (nunca sobre os registros de
 * getDashboardData). Cada consulta isola a organização por cities.organization_id e
 * aplica o escopo da função antes de contar. Só números: nenhum nome, contato ou posição.
 */

export class CalculatorError extends Error { constructor(message: string, public status = 400) { super(message); } }

type Value = string | number | null;
type Row = Record<string, unknown>;
const num = (value: unknown) => (value === null || value === undefined || value === "" ? 0 : Number(value));

/** O dia (AAAA-MM-DD, Brasília) de uma data gravada: só o dia, com -03:00, ou com hora sem fuso (UTC). */
export const dayOf = (column: string) => `(CASE WHEN length(${column}) = 10 THEN ${column} WHEN ${column} LIKE '%-03:00' THEN substr(${column}, 1, 10) ELSE date(${column}, '-3 hours') END)`;

const IMPORTED = "Importação da rede por planilha";
const VALID = "('Lead válido','Oportunidade')";

export function brazilToday(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export type RateSource = "real" | "sem-dados" | "consolidado";
export type Rate = { value: number | null; source: RateSource; base: string };
export type CalculatorBaseResponse = {
  scope: { kind: "Empresa" | "Cidade" | "Pessoa"; cityId: number | null; cityName: string; consolidated: boolean; consolidatedCities: number; detailedCities: number };
  today: string; periodStart: string;
  paid: number; paidRevenueCents: number; paidSource: "pagamentos" | "fechamento consolidado" | "misto";
  /** Vendas pagas e receita (centavos) por dia, de periodStart até hoje, para o gráfico. */
  series: { day: string; sales: number; revenueCents: number }[];
  rates: {
    ticketCents: Rate; v: Rate; c: Rate; m: Rate & { sameDay?: boolean }; N: Rate;
    Nmap: number | null; Nind: number | null; Nmid: number | null; Nout: number | null;
    Pm: Rate; nm: Rate; a: Rate; nv: Rate; kv: Rate; C: Rate; r: Rate; cplCents: Rate;
  };
  organicGoal: number;
  excluded: { importedLeads: number; consolidatedCities: number; peopleWithoutOrigin: number };
};

const noData = (base: string): Rate => ({ value: null, source: "sem-dados", base });

/** Escopo da função: Administrador (empresa ou cidade), Coordenação e Líder (a cidade), Comercial (os dele). */
export function calculatorScope(a: AccessView, cityId: number | null) {
  if (!a.active || ["Embaixador", "Mentorado"].includes(a.role)) throw new CalculatorError("Seu perfil não possui acesso comercial.", 403);
  if (a.role === "Coordenação" || a.role === "Líder") {
    if (!a.cityId) throw new CalculatorError("Sem cidade definida para o seu acesso.", 403);
    return { cityId: a.cityId, ownerEmail: null as string | null };
  }
  if (a.role === "Comercial") return { cityId: a.cityId ?? cityId, ownerEmail: a.email.toLowerCase() };
  return { cityId, ownerEmail: null as string | null };
}

export async function getCalculatorBase(a: AccessView, input: { cityId: number | null; today?: string }): Promise<CalculatorBaseResponse> {
  const scope = calculatorScope(a, input.cityId);
  const db = database();
  const all = async (sql: string, args: Value[]) => (await db.prepare(sql).bind(...args).all()).results as Row[];
  const org = a.organizationId;
  const today = input.today ?? brazilToday();
  const periodStart = `${today.slice(0, 7)}-01`;
  const back = (days: number) => addDays(today, -days);

  const cities = await all("SELECT id, name, tracking_mode FROM cities WHERE organization_id = ? " + (scope.cityId ? "AND id = ?" : ""), scope.cityId ? [org, scope.cityId] : [org]);
  if (scope.cityId && !cities.length) throw new CalculatorError("Cidade não encontrada.", 404);
  const detailed = cities.filter((c) => c.tracking_mode !== "Consolidado").map((c) => Number(c.id));
  const consolidated = cities.filter((c) => c.tracking_mode === "Consolidado").map((c) => Number(c.id));
  const settings = (await all("SELECT organic_goal_percent, origin_tracked_since FROM settings WHERE organization_id = ? LIMIT 1", [org]))[0] ?? {};
  const trackedSince = String(settings.origin_tracked_since || today);

  // Filtro de cidade (no máximo 1 parâmetro: a lista vem por subconsulta, nunca por IN com muitos ids).
  const cityFilter = (alias: string) => scope.cityId
    ? { sql: `${alias}.city_id = ? AND ${alias}.city_id IN (SELECT id FROM cities WHERE organization_id = ? AND tracking_mode <> 'Consolidado')`, args: [scope.cityId, org] as Value[] }
    : { sql: `${alias}.city_id IN (SELECT id FROM cities WHERE organization_id = ? AND tracking_mode <> 'Consolidado')`, args: [org] as Value[] };
  // Responsável (Comercial): o da oportunidade; sem oportunidade, quem está com o atendimento.
  const ownerOf = "COALESCE(NULLIF((SELECT o.owner_email FROM opportunities o WHERE o.lead_id = l.id LIMIT 1), ''), l.assigned_to_email)";
  const owner = scope.ownerEmail ? { sql: ` AND lower(${ownerOf}) = ?`, args: [scope.ownerEmail] as Value[] } : { sql: "", args: [] as Value[] };
  const leadScope = { sql: cityFilter("l").sql + owner.sql, args: [...cityFilter("l").args, ...owner.args] };
  const saleScope = { sql: cityFilter("s").sql + owner.sql, args: [...cityFilter("s").args, ...owner.args] };
  const paidDay = dayOf("s.paid_at");
  const leadDay = dayOf("l.created_at");

  const consolidatedArgs: Value[] = scope.cityId ? [org, scope.cityId] : [org];
  const [period, series, consolidatedSales, firstLead, pace, ticket, cohort, payDays, leadsBySource, mapped, firstMapped, mappedCohort, sellers, sellerWeeks, clients, cost, excluded] = await Promise.all([
    all(`SELECT COUNT(*) AS n, COALESCE(SUM(s.amount_cents),0) AS cents FROM sales s LEFT JOIN leads l ON l.id = s.lead_id WHERE s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND ${paidDay} BETWEEN ? AND ? AND ${saleScope.sql}`, [periodStart, today, ...saleScope.args]),
    all(`SELECT ${paidDay} AS day, COUNT(*) AS n, COALESCE(SUM(s.amount_cents),0) AS cents FROM sales s LEFT JOIN leads l ON l.id = s.lead_id WHERE s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND ${paidDay} BETWEEN ? AND ? AND ${saleScope.sql} GROUP BY day ORDER BY day`, [periodStart, today, ...saleScope.args]),
    scope.ownerEmail ? Promise.resolve([{ n: 0 }]) : all(`SELECT COALESCE(SUM(u.sales),0) AS n FROM city_updates u JOIN cities c ON c.id = u.city_id WHERE c.organization_id = ? ${scope.cityId ? "AND c.id = ?" : ""} AND c.tracking_mode = 'Consolidado' AND u.period >= '${periodStart.slice(0, 7)}' AND u.period <= '${today.slice(0, 7)}'`, consolidatedArgs),
    all(`SELECT MIN(${leadDay}) AS first FROM leads l WHERE l.source_label <> ? AND ${leadScope.sql}`, [IMPORTED, ...leadScope.args]),
    all(`SELECT ${paidDay} AS day, COUNT(*) AS n FROM sales s LEFT JOIN leads l ON l.id = s.lead_id WHERE s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND ${paidDay} > ? AND ${paidDay} <= ? AND ${saleScope.sql} GROUP BY day`, [back(56), today, ...saleScope.args]),
    all(`SELECT COUNT(*) AS n, AVG(s.amount_cents) AS avg FROM sales s LEFT JOIN leads l ON l.id = s.lead_id WHERE s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND s.amount_cents > 0 AND ${paidDay} > ? AND ${saleScope.sql}`, [back(90), ...saleScope.args]),
    all(`SELECT COUNT(*) AS n, SUM(CASE WHEN EXISTS (SELECT 1 FROM sales s WHERE s.lead_id = l.id AND s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND julianday(${paidDay}) - julianday(${leadDay}) <= 60) THEN 1 ELSE 0 END) AS paid FROM leads l WHERE l.status IN ${VALID} AND l.consent_revoked_at IS NULL AND l.source_label <> ? AND ${leadDay} BETWEEN ? AND ? AND ${leadScope.sql}`, [IMPORTED, back(150), back(60), ...leadScope.args]),
    all(`SELECT CAST(julianday(${paidDay}) - julianday(${leadDay}) AS INTEGER) AS d, COUNT(*) AS n FROM sales s JOIN leads l ON l.id = s.lead_id WHERE s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND l.source_label <> ? AND ${paidDay} > ? AND ${saleScope.sql} GROUP BY d`, [IMPORTED, back(180), ...saleScope.args]),
    all(`SELECT CASE WHEN l.channel = 'Indicação' OR EXISTS (SELECT 1 FROM territory_people p WHERE p.id = l.person_id AND p.referrer_id IS NOT NULL) THEN 'ind' WHEN l.channel = 'Mídia paga' THEN 'mid' WHEN l.source_label = 'Mapeamento' OR l.source_label LIKE 'Mapeamento · %' THEN 'map' ELSE 'out' END AS origin, COUNT(*) AS n FROM leads l WHERE l.status IN ${VALID} AND l.source_label <> ? AND ${leadDay} > ? AND ${leadScope.sql} GROUP BY origin`, [IMPORTED, back(56), ...leadScope.args]),
    all(`SELECT COUNT(*) AS n, COUNT(DISTINCT lower(p.created_by)) AS mappers FROM territory_people p WHERE p.source = 'Mapeamento' AND ${dayOf("p.created_at")} >= ? AND ${dayOf("p.created_at")} > ? AND ${cityFilter("p").sql}${scope.ownerEmail ? " AND lower(p.created_by) = ?" : ""}`, [trackedSince, back(56), ...cityFilter("p").args, ...(scope.ownerEmail ? [scope.ownerEmail] : [])]),
    all(`SELECT MIN(${dayOf("p.created_at")}) AS first FROM territory_people p WHERE p.source = 'Mapeamento' AND ${dayOf("p.created_at")} >= ? AND ${cityFilter("p").sql}${scope.ownerEmail ? " AND lower(p.created_by) = ?" : ""}`, [trackedSince, ...cityFilter("p").args, ...(scope.ownerEmail ? [scope.ownerEmail] : [])]),
    all(`SELECT COUNT(*) AS n, SUM(CASE WHEN EXISTS (SELECT 1 FROM leads l WHERE l.person_id = p.id AND l.status IN ${VALID} AND julianday(${leadDay}) - julianday(${dayOf("p.created_at")}) <= 30) THEN 1 ELSE 0 END) AS leads FROM territory_people p WHERE p.source = 'Mapeamento' AND ${dayOf("p.created_at")} >= ? AND ${dayOf("p.created_at")} BETWEEN ? AND ? AND ${cityFilter("p").sql}${scope.ownerEmail ? " AND lower(p.created_by) = ?" : ""}`, [trackedSince, back(120), back(30), ...cityFilter("p").args, ...(scope.ownerEmail ? [scope.ownerEmail] : [])]),
    all(`SELECT COUNT(DISTINCT lower(l.assigned_to_email)) AS n FROM leads l WHERE l.status IN ${VALID} AND l.source_label <> ? AND ${leadDay} > ? AND lower(l.assigned_to_email) IN (SELECT lower(email) FROM app_users WHERE organization_id = ? AND active = 1 AND role IN ('Administrador','Coordenação','Líder','Comercial')) AND ${leadScope.sql}`, [IMPORTED, back(56), org, ...leadScope.args]),
    all(`SELECT MAX(n) AS best FROM (SELECT lower(l.assigned_to_email) AS who, CAST((julianday(?) - julianday(${leadDay})) / 7 AS INTEGER) AS wk, COUNT(*) AS n FROM leads l WHERE l.status IN ${VALID} AND l.source_label <> ? AND l.assigned_to_email <> '' AND ${leadDay} > ? AND ${leadScope.sql} GROUP BY who, wk)`, [today, IMPORTED, back(90), ...leadScope.args]),
    all(`SELECT COUNT(DISTINCT l.person_id) AS n FROM sales s JOIN leads l ON l.id = s.lead_id WHERE s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND l.person_id IS NOT NULL AND l.consent_revoked_at IS NULL AND ${saleScope.sql}`, saleScope.args),
    scope.ownerEmail ? Promise.resolve([]) : (() => {
      const months = [1, 2, 3].map((k) => { const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - k, 1)); return d.toISOString().slice(0, 7); });
      return all(`SELECT (SELECT COALESCE(SUM(k.amount_cents),0) FROM costs k WHERE (k.category = 'Mídia paga' OR k.channel = 'Mídia paga') AND k.period BETWEEN ? AND ? AND ${cityFilter("k").sql}) AS cents, (SELECT COUNT(*) FROM leads l WHERE l.status IN ${VALID} AND l.channel = 'Mídia paga' AND substr(${leadDay}, 1, 7) BETWEEN ? AND ? AND ${cityFilter("l").sql}) AS leads`, [months[2], months[0], ...cityFilter("k").args, months[2], months[0], ...cityFilter("l").args]);
    })(),
    all(`SELECT (SELECT COUNT(*) FROM leads l WHERE l.source_label = ? AND ${leadScope.sql}) AS imported, (SELECT COUNT(*) FROM territory_people p WHERE p.source = '' AND ${cityFilter("p").sql}) AS noorigin`, [IMPORTED, ...leadScope.args, ...cityFilter("p").args]),
  ]);

  // Semanas cobertas: do mais recente entre (hoje − 56) e o 1º atendimento não importado, até hoje.
  const first = firstLead[0]?.first ? String(firstLead[0].first) : null;
  const coveredDays = first ? Math.min(56, daysBetween(first < back(56) ? back(56) : first, today)) : 0;
  const weeks = coveredDays / 7;
  const paceStart = first && first > back(56) ? first : back(56);
  const paceSales = pace.filter((r) => String(r.day) >= paceStart).reduce((s, r) => s + num(r.n), 0);

  const ticketN = num(ticket[0]?.n);
  const cohortN = num(cohort[0]?.n), cohortPaid = num(cohort[0]?.paid);
  const diffs: number[] = [];
  for (const r of payDays) { const d = num(r.d); if (d >= 0) for (let i = 0; i < num(r.n); i++) diffs.push(d); }
  diffs.sort((x, y) => x - y);
  const median = diffs.length ? (diffs.length % 2 ? diffs[(diffs.length - 1) / 2] : (diffs[diffs.length / 2 - 1] + diffs[diffs.length / 2]) / 2) : null;
  const m = median === null ? null : Math.min(90, Math.max(0, Math.ceil(median)));

  const origin = Object.fromEntries(leadsBySource.map((r) => [String(r.origin), num(r.n)]));
  const leads56 = ["map", "ind", "mid", "out"].reduce((s, k) => s + (origin[k] ?? 0), 0);
  const leadWeeksOk = weeks >= MINIMUMS.leadWeeks;
  const perWeek = (count: number) => (leadWeeksOk ? count / weeks : null);

  const firstMap = firstMapped[0]?.first ? String(firstMapped[0].first) : null;
  const mapStart = [trackedSince, back(56), firstMap ?? today].sort().at(-1)!;
  const mapWeeks = daysBetween(mapStart, today) / 7;
  const mappedN = num(mapped[0]?.n), mappers = num(mapped[0]?.mappers);
  const mapOk = mappers >= 1 && mapWeeks >= MINIMUMS.leadWeeks;
  const Pm = mapOk ? mappedN / mapWeeks : null;
  const aN = num(mappedCohort[0]?.n), aLeads = num(mappedCohort[0]?.leads);

  const nvCount = num(sellers[0]?.n), kvBest = num(sellerWeeks[0]?.best);
  const C = num(clients[0]?.n);
  const indN = origin.ind ?? 0;
  const costCents = num(cost[0]?.cents), mediaLeads = num(cost[0]?.leads);

  const consolidatedOnly = scope.cityId !== null && consolidated.length > 0 && detailed.length === 0;
  const consolidatedNote = "Sem dados suficientes (cidade em modo Consolidado)";
  const rate = (value: number | null, ok: boolean, base: string): Rate => consolidatedOnly ? { value: null, source: "consolidado", base: consolidatedNote } : ok && value !== null && Number.isFinite(value) ? { value, source: "real", base } : noData(base);
  const span = (from: string) => `de ${from.slice(8, 10)}/${from.slice(5, 7)} a ${today.slice(8, 10)}/${today.slice(5, 7)}`;

  const paidSales = num(period[0]?.n) + num(consolidatedSales[0]?.n);
  return {
    scope: { kind: scope.ownerEmail ? "Pessoa" : scope.cityId ? "Cidade" : "Empresa", cityId: scope.cityId, cityName: scope.cityId ? String(cities[0]?.name ?? "") : "", consolidated: consolidatedOnly, consolidatedCities: consolidated.length, detailedCities: detailed.length },
    today, periodStart,
    paid: paidSales, paidRevenueCents: num(period[0]?.cents),
    paidSource: consolidatedOnly ? "fechamento consolidado" : num(consolidatedSales[0]?.n) > 0 ? "misto" : "pagamentos",
    series: series.map((r) => ({ day: String(r.day), sales: num(r.n), revenueCents: num(r.cents) })),
    rates: {
      ticketCents: rate(ticketN ? num(ticket[0]?.avg) : null, ticketN >= MINIMUMS.ticketSales, `${ticketN} vendas pagas nos últimos 90 dias`),
      v: rate(weeks >= MINIMUMS.paceWeeks ? paceSales / weeks : null, weeks >= MINIMUMS.paceWeeks, `${paceSales} vendas pagas ${span(paceStart)}`),
      c: rate(cohortN ? cohortPaid / cohortN : null, cohortN >= MINIMUMS.conversionLeads && cohortPaid >= MINIMUMS.conversionPaid, `${cohortN} atendimentos de ${back(150).slice(8, 10)}/${back(150).slice(5, 7)} a ${back(60).slice(8, 10)}/${back(60).slice(5, 7)}, ${cohortPaid} pagaram em até 60 dias`),
      m: { ...rate(m, diffs.length >= MINIMUMS.ticketSales, `${diffs.length} vendas pagas nos últimos 180 dias`), ...(m === 0 && diffs.length >= MINIMUMS.ticketSales ? { sameDay: true } : {}) },
      N: rate(perWeek(leads56), leadWeeksOk, `${leads56} atendimentos novos em ${Math.round(weeks * 10) / 10} semanas`),
      Nmap: perWeek(origin.map ?? 0), Nind: perWeek(indN), Nmid: perWeek(origin.mid ?? 0), Nout: perWeek(origin.out ?? 0),
      Pm: rate(Pm, mapOk, `${mappedN} pessoas mapeadas em ${Math.round(mapWeeks * 10) / 10} semanas`),
      nm: rate(mapOk ? mappers : null, mapOk, `${mappers} pessoas cadastraram`),
      a: rate(aN ? aLeads / aN : null, aN >= MINIMUMS.mappedPeople && aLeads >= MINIMUMS.mappedLeads, `${aN} pessoas mapeadas, ${aLeads} viraram atendimento em até 30 dias`),
      nv: rate(leadWeeksOk ? nvCount : null, leadWeeksOk, `${nvCount} pessoas com atendimento novo nas últimas 8 semanas`),
      kv: rate(leadWeeksOk && kvBest > 0 ? kvBest : null, leadWeeksOk && kvBest > 0, "melhor semana de uma pessoa nos últimos 90 dias"),
      C: rate(C, C >= MINIMUMS.clients, `${C} clientes com pagamento`),
      r: rate(C > 0 && leadWeeksOk ? indN / weeks / C : null, C >= MINIMUMS.clients && indN >= MINIMUMS.referrals && leadWeeksOk, `${indN} indicações em ${Math.round(weeks * 10) / 10} semanas, ${C} clientes`),
      cplCents: scope.ownerEmail ? noData("") : rate(mediaLeads ? costCents / mediaLeads : null, costCents > 0 && mediaLeads >= MINIMUMS.mediaLeads, `${mediaLeads} atendimentos de mídia nos 3 últimos meses fechados`),
    },
    organicGoal: num(settings.organic_goal_percent),
    excluded: { importedLeads: num(excluded[0]?.imported), consolidatedCities: consolidated.length, peopleWithoutOrigin: num(excluded[0]?.noorigin) },
  };
}

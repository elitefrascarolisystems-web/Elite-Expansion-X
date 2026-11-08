/*
 * Metas com período (fonte única: tabela `goals`).
 * - applyGoal / splitGoal: as únicas gravações ("Aplicar como meta" e "Dividir pela equipe").
 * - goalProgress: a única leitura do realizado, usada pela Calculadora, pelo cartão "Quanto falta" de Hoje,
 *   pelas linhas de Metas e rotina e pela coluna "Meta" de Saúde das cidades.
 * Realizado pela data do pagamento; cidade em Consolidado pelos fechamentos consolidados do período.
 * De quem é cada venda: do responsável da oportunidade; sem oportunidade, de quem está com o atendimento;
 * sem ninguém (ou alguém que não é login ativo da equipe): "sem responsável", fora da meta de cada pessoa.
 */
import { brazilTimestamp, database } from "@/db/runtime";
import { brazilToday, dayOf } from "@/db/calculator";
import { addDays, daysBetween, firstOfMonth } from "@/lib/goal-calculator";
import { applyInput, GOAL_CONFLICT, ONLY_MANAGEMENT, splitInput, SALES_METRICS, weekOf, weeklyTarget, type Goal, type GoalMetricAny, type GoalScope } from "@/lib/goals";
import type { AccessView } from "@/lib/expansion-types";

export class GoalError extends Error { constructor(message: string, public status = 400) { super(message); } }

type Row = Record<string, unknown>;
type Value = string | number | null;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const all = async (sql: string, args: Value[] = []) => (await database().prepare(sql).bind(...args).all()).results as Row[];

const IMPORTED = "Importação da rede por planilha";
const VALID = "('Lead válido','Oportunidade')";
const TEAM = "('Administrador','Coordenação','Líder','Comercial')";
/** Responsável do atendimento: o da oportunidade; sem oportunidade, quem está com ele na Agenda. */
const OWNER_OF = "lower(COALESCE(NULLIF((SELECT o.owner_email FROM opportunities o WHERE o.lead_id = l.id LIMIT 1), ''), l.assigned_to_email, ''))";
const PAID_DAY = dayOf("s.paid_at");
const LEAD_DAY = dayOf("l.created_at");
const MAPPED_DAY = dayOf("p.created_at");

function readable(a: AccessView) {
  if (!a.active || ["Embaixador", "Mentorado"].includes(a.role)) throw new GoalError("Seu perfil não possui acesso comercial.", 403);
  if ((a.role === "Coordenação" || a.role === "Líder") && !a.cityId) throw new GoalError("Sem cidade definida para o seu acesso.", 403);
}

const toGoal = (r: Row): Goal => ({
  id: String(r.id), scope: String(r.scope) as GoalScope, cityId: r.city_id === null ? null : Number(r.city_id), ownerEmail: String(r.owner_email ?? ""),
  metric: String(r.metric) as GoalMetricAny, target: num(r.target), periodStart: String(r.period_start), periodEnd: String(r.period_end),
  status: String(r.status) as Goal["status"], version: num(r.version), createdAt: String(r.created_at),
});

/** Metas visíveis para a função: Administrador tudo; Coordenação e Líder, a cidade; Comercial, as dele. */
export async function listGoals(a: AccessView, opts: { history?: boolean } = {}): Promise<Goal[]> {
  readable(a);
  const where = ["organization_id = ?"]; const args: Value[] = [a.organizationId];
  if (!opts.history) where.push("status = 'Ativa'");
  if (a.role === "Comercial") { where.push("scope = 'Pessoa' AND lower(owner_email) = ?"); args.push(a.email.toLowerCase()); }
  else if (a.role !== "Administrador") { where.push("city_id = ?"); args.push(a.cityId!); }
  return (await all(`SELECT * FROM goals WHERE ${where.join(" AND ")} ORDER BY period_end DESC, created_at DESC LIMIT 1000`, args)).map(toGoal);
}

type Measure = { value: number; consolidated: boolean };
/** Mede uma métrica num período, agrupando por cidade (com o total da empresa) ou por pessoa dentro de uma cidade. */
async function measure(org: number, metric: GoalMetricAny, start: string, endRaw: string, today: string, by: "city" | "owner", cityId?: number | null) {
  const end = endRaw < today ? endRaw : today;
  const out = new Map<string, Measure>();
  if (end < start) return out;
  const add = (key: string, value: number, consolidated = false) => { const cur = out.get(key) ?? { value: 0, consolidated: false }; out.set(key, { value: cur.value + value, consolidated: cur.consolidated || consolidated }); };
  const detailed = (alias: string) => cityId
    ? { sql: `${alias}.city_id = ? AND ${alias}.city_id IN (SELECT id FROM cities WHERE organization_id = ? AND tracking_mode <> 'Consolidado')`, args: [cityId, org] as Value[] }
    : { sql: `${alias}.city_id IN (SELECT id FROM cities WHERE organization_id = ? AND tracking_mode <> 'Consolidado')`, args: [org] as Value[] };
  const key = by === "city" ? (alias: string) => `${alias}.city_id` : () => OWNER_OF;
  if (metric === "Vendas pagas" || metric === "Receita confirmada") {
    const f = detailed("s");
    const rows = await all(`SELECT ${by === "city" ? "s.city_id" : OWNER_OF} AS k, ${metric === "Vendas pagas" ? "COUNT(*)" : "COALESCE(SUM(s.amount_cents),0)"} AS n FROM sales s LEFT JOIN leads l ON l.id = s.lead_id WHERE s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND ${PAID_DAY} BETWEEN ? AND ? AND ${f.sql} GROUP BY k`, [start, end, ...f.args]);
    rows.forEach((r) => add(String(r.k ?? ""), num(r.n)));
  } else if (metric === "Atendimentos") {
    const f = detailed("l");
    const rows = await all(`SELECT ${key("l")} AS k, COUNT(*) AS n FROM leads l WHERE l.status IN ${VALID} AND l.source_label <> ? AND ${LEAD_DAY} BETWEEN ? AND ? AND ${f.sql} GROUP BY k`, [IMPORTED, start, end, ...f.args]);
    rows.forEach((r) => add(String(r.k ?? ""), num(r.n)));
  } else {
    const f = detailed("p");
    const rows = await all(`SELECT ${by === "city" ? "p.city_id" : "lower(p.created_by)"} AS k, COUNT(*) AS n FROM territory_people p WHERE p.source = 'Mapeamento' AND ${MAPPED_DAY} BETWEEN ? AND ? AND ${f.sql} GROUP BY k`, [start, end, ...f.args]);
    rows.forEach((r) => add(String(r.k ?? ""), num(r.n)));
  }
  // Cidades em Consolidado: a soma dos fechamentos dos meses do período (só por cidade; pessoas ficam fora).
  if (by === "city" && metric !== "Pessoas mapeadas") {
    const column = metric === "Vendas pagas" ? "u.sales" : metric === "Receita confirmada" ? "u.revenue_cents" : "u.leads";
    const rows = await all(`SELECT c.id AS k, COALESCE(SUM(${column}),0) AS n FROM city_updates u JOIN cities c ON c.id = u.city_id WHERE c.organization_id = ? ${cityId ? "AND c.id = ?" : ""} AND c.tracking_mode = 'Consolidado' AND u.period BETWEEN ? AND ? GROUP BY c.id`, [org, ...(cityId ? [cityId] : []), start.slice(0, 7), end.slice(0, 7)]);
    rows.forEach((r) => add(String(r.k), num(r.n), true));
  }
  return out;
}

/** Vendas sem responsável (ou com responsável que não é login ativo da equipe), por cidade. */
async function unowned(org: number, start: string, endRaw: string, today: string) {
  const end = endRaw < today ? endRaw : today;
  if (end < start) return new Map<number, number>();
  const rows = await all(`SELECT s.city_id AS k, COUNT(*) AS n FROM sales s LEFT JOIN leads l ON l.id = s.lead_id WHERE s.status = 'Pagamento confirmado' AND s.paid_at IS NOT NULL AND ${PAID_DAY} BETWEEN ? AND ? AND s.city_id IN (SELECT id FROM cities WHERE organization_id = ? AND tracking_mode <> 'Consolidado') AND (${OWNER_OF} = '' OR ${OWNER_OF} NOT IN (SELECT lower(email) FROM app_users WHERE organization_id = ? AND active = 1 AND role IN ${TEAM})) GROUP BY s.city_id`, [start, end, org, org]);
  return new Map(rows.map((r) => [num(r.k), num(r.n)]));
}

export type GoalLine = Goal & { realized: number; consolidated: boolean };
export type PersonLine = { email: string; name: string; cityId: number | null; sales: GoalLine | null; leads: GoalLine | null; people: GoalLine | null; week: { done: number; target: number } | null };
export type GoalProgress = {
  today: string;
  company: { goal: GoalLine | null; sum: { target: number; realized: number; metric: GoalMetricAny; withGoal: number; cities: number; periodEnd: string } | null };
  cities: { cityId: number; name: string; consolidated: boolean; goal: GoalLine | null; plan: GoalLine[] }[];
  people: PersonLine[];
  unowned: number;
};

/** Meta "do momento" de uma lista: a ativa que cobre hoje; vendas pagas primeiro. */
const current = (list: Goal[], today: string, metrics: GoalMetricAny[]) => list
  .filter((g) => g.status === "Ativa" && metrics.includes(g.metric) && g.periodStart <= today && today <= g.periodEnd)
  .sort((x, y) => metrics.indexOf(x.metric) - metrics.indexOf(y.metric))[0] ?? null;

/** A única leitura do progresso das metas, no escopo de quem pede. */
export async function goalProgress(a: AccessView, opts: { today?: string } = {}): Promise<GoalProgress> {
  readable(a);
  const today = opts.today ?? brazilToday();
  const org = a.organizationId;
  const goals = (await listGoals(a)).filter((g) => g.periodStart <= today && today <= g.periodEnd);
  const cityRows = await all(`SELECT id, name, tracking_mode FROM cities WHERE organization_id = ? ${a.role === "Administrador" ? "" : "AND id = ?"} ORDER BY name LIMIT 500`, a.role === "Administrador" ? [org] : [org, a.cityId ?? 0]);

  // Realizado por grupo (métrica + período + agrupamento): poucas consultas, nunca uma por meta.
  const cache = new Map<string, Map<string, Measure>>();
  const measured = async (g: Goal): Promise<Measure> => {
    const by = g.scope === "Pessoa" ? "owner" : "city";
    const key = [g.metric, g.periodStart, g.periodEnd, by, by === "owner" ? g.cityId : ""].join("|");
    if (!cache.has(key)) cache.set(key, await measure(org, g.metric, g.periodStart, g.periodEnd, today, by, by === "owner" ? g.cityId : null));
    const m = cache.get(key)!;
    if (g.scope === "Pessoa") return m.get(g.ownerEmail.toLowerCase()) ?? { value: 0, consolidated: false };
    if (g.scope === "Cidade") return m.get(String(g.cityId)) ?? { value: 0, consolidated: cityRows.some((c) => Number(c.id) === g.cityId && c.tracking_mode === "Consolidado") };
    let value = 0, consolidated = false; for (const v of m.values()) { value += v.value; consolidated ||= v.consolidated; } return { value, consolidated };
  };
  const line = async (g: Goal | null): Promise<GoalLine | null> => g ? { ...g, ...(await measured(g)), realized: (await measured(g)).value } : null;

  const cities = [];
  for (const c of cityRows) {
    const mine = goals.filter((g) => g.scope === "Cidade" && g.cityId === Number(c.id));
    cities.push({
      cityId: Number(c.id), name: String(c.name), consolidated: c.tracking_mode === "Consolidado",
      goal: await line(current(mine, today, SALES_METRICS)),
      plan: (await Promise.all(mine.filter((g) => g.metric === "Atendimentos" || g.metric === "Pessoas mapeadas").map(line))).filter(Boolean) as GoalLine[],
    });
  }

  let company: GoalProgress["company"] = { goal: null, sum: null };
  if (a.role === "Administrador") {
    const companyGoal = await line(current(goals.filter((g) => g.scope === "Empresa"), today, SALES_METRICS));
    if (companyGoal) company = { goal: companyGoal, sum: null };
    else {
      const withGoal = cities.filter((c) => c.goal);
      const metric = withGoal.some((c) => c.goal!.metric === "Vendas pagas") ? "Vendas pagas" : "Receita confirmada";
      const same = withGoal.filter((c) => c.goal!.metric === metric);
      if (same.length) company = { goal: null, sum: { metric, target: same.reduce((s, c) => s + c.goal!.target, 0), realized: same.reduce((s, c) => s + c.goal!.realized, 0), withGoal: same.length, cities: cityRows.length, periodEnd: same.map((c) => c.goal!.periodEnd).sort().at(-1)! } };
    }
  }

  // Linhas por pessoa: só a gestão vê as de todos; o Comercial vê só a dele.
  const memberWhere = a.role === "Administrador" ? "1=1" : a.role === "Comercial" ? "lower(email) = ?" : `(city_id = ? OR (city_id IS NULL AND role IN ('Administrador','Comercial')))`;
  const members = await all(`SELECT email, name, city_id FROM app_users WHERE organization_id = ? AND active = 1 AND role IN ${TEAM} AND ${memberWhere} ORDER BY name LIMIT 500`, [org, ...(a.role === "Administrador" ? [] : [a.role === "Comercial" ? a.email.toLowerCase() : a.cityId!])]);
  const personGoals = goals.filter((g) => g.scope === "Pessoa");
  const week = weekOf(today);
  const people: PersonLine[] = [];
  for (const m of members) {
    const email = String(m.email).toLowerCase();
    const own = personGoals.filter((g) => g.ownerEmail.toLowerCase() === email);
    if (!own.length && a.role === "Comercial") { people.push({ email, name: String(m.name), cityId: m.city_id === null ? null : Number(m.city_id), sales: null, leads: null, people: null, week: null }); continue; }
    if (!own.length) continue;
    const leadsGoal = current(own, today, ["Atendimentos"]);
    let weekLine: PersonLine["week"] = null;
    const weekTarget = leadsGoal ? weeklyTarget(leadsGoal, today) : null;
    if (leadsGoal && weekTarget !== null) {
      const done = await measure(org, "Atendimentos", week.start, week.end, today, "owner", leadsGoal.cityId);
      weekLine = { done: done.get(email)?.value ?? 0, target: weekTarget };
    }
    people.push({ email, name: String(m.name), cityId: own[0].cityId, sales: await line(current(own, today, SALES_METRICS)), leads: await line(leadsGoal), people: await line(current(own, today, ["Pessoas mapeadas"])), week: weekLine });
  }

  let unownedCount = 0;
  if (a.role !== "Comercial") {
    const ref = company.goal ?? cities.find((c) => c.goal)?.goal ?? null;
    const start = ref?.periodStart ?? firstOfMonth(today), end = ref?.periodEnd ?? today;
    const map = await unowned(org, start, end, today);
    unownedCount = cityRows.reduce((s, c) => s + (map.get(Number(c.id)) ?? 0), 0);
  }
  return { today, company, cities, people, unowned: unownedCount };
}

/** Premissas que a gestão gravou ao aplicar a meta da cidade (ou da empresa), só as que o Comercial usa e sem a base. */
export async function managementPremises(a: AccessView, today = brazilToday()) {
  if (a.role !== "Comercial") return {};
  const rows = await all(`SELECT assumptions_json FROM goals WHERE organization_id = ? AND status = 'Ativa' AND metric IN ('Vendas pagas','Receita confirmada') AND period_start <= ? AND period_end >= ? AND ((scope = 'Cidade' AND city_id = ?) OR scope = 'Empresa') ORDER BY CASE scope WHEN 'Cidade' THEN 0 ELSE 1 END LIMIT 1`, [a.organizationId, today, today, a.cityId ?? 0]);
  if (!rows[0]) return {};
  let snap: Record<string, { value?: unknown }> = {};
  try { snap = JSON.parse(String(rows[0].assumptions_json || "{}")); } catch { snap = {}; }
  const pick = (k: string) => { const v = snap[k]?.value; return typeof v === "number" && Number.isFinite(v) ? v : null; };
  const out: Record<string, number> = {};
  for (const k of ["ticketCents", "c", "m", "a"]) { const v = pick(k); if (v !== null) out[k] = v; }
  return out;
}

/** O que cada pessoa da cidade fez nas últimas 8 semanas, para preencher "Dividir pela equipe". */
export async function splitBase(a: AccessView, cityId: number, today = brazilToday()) {
  canWrite(a, "split", cityId);
  const org = a.organizationId;
  const members = await all(`SELECT email, name FROM app_users WHERE organization_id = ? AND active = 1 AND role IN ${TEAM} AND (city_id = ? OR (city_id IS NULL AND role IN ('Administrador','Comercial'))) ORDER BY name LIMIT 200`, [org, cityId]);
  const from = addDays(today, -55);
  const [sales, leads, mapped] = await Promise.all([
    measure(org, "Vendas pagas", from, today, today, "owner", cityId),
    measure(org, "Atendimentos", from, today, today, "owner", cityId),
    measure(org, "Pessoas mapeadas", from, today, today, "owner", cityId),
  ]);
  return members.map((m) => { const e = String(m.email).toLowerCase(); return { email: e, name: String(m.name), sales: sales.get(e)?.value ?? 0, leads: leads.get(e)?.value ?? 0, people: mapped.get(e)?.value ?? 0, maps: (mapped.get(e)?.value ?? 0) > 0 }; });
}

function canWrite(a: AccessView, action: "apply" | "split", cityId: number | null) {
  if (!a.active || ["Embaixador", "Mentorado"].includes(a.role)) throw new GoalError("Seu perfil não possui acesso comercial.", 403);
  if (a.role === "Comercial") throw new GoalError(ONLY_MANAGEMENT, 403);
  if (a.role === "Líder" && action === "apply") throw new GoalError("O Líder divide pela equipe uma meta já aplicada na cidade; quem aplica a meta é a Coordenação ou o Administrador.", 403);
  if (a.role !== "Administrador") {
    if (!a.cityId) throw new GoalError("Sem cidade definida para o seu acesso.", 403);
    if (cityId !== a.cityId) throw new GoalError("Cidade fora do seu acesso.", 403);
  }
}

/** Condição de sobreposição (mesmo escopo, mesma métrica, períodos que se cruzam) para um conjunto de metas novas. */
type NewGoal = { scope: GoalScope; cityId: number | null; ownerEmail: string; metric: GoalMetricAny; periodStart: string; periodEnd: string };
function overlapSql(list: NewGoal[]) {
  // Agrupa por (escopo, cidade, métrica, período): a divisão pela equipe vira uma condição por métrica, não uma por pessoa.
  const groups = new Map<string, { g: NewGoal; owners: Set<string> }>();
  for (const g of list) { const k = [g.scope, g.cityId, g.metric, g.periodStart, g.periodEnd].join("|"); const cur = groups.get(k) ?? { g, owners: new Set() }; cur.owners.add(g.ownerEmail.toLowerCase()); groups.set(k, cur); }
  const parts: string[] = []; const args: Value[] = [];
  for (const { g } of groups.values()) {
    parts.push(`(g.scope = ? AND ${g.cityId === null ? "g.city_id IS NULL" : "g.city_id = ?"} AND g.metric = ? AND g.period_start <= ? AND g.period_end >= ?)`);
    args.push(g.scope, ...(g.cityId === null ? [] : [g.cityId]), g.metric, g.periodEnd, g.periodStart);
  }
  return { sql: `(${parts.join(" OR ")})`, args };
}

async function write(a: AccessView, list: NewGoal[], targets: number[], assumptions: string, replace: { id: string; version: number }[], auditAction: string, summary: string, alsoReplaces: NewGoal[] = []) {
  const db = database(), now = brazilTimestamp(), org = a.organizationId;
  const overlap = overlapSql([...list, ...alsoReplaces]);
  // As metas ativas que se sobrepõem agora precisam ser exatamente as que a pessoa confirmou substituir (com a versão).
  const expected = replace.map((r) => `${r.id}:${r.version}`).sort().join(",");
  const current = (await all(`SELECT g.id, g.version FROM goals g WHERE g.organization_id = ? AND g.status = 'Ativa' AND ${overlap.sql} ORDER BY g.id`, [org, ...overlap.args]));
  if (current.map((r) => `${r.id}:${r.version}`).sort().join(",") !== expected) throw new GoalError(GOAL_CONFLICT, 409);
  const batchId = crypto.randomUUID();
  const statements = [
    // 1º: a anterior vira "Substituída" só se o conjunto ainda é o mesmo (id e versão).
    db.prepare(`UPDATE goals SET status = 'Substituída', version = version + 1, updated_at = ? WHERE organization_id = ? AND status = 'Ativa' AND id IN (SELECT g.id FROM goals g WHERE g.organization_id = ? AND g.status = 'Ativa' AND ${overlap.sql}) AND (SELECT COALESCE(group_concat(k, ','), '') FROM (SELECT g.id || ':' || g.version AS k FROM goals g WHERE g.organization_id = ? AND g.status = 'Ativa' AND ${overlap.sql} ORDER BY g.id)) = ?`)
      .bind(now, org, org, ...overlap.args, org, ...overlap.args, expected),
  ];
  // Cada meta nova só entra se não sobrou nenhuma meta ativa sobreposta (fora as deste lote).
  list.forEach((g, i) => statements.push(db.prepare(`INSERT INTO goals(id, organization_id, scope, city_id, owner_email, metric, target, period_start, period_end, assumptions_json, status, version, created_by, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativa', 1, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM goals g WHERE g.organization_id = ? AND g.status = 'Ativa' AND g.id NOT LIKE ? AND ${overlap.sql})`)
    .bind(`${batchId}-${i + 1}`, org, g.scope, g.cityId, g.ownerEmail.toLowerCase(), g.metric, targets[i], g.periodStart, g.periodEnd, i === 0 ? assumptions : "{}", a.email.toLowerCase(), now, now, org, `${batchId}-%`, ...overlap.args)));
  statements.push(db.prepare("INSERT INTO audit_logs(organization_id, actor_email, action, entity_type, entity_id, summary, created_at) SELECT ?, ?, ?, 'goal', ?, ?, ? WHERE changes() > 0").bind(org, a.email, auditAction, `${batchId}-1`, summary, now));
  const result = await db.batch(statements);
  if (!num(result[1]?.meta?.changes)) throw new GoalError(GOAL_CONFLICT, 409);
  return { ids: list.map((_, i) => `${batchId}-${i + 1}`) };
}

/** "Aplicar como meta": a meta de vendas (ou receita) e, se pedido, o plano de atendimentos e pessoas mapeadas até a data de começar. */
export async function applyGoal(a: AccessView, raw: unknown, today = brazilToday()) {
  const v = applyInput.parse(raw);
  canWrite(a, "apply", v.cityId);
  if (v.cityId !== null && !(await all("SELECT id FROM cities WHERE id = ? AND organization_id = ?", [v.cityId, a.organizationId]))[0]) throw new GoalError("Cidade fora do seu acesso.", 403);
  if (v.periodEnd < today) throw new GoalError("O período da meta já terminou. Escolha uma data a partir de hoje.");
  if (daysBetween(v.periodStart, v.periodEnd) > 366) throw new GoalError("Use um período de até 1 ano.");
  const scope: GoalScope = v.cityId === null ? "Empresa" : "Cidade";
  const list: NewGoal[] = [{ scope, cityId: v.cityId, ownerEmail: "", metric: v.metric, periodStart: v.periodStart, periodEnd: v.periodEnd }];
  const targets = [v.target];
  if (v.plan) {
    if (v.plan.startBy < today || v.plan.startBy > v.periodEnd) throw new GoalError("A data de começar do plano precisa ficar entre hoje e o fim da meta.");
    list.push({ scope, cityId: v.cityId, ownerEmail: "", metric: "Atendimentos", periodStart: today, periodEnd: v.plan.startBy }); targets.push(v.plan.leads);
    if (v.plan.people !== null) { list.push({ scope, cityId: v.cityId, ownerEmail: "", metric: "Pessoas mapeadas", periodStart: today, periodEnd: v.plan.startBy }); targets.push(v.plan.people); }
  }
  const before = v.replace.length ? `${v.replace.length} meta(s) substituída(s)` : "sem meta anterior";
  const summary = `${scope === "Empresa" ? "Empresa" : `Cidade ${v.cityId}`}: ${v.metric} ${v.target} de ${v.periodStart} a ${v.periodEnd}${v.plan ? `; plano ${v.plan.leads} atendimentos${v.plan.people !== null ? ` e ${v.plan.people} pessoas mapeadas` : ""} até ${v.plan.startBy}` : ""} (${before}).`;
  return write(a, list, targets, JSON.stringify(v.assumptions), v.replace, "goal_apply", summary);
}

/** "Dividir pela equipe": uma meta por pessoa (vendas, atendimentos e pessoas mapeadas); a soma das vendas fecha com a meta da cidade. */
export async function splitGoal(a: AccessView, raw: unknown, today = brazilToday()) {
  const v = splitInput.parse(raw);
  const parent = (await all("SELECT * FROM goals WHERE id = ? AND organization_id = ? AND status = 'Ativa' AND scope = 'Cidade'", [v.goalId, a.organizationId]))[0];
  if (!parent) throw new GoalError("Aplique primeiro a meta da cidade na Calculadora.", 404);
  const goal = toGoal(parent);
  canWrite(a, "split", goal.cityId);
  if (!SALES_METRICS.includes(goal.metric)) throw new GoalError("Divida a meta de vendas pagas ou de receita da cidade.");
  if (goal.periodEnd < today) throw new GoalError("O período desta meta já terminou.");
  const total = v.rows.reduce((s, r) => s + r.sales, 0);
  if (total !== goal.target) throw new GoalError(`A soma da equipe (${total}) precisa fechar com a meta da cidade (${goal.target}).`);
  const emails = v.rows.map((r) => r.email.toLowerCase());
  if (new Set(emails).size !== emails.length) throw new GoalError("Cada pessoa aparece uma vez só.");
  const members = new Set((await all(`SELECT lower(email) AS e FROM app_users WHERE organization_id = ? AND active = 1 AND role IN ${TEAM} AND (city_id = ? OR (city_id IS NULL AND role IN ('Administrador','Comercial')))`, [a.organizationId, goal.cityId])).map((r) => String(r.e)));
  if (emails.some((e) => !members.has(e))) throw new GoalError("Divida só entre pessoas ativas da equipe desta cidade.");
  // O plano da cidade (se gravado) dá o período de atendimentos e pessoas mapeadas; sem plano, o período da meta.
  const plan = (await all("SELECT metric, period_start, period_end FROM goals WHERE organization_id = ? AND status = 'Ativa' AND scope = 'Cidade' AND city_id = ? AND metric IN ('Atendimentos','Pessoas mapeadas') AND period_end >= ? AND period_start <= ?", [a.organizationId, goal.cityId, today, goal.periodEnd]));
  const planPeriod = (metric: string) => { const p = plan.find((r) => r.metric === metric) ?? plan[0]; return p ? { start: String(p.period_start) < today ? today : String(p.period_start), end: String(p.period_end) } : { start: today < goal.periodStart ? goal.periodStart : today, end: goal.periodEnd }; };
  const list: NewGoal[] = [], targets: number[] = [];
  for (const r of v.rows) {
    const email = r.email.toLowerCase();
    list.push({ scope: "Pessoa", cityId: goal.cityId, ownerEmail: email, metric: goal.metric, periodStart: goal.periodStart, periodEnd: goal.periodEnd }); targets.push(r.sales);
    if (r.leads !== null) { const p = planPeriod("Atendimentos"); list.push({ scope: "Pessoa", cityId: goal.cityId, ownerEmail: email, metric: "Atendimentos", periodStart: p.start, periodEnd: p.end }); targets.push(r.leads); }
    if (r.people !== null) { const p = planPeriod("Pessoas mapeadas"); list.push({ scope: "Pessoa", cityId: goal.cityId, ownerEmail: email, metric: "Pessoas mapeadas", periodStart: p.start, periodEnd: p.end }); targets.push(r.people); }
  }
  const summary = `Cidade ${goal.cityId}: ${goal.metric} ${goal.target} dividida entre ${v.rows.length} pessoa(s) (${v.rows.map((r) => r.sales).join(" + ")})${v.replace.length ? `; ${v.replace.length} meta(s) por pessoa substituída(s)` : ""}.`;
  // Dividir de novo substitui todas as metas por pessoa desta cidade no período (vendas, atendimentos e pessoas mapeadas),
  // mesmo de quem saiu da divisão; a meta da cidade continua ativa.
  const span = { start: today < goal.periodStart ? today : goal.periodStart, end: goal.periodEnd };
  const all3: NewGoal[] = [goal.metric, "Atendimentos", "Pessoas mapeadas"].map((metric) => ({ scope: "Pessoa", cityId: goal.cityId, ownerEmail: "", metric: metric as GoalMetricAny, periodStart: span.start, periodEnd: span.end }));
  return write(a, list, targets, "{}", v.replace, "goal_split", summary, all3);
}

/** "Metas anteriores" da empresa ou de uma cidade, com o realizado recalculado agora. */
export async function goalHistory(a: AccessView, cityId: number | null, today = brazilToday()) {
  readable(a);
  if (a.role === "Comercial") return [];
  const scopeCity = a.role === "Administrador" ? cityId : a.cityId;
  const rows = (await all(`SELECT * FROM goals WHERE organization_id = ? AND scope = ? AND ${scopeCity === null ? "city_id IS NULL" : "city_id = ?"} AND metric IN ('Vendas pagas','Receita confirmada') AND (status = 'Substituída' OR period_end < ?) ORDER BY period_end DESC, created_at DESC LIMIT 12`, [a.organizationId, scopeCity === null ? "Empresa" : "Cidade", ...(scopeCity === null ? [] : [scopeCity]), today])).map(toGoal);
  const out = [];
  for (const g of rows) {
    const m = await measure(a.organizationId, g.metric, g.periodStart, g.periodEnd, today, "city", g.cityId);
    let value = 0; for (const [k, v] of m) if (g.cityId === null || k === String(g.cityId)) value += v.value;
    out.push({ ...g, realized: value });
  }
  return out;
}

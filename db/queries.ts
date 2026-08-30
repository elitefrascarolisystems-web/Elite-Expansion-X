import { env } from "cloudflare:workers";
import type {
  AmbassadorView,
  CityView,
  DashboardData,
  RecentUpdate,
} from "@/lib/expansion-types";

function database() {
  if (!env.DB) throw new Error("Banco de dados indisponível.");
  return env.DB;
}

function number(value: unknown) {
  return Number(value ?? 0);
}

export async function ensureInitialCities(createdBy: string) {
  const db = database();
  const count = await db.prepare("SELECT COUNT(*) AS total FROM cities").all();
  if (number(count.results[0]?.total) > 0) return;

  const insert = `
    INSERT INTO cities
      (name, state, phase, leader_name, target_cac_cents, ambassador_goal, sales_goal, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await db.batch([
    db.prepare(insert).bind("Esmeraldas", "MG", "Piloto", "", 0, 10, 100, "Ativa", createdBy),
    db.prepare(insert).bind("Belo Horizonte", "MG", "Preparação", "", 0, 10, 100, "Planejada", createdBy),
    db.prepare(insert).bind("Contagem", "MG", "Preparação", "", 0, 10, 100, "Planejada", createdBy),
    db.prepare(insert).bind("Betim", "MG", "Em espera", "", 0, 10, 100, "Planejada", createdBy),
  ]);
}

export async function getDashboardData(createdBy: string): Promise<DashboardData> {
  await ensureInitialCities(createdBy);
  const db = database();

  const citiesResult = await db.prepare(`
    SELECT
      c.id, c.name, c.state, c.phase, c.leader_name, c.target_cac_cents,
      c.ambassador_goal, c.sales_goal, c.status,
      COALESCE(a.total, 0) AS ambassadors,
      COALESCE(a.active, 0) AS active_ambassadors,
      COALESCE(m.reach, 0) AS reach,
      COALESCE(m.leads, 0) AS leads,
      COALESCE(m.organic_leads, 0) AS organic_leads,
      COALESCE(m.sales, 0) AS sales,
      COALESCE(m.revenue_cents, 0) AS revenue_cents,
      COALESCE(m.cost_cents, 0) AS cost_cents,
      COALESCE(m.partners, 0) AS partners,
      COALESCE(m.events, 0) AS events
    FROM cities c
    LEFT JOIN (
      SELECT city_id, COUNT(*) AS total,
        SUM(CASE WHEN status IN ('Ativo', 'Líder local') THEN 1 ELSE 0 END) AS active
      FROM ambassadors GROUP BY city_id
    ) a ON a.city_id = c.id
    LEFT JOIN (
      SELECT city_id, SUM(reach) AS reach, SUM(leads) AS leads,
        SUM(organic_leads) AS organic_leads, SUM(sales) AS sales,
        SUM(revenue_cents) AS revenue_cents, SUM(cost_cents) AS cost_cents,
        SUM(partners) AS partners, SUM(events) AS events
      FROM city_updates GROUP BY city_id
    ) m ON m.city_id = c.id
    ORDER BY CASE c.phase WHEN 'Piloto' THEN 1 WHEN 'Ativa' THEN 2 WHEN 'Preparação' THEN 3 ELSE 4 END, c.name
  `).all();

  const ambassadorsResult = await db.prepare(`
    SELECT
      a.id, a.city_id, c.name AS city_name, a.name, a.code, a.whatsapp,
      a.level, a.status, COALESCE(u.leads, 0) AS leads,
      COALESCE(u.sales, 0) AS sales, COALESCE(u.cost_cents, 0) AS cost_cents,
      u.last_activity
    FROM ambassadors a
    JOIN cities c ON c.id = a.city_id
    LEFT JOIN (
      SELECT ambassador_id, SUM(leads) AS leads, SUM(sales) AS sales,
        SUM(cost_cents) AS cost_cents, MAX(created_at) AS last_activity
      FROM ambassador_updates GROUP BY ambassador_id
    ) u ON u.ambassador_id = a.id
    ORDER BY CASE a.status WHEN 'Líder local' THEN 1 WHEN 'Ativo' THEN 2 ELSE 3 END, a.name
  `).all();

  const recentResult = await db.prepare(`
    SELECT u.id, c.name AS city_name, u.period, u.leads, u.sales,
      u.cost_cents, u.created_at
    FROM city_updates u
    JOIN cities c ON c.id = u.city_id
    ORDER BY u.id DESC LIMIT 8
  `).all();

  const cities: CityView[] = citiesResult.results.map((row) => ({
    id: number(row.id), name: String(row.name), state: String(row.state),
    phase: String(row.phase), leaderName: String(row.leader_name ?? ""),
    targetCacCents: number(row.target_cac_cents), ambassadorGoal: number(row.ambassador_goal),
    salesGoal: number(row.sales_goal), status: String(row.status), ambassadors: number(row.ambassadors),
    activeAmbassadors: number(row.active_ambassadors), reach: number(row.reach), leads: number(row.leads),
    organicLeads: number(row.organic_leads), sales: number(row.sales), revenueCents: number(row.revenue_cents),
    costCents: number(row.cost_cents), partners: number(row.partners), events: number(row.events),
  }));

  const ambassadors: AmbassadorView[] = ambassadorsResult.results.map((row) => ({
    id: number(row.id), cityId: number(row.city_id), cityName: String(row.city_name),
    name: String(row.name), code: String(row.code), whatsapp: String(row.whatsapp ?? ""),
    level: String(row.level), status: String(row.status), leads: number(row.leads),
    sales: number(row.sales), costCents: number(row.cost_cents),
    lastActivity: row.last_activity ? String(row.last_activity) : null,
  }));

  const recentUpdates: RecentUpdate[] = recentResult.results.map((row) => ({
    id: number(row.id), cityName: String(row.city_name), period: String(row.period),
    leads: number(row.leads), sales: number(row.sales), costCents: number(row.cost_cents),
    createdAt: String(row.created_at),
  }));

  const summary = cities.reduce(
    (total, city) => ({
      plannedCities: total.plannedCities + 1,
      activeCities: total.activeCities + (city.status === "Ativa" ? 1 : 0),
      activeAmbassadors: total.activeAmbassadors + city.activeAmbassadors,
      leads: total.leads + city.leads,
      sales: total.sales + city.sales,
      revenueCents: total.revenueCents + city.revenueCents,
      costCents: total.costCents + city.costCents,
      organicLeads: total.organicLeads + city.organicLeads,
    }),
    { plannedCities: 0, activeCities: 0, activeAmbassadors: 0, leads: 0, sales: 0, revenueCents: 0, costCents: 0, organicLeads: 0 },
  );

  return { cities, ambassadors, recentUpdates, summary };
}

export async function createCity(input: Record<string, unknown>, createdBy: string) {
  const db = database();
  await db.prepare(`
    INSERT INTO cities
      (name, state, phase, leader_name, target_cac_cents, ambassador_goal, sales_goal, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    String(input.name), String(input.state || "MG"), String(input.phase || "Preparação"),
    String(input.leaderName || ""), number(input.targetCacCents), number(input.ambassadorGoal || 10),
    number(input.salesGoal || 100), String(input.status || "Planejada"), createdBy,
  ).run();
}

export async function createAmbassador(input: Record<string, unknown>, createdBy: string) {
  const db = database();
  await db.prepare(`
    INSERT INTO ambassadors (city_id, name, code, whatsapp, level, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    number(input.cityId), String(input.name), String(input.code).toUpperCase(),
    String(input.whatsapp || ""), String(input.level || "Indicador"),
    String(input.status || "Candidato"), createdBy,
  ).run();
}

export async function recordCityUpdate(input: Record<string, unknown>, createdBy: string) {
  const db = database();
  const cityId = number(input.cityId);
  const updateCity = db.prepare("UPDATE cities SET phase = ?, status = ? WHERE id = ?")
    .bind(String(input.phase || "Ativa"), String(input.status || "Ativa"), cityId);
  const insert = db.prepare(`
    INSERT INTO city_updates
      (city_id, period, reach, leads, organic_leads, sales, revenue_cents, cost_cents, partners, events, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    cityId, String(input.period), number(input.reach), number(input.leads), number(input.organicLeads),
    number(input.sales), number(input.revenueCents), number(input.costCents), number(input.partners),
    number(input.events), String(input.note || ""), createdBy,
  );
  await db.batch([updateCity, insert]);
}

export async function recordAmbassadorUpdate(input: Record<string, unknown>, createdBy: string) {
  const db = database();
  const ambassadorId = number(input.ambassadorId);
  const updateAmbassador = db.prepare("UPDATE ambassadors SET status = ?, level = ? WHERE id = ?")
    .bind(String(input.status || "Ativo"), String(input.level || "Embaixador ativo"), ambassadorId);
  const insert = db.prepare(`
    INSERT INTO ambassador_updates
      (ambassador_id, period, leads, sales, cost_cents, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    ambassadorId, String(input.period), number(input.leads), number(input.sales),
    number(input.costCents), String(input.note || ""), createdBy,
  );
  await db.batch([updateAmbassador, insert]);
}

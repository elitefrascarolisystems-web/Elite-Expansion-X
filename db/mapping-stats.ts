import { brazilTimestamp, database } from "@/db/runtime";
import type { AccessView, MappingStats } from "@/lib/expansion-types";

const rows = async (sql: string, args: (string | number | null)[]) => (await database().prepare(sql).bind(...args).all()).results;
const num = (v: unknown) => Number(v ?? 0);

/**
 * Indicadores do mapeamento: o que cada cidade já tem no mapa e quanto cada pessoa
 * da equipe cadastrou. Só para a gestão; coordenação e liderança veem a própria cidade.
 */
export async function getMappingStats(access: AccessView): Promise<MappingStats | undefined> {
  if (!["Administrador", "Coordenação", "Líder"].includes(access.role)) return undefined;
  const cityId = access.role === "Administrador" ? null : access.cityId;
  if (access.role !== "Administrador" && cityId === null) return { cities: [], mappers: [] };
  const inScope = (column: string) => `${column} IN (SELECT id FROM cities WHERE organization_id=?) AND (? IS NULL OR ${column}=?)`;
  const scopeArgs = [access.organizationId, cityId, cityId];
  const weekAgo = brazilTimestamp(new Date(Date.now() - 7 * 86_400_000));

  const [cities, places, people, peopleBy, placesBy, team] = await Promise.all([
    rows(`SELECT id, name FROM cities WHERE ${inScope("id")} ORDER BY name`, scopeArgs),
    rows(`SELECT b.city_id, SUM(b.place_type<>'Empresa') AS hubs, SUM(b.place_type='Empresa') AS companies,
            SUM(EXISTS(SELECT 1 FROM territory_locations g WHERE g.entity_key='business:'||b.id AND g.validated=1)) AS validated
          FROM businesses b WHERE b.organization_id=? AND ${inScope("b.city_id")} GROUP BY b.city_id`, [access.organizationId, ...scopeArgs]),
    rows(`SELECT city_id, COUNT(*) AS people, COUNT(place_id) AS linked FROM territory_people WHERE ${inScope("city_id")} GROUP BY city_id`, scopeArgs),
    rows(`SELECT lower(created_by) AS email, COUNT(*) AS total, SUM(created_at>=?) AS week, MAX(created_at) AS last
          FROM territory_people WHERE ${inScope("city_id")} GROUP BY lower(created_by)`, [weekAgo, ...scopeArgs]),
    rows(`SELECT lower(created_by) AS email, COUNT(*) AS total, SUM(created_at>=?) AS week, MAX(created_at) AS last
          FROM businesses WHERE organization_id=? AND ${inScope("city_id")} GROUP BY lower(created_by)`, [weekAgo, access.organizationId, ...scopeArgs]),
    rows("SELECT lower(email) AS email, name FROM app_users WHERE organization_id=?", [access.organizationId]),
  ]);

  const byCity = <T extends Record<string, unknown>>(list: T[]) => new Map(list.map((row) => [num(row.city_id), row]));
  const placeMap = byCity(places), peopleMap = byCity(people);
  const names = new Map(team.map((row) => [String(row.email), String(row.name || row.email)]));

  const mappers = new Map<string, MappingStats["mappers"][number]>();
  const add = (row: Record<string, unknown>, field: "people" | "places") => {
    const email = String(row.email ?? "");
    if (!email || email === "github-actions") return;
    const current = mappers.get(email) ?? { email, name: names.get(email) ?? email, people: 0, places: 0, lastWeek: 0, lastAt: null };
    current[field] += num(row.total);
    current.lastWeek += num(row.week);
    const last = row.last ? String(row.last) : null;
    if (last && (!current.lastAt || last > current.lastAt)) current.lastAt = last;
    mappers.set(email, current);
  };
  peopleBy.forEach((row) => add(row, "people"));
  placesBy.forEach((row) => add(row, "places"));

  return {
    cities: cities.map((city) => {
      const p = placeMap.get(num(city.id)), q = peopleMap.get(num(city.id));
      return { cityId: num(city.id), cityName: String(city.name), hubs: num(p?.hubs), companies: num(p?.companies), validated: num(p?.validated), people: num(q?.people), linked: num(q?.linked) };
    }),
    mappers: [...mappers.values()].sort((x, y) => y.lastWeek - x.lastWeek || (y.people + y.places) - (x.people + x.places)),
  };
}

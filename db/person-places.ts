/*
 * Lugares de relacionamento, situação do lugar e plano de plantio (Etapa 5).
 * - Lugares: até 5 por pessoa contando o principal, só estabelecimentos cadastrados, com a autorização da
 *   pessoa a cada lugar e a regra dos setores sensíveis conferida pelo setor gravado no local.
 * - Remover apaga a linha, tira a pessoa das visitas daquele local e cancela as programadas.
 * - Visitas: ações "Visita" com o local, nome e responsável de listas fixas; sem hora, GPS, foto ou texto livre.
 * Auditoria sem nome e sem o local: "Registro territorial person:<id>." (ou action:<id> nas visitas).
 */
import { brazilTimestamp, database } from "@/db/runtime";
import { personScopeSql, PersonPageError } from "@/db/person-page";
import type { AccessView } from "@/lib/expansion-types";
import {
  countableLinkSql, linkNeedsReview, linkRefusal, sensitiveLink, MAX_PLACES, personPlaceInput, planInput, REFUSAL, removePlaceInput, stepLabel, visitInput,
} from "@/lib/person-places";
import { placeSituation, type PlaceSituation } from "@/lib/place-situation";
import { ANONYMOUS_LABEL } from "@/lib/privacy";

export class PlaceError extends Error { constructor(message: string, public status = 400) { super(message); } }

type Row = Record<string, unknown>;
type Value = string | number | null;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const all = async (sql: string, args: Value[] = []) => (await database().prepare(sql).bind(...args).all()).results as Row[];
const MANAGEMENT = ["Administrador", "Coordenação", "Líder"];
const TEAM = "('Administrador','Coordenação','Líder','Comercial')";
const today = () => brazilTimestamp().slice(0, 10);
const audit = (a: AccessView, action: string, key: string) => database().prepare("INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) VALUES(?,?,?,?,?,?)").bind(a.organizationId, a.email, action, "territory", `Registro territorial ${key}.`, brazilTimestamp());

function mapper(a: AccessView) {
  if (!a.active || !["Administrador", "Coordenação", "Líder", "Comercial"].includes(a.role)) throw new PlaceError("Seu perfil não pode mudar lugares nem visitas.", 403);
}

/** Pessoa no escopo de quem vê (o mesmo da página da pessoa); fora dele, 404 sem revelar. */
async function personInScope(a: AccessView, personId: string) {
  let s: { sql: string; args: Value[] };
  try { s = personScopeSql(a); } catch (e) { throw new PlaceError((e as Error).message, 403); }
  const p = (await all(`SELECT p.*,b.sector AS b_sector,COALESCE(NULLIF(b.place_type,''),'Empresa') AS b_type FROM territory_people p LEFT JOIN businesses b ON b.id=p.place_id WHERE p.id=? AND ${s.sql}`, [personId, ...s.args]))[0];
  if (!p) throw new PlaceError("Pessoa não encontrada ou fora do seu acesso.", 404);
  return p;
}

/** Local da mesma organização (e da cidade, quando pedida). */
async function placeOf(a: AccessView, businessId: string, cityId?: number) {
  const b = (await all(`SELECT id,city_id,name,sector,COALESCE(NULLIF(place_type,''),'Empresa') AS place_type,owner_email FROM businesses WHERE id=? AND organization_id=?`, [businessId, a.organizationId]))[0];
  if (!b) throw new PlaceError("Local não encontrado nesta empresa.", 404);
  if (cityId !== undefined && num(b.city_id) !== cityId) throw new PlaceError(REFUSAL.otherCity);
  if ((a.role === "Coordenação" || a.role === "Líder") && num(b.city_id) !== a.cityId) throw new PlaceError("Local fora do seu acesso.", 403);
  return b;
}

/** Pode ter lugares além do principal: autorização de contato vigente ou papel de Mentorado ou Embaixador ativo. */
export async function canHaveExtraPlaces(personId: string) {
  return !!(await all(`SELECT 1 FROM leads l WHERE l.person_id=? AND l.consent_revoked_at IS NULL AND l.status<>'Cancelado'
    UNION ALL SELECT 1 FROM territory_roles r WHERE r.person_id=? AND r.role IN ('Mentorado') AND r.status NOT IN ('Desligado','Inativo','Encerrado','Pausado')
    UNION ALL SELECT 1 FROM ambassadors m WHERE m.person_id=? AND m.status NOT IN ('Desligado','Pausado')
    UNION ALL SELECT 1 FROM app_users u WHERE u.person_id=? AND u.role='Mentorado' AND u.active=1 LIMIT 1`, [personId, personId, personId, personId]))[0];
}

/** Apaga lugares (um ou todos), tira a pessoa das visitas desses locais e cancela as programadas. */
export function clearPlacesStatements(personId: string, businessId: string | null, now: string) {
  const db = database(), only = businessId ? " AND business_id=?" : "", args = businessId ? [businessId] : [];
  return [
    db.prepare(`UPDATE territory_actions SET status='Cancelado',updated_at=? WHERE person_id=? AND status='Programado' AND business_id IS NOT NULL${only}`).bind(now, personId, ...args),
    db.prepare(`UPDATE territory_actions SET person_id=NULL,updated_at=? WHERE person_id=? AND business_id IS NOT NULL${only}`).bind(now, personId, ...args),
    db.prepare(`DELETE FROM person_places WHERE person_id=?${only}`).bind(personId, ...args),
  ];
}

export async function savePersonPlace(a: AccessView, raw: unknown) {
  mapper(a);
  const v = personPlaceInput.parse(raw), now = brazilTimestamp();
  const p = await personInScope(a, v.personId);
  const b = await placeOf(a, v.businessId, num(p.city_id));
  if (str(p.place_id) === v.businessId) throw new PlaceError("Este já é o local principal da pessoa.");
  const refusal = linkRefusal({ type: str(b.place_type), sector: str(b.sector) }, v.link, { association: v.confirmAssociation, school: v.confirmSchool });
  if (refusal) throw new PlaceError(refusal);
  if (!(await canHaveExtraPlaces(v.personId))) throw new PlaceError(REFUSAL.consent);
  const existing = (await all("SELECT business_id FROM person_places WHERE person_id=?", [v.personId])).map((r) => str(r.business_id));
  if (!existing.includes(v.businessId) && existing.length + (p.place_id ? 1 : 0) >= MAX_PLACES) throw new PlaceError(REFUSAL.limit);
  const db = database();
  await db.batch([
    db.prepare("INSERT INTO person_places(id,organization_id,city_id,person_id,business_id,link,authorized_by,authorized_at,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(person_id,business_id) DO UPDATE SET link=excluded.link,authorized_by=excluded.authorized_by,authorized_at=excluded.authorized_at,updated_at=excluded.updated_at")
      .bind(crypto.randomUUID(), a.organizationId, num(p.city_id), v.personId, v.businessId, v.link, a.email, now, a.email, now, now),
    audit(a, "save_person_place", `person:${v.personId}`),
  ]);
  return { ok: true };
}

/** Remove um lugar extra (pela equipe ou, no portal, pela própria pessoa: "Não frequento mais"). */
export async function removePersonPlace(a: AccessView, raw: unknown, opts: { self?: boolean } = {}) {
  const v = removePlaceInput.parse(raw), now = brazilTimestamp();
  if (!opts.self) { mapper(a); await personInScope(a, v.personId); }
  const row = (await all("SELECT pp.id FROM person_places pp JOIN cities c ON c.id=pp.city_id WHERE pp.person_id=? AND pp.business_id=? AND c.organization_id=?", [v.personId, v.businessId, a.organizationId]))[0];
  if (!row) throw new PlaceError(opts.self ? "Só dá para tirar os lugares extras; o local principal fica com a equipe." : "Lugar não encontrado. Para trocar o local principal, use \"Editar\".", 404);
  await database().batch([...clearPlacesStatements(v.personId, v.businessId, now), audit(a, "remove_person_place", `person:${v.personId}`)]);
  return { ok: true };
}

/** "Tornar principal": troca o local principal pelo lugar extra (o principal antigo vira extra), numa transação. */
export async function makePrimaryPlace(a: AccessView, raw: unknown) {
  mapper(a);
  const v = removePlaceInput.parse(raw), now = brazilTimestamp(), db = database();
  const p = await personInScope(a, v.personId);
  const extra = (await all("SELECT * FROM person_places WHERE person_id=? AND business_id=?", [v.personId, v.businessId]))[0];
  if (!extra) throw new PlaceError("Lugar não encontrado.", 404);
  const statements = [
    db.prepare("DELETE FROM person_places WHERE person_id=? AND business_id=?").bind(v.personId, v.businessId),
    db.prepare("UPDATE territory_people SET place_id=?,place_link=?,updated_at=? WHERE id=?").bind(v.businessId, str(extra.link), now, v.personId),
  ];
  if (p.place_id) statements.push(db.prepare("INSERT INTO person_places(id,organization_id,city_id,person_id,business_id,link,authorized_by,authorized_at,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(person_id,business_id) DO NOTHING")
    .bind(crypto.randomUUID(), a.organizationId, num(p.city_id), v.personId, str(p.place_id), str(p.place_link) || "Colaborador", str(p.created_by), str(p.created_at), a.email, now, now));
  statements.push(audit(a, "save_person_place", `person:${v.personId}`));
  await db.batch(statements);
  return { ok: true };
}

/** A pessoa pode ser ponte numa visita a este local: está ligada a ele (principal ou extra) e o vínculo passa hoje na regra. */
async function bridgeAllowed(personId: string, businessId: string) {
  const link = (await all(`SELECT tp.place_link AS link,b.sector,COALESCE(NULLIF(b.place_type,''),'Empresa') AS place_type FROM territory_people tp JOIN businesses b ON b.id=tp.place_id WHERE tp.id=? AND tp.place_id=?
    UNION ALL SELECT pp.link,b.sector,COALESCE(NULLIF(b.place_type,''),'Empresa') FROM person_places pp JOIN businesses b ON b.id=pp.business_id WHERE pp.person_id=? AND pp.business_id=?`, [personId, businessId, personId, businessId]))[0];
  if (!link) return false;
  return !linkNeedsReview({ type: str(link.place_type), sector: str(link.sector) }, str(link.link));
}

async function responsibleAllowed(a: AccessView, email: string) {
  if (a.role === "Comercial" && email.toLowerCase() !== a.email.toLowerCase()) throw new PlaceError("Você só programa visitas para você mesmo.", 403);
  if (!(await all(`SELECT 1 FROM app_users WHERE organization_id=? AND lower(email)=lower(?) AND active=1 AND role IN ${TEAM}`, [a.organizationId, email]))[0]) throw new PlaceError("Escolha alguém ativo da equipe.");
}

/** "Planejar visita": uma ação Visita Programado com o local (o passo de uma lista fixa). */
export async function planVisit(a: AccessView, raw: unknown) {
  mapper(a);
  const v = planInput.parse(raw), now = brazilTimestamp(), id = v.requestId ?? crypto.randomUUID();
  const b = await placeOf(a, v.businessId);
  if (str(b.sector) === "Religioso" && v.bridge) throw new PlaceError(REFUSAL.religious);
  if (v.dueDate < today()) throw new PlaceError("Escolha uma data a partir de hoje.");
  await responsibleAllowed(a, v.responsible);
  let firstName = "";
  if (v.personId) {
    const p = await personInScope(a, v.personId);
    firstName = str(p.name).split(/\s+/)[0];
    if (v.bridge && !(await bridgeAllowed(v.personId, v.businessId))) throw new PlaceError("Esta pessoa não pode ser ponte neste local (vínculo sensível ou a revisar).");
  }
  if (v.step.includes("{primeiro_nome}") && !v.personId) throw new PlaceError("Escolha a pessoa para visitar junto.");
  const db = database();
  await db.batch([
    db.prepare("INSERT INTO territory_actions(id,city_id,person_id,name,category,status,responsible,due_date,business_id,created_by,created_at,updated_at) VALUES(?,?,?,?,'Visita','Programado',?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
      .bind(id, num(b.city_id), v.bridge ? v.personId : null, stepLabel(v.step, firstName), v.responsible.toLowerCase(), v.dueDate, v.businessId, a.email, now, now),
    audit(a, "plant_visit", `action:${id}`),
  ]);
  return { id };
}

/** "Registrar visita": fecha a programada daquele local (e daquela pessoa) ou cria uma Realizado. */
export async function registerVisit(a: AccessView, raw: unknown) {
  mapper(a);
  const v = visitInput.parse(raw), now = brazilTimestamp(), t = today();
  const min = brazilTimestamp(new Date(Date.now() - 7 * 86_400_000)).slice(0, 10);
  if (v.day > t) throw new PlaceError("A visita não pode ser no futuro.");
  if (v.day < min) throw new PlaceError("Registre visitas de até 7 dias atrás.");
  const b = await placeOf(a, v.businessId);
  if (v.personId) await personInScope(a, v.personId);
  const mine = a.role === "Comercial" ? " AND (lower(responsible)=lower(?) OR lower(created_by)=lower(?))" : "";
  const planned = (await all(`SELECT id,name FROM territory_actions WHERE business_id=? AND status='Programado' AND category='Visita'${v.personId ? " AND (person_id=? OR person_id IS NULL)" : ""}${mine} ORDER BY person_id IS NULL, due_date LIMIT 1`, [v.businessId, ...(v.personId ? [v.personId] : []), ...(a.role === "Comercial" ? [a.email, a.email] : [])]))[0];
  const db = database();
  if (planned) {
    await db.batch([db.prepare("UPDATE territory_actions SET status='Realizado',name=?,due_date=?,updated_at=? WHERE id=?").bind(`${str(planned.name).split(" — ")[0]} — ${v.result}`, v.day, now, str(planned.id)), audit(a, "plant_visit", `action:${str(planned.id)}`)]);
    return { id: str(planned.id) };
  }
  const id = v.requestId ?? crypto.randomUUID();
  const bridge = v.personId && (await bridgeAllowed(v.personId, v.businessId)) ? v.personId : null;
  await db.batch([
    db.prepare("INSERT INTO territory_actions(id,city_id,person_id,name,category,status,responsible,due_date,business_id,created_by,created_at,updated_at) VALUES(?,?,?,?,'Visita','Realizado',?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
      .bind(id, num(b.city_id), bridge, `Visita — ${v.result}`, a.email.toLowerCase(), v.day, v.businessId, a.email, now, now),
    audit(a, "plant_visit", `action:${id}`),
  ]);
  return { id };
}

export type PlaceSummary = {
  businessId: string; name: string; type: string; sector: string; situation: PlaceSituation; situationText: string;
  people: number; clients: number; multipliers: number; lastVisit: string; planned: { id: string; step: string; dueDate: string; responsible: string; bridge: boolean }[];
};

/**
 * Situação de vários locais de uma vez, contando pessoas distintas (principal ou extra) no escopo de quem vê,
 * sem os vínculos a revisar (igreja, saúde fora do trabalho, local sem setor). Lotes de 80 ids (limite do D1).
 */
export async function placeSummaries(a: AccessView, businessIds: string[]): Promise<Map<string, PlaceSummary>> {
  const out = new Map<string, PlaceSummary>();
  if (!businessIds.length) return out;
  const s = personScopeSql(a, "tp");
  const names = new Map((await all(`SELECT lower(email) AS e,name FROM app_users WHERE organization_id=? LIMIT 500`, [a.organizationId])).map((r) => [str(r.e), str(r.name)]));
  for (let i = 0; i < businessIds.length; i += 80) {
    const batch = [...new Set(businessIds.slice(i, i + 80))], marks = batch.map(() => "?").join(",");
    const [places, links, visits] = await Promise.all([
      all(`SELECT id,name,sector,COALESCE(NULLIF(place_type,''),'Empresa') AS place_type FROM businesses WHERE organization_id=? AND id IN (${marks})`, [a.organizationId, ...batch]),
      all(`SELECT x.business_id,COUNT(DISTINCT x.person_id) AS people,COUNT(DISTINCT CASE WHEN x.client=1 THEN x.person_id END) AS clients,COUNT(DISTINCT CASE WHEN x.multiplier=1 THEN x.person_id END) AS multipliers FROM (
          SELECT b.id AS business_id,tp.id AS person_id,
            EXISTS(SELECT 1 FROM leads l JOIN sales sa ON sa.lead_id=l.id WHERE l.person_id=tp.id AND l.consent_revoked_at IS NULL AND sa.status='Pagamento confirmado' AND sa.paid_at IS NOT NULL) AS client,
            EXISTS(SELECT 1 FROM territory_people ch JOIN leads lc ON lc.person_id=ch.id JOIN sales sc ON sc.lead_id=lc.id WHERE ch.referrer_id=tp.id AND lc.consent_revoked_at IS NULL AND sc.status='Pagamento confirmado' AND sc.paid_at IS NOT NULL) AS multiplier
          FROM businesses b JOIN territory_people tp ON (tp.place_id=b.id AND ${countableLinkSql("b", "tp.place_link")}) OR EXISTS(SELECT 1 FROM person_places pp WHERE pp.person_id=tp.id AND pp.business_id=b.id AND ${countableLinkSql("b", "pp.link")})
          WHERE b.id IN (${marks}) AND NOT EXISTS(SELECT 1 FROM leads lx WHERE lx.person_id=tp.id AND lx.consent_revoked_at IS NOT NULL) AND ${s.sql}
        ) x GROUP BY x.business_id`, [...batch, ...s.args]),
      all(`SELECT id,business_id,name,status,due_date,responsible,person_id FROM territory_actions WHERE category='Visita' AND business_id IN (${marks}) AND status IN ('Programado','Realizado') ORDER BY due_date DESC LIMIT 2000`, batch),
    ]);
    const byId = new Map(links.map((l) => [str(l.business_id), l]));
    for (const b of places) {
      const id = str(b.id), l = byId.get(id);
      const people = num(l?.people), clients = num(l?.clients), multipliers = num(l?.multipliers);
      const sit = placeSituation({ sector: str(b.sector), people, clients, multipliers });
      const mine = visits.filter((x) => str(x.business_id) === id);
      out.set(id, {
        businessId: id, name: str(b.name), type: str(b.place_type), sector: str(b.sector), situation: sit.situation, situationText: sit.text, people, clients, multipliers,
        lastVisit: mine.find((x) => x.status === "Realizado")?.due_date ? str(mine.find((x) => x.status === "Realizado")!.due_date) : "",
        planned: mine.filter((x) => x.status === "Programado").sort((x, y) => str(x.due_date).localeCompare(str(y.due_date))).slice(0, 10)
          .map((x) => ({ id: str(x.id), step: str(x.name), dueDate: str(x.due_date), responsible: names.get(str(x.responsible).toLowerCase()) || "alguém da equipe", bridge: !!x.person_id })),
      });
    }
  }
  return out;
}

/** Ficha do local: situação, "Pessoas da rede ligadas aqui" (no escopo), plano, última visita e, para a gestão, vínculos a revisar. */
export async function placeDetail(a: AccessView, businessId: string) {
  if (!a.active || ["Embaixador", "Mentorado"].includes(a.role)) throw new PlaceError("Esta ficha é da equipe.", 403);
  const b = await placeOf(a, businessId);
  const summary = (await placeSummaries(a, [businessId])).get(businessId)!;
  const s = personScopeSql(a, "tp");
  const people = await all(`SELECT DISTINCT tp.id,tp.name FROM businesses b JOIN territory_people tp ON (tp.place_id=b.id AND ${countableLinkSql("b", "tp.place_link")}) OR EXISTS(SELECT 1 FROM person_places pp WHERE pp.person_id=tp.id AND pp.business_id=b.id AND ${countableLinkSql("b", "pp.link")}) WHERE b.id=? AND NOT EXISTS(SELECT 1 FROM leads lx WHERE lx.person_id=tp.id AND lx.consent_revoked_at IS NOT NULL) AND ${s.sql} ORDER BY tp.name LIMIT 50`, [businessId, ...s.args]);
  const review = MANAGEMENT.includes(a.role) ? await all(`SELECT tp.id,tp.name,tp.place_link AS link FROM territory_people tp WHERE tp.place_id=? AND tp.name NOT LIKE '${ANONYMOUS_LABEL}%' ORDER BY tp.name LIMIT 200`, [businessId]) : [];
  const toReview = review.filter((r) => linkNeedsReview({ type: str(b.place_type), sector: str(b.sector) }, str(r.link)));
  return { ...summary, cityId: num(b.city_id), team: await plantTeam(a), people: summary.people, names: people.map((p) => ({ id: str(p.id), name: str(p.name) })), review: toReview.map((r) => ({ id: str(r.id), name: str(r.name), link: str(r.link) })) };
}

/** Quem pode fazer a visita: os logins ativos da equipe (a mesma lista de Metas e rotina); o Comercial, ele mesmo. */
export async function plantTeam(a: AccessView) {
  if (a.role === "Comercial") return [{ email: a.email.toLowerCase(), name: a.name || a.email }];
  const where = a.role === "Administrador" ? "1=1" : "(city_id=? OR (city_id IS NULL AND role IN ('Administrador','Comercial')))";
  return (await all(`SELECT lower(email) AS email,name FROM app_users WHERE organization_id=? AND active=1 AND role IN ${TEAM} AND ${where} ORDER BY name LIMIT 200`, [a.organizationId, ...(a.role === "Administrador" ? [] : [a.cityId ?? 0])]))
    .map((r) => ({ email: str(r.email), name: str(r.name) }));
}

/** Hoje: visitas de plantio programadas para hoje (do responsável; a gestão vê as do escopo). */
export async function plantingToday(a: AccessView) {
  if (!a.active || ["Embaixador", "Mentorado"].includes(a.role)) return [];
  const t = today();
  const where = a.role === "Comercial" ? "lower(t.responsible)=lower(?)" : a.role === "Administrador" ? "1=1" : "t.city_id=?";
  const args: Value[] = a.role === "Comercial" ? [a.email] : a.role === "Administrador" ? [] : [a.cityId ?? 0];
  return (await all(`SELECT t.id,t.name,t.business_id,b.name AS place FROM territory_actions t JOIN businesses b ON b.id=t.business_id AND b.organization_id=? WHERE t.category='Visita' AND t.status='Programado' AND t.due_date=? AND ${where} ORDER BY b.name LIMIT 50`, [a.organizationId, t, ...args]))
    .map((r) => ({ id: str(r.id), step: str(r.name), businessId: str(r.business_id), place: str(r.place) }));
}

/** Lugares da pessoa (principal e extras) para a página: sem os vínculos a revisar para quem não é gestão. */
export async function personPlacesOf(a: AccessView, person: Row) {
  const management = MANAGEMENT.includes(a.role);
  const rows = await all(`SELECT b.id,b.name,b.sector,COALESCE(NULLIF(b.place_type,''),'Empresa') AS place_type,tp.place_link AS link,1 AS main,'' AS authorized_at FROM territory_people tp JOIN businesses b ON b.id=tp.place_id WHERE tp.id=?
    UNION ALL SELECT b.id,b.name,b.sector,COALESCE(NULLIF(b.place_type,''),'Empresa'),pp.link,0,pp.authorized_at FROM person_places pp JOIN businesses b ON b.id=pp.business_id WHERE pp.person_id=? ORDER BY main DESC, name`, [str(person.id), str(person.id)]);
  // Vínculo sensível (igreja, saúde fora do trabalho): só a gestão vê, marcado "a revisar".
  const visible = rows.filter((r) => management || !sensitiveLink({ sector: str(r.sector) }, str(r.link)));
  const summaries = await placeSummaries(a, visible.map((r) => str(r.id)));
  return visible.map((r) => {
    const review = linkNeedsReview({ type: str(r.place_type), sector: str(r.sector) }, str(r.link));
    return { businessId: str(r.id), name: str(r.name), type: str(r.place_type), sector: str(r.sector), link: str(r.link), main: !!num(r.main), review, authorizedAt: str(r.authorized_at), summary: summaries.get(str(r.id)) ?? null };
  });
}

export { PersonPageError };

/**
 * Em campo (mapa): a situação dos locais próximos. A posição do aparelho nunca chega aqui; o aparelho escolhe
 * os locais pelo raio e manda só os ids. Só volta o que a função pode ver (o Comercial, os locais dele).
 */
export async function nearbySituations(a: AccessView, ids: string[]): Promise<Array<{ businessId: string; situation: PlaceSituation; situationText: string; people: number; lastVisit: string; planned: boolean }>> {
  const clean = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 40);
  if (!clean.length) return [];
  const { placeScope } = await import("@/db/territory");
  const scope = placeScope(a, "b", "owner_email");
  const visible = await all(`SELECT b.id FROM businesses b JOIN cities c ON c.id=b.city_id WHERE b.organization_id=? AND c.organization_id=? AND b.id IN (${clean.map(() => "?").join(",")}) AND ${scope.sql}`, [a.organizationId, a.organizationId, ...clean, ...scope.values]);
  const summaries = await placeSummaries(a, visible.map((r) => str(r.id)));
  return [...summaries.values()].map((x) => ({ businessId: x.businessId, situation: x.situation, situationText: x.situationText, people: x.people, lastVisit: x.lastVisit, planned: x.planned.length > 0 }));
}

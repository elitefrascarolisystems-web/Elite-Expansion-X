import { nameKey } from "@/lib/places";
import type { AccessView } from "@/lib/expansion-types";
import { database } from "@/db/runtime";

/**
 * Todo mentorado entra no mapa: liga o acesso ao portal a uma pessoa da cidade
 * (a de mesmo nome, se houver uma só) ou cria a pessoa, com o papel Mentorado.
 * Assim as indicações feitas no portal já nascem ligadas a quem indicou.
 */
export async function ensurePortalPerson(access: AccessView, userId: number, cityId: number, name: string, now: string) {
  const db = database();
  const user = (await db.prepare("SELECT person_id FROM app_users WHERE id=? AND organization_id=?").bind(userId, access.organizationId).all()).results[0];
  if (!user || user.person_id) return;
  const key = nameKey(name);
  if (!key) return;
  const rows = (await db.prepare("SELECT id,name FROM territory_people WHERE city_id=? AND length(name) BETWEEN ? AND ? LIMIT 5000").bind(cityId, Math.max(1, name.length - 6), name.length + 6).all()).results;
  const same = rows.filter((r) => nameKey(String(r.name)) === key);
  let personId = same.length === 1 ? String(same[0].id) : null;
  const statements = [];
  if (!personId) {
    personId = crypto.randomUUID();
    statements.push(db.prepare("INSERT INTO territory_people(id,city_id,name,leader,referrer_id,created_by,created_at,updated_at) VALUES(?,?,?,0,NULL,?,?,?)").bind(personId, cityId, name, access.email, now, now));
  }
  statements.push(
    db.prepare("INSERT INTO territory_roles(id,person_id,city_id,role,status,responsible,source,authorized_by,created_at,updated_at) VALUES(?,?,?,'Mentorado','Ativo',?,'Acesso ao portal de mentoria',?,?,?) ON CONFLICT(person_id,city_id,role) DO NOTHING").bind(crypto.randomUUID(), personId, cityId, access.name || access.email, access.email, now, now),
    db.prepare("UPDATE app_users SET person_id=? WHERE id=?").bind(personId, userId),
  );
  await db.batch(statements);
  return personId;
}

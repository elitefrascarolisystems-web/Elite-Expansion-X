import { asNullableNumber, asNumber, database } from "@/db/runtime";
import { cityLimitMessage, FEATURE_BLOCKED, seatLimitMessage, type PlanFeature, type PlanUsage } from "@/lib/subscriptions";

/**
 * Limites do plano de cada organização. Sem registro de plano (a Elite e
 * empresas ainda sem plano definido), tudo fica liberado e sem limite.
 * Mentorados não ocupam vaga da equipe: são clientes da empresa, não usuários dela.
 */
const TEAM_USERS = "SELECT count(*) FROM app_users WHERE organization_id=? AND active=1 AND role<>'Mentorado'";
const ACTIVE_CITIES = "SELECT count(*) FROM cities WHERE organization_id=? AND status='Ativa'";

export async function getPlan(organizationId: number): Promise<PlanUsage> {
  const row = (await database().prepare(`
    SELECT s.plan,e.user_limit,e.city_limit,e.imports,e.exports,e.external_maps,
      (${TEAM_USERS}) AS users,(${ACTIVE_CITIES}) AS cities
    FROM organizations o
    LEFT JOIN organization_entitlements e ON e.organization_id=o.id
    LEFT JOIN organization_subscriptions s ON s.organization_id=o.id
    WHERE o.id=?`).bind(organizationId, organizationId, organizationId).all()).results[0] ?? {};
  const on = (value: unknown) => value == null || Number(value) === 1;
  return {
    plan: String(row.plan ?? ""),
    userLimit: asNullableNumber(row.user_limit),
    cityLimit: asNullableNumber(row.city_limit),
    users: asNumber(row.users),
    cities: asNumber(row.cities),
    imports: on(row.imports),
    exports: on(row.exports),
    externalMaps: on(row.external_maps),
  };
}

/** Mensagem de bloqueio se o recurso não está no plano; null quando liberado. */
export async function featureBlocked(organizationId: number, feature: PlanFeature): Promise<string | null> {
  return (await getPlan(organizationId))[feature] ? null : FEATURE_BLOCKED[feature];
}

/**
 * Mensagem de bloqueio se a pessoa passaria a ocupar uma vaga além do limite.
 * `userId` é o vínculo que já existe (reativação ou troca de função), que não conta duas vezes.
 */
export async function seatBlocked(organizationId: number, role: string, userId: number | null = null): Promise<string | null> {
  if (role === "Mentorado") return null;
  const row = (await database().prepare(`
    SELECT e.user_limit,(${TEAM_USERS} AND id<>?) AS used FROM organization_entitlements e WHERE e.organization_id=?`)
    .bind(organizationId, userId ?? 0, organizationId).all()).results[0];
  if (!row || row.user_limit == null) return null;
  return asNumber(row.used) >= asNumber(row.user_limit) ? seatLimitMessage(asNumber(row.user_limit)) : null;
}

/** Mensagem de bloqueio se mais uma cidade ativa passaria do limite (`cityId`: a cidade que está sendo ativada). */
export async function citySlotBlocked(organizationId: number, cityId: number | null = null): Promise<string | null> {
  const row = (await database().prepare(`
    SELECT e.city_limit,(${ACTIVE_CITIES} AND id<>?) AS used FROM organization_entitlements e WHERE e.organization_id=?`)
    .bind(organizationId, cityId ?? 0, organizationId).all()).results[0];
  if (!row || row.city_limit == null) return null;
  return asNumber(row.used) >= asNumber(row.city_limit) ? cityLimitMessage(asNumber(row.city_limit)) : null;
}

/** Erros do banco (gatilhos de limite) traduzidos para a mesma mensagem do plano. */
export function planLimitFromDatabase(message: string): string | null {
  if (message.includes("tenant_user_limit")) return "O plano atingiu o limite de usuários da equipe. Fale com a Elite para ampliar o plano.";
  if (message.includes("tenant_city_limit")) return "O plano atingiu o limite de cidades ativas. Fale com a Elite para ampliar o plano.";
  return null;
}

import type { AccessView, SettingsView, UserRole } from "@/lib/expansion-types";
import { asNullableNumber, asNumber, brazilTimestamp, database } from "@/db/runtime";

const OWNER_EMAIL = "teamfrascaroli@gmail.com";

/**
 * Donos da plataforma: administradores da Elite com poderes de plataforma
 * (criar organizações clientes, gerenciar a Assessoria Elite). Sempre
 * cadastrados na Elite e sempre assessores. O primeiro é o dono registrado.
 */
export const PLATFORM_OWNERS: readonly { email: string; name: string }[] = [
  { email: OWNER_EMAIL, name: "Felipe Frascaroli" },
  { email: "elitefrascarolisystems@gmail.com", name: "Elite Frascaroli Systems" },
];

export function isPlatformOwnerEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return PLATFORM_OWNERS.some((owner) => owner.email === normalized);
}

async function ensureInitialCities(createdBy: string) {
  const db = database();
  const count = await db.prepare("SELECT COUNT(*) AS total FROM cities WHERE organization_id=1").all();
  if (asNumber(count.results[0]?.total) > 0) return;
  const insert = `
    INSERT INTO cities
      (name, state, phase, leader_name, target_cac_cents, ambassador_goal, sales_goal, status, tracking_mode, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await db.batch([
    db.prepare(insert).bind("Esmeraldas", "MG", "Piloto", "", 0, 10, 100, "Ativa", "Detalhado", createdBy),
    db.prepare(insert).bind("Belo Horizonte", "MG", "Preparação", "", 0, 10, 100, "Planejada", "Detalhado", createdBy),
    db.prepare(insert).bind("Contagem", "MG", "Preparação", "", 0, 10, 100, "Planejada", "Detalhado", createdBy),
    db.prepare(insert).bind("Betim", "MG", "Em espera", "", 0, 10, 100, "Planejada", "Detalhado", createdBy),
  ]);
}

export async function ensureSystemData(currentEmail: string, displayName: string) {
  const db = database();
  const timestamp = brazilTimestamp();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO organizations(id,name,owner_email,active,created_at) VALUES(1,'Elite Frascaroli Academy',?,1,?)").bind(OWNER_EMAIL,timestamp),
    db.prepare(`
      INSERT OR IGNORE INTO settings
        (id, owner_email, referral_base_url, attribution_model, updated_by, updated_at)
      VALUES (1, ?, '', 'Origem principal declarada', ?, ?)
    `).bind(OWNER_EMAIL, OWNER_EMAIL, timestamp),
    // Donos da plataforma: sempre administradores da Elite e sempre assessores.
    // Os demais assessores são escolhidos por eles.
    ...PLATFORM_OWNERS.flatMap((owner) => [
      db.prepare(`
        INSERT OR IGNORE INTO app_users
          (organization_id, email, name, role, active, created_by, created_at)
        VALUES (1, ?, ?, 'Administrador', 1, ?, ?)
      `).bind(owner.email, owner.name, OWNER_EMAIL, timestamp),
      db.prepare("INSERT OR IGNORE INTO platform_advisors(email,name,active,granted_by,granted_at) VALUES(?,?,1,?,?)").bind(owner.email, owner.name, OWNER_EMAIL, timestamp),
    ]),
  ]);
  if (currentEmail.toLowerCase() === OWNER_EMAIL) {
    await db.prepare("UPDATE app_users SET name = ? WHERE organization_id=1 AND email = ? AND (name = '' OR name IS NULL)")
      .bind(displayName || "Felipe Frascaroli", OWNER_EMAIL).run();
  }
  await ensureInitialCities(OWNER_EMAIL);
}

export async function getUserAccess(email: string, displayName: string, organizationId?: number): Promise<AccessView | null> {
  await ensureSystemData(email, displayName);
  const db = database();
  const result = await db.prepare(`
    SELECT u.id,u.email,u.name,u.role,u.city_id,u.ambassador_id,u.active,u.title,u.welcomed_at,u.organization_id,o.name AS organization_name,o.owner_email
    FROM app_users u JOIN organizations o ON o.id=u.organization_id AND o.active=1 WHERE lower(u.email)=lower(?) AND u.active=1 AND (? IS NULL OR u.organization_id=?) ORDER BY u.organization_id LIMIT 1
  `).bind(email,organizationId??null,organizationId??null).all();
  const row = result.results[0];
  if (!row || !Boolean(row.active)) {
    // Sem vínculo próprio: a Assessoria Elite entra só quando a organização é
    // pedida explicitamente (?org=), nunca como organização padrão.
    return organizationId !== undefined && organizationId > 0 ? advisoryAccess(email, displayName, organizationId) : null;
  }
  const role = String(row.role) as UserRole;
  return {
    isOrganizationOwner:String(row.owner_email).toLowerCase()===email.toLowerCase(),organizationId:asNumber(row.organization_id),organizationName:String(row.organization_name),isPlatformOwner:isPlatformOwnerEmail(email) && asNumber(row.organization_id)===1 && role==="Administrador",
    id: asNumber(row.id),
    email: String(row.email),
    name: String(row.name || displayName || email),
    role,
    cityId: asNullableNumber(row.city_id),
    ambassadorId: asNullableNumber(row.ambassador_id),
    active: Boolean(row.active),
    canManageGlobal: role === "Administrador",
    canManageCity: ["Administrador", "Coordenação", "Líder"].includes(role),
    canManagePipeline: ["Administrador", "Coordenação", "Líder", "Comercial"].includes(role),
    canManageContent: ["Administrador", "Coordenação", "Líder"].includes(role),
    title: String(row.title ?? ""),
    welcomed: Boolean(row.welcomed_at),
  };
}

/**
 * Assessor ativo = registrado em platform_advisors E ainda membro ativo da
 * organização principal (time Elite). Sair do time encerra a assessoria.
 */
const ACTIVE_ADVISOR_SQL = `
  SELECT adv.email, COALESCE(NULLIF(adv.name,''), u.name, adv.email) AS name, u.id AS user_id
  FROM platform_advisors adv
  JOIN app_users u ON u.organization_id=1 AND lower(u.email)=lower(adv.email) AND u.active=1
  JOIN organizations elite ON elite.id=1 AND elite.active=1
  WHERE adv.active=1`;

export async function isPlatformAdvisor(email: string): Promise<boolean> {
  const r = await database().prepare(`${ACTIVE_ADVISOR_SQL} AND lower(adv.email)=lower(?) LIMIT 1`).bind(email).all();
  return r.results.length > 0;
}

export async function listActiveAdvisors(): Promise<{ email: string; name: string }[]> {
  const r = await database().prepare(`${ACTIVE_ADVISOR_SQL} ORDER BY name LIMIT 100`).all();
  return r.results.map((row) => ({ email: String(row.email), name: String(row.name) }));
}

/** Acesso de assessoria: ver e editar como administrador, sempre identificado como Assessoria Elite. */
async function advisoryAccess(email: string, displayName: string, organizationId: number): Promise<AccessView | null> {
  if (organizationId === 1) return null; // A organização principal só por vínculo próprio.
  const db = database();
  const advisor = (await db.prepare(`${ACTIVE_ADVISOR_SQL} AND lower(adv.email)=lower(?) LIMIT 1`).bind(email).all()).results[0];
  if (!advisor) return null;
  const org = (await db.prepare("SELECT id,name FROM organizations WHERE id=? AND active=1").bind(organizationId).all()).results[0];
  if (!org) return null;
  return {
    isAdvisory: true,
    isOrganizationOwner: false,
    isPlatformOwner: false,
    organizationId: asNumber(org.id),
    organizationName: String(org.name),
    id: asNumber(advisor.user_id),
    email,
    name: String(advisor.name || displayName || email),
    role: "Administrador",
    cityId: null,
    ambassadorId: null,
    active: true,
    canManageGlobal: true,
    canManageCity: true,
    canManagePipeline: true,
    canManageContent: true,
  };
}

export async function getSettings(organizationId=1): Promise<SettingsView> {
  const result = await database().prepare(`
    SELECT owner_email, referral_base_url, attribution_model, min_active_ambassadors,
      min_confirmed_payments, min_active_partners, min_data_periods, inactivity_days,
      organic_goal_percent, updated_by, updated_at
    FROM settings WHERE organization_id = ?
  `).bind(organizationId).all();
  const row = result.results[0] ?? {};
  return {
    ownerEmail: String(row.owner_email ?? OWNER_EMAIL),
    referralBaseUrl: String(row.referral_base_url ?? ""),
    attributionModel: "Origem principal declarada",
    minActiveAmbassadors: asNumber(row.min_active_ambassadors),
    minConfirmedPayments: asNumber(row.min_confirmed_payments),
    minActivePartners: asNumber(row.min_active_partners),
    minDataPeriods: asNumber(row.min_data_periods),
    inactivityDays: asNumber(row.inactivity_days),
    organicGoalPercent: asNumber(row.organic_goal_percent),
    updatedBy: String(row.updated_by ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

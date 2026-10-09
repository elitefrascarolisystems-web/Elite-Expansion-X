import type { AccessView, SettingsView, UserRole } from "@/lib/expansion-types";
import { asNullableNumber, asNumber, brazilTimestamp, database } from "@/db/runtime";

const OWNER_EMAIL = "teamfrascaroli@gmail.com";

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
    db.prepare(`
      INSERT OR IGNORE INTO app_users
        (email, name, role, active, created_by, created_at)
      VALUES (?, 'Felipe Frascaroli', 'Administrador', 1, ?, ?)
    `).bind(OWNER_EMAIL, OWNER_EMAIL, timestamp),
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
    SELECT u.id,u.email,u.name,u.role,u.city_id,u.ambassador_id,u.active,u.organization_id,o.name AS organization_name
    FROM app_users u JOIN organizations o ON o.id=u.organization_id AND o.active=1 WHERE lower(u.email)=lower(?) AND u.active=1 AND (? IS NULL OR u.organization_id=?) ORDER BY u.organization_id LIMIT 1
  `).bind(email,organizationId??null,organizationId??null).all();
  const row = result.results[0];
  if (!row || !Boolean(row.active)) return null;
  const role = String(row.role) as UserRole;
  return {
    organizationId:asNumber(row.organization_id),organizationName:String(row.organization_name),isPlatformOwner:email.toLowerCase()===OWNER_EMAIL && asNumber(row.organization_id)===1 && role==="Administrador",
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

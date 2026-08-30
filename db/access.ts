import type { AccessView, SettingsView, UserRole } from "@/lib/expansion-types";
import { asNullableNumber, asNumber, brazilTimestamp, database } from "@/db/runtime";

const OWNER_EMAIL = "teamfrascaroli@gmail.com";

async function ensureInitialCities(createdBy: string) {
  const db = database();
  const count = await db.prepare("SELECT COUNT(*) AS total FROM cities").all();
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
    await db.prepare("UPDATE app_users SET name = ? WHERE email = ? AND (name = '' OR name IS NULL)")
      .bind(displayName || "Felipe Frascaroli", OWNER_EMAIL).run();
  }
  await ensureInitialCities(OWNER_EMAIL);
}

export async function getUserAccess(email: string, displayName: string): Promise<AccessView | null> {
  await ensureSystemData(email, displayName);
  const db = database();
  const result = await db.prepare(`
    SELECT id, email, name, role, city_id, ambassador_id, active
    FROM app_users WHERE lower(email) = lower(?) LIMIT 1
  `).bind(email).all();
  const row = result.results[0];
  if (!row || !Boolean(row.active)) return null;
  const role = String(row.role) as UserRole;
  return {
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

export async function getSettings(): Promise<SettingsView> {
  const result = await database().prepare(`
    SELECT owner_email, referral_base_url, attribution_model, min_active_ambassadors,
      min_confirmed_payments, min_active_partners, min_data_periods, inactivity_days,
      organic_goal_percent, updated_by, updated_at
    FROM settings WHERE id = 1
  `).all();
  const row = result.results[0] ?? {};
  return {
    ownerEmail: String(row.owner_email ?? OWNER_EMAIL),
    referralBaseUrl: String(row.referral_base_url ?? ""),
    attributionModel: String(row.attribution_model ?? "Origem principal declarada"),
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

import { isPortalRole, type AccessView, type SettingsView, type UserRole } from "@/lib/expansion-types";
import { asNullableNumber, asNumber, brazilTimestamp, database } from "@/db/runtime";
import { parseGuidesSeen } from "@/lib/tab-guide-keys";
import { advisoryAllowed } from "@/lib/advisory";

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
        (id, owner_email, referral_base_url, attribution_model, origin_tracked_since, updated_by, updated_at)
      VALUES (1, ?, '', 'Origem principal declarada', substr(?, 1, 10), ?, ?)
    `).bind(OWNER_EMAIL, timestamp, OWNER_EMAIL, timestamp),
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
    SELECT u.id,u.email,u.name,u.role,u.city_id,u.ambassador_id,u.active,u.title,u.welcomed_at,u.guides_seen,u.person_id,u.business_id,u.organization_id,o.name AS organization_name,o.owner_email,o.mfa_required
    FROM app_users u JOIN organizations o ON o.id=u.organization_id AND o.active=1 WHERE lower(u.email)=lower(?) AND u.active=1 AND (? IS NULL OR u.organization_id=?) ORDER BY u.organization_id LIMIT 1
  `).bind(email,organizationId??null,organizationId??null).all();
  const row = result.results[0];
  if (!row || !Boolean(row.active)) {
    // Sem vínculo próprio: a Assessoria Elite entra só quando a organização é
    // pedida explicitamente (?org=), nunca como organização padrão.
    return organizationId !== undefined && organizationId > 0 ? advisoryAccess(email, displayName, organizationId) : null;
  }
  const role = String(row.role) as UserRole;
  // A empresa exige verificação em duas etapas da equipe: sem ela ativa, a pessoa só vê a tela de ativar.
  const mfaSetupRequired = Number(row.mfa_required ?? 0) === 1 && !isPortalRole(role) && !(await mfaEnabled(email));
  return {
    ...(mfaSetupRequired ? { mfaSetupRequired: true } : {}),
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
    guidesSeen: parseGuidesSeen(row.guides_seen),
    personId: row.person_id ? String(row.person_id) : null,
    businessId: row.business_id ? String(row.business_id) : null,
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
  const org = (await db.prepare("SELECT id,name,mfa_required,advisory_mode,advisory_until FROM organizations WHERE id=? AND active=1").bind(organizationId).all()).results[0];
  if (!org) return null;
  // Quem decide o acesso da assessoria é a empresa: desligado ou com prazo vencido, ninguém da Elite entra.
  const today = brazilTimestamp().slice(0, 10);
  if (!advisoryAllowed(String(org.advisory_mode ?? "liberado"), org.advisory_until ? String(org.advisory_until) : null, today)) return null;
  // Uma linha por dia por assessor no Histórico da empresa: a empresa vê quem da Elite entrou e quando.
  await db.prepare(`INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,entity_id,summary,created_at)
    SELECT ?,?,'advisory_access','organization',?,'Assessoria Elite entrou na empresa.',?
    WHERE NOT EXISTS(SELECT 1 FROM audit_logs WHERE organization_id=? AND lower(actor_email)=lower(?) AND action='advisory_access' AND substr(created_at,1,10)=?)`)
    .bind(organizationId, email, organizationId, brazilTimestamp(), organizationId, email, today).run();
  // Empresa que exige verificação em duas etapas: a assessoria também precisa tê-la ativa.
  const mfaSetupRequired = Number(org.mfa_required ?? 0) === 1 && !(await mfaEnabled(email));
  return {
    ...(mfaSetupRequired ? { mfaSetupRequired: true } : {}),
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

/**
 * Acesso às ferramentas da equipe. Mentorados e assinantes têm login, mas só
 * entram no portal deles: para todas as APIs da equipe, é como se não tivessem acesso.
 */
export async function getTeamAccess(email: string, displayName: string, organizationId?: number): Promise<AccessView | null> {
  const access = await getUserAccess(email, displayName, organizationId);
  // Sem a verificação exigida pela empresa, nenhuma ferramenta da equipe responde (só a tela de ativar).
  return access && !isPortalRole(access.role) && !access.mfaSetupRequired ? access : null;
}

/** Verificação em duas etapas ativa (consulta direta, sem importar db/mfa, que depende deste arquivo). */
async function mfaEnabled(email: string): Promise<boolean> {
  return (await database().prepare("SELECT 1 FROM user_mfa WHERE email=lower(?) AND enabled_at IS NOT NULL").bind(email).all()).results.length > 0;
}

/** Empresa suspensa à qual a pessoa pertence (para explicar por que não entra), ou null. */
export async function suspendedOrganizationOf(email: string): Promise<string | null> {
  const row = (await database().prepare(`
    SELECT o.name FROM app_users u JOIN organizations o ON o.id=u.organization_id AND o.active=0
    WHERE lower(u.email)=lower(?) AND u.active=1 ORDER BY o.id LIMIT 1`).bind(email).all()).results[0];
  return row ? String(row.name) : null;
}

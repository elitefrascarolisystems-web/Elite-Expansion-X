import type {
  AccessView,
  AmbassadorRecord,
  AmbassadorUpdateRecord,
  AuditRecord,
  CityRecord,
  CityUpdateRecord,
  ContentRecord,
  CostRecord,
  DashboardData,
  EventRecord,
  LeadRecord,
  PartnerRecord,
  SaleRecord,
  TaskRecord,
  UserProfileRecord,
  UserRole,
} from "@/lib/expansion-types";
import { getSettings, listActiveAdvisors } from "@/db/access";
import { asNullableNumber, asNumber, brazilTimestamp, database } from "@/db/runtime";

type Scope = { where: string; values: Array<string | number> };

function legacyCityScope(access: AccessView, column = "city_id"): Scope {
  if (access.role === "Administrador") return { where: "1 = 1", values: [] };
  if (access.cityId !== null) return { where: `${column} = ?`, values: [access.cityId] };
  if (access.role === "Comercial") return { where: "1 = 1", values: [] };
  return { where: "1 = 0", values: [] };
}

function cityScope(access:AccessView,column="city_id"):Scope {
 const local=legacyCityScope(access,column);
 return {where:`(${local.where}) AND ${column} IN (SELECT id FROM cities WHERE organization_id=?)`,values:[...local.values,access.organizationId]};
}

function leadScope(access: AccessView, alias = "l"): Scope {
  if (access.role === "Administrador") return { where: "1 = 1", values: [] };
  if (["Líder", "Coordenação"].includes(access.role) && access.cityId !== null) return { where: `${alias}.city_id = ?`, values: [access.cityId] };
  if (access.role === "Embaixador" && access.ambassadorId !== null) return { where: `${alias}.ambassador_id = ?`, values: [access.ambassadorId] };
  if (access.role === "Comercial") return { where: `lower(${alias}.assigned_to_email) = lower(?)`, values: [access.email] };
  return { where: "1 = 0", values: [] };
}

async function rows(sql: string, values: Array<string | number> = []): Promise<Record<string, unknown>[]> {
  const statement = database().prepare(sql);
  const result = values.length ? await statement.bind(...values).all() : await statement.all();
  return result.results as Record<string, unknown>[];
}

function nullableText(value: unknown) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

export async function getDashboardData(access: AccessView): Promise<DashboardData> {
  const scope = cityScope(access, "c.id");
  const tableScope = cityScope(access);
  const leadLocal = leadScope(access, "l");
  const leadsScope={where:`(${leadLocal.where}) AND l.city_id IN (SELECT id FROM cities WHERE organization_id=?)`,values:[...leadLocal.values,access.organizationId]};
  const ambassadorWhere = access.role === "Embaixador" && access.ambassadorId !== null
    ? { where: "a.id = ?", values: [access.ambassadorId] }
    : access.role === "Comercial"
      ? { where: "1 = 0", values: [] }
      : { where: scope.where.replaceAll("c.id", "a.city_id"), values: scope.values };
  const ambassadorUpdateWhere = access.role === "Embaixador" && access.ambassadorId !== null
    ? { where: "u.ambassador_id = ?", values: [access.ambassadorId] }
    : access.role === "Comercial"
      ? { where: "1 = 0", values: [] }
      : { where: scope.where, values: scope.values };
  const cityUpdateWhere = ["Administrador", "Coordenação", "Líder"].includes(access.role)
    ? tableScope
    : { where: "1 = 0", values: [] };
  const costWhere = access.role === "Embaixador" && access.ambassadorId !== null
    ? { where: "ambassador_id = ?", values: [access.ambassadorId] }
    : access.role === "Comercial"
      ? { where: "1 = 0", values: [] }
      : tableScope;
  const taskWhere = access.role === "Embaixador" && access.ambassadorId !== null
    ? { where: "t.ambassador_id = ?", values: [access.ambassadorId] }
    : access.role === "Comercial"
      ? { where: "1 = 0", values: [] }
      : { where: scope.where.replaceAll("c.id", "t.city_id"), values: scope.values };
  const contentWhere = access.role === "Embaixador"
    ? { where: `x.status = 'Aprovado' AND (x.city_id IS NULL OR ${scope.where})`, values: scope.values }
    : { where: `x.city_id IS NULL OR ${scope.where}`, values: scope.values };

  const [
    settings,
    cityRows,
    ambassadorRows,
    cityUpdateRows,
    ambassadorUpdateRows,
    leadRows,
    saleRows,
    costRows,
    partnerRows,
    eventRows,
    contentRows,
    taskRows,
    userRows,
    auditRows,
  ] = await Promise.all([
    getSettings(access.organizationId),
    rows(`
      SELECT c.id, c.name, c.state, c.phase, c.leader_name, c.target_cac_cents,
        c.ambassador_goal, c.sales_goal, c.status, c.budget_cents, c.tracking_mode,
        c.notes, c.updated_at, c.created_at
      FROM cities c WHERE ${scope.where}
      ORDER BY CASE c.phase WHEN 'Piloto' THEN 1 WHEN 'Ativa' THEN 2 WHEN 'Preparação' THEN 3 ELSE 4 END, c.name
    `, scope.values),
    rows(`
      SELECT a.id, a.city_id, c.name AS city_name, a.name, a.code, a.email, a.whatsapp, a.whatsapp_authorized_at,
        a.level, a.status, a.onboarding_status, a.training_progress, a.terms_accepted_at,
        a.pause_reason, a.updated_at, a.created_at
      FROM ambassadors a JOIN cities c ON c.id = a.city_id
      WHERE c.organization_id=? AND (${ambassadorWhere.where})
      ORDER BY CASE a.status WHEN 'Ativo' THEN 1 WHEN 'Em treinamento' THEN 2 ELSE 3 END, a.name
    `, [access.organizationId,...ambassadorWhere.values]),
    rows(`
      SELECT id, city_id, period, reach, leads, organic_leads, sales, revenue_cents,
        cost_cents, media_cost_cents, refunds, satisfaction, partners, events, note, created_at
      FROM city_updates WHERE ${cityUpdateWhere.where} ORDER BY period DESC, id DESC LIMIT 1000
    `, cityUpdateWhere.values),
    rows(`
      SELECT u.id, u.ambassador_id, u.period, u.leads, u.sales, u.actions, u.contents,
        u.events, u.cost_cents, u.note, u.created_at
      FROM ambassador_updates u
      JOIN ambassadors a ON a.id = u.ambassador_id
      JOIN cities c ON c.id = a.city_id
      WHERE c.organization_id=? AND (${ambassadorUpdateWhere.where})
      ORDER BY u.period DESC, u.id DESC LIMIT 1000
    `, [access.organizationId,...ambassadorUpdateWhere.values]),
    rows(`
      SELECT l.id, l.city_id, c.name AS city_name, l.ambassador_id,
        COALESCE(a.name, '') AS ambassador_name, l.partner_id, l.event_id, l.content_id,
        l.name, l.email, l.whatsapp, l.status, l.channel, l.source_label, l.campaign,
        l.consent_at, l.consent_source, l.consent_purpose, l.consent_revoked_at,
        l.consent_revocation_reason, l.assigned_to_email, l.created_at
      FROM leads l
      JOIN cities c ON c.id = l.city_id
      LEFT JOIN ambassadors a ON a.id = l.ambassador_id
      WHERE ${leadsScope.where}
      ORDER BY l.id DESC LIMIT 1000
    `, leadsScope.values),
    rows(`
      SELECT s.id, s.lead_id, s.city_id, s.ambassador_id, s.product, s.amount_cents,
        s.status, s.paid_at, s.updated_at, s.created_at
      FROM sales s JOIN leads l ON l.id = s.lead_id
      WHERE ${leadsScope.where}
      ORDER BY s.id DESC LIMIT 1000
    `, leadsScope.values),
    rows(`
      SELECT id, city_id, ambassador_id, partner_id, event_id, category, channel,
        period, amount_cents, note, created_at
      FROM costs WHERE city_id IN (SELECT id FROM cities WHERE organization_id=?) AND (${costWhere.where}) ORDER BY period DESC, id DESC LIMIT 1000
    `, [access.organizationId,...costWhere.values]),
    rows(`
      SELECT p.id, p.city_id, c.name AS city_name, p.name, p.type, p.contact_name,
        p.whatsapp, p.status, p.next_action, p.created_at
      FROM partners p JOIN cities c ON c.id = p.city_id
      WHERE ${scope.where} ORDER BY p.id DESC LIMIT 500
    `, scope.values),
    rows(`
      SELECT e.id, e.city_id, c.name AS city_name, e.partner_id, e.name, e.event_date,
        e.status, e.owner_name, e.cost_cents, e.reach, e.leads, e.sales, e.created_at
      FROM events e JOIN cities c ON c.id = e.city_id
      WHERE ${scope.where} ORDER BY e.event_date DESC, e.id DESC LIMIT 500
    `, scope.values),
    rows(`
      SELECT x.id, x.city_id, COALESCE(c.name, 'Todas as cidades') AS city_name,
        x.title, x.type, x.channel, x.version, x.status, x.url, x.instructions,
        x.expires_at, x.created_at
      FROM contents x LEFT JOIN cities c ON c.id = x.city_id
      WHERE x.organization_id=? AND (${contentWhere.where})
      ORDER BY CASE x.status WHEN 'Aprovado' THEN 1 WHEN 'Em revisão' THEN 2 ELSE 3 END, x.id DESC LIMIT 500
    `, [access.organizationId,...contentWhere.values]),
    rows(`
      SELECT t.id, t.city_id, t.ambassador_id, COALESCE(a.name, 'Equipe da cidade') AS ambassador_name,
        t.title, t.category, t.due_date, t.status, t.completed_at, t.created_at
      FROM tasks t LEFT JOIN ambassadors a ON a.id = t.ambassador_id
      WHERE t.organization_id=? AND (${access.role === "Administrador" ? "t.city_id IS NULL OR " : ""}${taskWhere.where}) ORDER BY CASE t.status WHEN 'Pendente' THEN 1 ELSE 2 END, t.due_date, t.id DESC LIMIT 500
    `, [access.organizationId,...taskWhere.values]),
    access.role === "Administrador" ? rows(`
      SELECT u.id, u.email, u.name, u.role, u.city_id, COALESCE(c.name, '') AS city_name,
        u.ambassador_id, COALESCE(a.name, '') AS ambassador_name, u.active, u.created_at,
        EXISTS(SELECT 1 FROM user_credentials cr WHERE cr.email = lower(u.email)) AS has_password
      FROM app_users u
      LEFT JOIN cities c ON c.id = u.city_id
      LEFT JOIN ambassadors a ON a.id = u.ambassador_id
      WHERE u.organization_id=?
      ORDER BY CASE u.role WHEN 'Administrador' THEN 1 WHEN 'Coordenação' THEN 2 ELSE 3 END, u.name
    `, [access.organizationId]) : Promise.resolve([]),
    access.role === "Administrador" ? rows(`
      SELECT id, actor_email, action, entity_type, entity_id, summary, created_at,
        -- Feito pela Assessoria Elite: autor é (ou foi) assessor e não é membro desta organização.
        (EXISTS(SELECT 1 FROM platform_advisors adv WHERE lower(adv.email)=lower(audit_logs.actor_email))
         AND NOT EXISTS(SELECT 1 FROM app_users m WHERE m.organization_id=audit_logs.organization_id AND lower(m.email)=lower(audit_logs.actor_email))) AS advisory
      FROM audit_logs WHERE organization_id=? ORDER BY id DESC LIMIT 100
    `, [access.organizationId]) : Promise.resolve([]),
  ]);

  const cities: CityRecord[] = cityRows.map((row) => ({
    id: asNumber(row.id),
    name: String(row.name),
    state: String(row.state),
    phase: String(row.phase),
    leaderName: access.role === "Embaixador" ? "" : String(row.leader_name ?? ""),
    targetCacCents: access.role === "Embaixador" ? 0 : asNumber(row.target_cac_cents),
    ambassadorGoal: access.role === "Embaixador" ? 0 : asNumber(row.ambassador_goal),
    salesGoal: access.role === "Embaixador" ? 0 : asNumber(row.sales_goal),
    status: String(row.status),
    budgetCents: access.role === "Embaixador" ? 0 : asNumber(row.budget_cents),
    trackingMode: String(row.tracking_mode),
    notes: access.role === "Embaixador" ? "" : String(row.notes ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    createdAt: String(row.created_at),
  }));

  const ambassadors: AmbassadorRecord[] = ambassadorRows.map((row) => ({
    id: asNumber(row.id),
    cityId: asNumber(row.city_id),
    cityName: String(row.city_name),
    name: String(row.name),
    code: String(row.code),
    email: String(row.email ?? ""),
    whatsapp: String(row.whatsapp ?? ""),
    whatsappAuthorizedAt: nullableText(row.whatsapp_authorized_at),
    level: String(row.level),
    status: String(row.status),
    onboardingStatus: String(row.onboarding_status),
    trainingProgress: asNumber(row.training_progress),
    termsAcceptedAt: nullableText(row.terms_accepted_at),
    pauseReason: String(row.pause_reason ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    createdAt: String(row.created_at),
  }));

  const cityUpdates: CityUpdateRecord[] = cityUpdateRows.map((row) => ({
    id: asNumber(row.id), cityId: asNumber(row.city_id), period: String(row.period),
    reach: asNumber(row.reach), leads: asNumber(row.leads), organicLeads: asNumber(row.organic_leads),
    sales: asNumber(row.sales), revenueCents: asNumber(row.revenue_cents), costCents: asNumber(row.cost_cents),
    mediaCostCents: asNumber(row.media_cost_cents), refunds: asNumber(row.refunds), satisfaction: asNumber(row.satisfaction),
    partners: asNumber(row.partners), events: asNumber(row.events), note: String(row.note ?? ""), createdAt: String(row.created_at),
  }));

  const ambassadorUpdates: AmbassadorUpdateRecord[] = ambassadorUpdateRows.map((row) => ({
    id: asNumber(row.id), ambassadorId: asNumber(row.ambassador_id), period: String(row.period),
    leads: asNumber(row.leads), sales: asNumber(row.sales), actions: asNumber(row.actions),
    contents: asNumber(row.contents), events: asNumber(row.events), costCents: asNumber(row.cost_cents),
    note: String(row.note ?? ""), createdAt: String(row.created_at),
  }));

  const leads: LeadRecord[] = leadRows.map((row) => ({
    id: asNumber(row.id), cityId: asNumber(row.city_id), cityName: String(row.city_name),
    ambassadorId: asNullableNumber(row.ambassador_id), ambassadorName: String(row.ambassador_name ?? ""),
    partnerId: asNullableNumber(row.partner_id), eventId: asNullableNumber(row.event_id), contentId: asNullableNumber(row.content_id),
    name: access.role === "Embaixador" ? `Lead #${asNumber(row.id)}` : String(row.name),
    email: access.role === "Embaixador" ? "" : String(row.email ?? ""),
    whatsapp: access.role === "Embaixador" ? "" : String(row.whatsapp ?? ""),
    status: String(row.status), channel: String(row.channel), sourceLabel: String(row.source_label ?? ""),
    campaign: String(row.campaign ?? ""), consentAt: String(row.consent_at),
    consentSource: access.role === "Embaixador" ? "Registrado" : String(row.consent_source),
    consentPurpose: access.role === "Embaixador" ? "Registrado" : String(row.consent_purpose),
    consentRevokedAt: nullableText(row.consent_revoked_at),
    consentRevocationReason: access.role === "Embaixador" ? "" : String(row.consent_revocation_reason ?? ""),
    assignedToEmail: access.role === "Embaixador" ? "" : String(row.assigned_to_email ?? ""),
    createdAt: String(row.created_at),
  }));

  const sales: SaleRecord[] = saleRows.map((row) => ({
    id: asNumber(row.id), leadId: asNumber(row.lead_id), cityId: asNumber(row.city_id),
    ambassadorId: asNullableNumber(row.ambassador_id), product: String(row.product ?? ""),
    amountCents: asNumber(row.amount_cents), status: String(row.status), paidAt: nullableText(row.paid_at),
    updatedAt: String(row.updated_at ?? ""), createdAt: String(row.created_at),
  }));

  const costs: CostRecord[] = costRows.map((row) => ({
    id: asNumber(row.id), cityId: asNumber(row.city_id), ambassadorId: asNullableNumber(row.ambassador_id),
    partnerId: asNullableNumber(row.partner_id), eventId: asNullableNumber(row.event_id), category: String(row.category),
    channel: String(row.channel), period: String(row.period), amountCents: asNumber(row.amount_cents),
    note: String(row.note ?? ""), createdAt: String(row.created_at),
  }));

  const partners: PartnerRecord[] = partnerRows.map((row) => ({
    id: asNumber(row.id), cityId: asNumber(row.city_id), cityName: String(row.city_name), name: String(row.name),
    type: String(row.type), contactName: access.role === "Embaixador" ? "" : String(row.contact_name ?? ""),
    whatsapp: access.role === "Embaixador" ? "" : String(row.whatsapp ?? ""),
    status: String(row.status), nextAction: access.role === "Embaixador" ? "" : String(row.next_action ?? ""), createdAt: String(row.created_at),
  }));

  const events: EventRecord[] = eventRows.map((row) => ({
    id: asNumber(row.id), cityId: asNumber(row.city_id), cityName: String(row.city_name),
    partnerId: asNullableNumber(row.partner_id), name: String(row.name), eventDate: String(row.event_date),
    status: String(row.status), ownerName: access.role === "Embaixador" ? "" : String(row.owner_name ?? ""),
    costCents: access.role === "Embaixador" ? 0 : asNumber(row.cost_cents),
    reach: access.role === "Embaixador" ? 0 : asNumber(row.reach),
    leads: access.role === "Embaixador" ? 0 : asNumber(row.leads),
    sales: access.role === "Embaixador" ? 0 : asNumber(row.sales), createdAt: String(row.created_at),
  }));

  const contents: ContentRecord[] = contentRows.map((row) => ({
    id: asNumber(row.id), cityId: asNullableNumber(row.city_id), cityName: String(row.city_name),
    title: String(row.title), type: String(row.type), channel: String(row.channel), version: String(row.version),
    status: String(row.status), url: String(row.url ?? ""), instructions: String(row.instructions ?? ""),
    expiresAt: nullableText(row.expires_at), createdAt: String(row.created_at),
  }));

  const tasks: TaskRecord[] = taskRows.map((row) => ({
    id: asNumber(row.id), cityId: asNullableNumber(row.city_id), ambassadorId: asNullableNumber(row.ambassador_id),
    ambassadorName: String(row.ambassador_name), title: String(row.title), category: String(row.category),
    dueDate: nullableText(row.due_date), status: String(row.status), completedAt: nullableText(row.completed_at),
    createdAt: String(row.created_at),
  }));

  const users: UserProfileRecord[] = userRows.map((row) => ({
    id: asNumber(row.id), email: String(row.email), name: String(row.name), role: String(row.role) as UserRole,
    cityId: asNullableNumber(row.city_id), cityName: String(row.city_name ?? ""),
    ambassadorId: asNullableNumber(row.ambassador_id), ambassadorName: String(row.ambassador_name ?? ""),
    active: Boolean(row.active), hasPassword: Number(row.has_password) === 1, createdAt: String(row.created_at),
  }));

  const auditLogs: AuditRecord[] = auditRows.map((row) => ({
    id: asNumber(row.id), actorEmail: String(row.actor_email), action: String(row.action),
    entityType: String(row.entity_type), entityId: asNullableNumber(row.entity_id),
    summary: String(row.summary ?? ""), createdAt: String(row.created_at), advisory: Number(row.advisory) === 1,
  }));

  // Transparência: quem administra a organização vê quem da Assessoria Elite tem acesso.
  const advisors = access.role === "Administrador" && access.organizationId !== 1 ? await listActiveAdvisors() : [];

  const people = ["Administrador", "Coordenação", "Líder"].includes(access.role) ? await rows(`SELECT id, city_id, name FROM territory_people WHERE (${tableScope.where}) AND (leader=1 OR EXISTS(SELECT 1 FROM ambassadors a WHERE a.person_id=territory_people.id) OR NOT EXISTS(SELECT 1 FROM leads l WHERE l.person_id=territory_people.id AND l.consent_revoked_at IS NOT NULL)) ORDER BY name LIMIT 200`, tableScope.values) : [];
  return {
    people: people.map(p => ({id: String(p.id), cityId: Number(p.city_id), name: String(p.name)})),
    access,
    settings,
    cities,
    ambassadors,
    cityUpdates,
    ambassadorUpdates,
    leads,
    sales,
    costs,
    partners,
    events,
    contents,
    tasks,
    users,
    advisors,
    auditLogs,
    lastUpdated: brazilTimestamp(),
  };
}

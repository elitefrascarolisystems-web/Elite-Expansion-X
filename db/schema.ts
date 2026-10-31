import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable('organizations', {
  requestId:text('request_id').unique(),
  id: integer('id').primaryKey({autoIncrement:true}), name:text('name').notNull(),
  ownerEmail:text('owner_email').notNull(), active:integer('active').notNull().default(1),
  createdAt:text('created_at').notNull(),
});

export const cities = sqliteTable("cities", {
  organizationId: integer("organization_id").notNull().default(1),
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  state: text("state").notNull().default("MG"),
  phase: text("phase").notNull().default("Preparação"),
  leaderName: text("leader_name").notNull().default(""),
  targetCacCents: integer("target_cac_cents").notNull().default(0),
  ambassadorGoal: integer("ambassador_goal").notNull().default(10),
  salesGoal: integer("sales_goal").notNull().default(100),
  status: text("status").notNull().default("Planejada"),
  budgetCents: integer("budget_cents").notNull().default(0),
  trackingMode: text("tracking_mode").notNull().default("Consolidado"),
  notes: text("notes").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [uniqueIndex("cities_name_unique").on(t.organizationId,t.name,t.state)]);

export const ambassadors = sqliteTable("ambassadors", {
  personId: text("person_id"),
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  email: text("email").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  whatsappAuthorizedAt: text("whatsapp_authorized_at"),
  level: text("level").notNull().default("Indicador"),
  status: text("status").notNull().default("Candidato"),
  onboardingStatus: text("onboarding_status").notNull().default("Pendente"),
  trainingProgress: integer("training_progress").notNull().default(0),
  termsAcceptedAt: text("terms_accepted_at"),
  pauseReason: text("pause_reason").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("ambassadors_person_unique").on(table.personId),
  index("ambassadors_city_idx").on(table.cityId),
  index("ambassadors_email_idx").on(table.email),
]);

export const appUsers = sqliteTable("app_users", {
  organizationId: integer("organization_id").notNull().default(1),
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("Embaixador"),
  cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }),
  ambassadorId: integer("ambassador_id").references(() => ambassadors.id, { onDelete: "set null" }),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** Cargo na equipe (ex.: "Executivo de Vendas"); só descreve, quem define o acesso é a função. */
  title: text("title").notNull().default(""),
  /** Ciclo de mentoria da pessoa na Elite (0 = não é mentorada). */
  mentorshipCycle: integer("mentorship_cycle").notNull().default(0),
  /** Quando a pessoa fechou a tela de boas-vindas nesta organização. */
  welcomedAt: text("welcomed_at"),
  /** Guias "Como usar" que a pessoa já fechou nesta organização (chaves separadas por vírgula). */
  guidesSeen: text("guides_seen").notNull().default(""),
  /** Portal (Mentorado/Assinante): a pessoa do mapa ou a empresa assinante ligada a este login. */
  personId: text("person_id"),
  businessId: text("business_id"),
  /** Portal: quem da Elite acompanha esta pessoa ou empresa, e o próximo encontro combinado. */
  portalOwnerEmail: text("portal_owner_email").notNull().default(""),
  nextMeetingAt: text("next_meeting_at"),
  nextMeetingNote: text("next_meeting_note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("app_users_email_unique").on(table.organizationId,table.email),
  index("app_users_city_idx").on(table.cityId),
]);

export const settings = sqliteTable("settings", {
  organizationId: integer("organization_id").notNull().default(1),
  id: integer("id").primaryKey(),
  ownerEmail: text("owner_email").notNull().default("teamfrascaroli@gmail.com"),
  referralBaseUrl: text("referral_base_url").notNull().default(""),
  attributionModel: text("attribution_model").notNull().default("Origem principal declarada"),
  minActiveAmbassadors: integer("min_active_ambassadors").notNull().default(0),
  minConfirmedPayments: integer("min_confirmed_payments").notNull().default(0),
  minActivePartners: integer("min_active_partners").notNull().default(0),
  minDataPeriods: integer("min_data_periods").notNull().default(0),
  inactivityDays: integer("inactivity_days").notNull().default(0),
  organicGoalPercent: integer("organic_goal_percent").notNull().default(0),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

export const cityUpdates = sqliteTable("city_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  reach: integer("reach").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  organicLeads: integer("organic_leads").notNull().default(0),
  sales: integer("sales").notNull().default(0),
  revenueCents: integer("revenue_cents").notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  mediaCostCents: integer("media_cost_cents").notNull().default(0),
  refunds: integer("refunds").notNull().default(0),
  satisfaction: integer("satisfaction").notNull().default(0),
  partners: integer("partners").notNull().default(0),
  events: integer("events").notNull().default(0),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("city_updates_city_period_idx").on(table.cityId, table.period)]);

export const ambassadorUpdates = sqliteTable("ambassador_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ambassadorId: integer("ambassador_id")
    .notNull()
    .references(() => ambassadors.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  leads: integer("leads").notNull().default(0),
  sales: integer("sales").notNull().default(0),
  actions: integer("actions").notNull().default(0),
  contents: integer("contents").notNull().default(0),
  events: integer("events").notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("ambassador_updates_period_idx").on(table.ambassadorId, table.period)]);

export const partners = sqliteTable("partners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("Parceiro local"),
  contactName: text("contact_name").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  status: text("status").notNull().default("Em conversa"),
  nextAction: text("next_action").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("partners_city_idx").on(table.cityId)]);

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  partnerId: integer("partner_id").references(() => partners.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  eventDate: text("event_date").notNull(),
  status: text("status").notNull().default("Planejado"),
  ownerName: text("owner_name").notNull().default(""),
  costCents: integer("cost_cents").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  sales: integer("sales").notNull().default(0),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("events_city_date_idx").on(table.cityId, table.eventDate)]);

export const contents = sqliteTable("contents", {
  organizationId: integer("organization_id").notNull().default(1),
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("Mensagem"),
  channel: text("channel").notNull().default("WhatsApp"),
  version: text("version").notNull().default("1.0"),
  status: text("status").notNull().default("Em revisão"),
  url: text("url").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  expiresAt: text("expires_at"),
  /** Para quem o material aparece: Embaixadores, Mentorados, Assinantes ou Todos. */
  audience: text("audience").notNull().default("Embaixadores"),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("contents_city_idx").on(table.cityId)]);

export const leads = sqliteTable("leads", {
  personId: text("person_id"),
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  ambassadorId: integer("ambassador_id").references(() => ambassadors.id, { onDelete: "set null" }),
  partnerId: integer("partner_id").references(() => partners.id, { onDelete: "set null" }),
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  contentId: integer("content_id").references(() => contents.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  normalizedEmail: text("normalized_email"),
  normalizedWhatsapp: text("normalized_whatsapp"),
  status: text("status").notNull().default("Lead válido"),
  channel: text("channel").notNull(),
  sourceLabel: text("source_label").notNull().default(""),
  campaign: text("campaign").notNull().default(""),
  utmSource: text("utm_source").notNull().default(""),
  utmMedium: text("utm_medium").notNull().default(""),
  utmCampaign: text("utm_campaign").notNull().default(""),
  consentAt: text("consent_at").notNull(),
  consentSource: text("consent_source").notNull(),
  consentPurpose: text("consent_purpose").notNull(),
  consentRevokedAt: text("consent_revoked_at"),
  consentRevocationReason: text("consent_revocation_reason").notNull().default(""),
  assignedToEmail: text("assigned_to_email").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("leads_person_unique").on(table.personId),
  index("leads_city_idx").on(table.cityId),
  index("leads_ambassador_idx").on(table.ambassadorId),
  index("leads_normalized_email_idx").on(table.normalizedEmail),
  index("leads_normalized_whatsapp_idx").on(table.normalizedWhatsapp),
]);

export const sales = sqliteTable("sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  ambassadorId: integer("ambassador_id").references(() => ambassadors.id, { onDelete: "set null" }),
  product: text("product").notNull().default(""),
  amountCents: integer("amount_cents").notNull().default(0),
  status: text("status").notNull().default("Em negociação"),
  paidAt: text("paid_at"),
  updatedAt: text("updated_at").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("sales_lead_unique").on(table.leadId),
  index("sales_city_idx").on(table.cityId),
]);

export const costs = sqliteTable("costs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  ambassadorId: integer("ambassador_id").references(() => ambassadors.id, { onDelete: "set null" }),
  partnerId: integer("partner_id").references(() => partners.id, { onDelete: "set null" }),
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  channel: text("channel").notNull().default("Outro"),
  period: text("period").notNull(),
  amountCents: integer("amount_cents").notNull(),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("costs_city_period_idx").on(table.cityId, table.period)]);

export const tasks = sqliteTable("tasks", {
  organizationId: integer("organization_id").notNull().default(1),
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id").references(() => cities.id, { onDelete: "cascade" }),
  ambassadorId: integer("ambassador_id").references(() => ambassadors.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("Missão"),
  dueDate: text("due_date"),
  status: text("status").notNull().default("Pendente"),
  completedAt: text("completed_at"),
  updatedBy: text("updated_by").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("tasks_ambassador_idx").on(table.ambassadorId)]);

export const auditLogs = sqliteTable("audit_logs", {
  organizationId: integer("organization_id").notNull().default(1),
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  summary: text("summary").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("audit_logs_actor_idx").on(table.actorEmail)]);

// Additive territorial records. No precise residential locations are stored.
export const territoryPeople = sqliteTable("territory_people", {
  id: text("id").primaryKey(), cityId: integer("city_id").notNull().references(() => cities.id),
  name: text("name").notNull(), leader: integer("leader").notNull().default(0),
  referrerId: text("referrer_id"), createdBy: text("created_by").notNull(),
  // Local (empresa, escritório, network) ao qual a pessoa se liga; no mapa ela aparece ali, nunca na residência.
  placeId: text("place_id"), placeLink: text("place_link").notNull().default(""),
  // Bairro (região) da pessoa: sem local, ela aparece no centro do bairro, nunca na residência.
  regionId: text("region_id"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("territory_people_city_idx").on(t.cityId), index("territory_people_referrer_idx").on(t.referrerId), index("territory_people_place_idx").on(t.placeId), index("territory_people_region_idx").on(t.regionId)]);
/** Bairros de cada cidade. O ponto no mapa fica em territory_locations com a chave "region:<id>". */
export const territoryRegions = sqliteTable("territory_regions", {
  id: text("id").primaryKey(), cityId: integer("city_id").notNull().references(() => cities.id),
  name: text("name").notNull(), nameKey: text("name_key").notNull(),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("territory_regions_unique").on(t.cityId, t.nameKey)]);
export const territoryLocations = sqliteTable("territory_locations", {
  entityKey: text("entity_key").primaryKey(), cityId: integer("city_id").notNull().references(() => cities.id),
  latitude: real("latitude"), longitude: real("longitude"), region: text("region").notNull().default(""),
  precision: text("precision").notNull(), source: text("source").notNull(),
  validated: integer("validated").notNull().default(0), visibility: text("visibility").notNull().default("Equipe"),
  authorizedBy: text("authorized_by").notNull(), authorizedAt: text("authorized_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, t => [index("territory_locations_city_idx").on(t.cityId), index("territory_locations_bounds_idx").on(t.longitude,t.latitude)]);
export const territoryActions = sqliteTable("territory_actions", {
  id: text("id").primaryKey(), cityId: integer("city_id").notNull().references(() => cities.id),
  personId: text("person_id").references(() => territoryPeople.id), name: text("name").notNull(),
  category: text("category").notNull(), status: text("status").notNull(), responsible: text("responsible").notNull(),
  dueDate: text("due_date").notNull(), createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("territory_actions_city_date_idx").on(t.cityId,t.dueDate),index("territory_actions_person_idx").on(t.personId)]);
export const territoryRoles = sqliteTable('territory_roles', {
 id:text('id').primaryKey(),personId:text('person_id').notNull().references(()=>territoryPeople.id),
 cityId:integer('city_id').notNull().references(()=>cities.id),role:text('role').notNull(),status:text('status').notNull(),
 responsible:text('responsible').notNull().default(''),source:text('source').notNull(),authorizedBy:text('authorized_by').notNull(),
 createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('territory_roles_unique').on(t.personId,t.cityId,t.role),index('territory_roles_city_role_idx').on(t.cityId,t.role,t.status)]);

export const businesses = sqliteTable('businesses', {
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull(),cityId:integer('city_id').notNull().references(()=>cities.id),
 name:text('name').notNull(),segment:text('segment').notNull(),district:text('district').notNull().default(''),address:text('address').notNull().default(''),
 placeType:text('place_type').notNull().default('Empresa'),sector:text('sector').notNull().default(''),
 source:text('source').notNull(),externalId:text('external_id'),identityKey:text('identity_key').notNull(),verifiedAt:text('verified_at'),
 ownerEmail:text('owner_email').notNull(),status:text('status').notNull(),nextAction:text('next_action').notNull().default(''),
 partnerId:integer('partner_id').references(()=>partners.id),version:integer('version').notNull().default(1),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('business_identity_unique').on(t.organizationId,t.cityId,t.identityKey),uniqueIndex('business_partner_unique').on(t.partnerId),uniqueIndex('business_external_unique').on(t.organizationId,t.source,t.externalId),index('business_org_city').on(t.organizationId,t.cityId)]);
export const opportunities = sqliteTable('opportunities', {
 followupJson:text('followup_json').notNull().default('{}'),
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull(),cityId:integer('city_id').notNull().references(()=>cities.id),
 leadId:integer('lead_id').notNull().references(()=>leads.id),businessId:text('business_id').references(()=>businesses.id),ownerEmail:text('owner_email').notNull(),
 temperature:text('temperature').notNull(),stage:text('stage').notNull(),nextAction:text('next_action').notNull(),dueDate:text('due_date').notNull(),lostReason:text('lost_reason').notNull().default(''),
 version:integer('version').notNull().default(1),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('opportunity_lead_unique').on(t.organizationId,t.leadId),index('opportunity_owner_due').on(t.organizationId,t.ownerEmail,t.dueDate)]);
export const commercialActivities = sqliteTable('commercial_activities', {
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull(),cityId:integer('city_id').notNull().references(()=>cities.id),
 opportunityId:text('opportunity_id').references(()=>opportunities.id),ownerEmail:text('owner_email').notNull(),kind:text('kind').notNull(),note:text('note').notNull(),activityDate:text('activity_date').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('commercial_activity_day').on(t.organizationId,t.ownerEmail,t.activityDate)]);
/** Cada troca de etapa de um atendimento, com data e autor — base do gráfico "tempo em cada etapa". */
export const opportunityStageEvents = sqliteTable('opportunity_stage_events', {
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull(),opportunityId:text('opportunity_id').notNull().references(()=>opportunities.id),
 fromStage:text('from_stage'),toStage:text('to_stage').notNull(),actorEmail:text('actor_email').notNull(),source:text('source').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('opportunity_stage_events_scope').on(t.organizationId,t.opportunityId,t.createdAt)]);
export const sellerGoals = sqliteTable('seller_goals', {
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull(),cityId:integer('city_id').notNull().references(()=>cities.id),ownerEmail:text('owner_email').notNull(),day:text('day').notNull(),cold:integer('cold').notNull(),hot:integer('hot').notNull(),contacts:integer('contacts').notNull(),updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('seller_goals_day').on(t.organizationId,t.cityId,t.ownerEmail,t.day)]);
export const sellerReports = sqliteTable('seller_reports', {
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull(),cityId:integer('city_id').notNull().references(()=>cities.id),ownerEmail:text('owner_email').notNull(),day:text('day').notNull(),blockers:text('blockers').notNull(),nextPlan:text('next_plan').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('seller_report_day').on(t.organizationId,t.cityId,t.ownerEmail,t.day)]);
export const cityDecisions = sqliteTable('city_decisions', {
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull(),cityId:integer('city_id').notNull().references(()=>cities.id),ownerEmail:text('owner_email').notNull(),decision:text('decision').notNull(),reason:text('reason').notNull(),nextAction:text('next_action').notNull(),reviewDate:text('review_date').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('city_decisions_scope').on(t.organizationId,t.cityId,t.createdAt)]);
export const organizationPlans = sqliteTable('organization_plans', {
 organizationId:integer('organization_id').primaryKey(),name:text('name'),userLimit:integer('user_limit'),cityLimit:integer('city_limit'),updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
});

export const organizationProfiles=sqliteTable('organization_profiles',{
 organizationId:integer('organization_id').primaryKey().references(()=>organizations.id),objective:text('objective').notNull().default(''),onboarding:text('onboarding').notNull().default('{}'),logo:text('logo'),updatedAt:text('updated_at').notNull(),
});
export const organizationInvites=sqliteTable('organization_invites',{
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull().references(()=>organizations.id),email:text('email').notNull(),name:text('name').notNull(),role:text('role').notNull(),cityId:integer('city_id').references(()=>cities.id),ambassadorId:integer('ambassador_id').references(()=>ambassadors.id),tokenHash:text('token_hash').notNull().unique(),expiresAt:text('expires_at').notNull(),revokedAt:text('revoked_at'),acceptedAt:text('accepted_at'),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),
});
export const organizationEntitlements=sqliteTable('organization_entitlements',{
 organizationId:integer('organization_id').primaryKey().references(()=>organizations.id),userLimit:integer('user_limit'),cityLimit:integer('city_limit'),storageBytes:integer('storage_bytes'),imports:integer('imports').notNull().default(1),exports:integer('exports').notNull().default(1),maps:integer('maps').notNull().default(1),externalMaps:integer('external_maps').notNull().default(0),reports:integer('reports').notNull().default(1),updatedAt:text('updated_at').notNull(),
});
export const platformAudit=sqliteTable('platform_audit',{
 id:integer('id').primaryKey({autoIncrement:true}),organizationId:integer('organization_id').notNull(),actorEmail:text('actor_email').notNull(),action:text('action').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
});
/** Time Elite com acesso de assessoria às organizações clientes (ver e editar, sempre auditado). */
export const platformAdvisors=sqliteTable('platform_advisors',{
 id:integer('id').primaryKey({autoIncrement:true}),email:text('email').notNull(),name:text('name').notNull().default(''),active:integer('active').notNull().default(1),grantedBy:text('granted_by').notNull(),grantedAt:text('granted_at').notNull(),revokedBy:text('revoked_by'),revokedAt:text('revoked_at'),
},(table)=>[uniqueIndex('platform_advisors_email_unique').on(table.email)]);
/** Login por e-mail e senha. A senha nunca é guardada: só o PBKDF2 com sal próprio. */
export const userCredentials=sqliteTable('user_credentials',{
 email:text('email').primaryKey(),passwordHash:text('password_hash').notNull(),passwordSalt:text('password_salt').notNull(),iterations:integer('iterations').notNull(),updatedAt:text('updated_at').notNull(),lastLoginAt:text('last_login_at'),
});
/** Sessões abertas. O navegador guarda o token; aqui fica só o SHA-256 dele. */
export const userSessions=sqliteTable('user_sessions',{
 tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),createdAt:text('created_at').notNull(),expiresAt:text('expires_at').notNull(),
},(table)=>[index('user_sessions_email_idx').on(table.email)]);
/** Links de uso único para criar ou trocar a senha (gerados por um administrador). */
export const passwordLinks=sqliteTable('password_links',{
 tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),expiresAt:text('expires_at').notNull(),usedAt:text('used_at'),
},(table)=>[index('password_links_email_idx').on(table.email)]);
/** Tentativas de login erradas, por e-mail e por endereço de rede, para bloquear quem tenta adivinhar. */
export const loginThrottle=sqliteTable('login_throttle',{
 key:text('key').primaryKey(),failures:integer('failures').notNull(),windowStartedAt:text('window_started_at').notNull(),lockedUntil:text('locked_until'),
});
/** Histórico do acompanhamento (Follow-up, FECHA, pós-venda): antes/depois de cada comando. */
export const followupEvents = sqliteTable('followup_events', {
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull(),
 opportunityId:text('opportunity_id').notNull().references(()=>opportunities.id),
 actorEmail:text('actor_email').notNull(),requestJson:text('request_json').notNull(),
 action:text('action').notNull(),note:text('note').notNull(),beforeJson:text('before_json').notNull(),afterJson:text('after_json').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('followup_history').on(t.organizationId,t.opportunityId,t.createdAt)]);

/** Portal: etapas da jornada de cada público (Mentorados ou Assinantes), definidas pela Elite. */
export const portalSteps = sqliteTable('portal_steps', {
 id:integer('id').primaryKey({autoIncrement:true}),organizationId:integer('organization_id').notNull(),audience:text('audience').notNull(),
 title:text('title').notNull(),description:text('description').notNull().default(''),position:integer('position').notNull().default(0),
 createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),
},(table)=>[index('portal_steps_org_idx').on(table.organizationId,table.audience)]);
/** Portal: etapas que cada membro já concluiu. */
export const portalProgress = sqliteTable('portal_progress', {
 userId:integer('user_id').notNull().references(()=>appUsers.id,{onDelete:'cascade'}),stepId:integer('step_id').notNull().references(()=>portalSteps.id,{onDelete:'cascade'}),
 doneAt:text('done_at').notNull(),
},(table)=>[uniqueIndex('portal_progress_unique').on(table.userId,table.stepId)]);
/** Assinatura de cada empresa (gestão comercial da plataforma; a cobrança acontece fora dela). */
export const organizationSubscriptions = sqliteTable('organization_subscriptions', {
 organizationId:integer('organization_id').primaryKey().references(()=>organizations.id),plan:text('plan').notNull().default(''),
 priceCents:integer('price_cents').notNull().default(0),paidUntil:text('paid_until'),notes:text('notes').notNull().default(''),
 updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
});
/** Banco de Ganchos (Sistema de Prospecção): frases de abordagem por situação, canal e setor. */
export const prospectHooks = sqliteTable('prospect_hooks', {
 id:integer('id').primaryKey({autoIncrement:true}),organizationId:integer('organization_id').notNull().references(()=>organizations.id),
 title:text('title').notNull(),situation:text('situation').notNull(),channel:text('channel').notNull().default('WhatsApp'),sector:text('sector').notNull().default(''),
 body:text('body').notNull(),status:text('status').notNull().default('Rascunho'),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},(t)=>[index('prospect_hooks_org_status_idx').on(t.organizationId,t.status,t.situation)]);
/**
 * Pedidos de titulares (LGPD, art. 18): acesso, correção, revogação e anonimização.
 * subject_ref aponta o titular (person:<id>, lead:<id> ou ambassador:<id>); depois da
 * anonimização o subject_label passa a ser o rótulo anônimo, nunca o nome.
 */
export const privacyRequests = sqliteTable('privacy_requests', {
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull().references(()=>organizations.id),
 kind:text('kind').notNull(),subjectRef:text('subject_ref').notNull(),subjectLabel:text('subject_label').notNull(),
 channel:text('channel').notNull(),receivedAt:text('received_at').notNull(),completedAt:text('completed_at').notNull(),
 note:text('note').notNull().default(''),actorEmail:text('actor_email').notNull(),
},(t)=>[index('privacy_requests_org_idx').on(t.organizationId,t.completedAt),index('privacy_requests_subject_idx').on(t.organizationId,t.subjectRef)]);
/**
 * Pedidos vindos da página pública /conheca: empresas interessadas na plataforma.
 * Só os donos da plataforma veem. ip_hash (IP + dia, com hash) só limita envios repetidos.
 */
export const subscriptionRequests = sqliteTable('subscription_requests', {
 id:text('id').primaryKey(),company:text('company').notNull(),contactName:text('contact_name').notNull(),email:text('email').notNull(),
 whatsapp:text('whatsapp').notNull(),city:text('city').notNull(),teamSize:text('team_size').notNull(),message:text('message').notNull().default(''),
 consentAt:text('consent_at').notNull(),ipHash:text('ip_hash').notNull(),status:text('status').notNull().default('Novo'),note:text('note').notNull().default(''),
 organizationId:integer('organization_id').references(()=>organizations.id),handledBy:text('handled_by').notNull().default(''),
 createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},(t)=>[index('subscription_requests_status_idx').on(t.status,t.createdAt),index('subscription_requests_ip_idx').on(t.ipHash,t.createdAt)]);
/**
 * Avisos por e-mail: o que cada pessoa quer receber em cada empresa. token serve
 * para o link "parar de receber" do próprio e-mail, sem precisar entrar.
 */
export const notificationPrefs = sqliteTable('notification_prefs', {
 organizationId:integer('organization_id').notNull().references(()=>organizations.id),email:text('email').notNull(),
 daily:integer('daily').notNull(),weekly:integer('weekly').notNull(),token:text('token').notNull(),
 updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
},(t)=>[uniqueIndex('notification_prefs_pk').on(t.organizationId,t.email),uniqueIndex('notification_prefs_token').on(t.token)]);
/** Um envio por pessoa, tipo e período: o aviso não sai duas vezes no mesmo dia (ou semana). */
export const notificationLog = sqliteTable('notification_log', {
 id:text('id').primaryKey(),organizationId:integer('organization_id').notNull(),email:text('email').notNull(),
 kind:text('kind').notNull(),period:text('period').notNull(),status:text('status').notNull(),detail:text('detail').notNull().default(''),createdAt:text('created_at').notNull(),
},(t)=>[uniqueIndex('notification_log_once').on(t.organizationId,t.email,t.kind,t.period),index('notification_log_created_idx').on(t.createdAt)]);
/** Cada rodada automática, para a gestão ver quando rodou e o que aconteceu. */
export const notificationRuns = sqliteTable('notification_runs', {
 id:text('id').primaryKey(),ranAt:text('ran_at').notNull(),configured:integer('configured').notNull(),
 sent:integer('sent').notNull(),failed:integer('failed').notNull(),skipped:integer('skipped').notNull(),detail:text('detail').notNull().default(''),
});

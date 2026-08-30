import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const cities = sqliteTable("cities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
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
});

export const ambassadors = sqliteTable("ambassadors", {
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
  index("ambassadors_city_idx").on(table.cityId),
  index("ambassadors_email_idx").on(table.email),
]);

export const appUsers = sqliteTable("app_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("Embaixador"),
  cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }),
  ambassadorId: integer("ambassador_id").references(() => ambassadors.id, { onDelete: "set null" }),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("app_users_email_unique").on(table.email),
  index("app_users_city_idx").on(table.cityId),
]);

export const settings = sqliteTable("settings", {
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
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("contents_city_idx").on(table.cityId)]);

export const leads = sqliteTable("leads", {
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
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  summary: text("summary").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("audit_logs_actor_idx").on(table.actorEmail)]);

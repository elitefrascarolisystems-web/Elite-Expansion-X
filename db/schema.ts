import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  whatsapp: text("whatsapp").notNull().default(""),
  level: text("level").notNull().default("Indicador"),
  status: text("status").notNull().default("Candidato"),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
  partners: integer("partners").notNull().default(0),
  events: integer("events").notNull().default(0),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const ambassadorUpdates = sqliteTable("ambassador_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ambassadorId: integer("ambassador_id")
    .notNull()
    .references(() => ambassadors.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  leads: integer("leads").notNull().default(0),
  sales: integer("sales").notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

CREATE TABLE `app_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'Embaixador' NOT NULL,
	`city_id` integer,
	`ambassador_id` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ambassador_id`) REFERENCES `ambassadors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_unique` ON `app_users` (`email`);--> statement-breakpoint
CREATE INDEX `app_users_city_idx` ON `app_users` (`city_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_email`);--> statement-breakpoint
CREATE TABLE `contents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer,
	`title` text NOT NULL,
	`type` text DEFAULT 'Mensagem' NOT NULL,
	`channel` text DEFAULT 'WhatsApp' NOT NULL,
	`version` text DEFAULT '1.0' NOT NULL,
	`status` text DEFAULT 'Em revisão' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`expires_at` text,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contents_city_idx` ON `contents` (`city_id`);--> statement-breakpoint
CREATE TABLE `costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`ambassador_id` integer,
	`partner_id` integer,
	`event_id` integer,
	`category` text NOT NULL,
	`channel` text DEFAULT 'Outro' NOT NULL,
	`period` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ambassador_id`) REFERENCES `ambassadors`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `costs_city_period_idx` ON `costs` (`city_id`,`period`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`partner_id` integer,
	`name` text NOT NULL,
	`event_date` text NOT NULL,
	`status` text DEFAULT 'Planejado' NOT NULL,
	`owner_name` text DEFAULT '' NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`reach` integer DEFAULT 0 NOT NULL,
	`leads` integer DEFAULT 0 NOT NULL,
	`sales` integer DEFAULT 0 NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `events_city_date_idx` ON `events` (`city_id`,`event_date`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`ambassador_id` integer,
	`partner_id` integer,
	`event_id` integer,
	`content_id` integer,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`normalized_email` text,
	`normalized_whatsapp` text,
	`status` text DEFAULT 'Lead válido' NOT NULL,
	`channel` text NOT NULL,
	`source_label` text DEFAULT '' NOT NULL,
	`campaign` text DEFAULT '' NOT NULL,
	`utm_source` text DEFAULT '' NOT NULL,
	`utm_medium` text DEFAULT '' NOT NULL,
	`utm_campaign` text DEFAULT '' NOT NULL,
	`consent_at` text NOT NULL,
	`consent_source` text NOT NULL,
	`consent_purpose` text NOT NULL,
	`assigned_to_email` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ambassador_id`) REFERENCES `ambassadors`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `leads_city_idx` ON `leads` (`city_id`);--> statement-breakpoint
CREATE INDEX `leads_ambassador_idx` ON `leads` (`ambassador_id`);--> statement-breakpoint
CREATE INDEX `leads_normalized_email_idx` ON `leads` (`normalized_email`);--> statement-breakpoint
CREATE INDEX `leads_normalized_whatsapp_idx` ON `leads` (`normalized_whatsapp`);--> statement-breakpoint
CREATE TABLE `partners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'Parceiro local' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Em conversa' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `partners_city_idx` ON `partners` (`city_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	`ambassador_id` integer,
	`product` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Em negociação' NOT NULL,
	`paid_at` text,
	`updated_at` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ambassador_id`) REFERENCES `ambassadors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_lead_unique` ON `sales` (`lead_id`);--> statement-breakpoint
CREATE INDEX `sales_city_idx` ON `sales` (`city_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner_email` text DEFAULT 'teamfrascaroli@gmail.com' NOT NULL,
	`referral_base_url` text DEFAULT '' NOT NULL,
	`attribution_model` text DEFAULT 'Origem principal declarada' NOT NULL,
	`min_active_ambassadors` integer DEFAULT 0 NOT NULL,
	`min_confirmed_payments` integer DEFAULT 0 NOT NULL,
	`min_active_partners` integer DEFAULT 0 NOT NULL,
	`min_data_periods` integer DEFAULT 0 NOT NULL,
	`inactivity_days` integer DEFAULT 0 NOT NULL,
	`organic_goal_percent` integer DEFAULT 0 NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer,
	`ambassador_id` integer,
	`title` text NOT NULL,
	`category` text DEFAULT 'Missão' NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`completed_at` text,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ambassador_id`) REFERENCES `ambassadors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_ambassador_idx` ON `tasks` (`ambassador_id`);--> statement-breakpoint
ALTER TABLE `ambassador_updates` ADD `actions` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ambassador_updates` ADD `contents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ambassador_updates` ADD `events` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `ambassador_updates_period_idx` ON `ambassador_updates` (`ambassador_id`,`period`);--> statement-breakpoint
ALTER TABLE `ambassadors` ADD `email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `ambassadors` ADD `onboarding_status` text DEFAULT 'Pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE `ambassadors` ADD `training_progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ambassadors` ADD `terms_accepted_at` text;--> statement-breakpoint
ALTER TABLE `ambassadors` ADD `pause_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `ambassadors` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `ambassadors_city_idx` ON `ambassadors` (`city_id`);--> statement-breakpoint
CREATE INDEX `ambassadors_email_idx` ON `ambassadors` (`email`);--> statement-breakpoint
ALTER TABLE `cities` ADD `budget_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cities` ADD `tracking_mode` text DEFAULT 'Consolidado' NOT NULL;--> statement-breakpoint
ALTER TABLE `cities` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cities` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `city_updates` ADD `media_cost_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `city_updates` ADD `refunds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `city_updates` ADD `satisfaction` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `city_updates_city_period_idx` ON `city_updates` (`city_id`,`period`);
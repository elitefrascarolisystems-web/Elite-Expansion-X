CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	`name` text NOT NULL,
	`segment` text NOT NULL,
	`district` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`external_id` text,
	`identity_key` text NOT NULL,
	`verified_at` text,
	`owner_email` text NOT NULL,
	`status` text NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`partner_id` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_identity_unique` ON `businesses` (`organization_id`,`city_id`,`identity_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `business_external_unique` ON `businesses` (`organization_id`,`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `business_org_city` ON `businesses` (`organization_id`,`city_id`);--> statement-breakpoint
CREATE TABLE `commercial_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	`opportunity_id` text,
	`owner_email` text NOT NULL,
	`kind` text NOT NULL,
	`note` text NOT NULL,
	`activity_date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `commercial_activity_day` ON `commercial_activities` (`organization_id`,`owner_email`,`activity_date`);--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	`lead_id` integer NOT NULL,
	`business_id` text,
	`owner_email` text NOT NULL,
	`temperature` text NOT NULL,
	`stage` text NOT NULL,
	`next_action` text NOT NULL,
	`due_date` text NOT NULL,
	`lost_reason` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_lead_unique` ON `opportunities` (`organization_id`,`lead_id`);--> statement-breakpoint
CREATE INDEX `opportunity_owner_due` ON `opportunities` (`organization_id`,`owner_email`,`due_date`);--> statement-breakpoint
CREATE TABLE `seller_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	`owner_email` text NOT NULL,
	`day` text NOT NULL,
	`cold` integer NOT NULL,
	`hot` integer NOT NULL,
	`contacts` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seller_goals_day` ON `seller_goals` (`organization_id`,`city_id`,`owner_email`,`day`);--> statement-breakpoint
CREATE TABLE `seller_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	`owner_email` text NOT NULL,
	`day` text NOT NULL,
	`blockers` text NOT NULL,
	`next_plan` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seller_report_day` ON `seller_reports` (`organization_id`,`city_id`,`owner_email`,`day`);
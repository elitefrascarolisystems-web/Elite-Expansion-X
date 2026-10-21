CREATE TABLE `contact_optouts` (
	`organization_id` integer NOT NULL,
	`identity_hash` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_optouts_identity` ON `contact_optouts` (`organization_id`,`identity_hash`);--> statement-breakpoint
CREATE TABLE `prospect_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`owner_email` text NOT NULL,
	`city_id` integer,
	`name` text NOT NULL,
	`whatsapp` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`temperature` text DEFAULT 'Frio' NOT NULL,
	`status` text DEFAULT 'A contatar' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`last_contacted_at` text,
	`lead_id` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_owner_whatsapp` ON `prospect_contacts` (`organization_id`,`owner_email`,`whatsapp`);--> statement-breakpoint
CREATE INDEX `prospect_owner_status` ON `prospect_contacts` (`organization_id`,`owner_email`,`status`);
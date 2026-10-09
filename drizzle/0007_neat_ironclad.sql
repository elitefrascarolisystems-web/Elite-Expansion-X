CREATE TABLE `organizations` (
	`request_id` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`owner_email` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_request_id_unique` ON `organizations` (`request_id`);--> statement-breakpoint
DROP INDEX `app_users_email_unique`;--> statement-breakpoint
ALTER TABLE `app_users` ADD `organization_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_unique` ON `app_users` (`organization_id`,`email`);--> statement-breakpoint
DROP INDEX `cities_name_unique`;--> statement-breakpoint
ALTER TABLE `cities` ADD `organization_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cities_name_unique` ON `cities` (`organization_id`,`name`,`state`);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `organization_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `contents` ADD `organization_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `organization_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `organization_id` integer DEFAULT 1 NOT NULL;
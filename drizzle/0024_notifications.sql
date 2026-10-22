CREATE TABLE `notification_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`email` text NOT NULL,
	`kind` text NOT NULL,
	`period` text NOT NULL,
	`status` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_log_once` ON `notification_log` (`organization_id`,`email`,`kind`,`period`);--> statement-breakpoint
CREATE INDEX `notification_log_created_idx` ON `notification_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `notification_prefs` (
	`organization_id` integer NOT NULL,
	`email` text NOT NULL,
	`daily` integer NOT NULL,
	`weekly` integer NOT NULL,
	`token` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_prefs_pk` ON `notification_prefs` (`organization_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_prefs_token` ON `notification_prefs` (`token`);--> statement-breakpoint
CREATE TABLE `notification_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`ran_at` text NOT NULL,
	`configured` integer NOT NULL,
	`sent` integer NOT NULL,
	`failed` integer NOT NULL,
	`skipped` integer NOT NULL,
	`detail` text DEFAULT '' NOT NULL
);

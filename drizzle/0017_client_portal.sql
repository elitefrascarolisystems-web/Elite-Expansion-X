CREATE TABLE `portal_progress` (
	`user_id` integer NOT NULL,
	`step_id` integer NOT NULL,
	`done_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_id`) REFERENCES `portal_steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_progress_unique` ON `portal_progress` (`user_id`,`step_id`);--> statement-breakpoint
CREATE TABLE `portal_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`audience` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `portal_steps_org_idx` ON `portal_steps` (`organization_id`,`audience`);--> statement-breakpoint
ALTER TABLE `app_users` ADD `person_id` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `business_id` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `portal_owner_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `next_meeting_at` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `next_meeting_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `contents` ADD `audience` text DEFAULT 'Embaixadores' NOT NULL;
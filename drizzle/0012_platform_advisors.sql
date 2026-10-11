CREATE TABLE `platform_advisors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`granted_by` text NOT NULL,
	`granted_at` text NOT NULL,
	`revoked_by` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_advisors_email_unique` ON `platform_advisors` (`email`);

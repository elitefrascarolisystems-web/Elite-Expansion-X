CREATE TABLE `login_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`window_started_at` text NOT NULL,
	`locked_until` text
);
--> statement-breakpoint
CREATE TABLE `password_links` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE INDEX `password_links_email_idx` ON `password_links` (`email`);--> statement-breakpoint
CREATE TABLE `user_credentials` (
	`email` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`iterations` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_sessions_email_idx` ON `user_sessions` (`email`);
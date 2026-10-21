ALTER TABLE `app_users` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `mentorship_cycle` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `welcomed_at` text;--> statement-breakpoint
ALTER TABLE `user_credentials` ADD `last_login_at` text;
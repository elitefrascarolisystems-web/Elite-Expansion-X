CREATE TABLE `city_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	`owner_email` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text NOT NULL,
	`next_action` text NOT NULL,
	`review_date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `city_decisions_scope` ON `city_decisions` (`organization_id`,`city_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `organization_plans` (
	`organization_id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`user_limit` integer,
	`city_limit` integer,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);

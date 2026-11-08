CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`scope` text NOT NULL,
	`city_id` integer,
	`owner_email` text DEFAULT '' NOT NULL,
	`metric` text NOT NULL,
	`target` integer NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`assumptions_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'Ativa' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `goals_status` ON `goals` (`organization_id`,`status`,`period_end`);--> statement-breakpoint
CREATE INDEX `goals_city_owner` ON `goals` (`organization_id`,`city_id`,`owner_email`);
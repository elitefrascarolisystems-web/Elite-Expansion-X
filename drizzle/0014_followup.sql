CREATE TABLE `followup_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`opportunity_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`request_json` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `followup_history` ON `followup_events` (`organization_id`,`opportunity_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `followup_json` text DEFAULT '{}' NOT NULL;
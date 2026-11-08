CREATE TABLE `person_places` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	`person_id` text NOT NULL,
	`business_id` text NOT NULL,
	`link` text NOT NULL,
	`authorized_by` text NOT NULL,
	`authorized_at` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `territory_people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `person_places_unique` ON `person_places` (`person_id`,`business_id`);--> statement-breakpoint
CREATE INDEX `person_places_business` ON `person_places` (`organization_id`,`business_id`);--> statement-breakpoint
CREATE INDEX `person_places_person` ON `person_places` (`person_id`);--> statement-breakpoint
ALTER TABLE `territory_actions` ADD `business_id` text;--> statement-breakpoint
CREATE INDEX `territory_actions_business_idx` ON `territory_actions` (`business_id`,`due_date`);
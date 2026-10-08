CREATE TABLE `territory_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`city_id` integer NOT NULL,
	`person_id` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`responsible` text NOT NULL,
	`due_date` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `territory_people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `territory_actions_city_date_idx` ON `territory_actions` (`city_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `territory_actions_person_idx` ON `territory_actions` (`person_id`);--> statement-breakpoint
CREATE TABLE `territory_locations` (
	`entity_key` text PRIMARY KEY NOT NULL,
	`city_id` integer NOT NULL,
	`latitude` real,
	`longitude` real,
	`region` text DEFAULT '' NOT NULL,
	`precision` text NOT NULL,
	`source` text NOT NULL,
	`validated` integer DEFAULT 0 NOT NULL,
	`visibility` text DEFAULT 'Equipe' NOT NULL,
	`authorized_by` text NOT NULL,
	`authorized_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `territory_locations_city_idx` ON `territory_locations` (`city_id`);--> statement-breakpoint
CREATE INDEX `territory_locations_bounds_idx` ON `territory_locations` (`longitude`,`latitude`);--> statement-breakpoint
CREATE TABLE `territory_people` (
	`id` text PRIMARY KEY NOT NULL,
	`city_id` integer NOT NULL,
	`name` text NOT NULL,
	`leader` integer DEFAULT 0 NOT NULL,
	`referrer_id` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `territory_people_city_idx` ON `territory_people` (`city_id`);--> statement-breakpoint
CREATE INDEX `territory_people_referrer_idx` ON `territory_people` (`referrer_id`);--> statement-breakpoint
ALTER TABLE `ambassadors` ADD `person_id` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `person_id` text;
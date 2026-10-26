CREATE TABLE `territory_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`city_id` integer NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `territory_regions_unique` ON `territory_regions` (`city_id`,`name_key`);--> statement-breakpoint
ALTER TABLE `territory_people` ADD `region_id` text;--> statement-breakpoint
CREATE INDEX `territory_people_region_idx` ON `territory_people` (`region_id`);
ALTER TABLE `businesses` ADD `place_type` text DEFAULT 'Empresa' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `sector` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `territory_people` ADD `place_id` text;--> statement-breakpoint
ALTER TABLE `territory_people` ADD `place_link` text DEFAULT '' NOT NULL;
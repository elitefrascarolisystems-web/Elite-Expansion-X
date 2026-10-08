CREATE TABLE `territory_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`city_id` integer NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`authorized_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `territory_people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `territory_roles_unique` ON `territory_roles` (`person_id`,`city_id`,`role`);--> statement-breakpoint
CREATE INDEX `territory_roles_city_role_idx` ON `territory_roles` (`city_id`,`role`,`status`);
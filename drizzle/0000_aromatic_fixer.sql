CREATE TABLE `ambassador_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ambassador_id` integer NOT NULL,
	`period` text NOT NULL,
	`leads` integer DEFAULT 0 NOT NULL,
	`sales` integer DEFAULT 0 NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`ambassador_id`) REFERENCES `ambassadors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ambassadors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`level` text DEFAULT 'Indicador' NOT NULL,
	`status` text DEFAULT 'Candidato' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ambassadors_code_unique` ON `ambassadors` (`code`);--> statement-breakpoint
CREATE TABLE `cities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`state` text DEFAULT 'MG' NOT NULL,
	`phase` text DEFAULT 'Preparação' NOT NULL,
	`leader_name` text DEFAULT '' NOT NULL,
	`target_cac_cents` integer DEFAULT 0 NOT NULL,
	`ambassador_goal` integer DEFAULT 10 NOT NULL,
	`sales_goal` integer DEFAULT 100 NOT NULL,
	`status` text DEFAULT 'Planejada' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cities_name_unique` ON `cities` (`name`);--> statement-breakpoint
CREATE TABLE `city_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`period` text NOT NULL,
	`reach` integer DEFAULT 0 NOT NULL,
	`leads` integer DEFAULT 0 NOT NULL,
	`organic_leads` integer DEFAULT 0 NOT NULL,
	`sales` integer DEFAULT 0 NOT NULL,
	`revenue_cents` integer DEFAULT 0 NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`partners` integer DEFAULT 0 NOT NULL,
	`events` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade
);

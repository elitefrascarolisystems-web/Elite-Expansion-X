CREATE TABLE `prospect_hooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`title` text NOT NULL,
	`situation` text NOT NULL,
	`channel` text DEFAULT 'WhatsApp' NOT NULL,
	`sector` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'Rascunho' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prospect_hooks_org_status_idx` ON `prospect_hooks` (`organization_id`,`status`,`situation`);
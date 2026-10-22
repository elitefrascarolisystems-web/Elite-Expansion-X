CREATE TABLE `subscription_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`contact_name` text NOT NULL,
	`email` text NOT NULL,
	`whatsapp` text NOT NULL,
	`city` text NOT NULL,
	`team_size` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`consent_at` text NOT NULL,
	`ip_hash` text NOT NULL,
	`status` text DEFAULT 'Novo' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`organization_id` integer,
	`handled_by` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subscription_requests_status_idx` ON `subscription_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `subscription_requests_ip_idx` ON `subscription_requests` (`ip_hash`,`created_at`);
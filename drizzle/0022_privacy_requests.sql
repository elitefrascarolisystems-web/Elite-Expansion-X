CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`kind` text NOT NULL,
	`subject_ref` text NOT NULL,
	`subject_label` text NOT NULL,
	`channel` text NOT NULL,
	`received_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`actor_email` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `privacy_requests_org_idx` ON `privacy_requests` (`organization_id`,`completed_at`);--> statement-breakpoint
CREATE INDEX `privacy_requests_subject_idx` ON `privacy_requests` (`organization_id`,`subject_ref`);
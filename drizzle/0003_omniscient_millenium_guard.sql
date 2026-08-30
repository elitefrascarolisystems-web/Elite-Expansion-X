ALTER TABLE `leads` ADD `consent_revoked_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `consent_revocation_reason` text DEFAULT '' NOT NULL;
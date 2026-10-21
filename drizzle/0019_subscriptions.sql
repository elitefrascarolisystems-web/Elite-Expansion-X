CREATE TABLE `organization_subscriptions` (
	`organization_id` integer PRIMARY KEY NOT NULL,
	`plan` text DEFAULT '' NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`paid_until` text,
	`notes` text DEFAULT '' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Mentorados não ocupam vaga da equipe: os gatilhos de limite passam a ignorá-los.
DROP TRIGGER IF EXISTS tenant_user_limit_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS tenant_user_limit_update;
--> statement-breakpoint
CREATE TRIGGER tenant_user_limit_insert BEFORE INSERT ON app_users WHEN NEW.active=1 AND NEW.role<>'Mentorado' AND EXISTS(SELECT 1 FROM organization_entitlements e WHERE e.organization_id=NEW.organization_id AND e.user_limit IS NOT NULL AND (SELECT count(*) FROM app_users u WHERE u.organization_id=NEW.organization_id AND u.active=1 AND u.role<>'Mentorado')>=e.user_limit) BEGIN SELECT RAISE(ABORT,'tenant_user_limit'); END;
--> statement-breakpoint
CREATE TRIGGER tenant_user_limit_update BEFORE UPDATE OF active,organization_id,role ON app_users WHEN NEW.active=1 AND NEW.role<>'Mentorado' AND (OLD.active<>1 OR OLD.organization_id<>NEW.organization_id OR OLD.role='Mentorado') AND EXISTS(SELECT 1 FROM organization_entitlements e WHERE e.organization_id=NEW.organization_id AND e.user_limit IS NOT NULL AND (SELECT count(*) FROM app_users u WHERE u.organization_id=NEW.organization_id AND u.active=1 AND u.role<>'Mentorado')>=e.user_limit) BEGIN SELECT RAISE(ABORT,'tenant_user_limit'); END;

CREATE TABLE `organization_entitlements` (
	`organization_id` integer PRIMARY KEY NOT NULL,
	`user_limit` integer,
	`city_limit` integer,
	`storage_bytes` integer,
	`imports` integer DEFAULT 1 NOT NULL,
	`exports` integer DEFAULT 1 NOT NULL,
	`maps` integer DEFAULT 1 NOT NULL,
	`external_maps` integer DEFAULT 0 NOT NULL,
	`reports` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `organization_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`city_id` integer,
	`ambassador_id` integer,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`accepted_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ambassador_id`) REFERENCES `ambassadors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_invites_token_hash_unique` ON `organization_invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `organization_profiles` (
	`organization_id` integer PRIMARY KEY NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`onboarding` text DEFAULT '{}' NOT NULL,
	`logo` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `platform_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER tenant_user_limit_insert BEFORE INSERT ON app_users WHEN NEW.active=1 AND EXISTS(SELECT 1 FROM organization_entitlements e WHERE e.organization_id=NEW.organization_id AND e.user_limit IS NOT NULL AND (SELECT count(*) FROM app_users u WHERE u.organization_id=NEW.organization_id AND u.active=1)>=e.user_limit) BEGIN SELECT RAISE(ABORT,'tenant_user_limit'); END;
--> statement-breakpoint
CREATE TRIGGER tenant_user_limit_update BEFORE UPDATE OF active,organization_id ON app_users WHEN NEW.active=1 AND (OLD.active<>1 OR OLD.organization_id<>NEW.organization_id) AND EXISTS(SELECT 1 FROM organization_entitlements e WHERE e.organization_id=NEW.organization_id AND e.user_limit IS NOT NULL AND (SELECT count(*) FROM app_users u WHERE u.organization_id=NEW.organization_id AND u.active=1)>=e.user_limit) BEGIN SELECT RAISE(ABORT,'tenant_user_limit'); END;
--> statement-breakpoint
CREATE TRIGGER tenant_city_limit_insert BEFORE INSERT ON cities WHEN NEW.status='Ativa' AND EXISTS(SELECT 1 FROM organization_entitlements e WHERE e.organization_id=NEW.organization_id AND e.city_limit IS NOT NULL AND (SELECT count(*) FROM cities c WHERE c.organization_id=NEW.organization_id AND c.status='Ativa')>=e.city_limit) BEGIN SELECT RAISE(ABORT,'tenant_city_limit'); END;
--> statement-breakpoint
CREATE TRIGGER tenant_city_limit_update BEFORE UPDATE OF status,organization_id ON cities WHEN NEW.status='Ativa' AND (OLD.status<>'Ativa' OR OLD.organization_id<>NEW.organization_id) AND EXISTS(SELECT 1 FROM organization_entitlements e WHERE e.organization_id=NEW.organization_id AND e.city_limit IS NOT NULL AND (SELECT count(*) FROM cities c WHERE c.organization_id=NEW.organization_id AND c.status='Ativa')>=e.city_limit) BEGIN SELECT RAISE(ABORT,'tenant_city_limit'); END;
--> statement-breakpoint
CREATE TRIGGER tenant_protect_owner BEFORE UPDATE ON app_users WHEN EXISTS(SELECT 1 FROM organizations o WHERE o.id=OLD.organization_id AND lower(o.owner_email)=lower(OLD.email)) AND (NEW.active<>1 OR NEW.role<>'Administrador' OR NEW.city_id IS NOT NULL OR NEW.organization_id<>OLD.organization_id OR lower(NEW.email)<>lower(OLD.email)) BEGIN SELECT RAISE(ABORT,'tenant_protect_owner'); END;
--> statement-breakpoint
CREATE TRIGGER tenant_protect_owner_delete BEFORE DELETE ON app_users WHEN EXISTS(SELECT 1 FROM organizations o WHERE o.id=OLD.organization_id AND lower(o.owner_email)=lower(OLD.email)) BEGIN SELECT RAISE(ABORT,'tenant_protect_owner'); END;

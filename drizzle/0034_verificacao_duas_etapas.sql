-- Verificação em duas etapas (app autenticador). A chave fica só aqui; os códigos de recuperação, só o hash.
-- `enabled_at` vazio: cadastro começado e ainda não confirmado com um código.
CREATE TABLE `user_mfa` (
	`email` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`enabled_at` text,
	`recovery_hashes` text DEFAULT '[]' NOT NULL,
	`last_step` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
-- Depois da senha certa, quem tem a verificação ligada recebe um desafio de 5 minutos para digitar o código.
CREATE TABLE `mfa_challenges` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mfa_challenges_email_idx` ON `mfa_challenges` (`email`);
--> statement-breakpoint
-- A empresa pode exigir a verificação em duas etapas de toda a equipe (os portais ficam de fora).
ALTER TABLE `organizations` ADD `mfa_required` integer DEFAULT 0 NOT NULL;

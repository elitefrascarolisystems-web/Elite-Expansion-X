-- A empresa cliente decide o acesso da Assessoria Elite: liberado (padrão, como antes), liberado até uma data ou desligado.
ALTER TABLE `organizations` ADD `advisory_mode` text DEFAULT 'liberado' NOT NULL;
--> statement-breakpoint
ALTER TABLE `organizations` ADD `advisory_until` text;
--> statement-breakpoint
ALTER TABLE `organizations` ADD `advisory_changed_by` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `organizations` ADD `advisory_changed_at` text;

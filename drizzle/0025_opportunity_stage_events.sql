CREATE TABLE `opportunity_stage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`opportunity_id` text NOT NULL,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`actor_email` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `opportunity_stage_events_scope` ON `opportunity_stage_events` (`organization_id`,`opportunity_id`,`created_at`);--> statement-breakpoint
-- Histórico que já existia: as atividades "Etapa" guardam a troca como texto ("Novo → Qualificado; temperatura Quente").
INSERT INTO `opportunity_stage_events` (`id`,`organization_id`,`opportunity_id`,`from_stage`,`to_stage`,`actor_email`,`source`,`created_at`)
SELECT 'hist-' || h.id, h.organization_id, h.opportunity_id, h.from_stage, h.to_stage, h.owner_email, 'Histórico', h.created_at
FROM (
  SELECT a.id, a.organization_id, a.opportunity_id, a.owner_email, a.created_at,
    NULLIF(trim(substr(a.note, 1, instr(a.note, ' → ') - 1)), 'Cadastro') AS from_stage,
    trim(CASE
      WHEN instr(substr(a.note, instr(a.note, ' → ') + 3), ';') > 0 THEN substr(substr(a.note, instr(a.note, ' → ') + 3), 1, instr(substr(a.note, instr(a.note, ' → ') + 3), ';') - 1)
      WHEN instr(substr(a.note, instr(a.note, ' → ') + 3), ' (') > 0 THEN substr(substr(a.note, instr(a.note, ' → ') + 3), 1, instr(substr(a.note, instr(a.note, ' → ') + 3), ' (') - 1)
      ELSE substr(a.note, instr(a.note, ' → ') + 3)
    END) AS to_stage
  FROM `commercial_activities` a
  WHERE a.kind = 'Etapa' AND a.opportunity_id IS NOT NULL AND instr(a.note, ' → ') > 0
    AND EXISTS (SELECT 1 FROM `opportunities` o WHERE o.id = a.opportunity_id)
) h
WHERE h.to_stage <> '' AND (h.from_stage IS NULL OR h.from_stage <> h.to_stage);
--> statement-breakpoint
-- Atendimentos sem nenhuma troca registrada (ex.: indicação do portal): começam na etapa atual, na data em que foram criados.
INSERT INTO `opportunity_stage_events` (`id`,`organization_id`,`opportunity_id`,`from_stage`,`to_stage`,`actor_email`,`source`,`created_at`)
SELECT 'ini-' || o.id, o.organization_id, o.id, NULL, o.stage, o.created_by, 'Histórico', o.created_at
FROM `opportunities` o
WHERE NOT EXISTS (SELECT 1 FROM `opportunity_stage_events` e WHERE e.opportunity_id = o.id);

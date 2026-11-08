ALTER TABLE `settings` ADD `origin_tracked_since` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `territory_people` ADD `source` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Empresas que já existiam: a origem passa a ser gravada a partir do dia desta migração (dia de Brasília).
UPDATE `settings` SET `origin_tracked_since` = substr(datetime('now', '-3 hours'), 1, 10) WHERE `origin_tracked_since` = '';--> statement-breakpoint
-- Passado só com prova (idempotente: só toca quem ainda está sem origem). 1) Importação.
UPDATE `territory_people` SET `source` = 'Importação' WHERE `source` = '' AND (
  EXISTS (SELECT 1 FROM `territory_roles` r WHERE r.person_id = `territory_people`.id AND r.source LIKE 'Importação%')
  OR EXISTS (SELECT 1 FROM `leads` l WHERE l.person_id = `territory_people`.id AND l.source_label = 'Importação da rede por planilha'));--> statement-breakpoint
-- 2) Portal do Mentorado (o "Lead informado" do Embaixador, de canal "Embaixador", fica sem origem).
UPDATE `territory_people` SET `source` = 'Portal do mentorado' WHERE `source` = '' AND (
  EXISTS (SELECT 1 FROM `territory_roles` r WHERE r.person_id = `territory_people`.id AND r.source = 'Acesso ao portal de mentoria')
  OR EXISTS (SELECT 1 FROM `leads` l WHERE l.person_id = `territory_people`.id AND l.channel = 'Indicação' AND l.source_label LIKE '%(mentorado)'));--> statement-breakpoint
-- 3) Mapeamento: só quem virou atendimento com origem de mapeamento. O resto fica sem origem.
UPDATE `territory_people` SET `source` = 'Mapeamento' WHERE `source` = '' AND
  EXISTS (SELECT 1 FROM `leads` l WHERE l.person_id = `territory_people`.id AND l.source_label LIKE 'Mapeamento%');

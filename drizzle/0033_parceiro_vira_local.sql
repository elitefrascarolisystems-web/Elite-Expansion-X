-- Simplificação, parte 3 (J6): o parceiro passa a ser um local marcado como parceiro.
-- Nada é apagado: a tabela partners continua (eventos e histórico apontam para ela). Cada parceiro sem local
-- ganha um vínculo: primeiro com um local de mesmo nome na mesma cidade; se não houver, um local novo
-- (setor em branco, para a gestão revisar), com o mesmo ponto no mapa.
UPDATE `businesses` SET
  `partner_id` = (SELECT p.`id` FROM `partners` p WHERE p.`city_id` = `businesses`.`city_id` AND lower(trim(p.`name`)) = lower(trim(`businesses`.`name`)) AND NOT EXISTS(SELECT 1 FROM `businesses` b2 WHERE b2.`partner_id` = p.`id`) ORDER BY p.`id` LIMIT 1),
  `status` = 'Parceira', `version` = `version` + 1
WHERE `partner_id` IS NULL AND EXISTS(SELECT 1 FROM `partners` p WHERE p.`city_id` = `businesses`.`city_id` AND lower(trim(p.`name`)) = lower(trim(`businesses`.`name`)) AND NOT EXISTS(SELECT 1 FROM `businesses` b2 WHERE b2.`partner_id` = p.`id`));
--> statement-breakpoint
INSERT INTO `businesses` (`id`, `organization_id`, `city_id`, `name`, `segment`, `district`, `address`, `source`, `external_id`, `identity_key`, `verified_at`, `owner_email`, `status`, `next_action`, `partner_id`, `version`, `created_by`, `created_at`, `updated_at`, `place_type`, `sector`)
SELECT '00000000-0000-4000-8000-' || printf('%012d', p.`id`), c.`organization_id`, p.`city_id`, p.`name`,
  CASE WHEN length(trim(p.`type`)) >= 2 THEN p.`type` ELSE 'Parceiro' END, '', '', 'Cadastro de parceiro', NULL,
  'parceiro-' || p.`id`, NULL, COALESCE(NULLIF(p.`created_by`, ''), o.`owner_email`), 'Parceira', p.`next_action`, p.`id`, 1,
  COALESCE(NULLIF(p.`created_by`, ''), o.`owner_email`), p.`created_at`, p.`created_at`, 'Empresa', ''
FROM `partners` p JOIN `cities` c ON c.`id` = p.`city_id` JOIN `organizations` o ON o.`id` = c.`organization_id`
WHERE NOT EXISTS(SELECT 1 FROM `businesses` b WHERE b.`partner_id` = p.`id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `territory_locations` (`entity_key`, `city_id`, `latitude`, `longitude`, `region`, `precision`, `source`, `validated`, `visibility`, `authorized_by`, `authorized_at`, `updated_at`)
SELECT 'business:' || b.`id`, l.`city_id`, l.`latitude`, l.`longitude`, l.`region`, l.`precision`, l.`source`, l.`validated`, l.`visibility`, l.`authorized_by`, l.`authorized_at`, l.`updated_at`
FROM `businesses` b JOIN `territory_locations` l ON l.`entity_key` = 'partner:' || b.`partner_id`
WHERE b.`partner_id` IS NOT NULL;

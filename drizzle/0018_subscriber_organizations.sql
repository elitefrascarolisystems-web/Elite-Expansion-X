-- Empresas assinantes usam uma organização própria (a plataforma inteira), não o portal.
-- O tipo de local "Escritório Elite" vira "Escritório": serve para a Elite e para cada assinante.
UPDATE `businesses` SET `place_type` = 'Escritório' WHERE `place_type` = 'Escritório Elite';--> statement-breakpoint
UPDATE `app_users` SET `active` = 0 WHERE `role` = 'Assinante';--> statement-breakpoint
DELETE FROM `portal_steps` WHERE `audience` = 'Assinantes';--> statement-breakpoint
UPDATE `contents` SET `status` = 'Retirado' WHERE `audience` = 'Assinantes';

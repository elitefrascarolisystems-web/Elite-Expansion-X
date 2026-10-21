-- O papel/situação "Assinante" no mapa vira "Cliente assinante", para não confundir com empresa assinante da plataforma.
UPDATE `territory_roles` SET `role` = 'Cliente assinante' WHERE `role` = 'Assinante';
--> statement-breakpoint
UPDATE `businesses` SET `status` = 'Cliente assinante' WHERE `status` = 'Assinante';

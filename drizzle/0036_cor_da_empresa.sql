-- Cor da empresa nos destaques da plataforma (vazio = dourado). Paleta fechada em lib/accent.ts.
ALTER TABLE `organizations` ADD `accent` text DEFAULT '' NOT NULL;

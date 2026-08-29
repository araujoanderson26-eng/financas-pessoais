CREATE TABLE `user_settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`profile_name` text DEFAULT 'Anderson de Araujo' NOT NULL,
	`product_name` text DEFAULT 'Nexo Finanças Pessoais' NOT NULL,
	`signature` text DEFAULT 'by Anderson de Araujo' NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`locale` text DEFAULT 'pt-BR' NOT NULL,
	`date_format` text DEFAULT 'DD/MM/AAAA' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`density` text DEFAULT 'comfortable' NOT NULL,
	`hide_values` integer DEFAULT 0 NOT NULL,
	`export_identity` integer DEFAULT 1 NOT NULL,
	`export_owner` integer DEFAULT 1 NOT NULL,
	`export_generated_at` integer DEFAULT 1 NOT NULL,
	`export_totals` integer DEFAULT 1 NOT NULL,
	`export_filters` integer DEFAULT 1 NOT NULL,
	`export_freeze_header` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `financial_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`net_worth` real DEFAULT 0 NOT NULL,
	`assets` real DEFAULT 0 NOT NULL,
	`liabilities` real DEFAULT 0 NOT NULL,
	`account_balance` real DEFAULT 0 NOT NULL,
	`investments` real DEFAULT 0 NOT NULL,
	`emergency_reserve` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_snapshots_owner_date_unique` ON `financial_snapshots` (`owner`,`snapshot_date`);
--> statement-breakpoint
CREATE TABLE `backup_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `backup_events_owner_created_idx` ON `backup_events` (`owner`,`created_at`);

CREATE TABLE `monthly_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`month` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`account` text DEFAULT 'Não informado' NOT NULL,
	`value` real NOT NULL,
	`billing_day` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'Ativa' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaction_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`transaction_id` integer NOT NULL,
	`action` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `scope` text DEFAULT 'PF' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `institution` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `closing_day` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `due_day` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `installment_current` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `installment_total` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `archived_at` text;
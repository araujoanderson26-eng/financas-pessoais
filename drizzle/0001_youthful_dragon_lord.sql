CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`credit_limit` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`month` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`target` real NOT NULL,
	`current` real DEFAULT 0 NOT NULL,
	`deadline` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wealth_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`group_name` text NOT NULL,
	`value` real NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `account` text DEFAULT 'Não informado' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `recurrence` text DEFAULT 'Não' NOT NULL;
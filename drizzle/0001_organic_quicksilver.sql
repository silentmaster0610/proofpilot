CREATE TABLE `automation_tokens` (
	`user_id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_tokens_token_hash_unique` ON `automation_tokens` (`token_hash`);
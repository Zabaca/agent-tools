CREATE TABLE `intents` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`stated_at` integer NOT NULL,
	`intent_text` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`completed_at` integer,
	`completion_note` text,
	`superseded_by` text,
	`cwd` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_intents_session` ON `intents` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_intents_status` ON `intents` (`status`);--> statement-breakpoint
CREATE INDEX `idx_intents_stated_at` ON `intents` (`stated_at`);
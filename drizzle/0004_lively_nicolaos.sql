CREATE TABLE `media_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`threshold` integer NOT NULL,
	`used` integer NOT NULL,
	`created` integer NOT NULL,
	`acknowledged` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `attachments` ADD `provider` text DEFAULT 'r2' NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD `storagePath` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `purpose` text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD `state` text DEFAULT 'attached' NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD `expectedSize` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD `expires` integer;--> statement-breakpoint
ALTER TABLE `attachments` ADD `thumbnailId` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `parentId` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `duration` real;--> statement-breakpoint
ALTER TABLE `attachments` ADD `waveform` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `deletedAt` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `avatarImageId` text;
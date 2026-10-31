PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`senderId` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created` integer NOT NULL,
	`provider` text DEFAULT 'supabase' NOT NULL,
	`storagePath` text,
	`purpose` text DEFAULT 'chat' NOT NULL,
	`state` text DEFAULT 'attached' NOT NULL,
	`expectedSize` integer DEFAULT 0 NOT NULL,
	`expires` integer,
	`thumbnailId` text,
	`parentId` text,
	`duration` real,
	`waveform` text,
	`deletedAt` integer,
	`resumableUrl` text
);
--> statement-breakpoint
INSERT INTO `__new_attachments`("id", "roomId", "senderId", "name", "mime", "size", "created", "provider", "storagePath", "purpose", "state", "expectedSize", "expires", "thumbnailId", "parentId", "duration", "waveform", "deletedAt", "resumableUrl") SELECT "id", "roomId", "senderId", "name", "mime", "size", "created", "provider", "storagePath", "purpose", "state", "expectedSize", "expires", "thumbnailId", "parentId", "duration", "waveform", "deletedAt", "resumableUrl" FROM `attachments`;--> statement-breakpoint
DROP TABLE `attachments`;--> statement-breakpoint
ALTER TABLE `__new_attachments` RENAME TO `attachments`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;

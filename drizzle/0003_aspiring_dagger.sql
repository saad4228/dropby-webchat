CREATE TABLE `music_choices` (
	`roomId` text NOT NULL,
	`sessionId` text NOT NULL,
	`trackId` text NOT NULL,
	`response` text NOT NULL,
	`changeRequested` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`roomId`, `sessionId`)
);
--> statement-breakpoint
CREATE TABLE `music_states` (
	`roomId` text PRIMARY KEY NOT NULL,
	`trackId` text,
	`controllerId` text,
	`position` real DEFAULT 0 NOT NULL,
	`playing` integer DEFAULT 0 NOT NULL,
	`updatedAt` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `music_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`attachmentId` text NOT NULL,
	`title` text NOT NULL,
	`duration` real NOT NULL,
	`addedBy` text NOT NULL,
	`created` integer NOT NULL,
	`played` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_tracks_attachmentId_unique` ON `music_tracks` (`attachmentId`);--> statement-breakpoint
CREATE INDEX `music_queue` ON `music_tracks` (`roomId`,`played`,`created`);
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`senderId` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`roomId` text NOT NULL,
	`sessionId` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`banned` integer DEFAULT 0 NOT NULL,
	`muted` integer DEFAULT 0 NOT NULL,
	`lastSeen` integer NOT NULL,
	`typingUntil` integer DEFAULT 0 NOT NULL,
	`inCall` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`roomId`, `sessionId`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`senderId` text NOT NULL,
	`text` text NOT NULL,
	`replyId` text,
	`attachmentId` text,
	`created` integer NOT NULL,
	`edited` integer,
	`deleted` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `message_room_created` ON `messages` (`roomId`,`created`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`messageId` text NOT NULL,
	`sessionId` text NOT NULL,
	`emoji` text NOT NULL,
	PRIMARY KEY(`messageId`, `sessionId`, `emoji`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`messageId` text NOT NULL,
	`reporterId` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`messageId` text NOT NULL,
	`text` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visibility` text NOT NULL,
	`passwordHash` text,
	`owner` text NOT NULL,
	`theme` text DEFAULT 'alpine' NOT NULL,
	`locked` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_slug_unique` ON `rooms` (`slug`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tokenHash` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text NOT NULL,
	`color` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_tokenHash_unique` ON `sessions` (`tokenHash`);--> statement-breakpoint
CREATE TABLE `signals` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`senderId` text NOT NULL,
	`recipientId` text NOT NULL,
	`data` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `signals_recipient` ON `signals` (`recipientId`,`created`);
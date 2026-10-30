ALTER TABLE `sessions` ADD `accountId` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_accountId_unique` ON `sessions` (`accountId`);
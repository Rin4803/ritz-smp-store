ALTER TABLE `player_reports` ADD `handledByDiscordId` varchar(64);--> statement-breakpoint
ALTER TABLE `player_reports` ADD `handledByDisplayName` varchar(128);--> statement-breakpoint
ALTER TABLE `player_reports` ADD `handledAt` timestamp;--> statement-breakpoint
ALTER TABLE `player_reports` ADD `closedAt` timestamp;
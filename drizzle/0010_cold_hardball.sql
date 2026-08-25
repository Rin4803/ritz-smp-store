CREATE TABLE `player_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(64) NOT NULL,
	`reporterDiscordId` varchar(64) NOT NULL,
	`reporterDisplayName` varchar(128) NOT NULL,
	`targetDiscordId` varchar(64),
	`targetDiscordName` varchar(128) NOT NULL,
	`targetMinecraftIGN` varchar(16),
	`category` varchar(64) NOT NULL,
	`details` text NOT NULL,
	`status` enum('ใหม่','กำลังตรวจสอบ','ปิดแล้ว') NOT NULL DEFAULT 'ใหม่',
	`editCount` int NOT NULL DEFAULT 0,
	`discordMessageId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `player_reports_id` PRIMARY KEY(`id`)
);

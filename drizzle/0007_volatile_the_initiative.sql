CREATE TABLE `discord_verification_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discordUserId` varchar(64) NOT NULL,
	`code` varchar(4) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discord_verification_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `discord_verification_codes_discordUserId_unique` UNIQUE(`discordUserId`)
);

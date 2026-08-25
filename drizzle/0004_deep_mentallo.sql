CREATE TABLE `discord_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discordUserId` varchar(64) NOT NULL,
	`minecraftIGN` varchar(16) NOT NULL,
	`minecraftUuid` varchar(64) NOT NULL,
	`verifiedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discord_verifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `discord_verifications_discordUserId_unique` UNIQUE(`discordUserId`),
	CONSTRAINT `discord_verifications_minecraftUuid_unique` UNIQUE(`minecraftUuid`)
);

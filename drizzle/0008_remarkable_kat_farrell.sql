CREATE TABLE `managed_server_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managedServerId` int NOT NULL,
	`discordTokenEnv` varchar(128),
	`rconHost` varchar(255),
	`rconPort` int DEFAULT 25575,
	`rconPasswordEnv` varchar(128),
	`channelConfig` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managed_server_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `managed_server_configs_managedServerId_unique` UNIQUE(`managedServerId`)
);
--> statement-breakpoint
CREATE TABLE `managed_servers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`minecraftHost` varchar(255) NOT NULL,
	`minecraftPort` int NOT NULL DEFAULT 25565,
	`discordGuildId` varchar(64),
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managed_servers_id` PRIMARY KEY(`id`),
	CONSTRAINT `managed_servers_slug_unique` UNIQUE(`slug`)
);

CREATE TABLE `discord_embed_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(64) NOT NULL,
	`name` varchar(80) NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT 'EC4899',
	`imageUrl` varchar(1024),
	`footer` varchar(2048),
	`defaultChannelId` varchar(64),
	`createdBy` varchar(64) NOT NULL,
	`updatedBy` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discord_embed_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `health_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service` varchar(64) NOT NULL,
	`status` enum('ok','degraded','down','error') NOT NULL,
	`message` text NOT NULL,
	`metadata` text NOT NULL,
	`guildId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `health_events_id` PRIMARY KEY(`id`)
);

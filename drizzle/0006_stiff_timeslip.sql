CREATE TABLE `minecraft_presence_state` (
	`id` int NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`lastOnline` int NOT NULL,
	`playerListKnown` int NOT NULL,
	`lastPlayerNames` text NOT NULL,
	`lastCheckedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `minecraft_presence_state_id` PRIMARY KEY(`id`)
);

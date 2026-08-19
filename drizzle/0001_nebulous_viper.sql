CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`minecraftIGN` varchar(64) NOT NULL,
	`rankId` int NOT NULL,
	`rankName` varchar(128) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`paymentMethod` varchar(64) NOT NULL DEFAULT 'PromptPay / ออมสิน',
	`slipUrl` text NOT NULL,
	`slipKey` varchar(255) NOT NULL,
	`status` enum('รอตรวจสอบ','สำเร็จ','ยกเลิก') NOT NULL DEFAULT 'รอตรวจสอบ',
	`adminNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ranks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`duration` varchar(64) NOT NULL DEFAULT 'ถาวร',
	`color` varchar(32) NOT NULL DEFAULT 'gold',
	`badge` varchar(64) NOT NULL DEFAULT 'POPULAR',
	`description` text NOT NULL,
	`features` text NOT NULL,
	`roleId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ranks_id` PRIMARY KEY(`id`)
);

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var ranks = mysqlTable("ranks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: varchar("duration", { length: 64 }).default("\u0E16\u0E32\u0E27\u0E23").notNull(),
  color: varchar("color", { length: 32 }).default("gold").notNull(),
  badge: varchar("badge", { length: 64 }).default("POPULAR").notNull(),
  description: text("description").notNull(),
  features: text("features").notNull(),
  // JSON string array of perks
  roleId: varchar("roleId", { length: 64 }),
  // Discord role ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  minecraftIGN: varchar("minecraftIGN", { length: 64 }).notNull(),
  rankId: int("rankId").notNull(),
  rankName: varchar("rankName", { length: 128 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 64 }).default("PromptPay / \u0E2D\u0E2D\u0E21\u0E2A\u0E34\u0E19").notNull(),
  slipUrl: text("slipUrl").notNull(),
  slipKey: varchar("slipKey", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A", "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08", "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"]).default("\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A").notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var walletTransactions = mysqlTable("wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["topup", "purchase", "refund", "admin_adjust"]).notNull(),
  description: text("description").notNull(),
  referenceKey: varchar("referenceKey", { length: 128 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var discordVerifications = mysqlTable("discord_verifications", {
  id: int("id").autoincrement().primaryKey(),
  discordUserId: varchar("discordUserId", { length: 64 }).notNull().unique(),
  minecraftIGN: varchar("minecraftIGN", { length: 16 }).notNull(),
  minecraftUuid: varchar("minecraftUuid", { length: 64 }).notNull().unique(),
  bio: text("bio"),
  playStyle: varchar("playStyle", { length: 128 }),
  verifiedAt: timestamp("verifiedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var discordVerificationCodes = mysqlTable("discord_verification_codes", {
  id: int("id").autoincrement().primaryKey(),
  discordUserId: varchar("discordUserId", { length: 64 }).notNull().unique(),
  code: varchar("code", { length: 4 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var minecraftPresenceState = mysqlTable("minecraft_presence_state", {
  id: int("id").primaryKey(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastOnline: int("lastOnline").notNull(),
  playerListKnown: int("playerListKnown").notNull(),
  lastPlayerNames: text("lastPlayerNames").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var managedServers = mysqlTable("managed_servers", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  minecraftHost: varchar("minecraftHost", { length: 255 }).notNull(),
  minecraftPort: int("minecraftPort").default(25565).notNull(),
  discordGuildId: varchar("discordGuildId", { length: 64 }),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var managedServerConfigs = mysqlTable("managed_server_configs", {
  id: int("id").autoincrement().primaryKey(),
  managedServerId: int("managedServerId").notNull().unique(),
  discordTokenEnv: varchar("discordTokenEnv", { length: 128 }),
  rconHost: varchar("rconHost", { length: 255 }),
  rconPort: int("rconPort").default(25575),
  rconPasswordEnv: varchar("rconPasswordEnv", { length: 128 }),
  channelConfig: text("channelConfig").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var discordEmbedTemplates = mysqlTable("discord_embed_templates", {
  id: int("id").autoincrement().primaryKey(),
  guildId: varchar("guildId", { length: 64 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  color: varchar("color", { length: 16 }).default("EC4899").notNull(),
  imageUrl: varchar("imageUrl", { length: 1024 }),
  footer: varchar("footer", { length: 2048 }),
  defaultChannelId: varchar("defaultChannelId", { length: 64 }),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var healthEvents = mysqlTable("health_events", {
  id: int("id").autoincrement().primaryKey(),
  service: varchar("service", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["ok", "degraded", "down", "error"]).notNull(),
  message: text("message").notNull(),
  metadata: text("metadata").notNull(),
  guildId: varchar("guildId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? "",
  discordGuildId: process.env.DISCORD_GUILD_ID ?? "",
  discordStoreChannelId: process.env.DISCORD_STORE_CHANNEL_ID ?? "",
  discordSupportChannelId: process.env.DISCORD_SUPPORT_CHANNEL_ID ?? "",
  discordDonateChannelId: process.env.DISCORD_DONATE_CHANNEL_ID ?? "",
  discordDonateLogChannelId: process.env.DISCORD_DONATE_LOG_CHANNEL_ID ?? "",
  discordOrdersChannelId: process.env.DISCORD_ORDERS_CHANNEL_ID ?? "",
  discordAdminRoleId: process.env.DISCORD_ADMIN_ROLE_ID ?? "",
  discordWelcomeChannelId: process.env.DISCORD_WELCOME_CHANNEL_ID ?? "",
  discordVerificationChannelId: process.env.DISCORD_VERIFICATION_CHANNEL_ID ?? "",
  discordOnlineChannelId: process.env.DISCORD_ONLINE_CHANNEL_ID ?? "",
  discordVerifiedRoleId: process.env.DISCORD_VERIFIED_ROLE_ID ?? "",
  discordMemberRoleId: process.env.DISCORD_MEMBER_ROLE_ID ?? "",
  discordClaimRankGroup: process.env.DISCORD_CLAIM_RANK_GROUP ?? "member",
  publicStoreUrl: process.env.PUBLIC_STORE_URL ?? "",
  rconHost: process.env.RCON_HOST ?? "",
  rconPort: Number(process.env.RCON_PORT ?? 0),
  rconPassword: process.env.RCON_PASSWORD ?? ""
};

// server/db.ts
var _db = null;
var rank = (id, name, price, color, badge, description, features) => ({
  id,
  name,
  displayName: name,
  price,
  duration: "\u0E16\u0E32\u0E27\u0E23",
  color,
  badge,
  description,
  features: JSON.stringify(features),
  roleId: null,
  createdAt: /* @__PURE__ */ new Date(0),
  updatedAt: /* @__PURE__ */ new Date(0)
});
var DEFAULT_RANKS = [
  rank(1, "VIP", "39.00", "silver", "ENTRY", "\u0E22\u0E28\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19 RitzSMP", ["/hat", "/craft", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 3 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 10,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 100 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(2, "VIP+", "79.00", "gold", "POPULAR", "\u0E2D\u0E31\u0E1B\u0E40\u0E01\u0E23\u0E14\u0E08\u0E32\u0E01 VIP \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E2D\u0E33\u0E19\u0E27\u0E22\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E30\u0E14\u0E27\u0E01\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C VIP \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/enderchest", "/feed", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 5 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 25,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 250 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(3, "Knight", "149.00", "ruby", "ADVENTURE", "\u0E22\u0E28\u0E19\u0E31\u0E01\u0E23\u0E1A\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E27\u0E32\u0E21\u0E04\u0E25\u0E48\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C VIP+ \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/ptime", "/pweather", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 8 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 50,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 450 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(4, "Elite", "249.00", "gold", "ADVANCED", "\u0E22\u0E28\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E2A\u0E39\u0E07\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E0B\u0E48\u0E2D\u0E21\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E44\u0E2D\u0E40\u0E17\u0E21", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Knight \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/repair", "/anvil", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 10 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 80,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 700 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(5, "Noble", "399.00", "silver", "UTILITY", "\u0E22\u0E28\u0E1C\u0E39\u0E49\u0E14\u0E35\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E30\u0E14\u0E27\u0E01\u0E43\u0E19\u0E01\u0E32\u0E23\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Elite \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/back", "Backpack Lv.1", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 15 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 120,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,000 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(6, "Lord", "599.00", "ruby", "PRESTIGE", "\u0E22\u0E28\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E28\u0E23\u0E35\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E35\u0E41\u0E0A\u0E17\u0E41\u0E25\u0E30 Fly \u0E17\u0E35\u0E48 Spawn", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Noble \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Chat Color", "Fly \u0E17\u0E35\u0E48 Spawn", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 20 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 200,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,200 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(7, "Overlord", "899.00", "gold", "ELITE", "\u0E22\u0E28\u0E0A\u0E31\u0E49\u0E19\u0E2A\u0E39\u0E07\u0E1E\u0E23\u0E49\u0E2D\u0E21 Backpack \u0E41\u0E25\u0E30 Prefix \u0E44\u0E25\u0E48\u0E2A\u0E35", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Lord \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Backpack Lv.2", "Prefix \u0E44\u0E25\u0E48\u0E2A\u0E35", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 30 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 350,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,350 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(8, "Mythic", "1299.00", "ruby", "MYTHIC", "\u0E22\u0E28 Mythic \u0E1E\u0E23\u0E49\u0E2D\u0E21 Aura \u0E41\u0E25\u0E30 Cosmetic \u0E1E\u0E34\u0E40\u0E28\u0E29", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Overlord \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Aura \u0E1E\u0E34\u0E40\u0E28\u0E29", "Cosmetic \u0E1E\u0E34\u0E40\u0E28\u0E29", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 40 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 500,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,420 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(9, "Celestial", "1799.00", "gold", "CELESTIAL", "\u0E22\u0E28 Celestial \u0E1E\u0E23\u0E49\u0E2D\u0E21 Join Message \u0E41\u0E25\u0E30 Chat Tag", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Mythic \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Join Message", "Chat Tag", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 50 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 800,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,470 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(10, "Emperor", "2499.00", "ruby", "ULTIMATE", "\u0E22\u0E28\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E08\u0E31\u0E01\u0E23\u0E1E\u0E23\u0E23\u0E14\u0E34\u0E02\u0E2D\u0E07 RitzSMP", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Homes \u0E44\u0E21\u0E48\u0E08\u0E33\u0E01\u0E31\u0E14", "Cosmetic \u0E17\u0E38\u0E01\u0E0A\u0E19\u0E34\u0E14", "Join Message \u0E1E\u0E34\u0E40\u0E28\u0E29", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 1,500,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,500 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"])
];
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  for (const field of textFields) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= /* @__PURE__ */ new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function getRanks() {
  const db = await getDb();
  if (!db) return DEFAULT_RANKS;
  try {
    for (const r of DEFAULT_RANKS) {
      await db.insert(ranks).values({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
        price: r.price,
        duration: r.duration,
        color: r.color,
        badge: r.badge,
        description: r.description,
        features: r.features
      }).onDuplicateKeyUpdate({
        set: {
          name: r.name,
          displayName: r.displayName,
          price: r.price,
          duration: r.duration,
          color: r.color,
          badge: r.badge,
          description: r.description,
          features: r.features
        }
      });
    }
  } catch (err) {
    console.warn("[Database] Failed to sync ranks table:", err);
  }
  return DEFAULT_RANKS;
}
async function getRankById(id) {
  const db = await getDb();
  if (!db) return DEFAULT_RANKS.find((rank2) => rank2.id === id);
  const result = await db.select().from(ranks).where(eq(ranks.id, id)).limit(1);
  return result[0] ?? DEFAULT_RANKS.find((rank2) => rank2.id === id);
}
async function createOrder(order) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(orders).values(order);
  const created = await db.select().from(orders).where(eq(orders.id, result[0].insertId)).limit(1);
  if (!created[0]) throw new Error("Order could not be created");
  return created[0];
}
async function getOrderById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}
async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}
async function updateUserRole(id, role) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
  return getUserById(id);
}
async function getDiscordVerification(discordUserId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(discordVerifications).where(eq(discordVerifications.discordUserId, discordUserId)).limit(1);
  return result[0];
}
async function getDiscordVerificationByMinecraftUuid(minecraftUuid) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(discordVerifications).where(eq(discordVerifications.minecraftUuid, minecraftUuid)).limit(1);
  return result[0];
}
async function createDiscordVerification(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(discordVerifications).values(input);
  const created = await db.select().from(discordVerifications).where(eq(discordVerifications.discordUserId, input.discordUserId)).limit(1);
  if (!created[0]) throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E44\u0E14\u0E49");
  return created[0];
}
var DISCORD_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1e3;
function isValidDiscordVerificationCode(code) {
  return /^\d{4}$/.test(code);
}
function generateDiscordVerificationCode() {
  return randomInt(0, 1e4).toString().padStart(4, "0");
}
async function createDiscordVerificationCode(discordUserId, forceNew = false) {
  if (!discordUserId) throw new Error("Discord user ID is required");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (!forceNew) {
    const existingRows = await db.select().from(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId)).limit(1);
    const existing = existingRows[0];
    const now = Date.now();
    if (existing && !existing.usedAt && existing.expiresAt.getTime() > now) {
      return existing;
    }
  }
  const code = generateDiscordVerificationCode();
  const expiresAt = new Date(Date.now() + DISCORD_VERIFICATION_CODE_TTL_MS);
  await db.insert(discordVerificationCodes).values({
    discordUserId,
    code,
    expiresAt,
    usedAt: null
  }).onDuplicateKeyUpdate({
    set: { code, expiresAt, usedAt: null }
  });
  const created = await db.select().from(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId)).limit(1);
  if (!created[0]) throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E44\u0E14\u0E49");
  return created[0];
}
async function cancelDiscordVerificationCode(discordUserId) {
  if (!discordUserId) return false;
  const db = await getDb();
  if (!db) return false;
  await db.delete(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId));
  return true;
}
async function unlinkDiscordVerification(discordUserId) {
  if (!discordUserId) return false;
  const db = await getDb();
  if (!db) return false;
  await db.delete(discordVerifications).where(eq(discordVerifications.discordUserId, discordUserId));
  await db.delete(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId));
  return true;
}
async function redeemDiscordVerificationCode(input) {
  if (!isValidDiscordVerificationCode(input.code)) throw new Error("\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02 4 \u0E2B\u0E25\u0E31\u0E01");
  if (!input.minecraftIGN || !input.minecraftUuid) throw new Error("\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E25\u0E30 UUID \u0E02\u0E2D\u0E07 Minecraft");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const codeRows = await tx.select().from(discordVerificationCodes).where(eq(discordVerificationCodes.code, input.code)).limit(1);
    const codeRow = codeRows[0];
    if (!codeRow || codeRow.usedAt || codeRow.expiresAt.getTime() <= Date.now()) {
      throw new Error("\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38\u0E41\u0E25\u0E49\u0E27");
    }
    const discordRows = await tx.select().from(discordVerifications).where(eq(discordVerifications.discordUserId, codeRow.discordUserId)).limit(1);
    const minecraftRows = await tx.select().from(discordVerifications).where(eq(discordVerifications.minecraftUuid, input.minecraftUuid)).limit(1);
    const existingDiscord = discordRows[0];
    const existingMinecraft = minecraftRows[0];
    if (existingMinecraft && existingMinecraft.discordUserId !== codeRow.discordUserId) {
      throw new Error("Minecraft \u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E01\u0E31\u0E1A Discord \u0E2D\u0E37\u0E48\u0E19\u0E41\u0E25\u0E49\u0E27");
    }
    if (existingDiscord && existingDiscord.minecraftUuid !== input.minecraftUuid) {
      throw new Error("Discord \u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E01\u0E31\u0E1A Minecraft \u0E2D\u0E37\u0E48\u0E19\u0E41\u0E25\u0E49\u0E27");
    }
    const now = /* @__PURE__ */ new Date();
    if (!existingDiscord) {
      await tx.insert(discordVerifications).values({
        discordUserId: codeRow.discordUserId,
        minecraftIGN: input.minecraftIGN.slice(0, 16),
        minecraftUuid: input.minecraftUuid,
        verifiedAt: now,
        updatedAt: now
      });
    }
    await tx.update(discordVerificationCodes).set({ usedAt: now }).where(eq(discordVerificationCodes.id, codeRow.id));
    const linkedRows = await tx.select().from(discordVerifications).where(eq(discordVerifications.discordUserId, codeRow.discordUserId)).limit(1);
    if (!linkedRows[0]) throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E44\u0E14\u0E49");
    return linkedRows[0];
  });
}
async function updateDiscordProfile(discordUserId, input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const updates = {};
  if (input.bio !== void 0) updates.bio = input.bio;
  if (input.playStyle !== void 0) updates.playStyle = input.playStyle;
  if (Object.keys(updates).length > 0) {
    await db.update(discordVerifications).set(updates).where(eq(discordVerifications.discordUserId, discordUserId));
  }
  return getDiscordVerification(discordUserId);
}
async function getMinecraftPresenceState() {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(minecraftPresenceState).where(eq(minecraftPresenceState.id, 1)).limit(1);
  return result[0];
}
async function saveMinecraftPresenceState(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await getMinecraftPresenceState();
  const values = {
    id: 1,
    scheduleCronTaskUid: input.scheduleCronTaskUid !== void 0 ? input.scheduleCronTaskUid : existing?.scheduleCronTaskUid ?? null,
    lastOnline: input.lastOnline ? 1 : 0,
    playerListKnown: input.playerListKnown ? 1 : 0,
    lastPlayerNames: JSON.stringify(input.lastPlayerNames),
    lastCheckedAt: input.lastCheckedAt ?? /* @__PURE__ */ new Date()
  };
  await db.insert(minecraftPresenceState).values(values).onDuplicateKeyUpdate({
    set: {
      scheduleCronTaskUid: values.scheduleCronTaskUid,
      lastOnline: values.lastOnline,
      playerListKnown: values.playerListKnown,
      lastPlayerNames: values.lastPlayerNames,
      lastCheckedAt: values.lastCheckedAt
    }
  });
  const saved = await getMinecraftPresenceState();
  if (!saved) throw new Error("Minecraft presence state could not be saved");
  return saved;
}
async function getOrdersByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}
async function getAllOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}
async function updateOrder(id, status, adminNotes) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(orders).set({ status, adminNotes: adminNotes ?? null }).where(eq(orders.id, id));
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}
async function getUserWallet(userId) {
  const db = await getDb();
  if (!db) return { userId, balance: "0.00" };
  const res = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (res[0]) return res[0];
  await db.insert(wallets).values({ userId, balance: "0.00" }).onDuplicateKeyUpdate({ set: { userId } });
  const created = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return created[0] ?? { userId, balance: "0.00" };
}
async function adjustUserBalance(userId, amount, type, description, referenceKey) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (!Number.isFinite(amount) || Math.round(amount * 100) !== amount * 100) {
    throw new Error("\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07");
  }
  return db.transaction(async (tx) => {
    await tx.insert(wallets).values({ userId, balance: "0.00" }).onDuplicateKeyUpdate({ set: { userId } });
    if (referenceKey) {
      const inserted = await tx.insert(walletTransactions).values({ userId, amount: String(amount), type, description, referenceKey }).onDuplicateKeyUpdate({ set: { id: sql`${walletTransactions.id}` } });
      const affectedRows2 = Number(inserted?.[0]?.affectedRows ?? 0);
      if (affectedRows2 === 0) {
        const existing = await tx.select().from(walletTransactions).where(eq(walletTransactions.referenceKey, referenceKey)).limit(1);
        const existingTransaction = existing[0];
        if (existingTransaction?.userId !== userId) {
          throw new Error("\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E40\u0E07\u0E34\u0E19\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E0B\u0E49\u0E33\u0E01\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2D\u0E37\u0E48\u0E19");
        }
        if (!existingTransaction || Number(existingTransaction.amount) !== amount || existingTransaction.type !== type) {
          throw new Error("referenceKey \u0E16\u0E39\u0E01\u0E43\u0E0A\u0E49\u0E01\u0E31\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E40\u0E07\u0E34\u0E19\u0E04\u0E19\u0E25\u0E30\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23");
        }
        const current2 = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
        return { userId, newBalance: Number(current2[0]?.balance) || 0, alreadyApplied: true };
      }
    }
    const updated = await tx.update(wallets).set({ balance: sql`${wallets.balance} + ${amount}` }).where(and(eq(wallets.userId, userId), sql`${wallets.balance} + ${amount} >= 0`));
    const affectedRows = Number(updated?.[0]?.affectedRows ?? 0);
    if (affectedRows === 0) {
      throw new Error("\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E44\u0E21\u0E48\u0E1E\u0E2D\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E17\u0E33\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23");
    }
    if (!referenceKey) {
      await tx.insert(walletTransactions).values({
        userId,
        amount: String(amount),
        type,
        description
      });
    }
    const current = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    return { userId, newBalance: Number(current[0]?.balance) || 0, alreadyApplied: false };
  });
}
async function getUserWalletTransactions(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt));
}
async function getManagedServers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(managedServers).orderBy(desc(managedServers.displayName));
}
async function getEnabledManagedServers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(managedServers).where(eq(managedServers.enabled, 1)).orderBy(desc(managedServers.displayName));
}
async function getManagedServerById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(managedServers).where(eq(managedServers.id, id)).limit(1);
  return result[0];
}
async function getManagedServerConfig(serverId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(managedServerConfigs).where(eq(managedServerConfigs.managedServerId, serverId)).limit(1);
  return result[0];
}
async function createManagedServer(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(managedServers).values({
      slug: input.slug,
      displayName: input.displayName,
      minecraftHost: input.minecraftHost,
      minecraftPort: input.minecraftPort,
      discordGuildId: input.discordGuildId ?? null,
      enabled: input.enabled === false ? 0 : 1
    });
    const serverId = Number(inserted[0].insertId);
    await tx.insert(managedServerConfigs).values({
      managedServerId: serverId,
      discordTokenEnv: input.config.discordTokenEnv ?? null,
      rconHost: input.config.rconHost ?? null,
      rconPort: input.config.rconPort ?? null,
      rconPasswordEnv: input.config.rconPasswordEnv ?? null,
      channelConfig: input.config.channelConfig
    });
    const created = await tx.select().from(managedServers).where(eq(managedServers.id, serverId)).limit(1);
    if (!created[0]) throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E44\u0E14\u0E49");
    return created[0];
  });
}
async function updateManagedServer(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.transaction(async (tx) => {
    await tx.update(managedServers).set({
      displayName: input.displayName,
      minecraftHost: input.minecraftHost,
      minecraftPort: input.minecraftPort,
      discordGuildId: input.discordGuildId ?? null,
      enabled: input.enabled ? 1 : 0
    }).where(eq(managedServers.id, input.id));
    await tx.insert(managedServerConfigs).values({
      managedServerId: input.id,
      discordTokenEnv: input.config.discordTokenEnv ?? null,
      rconHost: input.config.rconHost ?? null,
      rconPort: input.config.rconPort ?? null,
      rconPasswordEnv: input.config.rconPasswordEnv ?? null,
      channelConfig: input.config.channelConfig
    }).onDuplicateKeyUpdate({ set: {
      discordTokenEnv: input.config.discordTokenEnv ?? null,
      rconHost: input.config.rconHost ?? null,
      rconPort: input.config.rconPort ?? null,
      rconPasswordEnv: input.config.rconPasswordEnv ?? null,
      channelConfig: input.config.channelConfig
    } });
  });
  return getManagedServerById(input.id);
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
function isOwnerUser(user) {
  return Boolean(ENV.ownerOpenId) && user.openId === ENV.ownerOpenId;
}
var ownerProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || !isOwnerUser(ctx.user)) {
      throw new TRPCError2({ code: "FORBIDDEN", message: "\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E44\u0E14\u0E49" });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/routers.ts
import { Rcon as Rcon2 } from "rcon-client";

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  return url;
}

// server/discordAiBot.ts
import {
  Client as Client2,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder as SlashCommandBuilder2,
  EmbedBuilder as EmbedBuilder2,
  ActionRowBuilder as ActionRowBuilder2,
  ButtonBuilder as ButtonBuilder2,
  ButtonStyle as ButtonStyle2,
  PermissionsBitField,
  ChannelType as ChannelType3,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var RETRY_MAX_RETRIES = 4;
var RETRY_BASE_DELAY_MS = 500;
var RETRY_MAX_DELAY_MS = 3e4;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var parseRetryAfter = (value) => {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
};
var computeBackoffDelay = (attempt, retryAfterMs) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};
var fetchWithBackoff = async (url, init) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) {
        return response;
      }
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens
  } = params;
  const payload = {
    messages: messages.map(normalizeMessage)
  };
  if (model) {
    payload.model = model;
  }
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetchWithBackoff(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/minecraftIntegration.ts
import { Rcon } from "rcon-client";
function isValidMinecraftIgn(value) {
  return /^[A-Za-z0-9_]{3,16}$/.test(value);
}
function isValidLuckPermsGroup(value) {
  return /^[A-Za-z0-9_-]{1,32}$/.test(value);
}
function getMotd(data) {
  const clean = data?.motd?.clean;
  if (Array.isArray(clean)) return clean.join(" ").trim() || "RitzSMP Minecraft Server";
  if (typeof clean === "string") return clean;
  return "RitzSMP Minecraft Server";
}
async function fetchMinecraftServerStatus() {
  const startedAt = Date.now();
  try {
    const response = await fetch("https://api.mcsrvstat.us/2/ritz.mcsv.me", {
      signal: AbortSignal.timeout(4e3)
    });
    if (!response.ok) throw new Error(`Minecraft status API returned ${response.status}`);
    const data = await response.json();
    const online = data?.online === true;
    const playerListKnown = online && Array.isArray(data?.players?.list);
    const playerNames = playerListKnown ? data.players.list.filter((name) => typeof name === "string").slice(0, 100) : [];
    return {
      online,
      players: online ? Number(data?.players?.online ?? playerNames.length) : 0,
      maxPlayers: online ? Number(data?.players?.max ?? 0) : 0,
      playerNames,
      playerListKnown,
      version: online ? String(data?.version ?? "\u0E44\u0E21\u0E48\u0E17\u0E23\u0E32\u0E1A\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19") : "\u0E44\u0E21\u0E48\u0E17\u0E23\u0E32\u0E1A\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19",
      latency: Date.now() - startedAt,
      motd: getMotd(data)
    };
  } catch {
    return {
      online: false,
      players: 0,
      maxPlayers: 0,
      playerNames: [],
      playerListKnown: false,
      version: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E44\u0E14\u0E49",
      latency: null,
      motd: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D API \u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E44\u0E14\u0E49"
    };
  }
}
async function fetchMinecraftProfile(minecraftIGN) {
  if (!isValidMinecraftIgn(minecraftIGN)) return null;
  try {
    const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(minecraftIGN)}`, {
      signal: AbortSignal.timeout(4e3)
    });
    if (response.status === 204 || response.status === 404) return null;
    if (!response.ok) throw new Error(`Mojang profile API returned ${response.status}`);
    const data = await response.json();
    if (typeof data.id !== "string" || typeof data.name !== "string") return null;
    return { id: data.id, name: data.name };
  } catch {
    return null;
  }
}
async function grantMinecraftRank(minecraftIGN, groupName) {
  if (!isValidMinecraftIgn(minecraftIGN)) throw new Error("\u0E0A\u0E37\u0E48\u0E2D Minecraft \u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07");
  if (!isValidLuckPermsGroup(groupName)) throw new Error("\u0E0A\u0E37\u0E48\u0E2D\u0E01\u0E25\u0E38\u0E48\u0E21 LuckPerms \u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07");
  const command = `lp user ${minecraftIGN} parent add ${groupName}`;
  if (!ENV.rconHost || !ENV.rconPort || !ENV.rconPassword) {
    return {
      executed: false,
      command,
      detail: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 RCON \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E43\u0E19\u0E40\u0E01\u0E21 \u0E08\u0E36\u0E07\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
    };
  }
  const rcon = await Rcon.connect({
    host: ENV.rconHost,
    port: ENV.rconPort,
    password: ENV.rconPassword
  });
  try {
    const response = await rcon.send(command);
    return { executed: true, command, detail: response || "LuckPerms \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E41\u0E25\u0E49\u0E27" };
  } finally {
    await rcon.end();
  }
}

// server/discordMusic.ts
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel
} from "@discordjs/voice";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { Transform } from "node:stream";
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
var MUSIC_IDLE_TIMEOUT_MS = 15 * 60 * 1e3;
var MUSIC_RESOLVE_TIMEOUT_MS = 12e3;
var YTDLP_BIN = process.env.YTDLP_PATH || "yt-dlp";
var FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
var YTDLP_COOKIES_PATH = process.env.YTDLP_COOKIES_PATH || "";
var MUSIC_QUERY_MESSAGE = "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E25\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube/SoundCloud \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E34\u0E14\u0E19\u0E30\u0E04\u0E30";
var sessions = /* @__PURE__ */ new Map();
var musicCommand = new SlashCommandBuilder().setName("music").setDescription(
  "\u{1F3B5} \u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E19\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E1A\u0E1A\u0E1F\u0E23\u0E35 (\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E2B\u0E49\u0E2D\u0E07\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E17\u0E38\u0E01\u0E04\u0E19)"
).addSubcommand(
  (sub) => sub.setName("play").setDescription("\u0E40\u0E25\u0E48\u0E19\u0E40\u0E1E\u0E25\u0E07\u0E08\u0E32\u0E01\u0E0A\u0E37\u0E48\u0E2D (Query) \u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube / SoundCloud").addStringOption(
    (option) => option.setName("query").setDescription("\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E25\u0E07 \u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube / SoundCloud").setRequired(true)
  )
).addSubcommand(
  (sub) => sub.setName("queue").setDescription("\u0E14\u0E39\u0E04\u0E34\u0E27\u0E40\u0E1E\u0E25\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19")
).addSubcommand(
  (sub) => sub.setName("skip").setDescription("\u0E02\u0E49\u0E32\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19")
).addSubcommand(
  (sub) => sub.setName("stop").setDescription("\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27")
).addSubcommand(
  (sub) => sub.setName("leave").setDescription("\u0E43\u0E2B\u0E49\u0E19\u0E49\u0E2D\u0E07\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07")
);
var playShortcutCommand = new SlashCommandBuilder().setName("play").setDescription(
  "\u{1F3B5} \u0E40\u0E25\u0E48\u0E19\u0E40\u0E1E\u0E25\u0E07\u0E17\u0E31\u0E19\u0E17\u0E35\u0E08\u0E32\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube / SoundCloud (\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E17\u0E38\u0E01\u0E04\u0E19)"
).addStringOption(
  (option) => option.setName("query").setDescription("\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E25\u0E07 \u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube / SoundCloud").setRequired(true)
);
var leaveShortcutCommand = new SlashCommandBuilder().setName("leave").setDescription("\u{1F6AA} \u0E43\u0E2B\u0E49\u0E19\u0E49\u0E2D\u0E07\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27\u0E17\u0E31\u0E19\u0E17\u0E35 (\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E04\u0E19)");
function resolveMusicQuery(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: MUSIC_QUERY_MESSAGE };
  }
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" && [
      "youtube.com",
      "www.youtube.com",
      "youtu.be",
      "soundcloud.com",
      "www.soundcloud.com"
    ].includes(url.hostname.toLowerCase())) {
      return { ok: true, query: url.toString(), isUrl: true };
    }
  } catch {
  }
  return { ok: true, query: trimmed, isUrl: false };
}
async function interactionReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      if (typeof payload === "string") {
        return await interaction.editReply({
          content: payload,
          embeds: [],
          components: []
        });
      }
      return await interaction.editReply(payload);
    }
    if (typeof payload === "string") {
      return await interaction.reply({ content: payload, ephemeral: false });
    }
    return await interaction.reply({ ...payload, ephemeral: false });
  } catch {
    try {
      if (typeof payload === "string") {
        return await interaction.followUp({
          content: payload,
          ephemeral: false
        });
      }
      return await interaction.followUp({ ...payload, ephemeral: false });
    } catch {
    }
  }
}
function getVoiceChannel(interaction) {
  const userId = interaction.user?.id;
  if (userId && interaction.guild?.voiceStates?.cache) {
    const voiceState = interaction.guild.voiceStates.cache.get(userId);
    if (voiceState?.channel) {
      return voiceState.channel;
    }
  }
  if (interaction.member?.voice?.channel) {
    return interaction.member.voice.channel;
  }
  if (userId && interaction.guild?.members?.cache) {
    const member = interaction.guild.members.cache.get(userId);
    if (member?.voice?.channel) {
      return member.voice.channel;
    }
  }
  return null;
}
function stopActiveAudio(session) {
  const stop = session.activeStop;
  session.activeStop = void 0;
  stop?.();
}
function scheduleIdleCleanup(session) {
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => {
    if (!session.current && session.queue.length === 0) {
      stopActiveAudio(session);
      session.player.stop(true);
      session.connection.destroy();
      sessions.delete(session.guildId);
    }
  }, MUSIC_IDLE_TIMEOUT_MS);
}
async function getOrCreateSession(interaction, voiceChannel) {
  const existing = sessions.get(interaction.guildId);
  if (existing) {
    if (existing.connection.joinConfig.channelId !== voiceChannel.id) {
      existing.connection.rejoin({
        channelId: voiceChannel.id,
        selfDeaf: true,
        selfMute: false
      });
    }
    await entersState(existing.connection, VoiceConnectionStatus.Ready, 1e4);
    return existing;
  }
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 1e4);
  } catch {
    connection.destroy();
    throw new Error("\u0E1A\u0E2D\u0E17\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E20\u0E32\u0E22\u0E43\u0E19\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E04\u0E48\u0E30");
  }
  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play
    }
  });
  connection.subscribe(player);
  const session = {
    guildId: interaction.guildId,
    connection,
    player,
    queue: [],
    started: false
  };
  sessions.set(interaction.guildId, session);
  player.on(AudioPlayerStatus.Idle, () => {
    console.log("[Music] AudioPlayer entered Idle state");
    session.activeStop = void 0;
    session.current = void 0;
    void playNext(session);
  });
  player.on(AudioPlayerStatus.Playing, () => {
    console.log("[Music] AudioPlayer is now PLAYING audio output!");
  });
  player.on("error", (error) => {
    console.error("[Music Error] AudioPlayer encountered error:", error);
    stopActiveAudio(session);
    session.current = void 0;
    void playNext(session);
  });
  connection.on("error", (error) => {
    console.error("[Music Error] VoiceConnection encountered error:", error);
    try {
      if (error?.message?.includes("IP discovery") || error?.message?.includes("socket closed")) {
        console.warn(
          "[Music] Attempting to recover voice connection due to socket/IP error..."
        );
        setTimeout(() => {
          try {
            connection.rejoin({
              channelId: voiceChannel.id,
              selfDeaf: true,
              selfMute: false
            });
          } catch (rejoinErr) {
            console.error("[Music Error] Rejoin failed:", rejoinErr);
          }
        }, 2e3);
      }
    } catch (rcErr) {
      console.error("[Music] Error in recovery handler:", rcErr);
    }
  });
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5e3),
        entersState(connection, VoiceConnectionStatus.Connecting, 5e3)
      ]);
    } catch {
      stopActiveAudio(session);
      sessions.delete(session.guildId);
      connection.destroy();
    }
  });
  scheduleIdleCleanup(session);
  return session;
}
function ytDlpCookieArgs() {
  return YTDLP_COOKIES_PATH && existsSync(YTDLP_COOKIES_PATH) ? ["--cookies", YTDLP_COOKIES_PATH] : [];
}
function buildYtDlpArgs(trackUrl) {
  return [
    "--quiet",
    "--no-warnings",
    "--no-playlist",
    "--force-ipv4",
    "--js-runtimes",
    "node",
    "--format",
    "bestaudio/best",
    "--output",
    "-",
    "--no-part",
    "--retries",
    "2",
    "--fragment-retries",
    "2",
    "--socket-timeout",
    "10",
    ...ytDlpCookieArgs(),
    trackUrl
  ];
}
function buildYtDlpMetadataArgs(query, isUrl) {
  return [
    "--dump-single-json",
    "--no-warnings",
    "--skip-download",
    "--no-playlist",
    "--force-ipv4",
    "--js-runtimes",
    "node",
    ...ytDlpCookieArgs(),
    isUrl ? query : `ytsearch1:${query}`
  ];
}
function runYtDlp(args, timeoutMs = MUSIC_RESOLVE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" }
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(
        new Error(
          "\u0E01\u0E32\u0E23\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E0A\u0E49\u0E40\u0E27\u0E25\u0E32\u0E19\u0E32\u0E19\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B (Timeout) \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E04\u0E48\u0E30"
        )
      );
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E1B\u0E23\u0E41\u0E01\u0E23\u0E21 yt-dlp (${error.message})`));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const detail = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] || `exit code ${code}`;
        reject(new Error(`\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19: ${detail.slice(0, 220)}`));
      }
    });
  });
}
function parseYtDlpMetadata(stdout) {
  const lines = stdout.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const raw = JSON.parse(lines[index]);
      const entry = raw?.entries?.[0] ?? raw;
      const url = entry?.webpage_url || entry?.original_url || entry?.url;
      if (typeof url === "string" && url.startsWith("http")) {
        return {
          url,
          title: typeof entry?.title === "string" && entry.title.trim() ? entry.title.trim() : "RitzSMP Music Track"
        };
      }
    } catch {
    }
  }
  throw new Error("yt-dlp \u0E44\u0E21\u0E48\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E25\u0E07\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32");
}
async function resolveTrackFromQuery(resolvedQuery, requestedBy) {
  const metadata = await runYtDlp(
    buildYtDlpMetadataArgs(resolvedQuery.query, resolvedQuery.isUrl)
  );
  const parsed = parseYtDlpMetadata(metadata.stdout);
  return {
    url: parsed.url,
    title: parsed.title.slice(0, 180),
    requestedBy
  };
}
function waitForPlayerPlaying(player, timeoutMs = 5e3) {
  if (player.state.status === AudioPlayerStatus.Playing)
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onPlaying = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      player.off(AudioPlayerStatus.Playing, onPlaying);
      reject(new Error("\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E20\u0E32\u0E22\u0E43\u0E19\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E04\u0E48\u0E30"));
    }, timeoutMs);
    player.once(AudioPlayerStatus.Playing, onPlaying);
  });
}
function createYtDlpAudioStream(trackUrl, options = {}) {
  const extractor = spawn(
    options.ytDlpPath ?? YTDLP_BIN,
    buildYtDlpArgs(trackUrl),
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" }
    }
  );
  const transcoder = spawn(
    options.ffmpegPath ?? FFMPEG_BIN,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-vn",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-f",
      "s16le",
      "pipe:1"
    ],
    {
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  let resolveFirstAudioData;
  let rejectFirstAudioData;
  let audioDataSeen = false;
  const firstAudioData = new Promise((resolve, reject) => {
    resolveFirstAudioData = resolve;
    rejectFirstAudioData = reject;
  });
  const output = new Transform({
    transform(chunk, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (!audioDataSeen && buffer.length > 0) {
        audioDataSeen = true;
        resolveFirstAudioData();
      }
      callback(null, buffer);
    },
    flush(callback) {
      if (!audioDataSeen) {
        rejectFirstAudioData(
          new Error("\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E08\u0E1A\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E48\u0E2D\u0E19\u0E21\u0E35\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2D\u0E2D\u0E01\u0E04\u0E48\u0E30")
        );
      }
      callback();
    }
  });
  let stopped = false;
  let extractorError = "";
  let transcoderError = "";
  extractor.stderr.setEncoding("utf8");
  transcoder.stderr.setEncoding("utf8");
  extractor.stderr.on("data", (chunk) => {
    extractorError += chunk;
  });
  transcoder.stderr.on("data", (chunk) => {
    transcoderError += chunk;
  });
  extractor.stdout.pipe(transcoder.stdin);
  transcoder.stdout.pipe(output);
  const fail = (prefix, detail) => {
    if (stopped || output.destroyed) return;
    const message = `${prefix}: ${(detail.trim() || "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14").split(/\r?\n/).slice(-1)[0].slice(0, 240)}`;
    console.error(`[Music Error] ${message}`);
    rejectFirstAudioData(new Error(message));
    output.destroy(new Error(message));
  };
  extractor.stdout.once(
    "error",
    (error) => fail("yt-dlp output failed", error.message)
  );
  transcoder.stdin.once(
    "error",
    (error) => fail("FFmpeg input failed", error.message)
  );
  extractor.once(
    "error",
    (error) => fail("yt-dlp process failed", error.message)
  );
  transcoder.once(
    "error",
    (error) => fail("FFmpeg process failed", error.message)
  );
  extractor.once("close", (code) => {
    if (!stopped && code !== 0)
      fail("yt-dlp stream failed", extractorError || `exit code ${code}`);
  });
  transcoder.once("close", (code) => {
    if (!stopped && code !== 0)
      fail("FFmpeg stream failed", transcoderError || `exit code ${code}`);
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    rejectFirstAudioData(new Error("\u0E2B\u0E22\u0E38\u0E14 pipeline \u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30"));
    extractor.stdout.unpipe(transcoder.stdin);
    transcoder.stdin.destroy();
    extractor.kill("SIGKILL");
    transcoder.kill("SIGKILL");
  };
  output.once("close", stop);
  return { stream: output, stop, firstAudioData };
}
function formatMusicPlaybackError(error) {
  const message = error instanceof Error ? error.message : "\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19";
  if (/sign in to confirm|not a bot|cookies?/i.test(message)) {
    return "YouTube \u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E01\u0E32\u0E23\u0E14\u0E36\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E08\u0E32\u0E01 IP \u0E19\u0E35\u0E49\u0E04\u0E48\u0E30 \u0E43\u0E2B\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E44\u0E1F\u0E25\u0E4C cookies \u0E1A\u0E19 VPS \u0E41\u0E25\u0E49\u0E27\u0E01\u0E33\u0E2B\u0E19\u0E14 YTDLP_COOKIES_PATH \u0E2B\u0E23\u0E37\u0E2D\u0E43\u0E0A\u0E49\u0E25\u0E34\u0E07\u0E01\u0E4C SoundCloud \u0E41\u0E17\u0E19\u0E04\u0E48\u0E30";
  }
  if (/ENOENT|ไม่พบโปรแกรม yt-dlp|ไม่พบโปรแกรม ffmpeg/i.test(message)) {
    return "\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35 yt-dlp \u0E2B\u0E23\u0E37\u0E2D FFmpeg \u0E04\u0E23\u0E1A\u0E04\u0E48\u0E30 \u0E43\u0E2B\u0E49\u0E23\u0E31\u0E19\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E08\u0E32\u0E01 VPS_DEPLOYMENT.md \u0E41\u0E25\u0E49\u0E27\u0E23\u0E35\u0E2A\u0E15\u0E32\u0E23\u0E4C\u0E15\u0E1A\u0E2D\u0E17\u0E04\u0E48\u0E30";
  }
  return message;
}
async function playNext(session) {
  const next = session.queue.shift();
  if (!next) {
    session.current = void 0;
    scheduleIdleCleanup(session);
    return;
  }
  session.current = next;
  session.started = true;
  try {
    console.log(
      "[Music] Starting yt-dlp -> FFmpeg -> PCM stream for:",
      next.url
    );
    const audio = createYtDlpAudioStream(next.url);
    session.activeStop = audio.stop;
    audio.stream.once("error", (streamErr) => {
      console.error(`[Music Error] Audio pipeline failed:`, streamErr?.message);
    });
    const resource = createAudioResource(audio.stream, {
      inputType: StreamType.Raw,
      inlineVolume: true
    });
    resource.volume?.setVolume(1);
    session.player.play(resource);
    await Promise.all([
      waitForPlayerPlaying(session.player),
      audio.firstAudioData
    ]);
    console.log("[Music] AudioPlayer playing decoded PCM for:", next.title);
  } catch (err) {
    console.error("[Music Error] Failed to stream URL:", next.url, err);
    stopActiveAudio(session);
    session.current = void 0;
    await playNext(session);
  }
}
function buildMusicEmbed(session) {
  const embed = new EmbedBuilder().setTitle("\u{1F3B5} RitzSMP Music Player & Queue").setColor(15485081).setTimestamp();
  if (session.current) {
    embed.addFields({
      name: "\u25B6\uFE0F \u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49",
      value: `**[${session.current.title}](${session.current.url})**
\u{1F464} \u0E02\u0E2D\u0E42\u0E14\u0E22: \`${session.current.requestedBy}\``,
      inline: false
    });
  } else {
    embed.addFields({
      name: "\u25B6\uFE0F \u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49",
      value: "*\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E1E\u0E25\u0E07\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19 (\u0E1A\u0E2D\u0E17\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E23\u0E31\u0E1A\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1E\u0E25\u0E07)*",
      inline: false
    });
  }
  const queueList = session.queue.length > 0 ? session.queue.slice(0, 8).map(
    (t2, i) => `\`${i + 1}.\` [${t2.title}](${t2.url}) (\u0E02\u0E2D\u0E42\u0E14\u0E22: ${t2.requestedBy})`
  ).join("\n") : "*\u0E04\u0E34\u0E27\u0E40\u0E1E\u0E25\u0E07\u0E27\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E25\u0E48\u0E32*";
  embed.addFields({
    name: `\u{1F3B6} \u0E04\u0E34\u0E27\u0E40\u0E1E\u0E25\u0E07\u0E16\u0E31\u0E14\u0E44\u0E1B (${session.queue.length} \u0E40\u0E1E\u0E25\u0E07)`,
    value: queueList,
    inline: false
  });
  embed.setFooter({
    text: "RitzSMP AI \u2022 \u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E1C\u0E48\u0E32\u0E19\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 /music"
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("music_pause_resume").setLabel("\u23F8\uFE0F \u0E40\u0E25\u0E48\u0E19/\u0E2B\u0E22\u0E38\u0E14\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_skip").setLabel("\u23ED\uFE0F \u0E02\u0E49\u0E32\u0E21\u0E40\u0E1E\u0E25\u0E07").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_stop").setLabel("\u23F9\uFE0F \u0E2B\u0E22\u0E38\u0E14\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_queue").setLabel("\u{1F4DC} \u0E14\u0E39\u0E04\u0E34\u0E27\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14").setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}
async function handleMusicCommand(interaction) {
  if (!interaction.guildId) {
    await interactionReply(
      interaction,
      "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Discord \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30"
    );
    return true;
  }
  const isStandalonePlay = interaction.commandName === "play";
  const isStandaloneLeave = interaction.commandName === "leave";
  const subcommand = isStandalonePlay ? "play" : isStandaloneLeave ? "leave" : interaction.options?.getSubcommand?.() ?? "";
  const existing = sessions.get(interaction.guildId);
  if (subcommand === "queue") {
    await interactionReply(
      interaction,
      buildMusicEmbed(existing ?? { queue: [] })
    );
    return true;
  }
  if (subcommand === "leave") {
    if (existing) {
      existing.idleTimer && clearTimeout(existing.idleTimer);
      stopActiveAudio(existing);
      existing.player.stop(true);
      existing.connection.destroy();
      sessions.delete(existing.guildId);
    }
    await interactionReply(
      interaction,
      "\u0E19\u0E49\u0E2D\u0E07\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F3B5}"
    );
    return true;
  }
  if (subcommand === "stop") {
    if (existing) {
      existing.queue.length = 0;
      existing.current = void 0;
      stopActiveAudio(existing);
      existing.player.stop(true);
      scheduleIdleCleanup(existing);
    }
    await interactionReply(interaction, "\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u23F9\uFE0F");
    return true;
  }
  const voiceChannel = getVoiceChannel(interaction);
  if (!voiceChannel) {
    await interactionReply(
      interaction,
      "\u0E1E\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E02\u0E49\u0E32\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E01\u0E48\u0E2D\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E2D\u0E22\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E19\u0E30\u0E04\u0E30 \u{1F496}"
    );
    return true;
  }
  if (subcommand === "skip") {
    if (!existing?.current) {
      await interactionReply(
        interaction,
        "\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E1E\u0E25\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E04\u0E48\u0E30"
      );
      return true;
    }
    stopActiveAudio(existing);
    existing.player.stop();
    await interactionReply(interaction, "\u0E02\u0E49\u0E32\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F3B6}");
    return true;
  }
  if (subcommand === "play") {
    const rawQuery = isStandalonePlay ? interaction.options.getString("query", true) : interaction.options.getString("query", false) || interaction.options.getString("url", false);
    const resolved = resolveMusicQuery(rawQuery);
    if (!resolved.ok) {
      await interactionReply(interaction, resolved.reason);
      return true;
    }
    try {
      if (typeof interaction.deferReply === "function" && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false }).catch(() => {
        });
      }
      const session = await getOrCreateSession(interaction, voiceChannel);
      const track = await resolveTrackFromQuery(
        resolved,
        interaction.user?.tag ?? "\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 RitzSMP"
      );
      session.queue.push(track);
      if (!session.current) await playNext(session);
      if (!session.current) {
        throw new Error(
          "\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E2A\u0E48\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E2D\u0E37\u0E48\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07"
        );
      }
      await interactionReply(interaction, buildMusicEmbed(session));
    } catch (error) {
      await interactionReply(
        interaction,
        `\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30: ${formatMusicPlaybackError(error)}`
      );
    }
    return true;
  }
  await interactionReply(
    interaction,
    "\u0E43\u0E0A\u0E49 /play query:... \u0E2B\u0E23\u0E37\u0E2D /music play, /music queue, /music skip, /music stop \u0E2B\u0E23\u0E37\u0E2D /music leave \u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E04\u0E48\u0E30"
  );
  return true;
}
async function handleMusicButtonInteraction(interaction) {
  if (!interaction?.isButton?.() || typeof interaction.customId !== "string" || !interaction.customId.startsWith("music_")) {
    return false;
  }
  if (!interaction.guildId) {
    await interactionReply(
      interaction,
      "\u0E1B\u0E38\u0E48\u0E21\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Discord \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30"
    );
    return true;
  }
  const session = sessions.get(interaction.guildId);
  if (interaction.customId === "music_queue") {
    await interactionReply(
      interaction,
      buildMusicEmbed(session ?? { queue: [] })
    );
    return true;
  }
  if (!session) {
    await interactionReply(
      interaction,
      "\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35 session \u0E40\u0E1E\u0E25\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E33\u0E07\u0E32\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E04\u0E48\u0E30"
    );
    return true;
  }
  if (interaction.customId === "music_pause_resume") {
    if (!session.current) {
      await interactionReply(
        interaction,
        "\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E1E\u0E25\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E04\u0E48\u0E30"
      );
      return true;
    }
    if (session.player.state.status === AudioPlayerStatus.Paused) {
      session.player.unpause();
      await interactionReply(interaction, "\u0E40\u0E25\u0E48\u0E19\u0E40\u0E1E\u0E25\u0E07\u0E15\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u25B6\uFE0F");
    } else if (session.player.state.status === AudioPlayerStatus.Playing) {
      session.player.pause(true);
      await interactionReply(interaction, "\u0E1E\u0E31\u0E01\u0E40\u0E1E\u0E25\u0E07\u0E44\u0E27\u0E49\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u23F8\uFE0F");
    } else {
      await interactionReply(
        interaction,
        "\u0E40\u0E1E\u0E25\u0E07\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E22\u0E31\u0E07\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E48\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30"
      );
    }
    return true;
  }
  if (interaction.customId === "music_skip") {
    if (!session.current) {
      await interactionReply(
        interaction,
        "\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E1E\u0E25\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E04\u0E48\u0E30"
      );
      return true;
    }
    stopActiveAudio(session);
    session.player.stop();
    await interactionReply(interaction, "\u0E02\u0E49\u0E32\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F3B6}");
    return true;
  }
  if (interaction.customId === "music_stop") {
    session.queue.length = 0;
    session.current = void 0;
    stopActiveAudio(session);
    session.player.stop(true);
    scheduleIdleCleanup(session);
    await interactionReply(interaction, "\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u23F9\uFE0F");
    return true;
  }
  await interactionReply(interaction, "\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01\u0E1B\u0E38\u0E48\u0E21\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E19\u0E35\u0E49\u0E04\u0E48\u0E30");
  return true;
}

// server/discordMusicChannel.ts
import { ChannelType, PermissionFlagsBits } from "discord.js";
var MUSIC_CHANNEL_NAME = "\u{1F3B5}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E25\u0E07";
var LEGACY_MUSIC_CHANNEL_NAMES = ["\u{1F3B5}\u2502\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E1E\u0E25\u0E07"];
var configuredMusicChannelId = process.env.DISCORD_MUSIC_CHANNEL_ID?.trim() || "";
async function ensureMusicTextChannel(client, guildId) {
  if (configuredMusicChannelId) return configuredMusicChannelId;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;
  const channels = await guild.channels.fetch().catch(() => null);
  const existing = channels?.find(
    (channel) => channel?.type === ChannelType.GuildText && (channel.name === MUSIC_CHANNEL_NAME || LEGACY_MUSIC_CHANNEL_NAMES.includes(channel.name))
  );
  if (existing) {
    if (existing.name !== MUSIC_CHANNEL_NAME && "setName" in existing) {
      await existing.setName(MUSIC_CHANNEL_NAME, "Standardize RitzSMP music channel name").catch(() => void 0);
    }
    if ("setTopic" in existing) {
      await existing.setTopic("\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E25\u0E07 RitzSMP AI \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E25\u0E48\u0E19\u0E41\u0E25\u0E30\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19").catch(() => void 0);
    }
    configuredMusicChannelId = existing.id;
    return existing.id;
  }
  const botMember = await guild.members.fetch(client.user?.id ?? "").catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) return null;
  const created = await guild.channels.create({
    name: MUSIC_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E25\u0E07 RitzSMP AI \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E25\u0E48\u0E19\u0E41\u0E25\u0E30\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19",
    reason: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E41\u0E22\u0E01\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E25\u0E07 \u0E44\u0E21\u0E48\u0E23\u0E1A\u0E01\u0E27\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28"
  }).catch(() => null);
  if (!created) return null;
  configuredMusicChannelId = created.id;
  return created.id;
}

// server/discordMinecraftStatusChannel.ts
import { ChannelType as ChannelType2, PermissionFlagsBits as PermissionFlagsBits2 } from "discord.js";
var MINECRAFT_STATUS_CHANNEL_NAME = "\u{1F4E1}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C";
var LEGACY_MINECRAFT_STATUS_CHANNEL_NAMES = ["\u{1F4E1}\u2502\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"];
var configuredMinecraftStatusChannelId = process.env.DISCORD_ONLINE_CHANNEL_ID?.trim() || "";
function getMinecraftStatusChannelId() {
  return configuredMinecraftStatusChannelId;
}
async function ensureMinecraftStatusTextChannel(client, guildId) {
  if (configuredMinecraftStatusChannelId) return configuredMinecraftStatusChannelId;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;
  const channels = await guild.channels.fetch().catch(() => null);
  const existing = channels?.find(
    (channel) => channel?.type === ChannelType2.GuildText && (channel.name === MINECRAFT_STATUS_CHANNEL_NAME || LEGACY_MINECRAFT_STATUS_CHANNEL_NAMES.includes(channel.name))
  );
  if (existing) {
    if (existing.name !== MINECRAFT_STATUS_CHANNEL_NAME && "setName" in existing) {
      await existing.setName(MINECRAFT_STATUS_CHANNEL_NAME, "Standardize RitzSMP Minecraft status channel name").catch(() => void 0);
    }
    if ("setTopic" in existing) {
      await existing.setTopic("\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E2A\u0E14\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C \u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E02\u0E49\u0E32-\u0E2D\u0E2D\u0E01").catch(() => void 0);
    }
    configuredMinecraftStatusChannelId = existing.id;
    return existing.id;
  }
  const botMember = await guild.members.fetch(client.user?.id ?? "").catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits2.ManageChannels)) return null;
  const created = await guild.channels.create({
    name: MINECRAFT_STATUS_CHANNEL_NAME,
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E2A\u0E14\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C \u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E02\u0E49\u0E32-\u0E2D\u0E2D\u0E01",
    reason: "\u0E41\u0E22\u0E01\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E2A\u0E16\u0E32\u0E19\u0E30 Minecraft \u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E41\u0E25\u0E30\u0E0A\u0E48\u0E2D\u0E07\u0E40\u0E1E\u0E25\u0E07"
  }).catch(() => null);
  if (!created) return null;
  configuredMinecraftStatusChannelId = created.id;
  return created.id;
}

// server/multiserverRuntime.ts
var ENV_KEY = /^[A-Z][A-Z0-9_]*$/;
function readReferencedEnv(name) {
  if (!name || !ENV_KEY.test(name)) return "";
  return process.env[name] ?? "";
}
function parseChannelConfig(raw) {
  try {
    const parsed = JSON.parse(raw);
    const allowedKeys = [
      "welcomeChannelId",
      "leaveChannelId",
      "statusChannelId",
      "musicChannelId",
      "verificationChannelId",
      "memberListChannelId",
      "rankClaimChannelId",
      "verifiedRoleId",
      "memberRoleId",
      "claimRankGroup"
    ];
    return allowedKeys.reduce((result, key) => {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) result[key] = value.trim();
      return result;
    }, {});
  } catch {
    return {};
  }
}
function buildManagedServerRuntimeConfig(server, config) {
  return {
    serverId: server.id,
    slug: server.slug,
    displayName: server.displayName,
    enabled: server.enabled === 1,
    minecraftHost: server.minecraftHost,
    minecraftPort: server.minecraftPort,
    discordGuildId: server.discordGuildId ?? "",
    discordBotToken: readReferencedEnv(config.discordTokenEnv),
    rconHost: config.rconHost ?? server.minecraftHost,
    rconPort: config.rconPort ?? 25575,
    rconPassword: readReferencedEnv(config.rconPasswordEnv),
    channels: parseChannelConfig(config.channelConfig)
  };
}
async function getManagedServerRuntimeConfig(serverId) {
  const [server, config] = await Promise.all([getManagedServerById(serverId), getManagedServerConfig(serverId)]);
  if (!server || !config || server.enabled !== 1) return void 0;
  return buildManagedServerRuntimeConfig(server, config);
}
async function getActiveManagedServerRuntimeConfig() {
  const rawId = process.env.RITZ_ACTIVE_SERVER_ID?.trim();
  if (!rawId) return void 0;
  const serverId = Number(rawId);
  if (!Number.isInteger(serverId) || serverId <= 0) return void 0;
  return getManagedServerRuntimeConfig(serverId);
}
function runtimeConfigForClient(config) {
  return {
    serverId: config.serverId,
    slug: config.slug,
    displayName: config.displayName,
    enabled: config.enabled,
    minecraftHost: config.minecraftHost,
    minecraftPort: config.minecraftPort,
    discordGuildId: config.discordGuildId,
    channels: config.channels,
    hasDiscordToken: Boolean(config.discordBotToken),
    hasRconPassword: Boolean(config.rconPassword)
  };
}

// server/discordAiBot.ts
var MAX_LOGS = 100;
var logsBuffer = [];
var botClient = null;
var activeManagedServerRuntime = null;
var totalInteractionsCount = 0;
var botStartTime = null;
function createSingleFlight() {
  let inFlight = null;
  return {
    run(factory) {
      if (inFlight) return inFlight;
      inFlight = factory().catch((error) => {
        inFlight = null;
        throw error;
      });
      return inFlight;
    },
    get promise() {
      return inFlight;
    }
  };
}
var botStartup = createSingleFlight();
function pushLog(level, message) {
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  logsBuffer.push({ timestamp: timestamp2, level, message });
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }
  console.log(`[RitzSmpAI] [${level}] ${message}`);
}
function getRitzSmpAiBotStatus() {
  const isOnline = Boolean(botClient && botClient.isReady());
  return {
    status: isOnline ? "online" : "offline",
    username: botClient?.user?.tag || "RitzSMP AI#0000",
    totalInteractions: totalInteractionsCount,
    uptimeMs: botStartTime ? Date.now() - botStartTime : 0,
    logs: [...logsBuffer].reverse()
  };
}
var checkMinecraftServerStatus = fetchMinecraftServerStatus;
function getConfiguredDiscordGuildId() {
  return activeManagedServerRuntime?.discordGuildId || ENV.discordGuildId;
}
function interactionWasAlreadyAcknowledged(error) {
  const code = error?.code;
  return code === 40060 || /already been acknowledged|already acknowledged/i.test(String(error));
}
function interactionWasNotReplied(error) {
  return /InteractionNotReplied|reply to this interaction has not been sent or deferred/i.test(
    String(error)
  );
}
async function ensureDeferredReply(interaction, options = {}) {
  if (!interaction) return false;
  if (typeof interaction.isRepliable === "function" && !interaction.isRepliable())
    return false;
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply(options);
    interaction.__ritzDeferred = true;
    interaction.__ritzDeferConfirmed = true;
    return true;
  } catch (error) {
    if (interactionWasAlreadyAcknowledged(error) || interaction.deferred || interaction.replied) {
      interaction.__ritzAcknowledgedByRace = true;
      pushLog(
        "INFO",
        "Interaction was acknowledged by another handler; continuing with followUp"
      );
      return true;
    }
    pushLog("ERROR", `Could not defer interaction: ${String(error)}`);
    return false;
  }
}
async function safeReply(interaction, options) {
  if (!interaction) return false;
  if (typeof interaction.isRepliable === "function" && !interaction.isRepliable())
    return false;
  let payload = options;
  if (typeof options === "string") {
    payload = {
      content: options.length > 1950 ? options.slice(0, 1900) + "\n...(\u0E16\u0E39\u0E01\u0E15\u0E31\u0E14\u0E17\u0E2D\u0E19\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27)" : options
    };
  } else if (options && typeof options === "object" && typeof options.content === "string" && options.content.length > 1950) {
    payload = {
      ...options,
      content: options.content.slice(0, 1900) + "\n...(\u0E16\u0E39\u0E01\u0E15\u0E31\u0E14\u0E17\u0E2D\u0E19\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27)"
    };
  }
  try {
    if (interaction.deferred || interaction.replied || interaction.__ritzDeferConfirmed) {
      await interaction.editReply(payload);
    } else if (interaction.__ritzAcknowledgedByRace && typeof interaction.followUp === "function") {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
    return true;
  } catch (error) {
    if (interactionWasNotReplied(error)) {
      try {
        await interaction.reply(payload);
        return true;
      } catch (replyError) {
        if (interactionWasAlreadyAcknowledged(replyError) && typeof interaction.followUp === "function") {
          await interaction.followUp(payload);
          return true;
        }
        pushLog(
          "ERROR",
          `safeReply reply recovery failed: ${String(replyError)}`
        );
        return false;
      }
    }
    if (interactionWasAlreadyAcknowledged(error)) {
      try {
        if (interaction.deferred || interaction.replied || interaction.__ritzDeferConfirmed) {
          await interaction.editReply(payload);
        } else if (interaction.__ritzAcknowledgedByRace && typeof interaction.followUp === "function") {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
        return true;
      } catch (retryError) {
        pushLog(
          "ERROR",
          `safeReply acknowledged retry failed: ${String(retryError)}`
        );
        return false;
      }
    }
    pushLog("WARN", `safeReply failed: ${String(error)}`);
    try {
      const fallbackPayload = {
        content: "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E15\u0E2D\u0E1A\u0E2A\u0E19\u0E2D\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30 \u{1F495}",
        ephemeral: true
      };
      if (!interaction.replied && !interaction.deferred && !interaction.__ritzAcknowledgedByRace) {
        await interaction.reply(fallbackPayload);
      } else if (interaction.__ritzAcknowledgedByRace && typeof interaction.followUp === "function") {
        await interaction.followUp(fallbackPayload);
      } else {
        await interaction.editReply(fallbackPayload);
      }
      return true;
    } catch (fallbackError) {
      pushLog("ERROR", `safeReply fallback failed: ${String(fallbackError)}`);
      return false;
    }
  }
}
var RITZ_WELCOME_COVER_IMAGE_URL = "https://ritzsmpstore-94jhsfkx.manus.space/manus-storage/welcome-cover_ec173e6c.png";
var RITZ_RANK_CLAIM_IMAGE_URL = "https://ritzsmpstore-94jhsfkx.manus.space/manus-storage/rank-claim_2909f231.png";
function buildOnboardingComponents() {
  const actionRow = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId("ritz_verify_button").setLabel("\u{1F517} \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35").setStyle(ButtonStyle2.Success),
    new ButtonBuilder2().setCustomId("ritz_cancel_verify_button").setLabel("\u274C \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E23\u0E2B\u0E31\u0E2A / \u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E1A\u0E31\u0E0D\u0E0A\u0E35").setStyle(ButtonStyle2.Secondary),
    new ButtonBuilder2().setCustomId("ritz_unlink_button").setLabel("\u{1F513} \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14").setStyle(ButtonStyle2.Danger)
  );
  return [actionRow];
}
function buildRankClaimComponents() {
  const actionRow = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId("ritz_claim_rank_button").setLabel("\u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19").setStyle(ButtonStyle2.Success)
  );
  return [actionRow];
}
function buildRankClaimEmbed() {
  return new EmbedBuilder2().setTitle("\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E01\u0E31\u0E19\u0E14\u0E49\u0E27\u0E22\u0E19\u0E49\u0E32\u2728").setDescription(
    "\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 RitzSMP \u0E19\u0E30\u0E04\u0E30 \u{1F496}\\n\\n\u0E2B\u0E32\u0E01\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Minecraft \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E43\u0E2B\u0E49\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D\u0E04\u0E48\u0E30"
  ).setColor(16730972).setImage(RITZ_RANK_CLAIM_IMAGE_URL).setFooter({ text: "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34" }).setTimestamp();
}
var AUTO_SYSTEM_PANEL_DEPLOYMENT_ENABLED = false;
function parseEmbedColor(input, fallback = 15485081) {
  if (typeof input === "number" && Number.isInteger(input) && input >= 0 && input <= 16777215) {
    return input;
  }
  const normalized = String(input ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? parseInt(normalized, 16) : fallback;
}
function isHttpUrl(value) {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
function buildManualEmbedPayload(options) {
  const embed = new EmbedBuilder2().setTitle(options.title.trim().slice(0, 256)).setDescription(options.description.trim().slice(0, 4096)).setColor(parseEmbedColor(options.color)).setTimestamp().setFooter({
    text: (options.footerText || "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E42\u0E14\u0E22\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19 \u2022 RitzSMP AI").slice(
      0,
      2048
    )
  });
  if (isHttpUrl(options.imageUrl)) embed.setImage(options.imageUrl);
  const components = [];
  if (options.buttonLabel?.trim() && isHttpUrl(options.buttonUrl)) {
    components.push(
      new ActionRowBuilder2().addComponents(
        new ButtonBuilder2().setLabel(options.buttonLabel.trim().slice(0, 80)).setStyle(ButtonStyle2.Link).setURL(options.buttonUrl)
      )
    );
  }
  return { embeds: [embed], components };
}
function buildManualSystemPanelPayload(kind, overrides = {}) {
  const defaults = kind === "welcome" ? {
    title: "\u{1F44B} \u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48 RitzSMP",
    description: "\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E04\u0E48\u0E30 \u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E30 \u{1F496}",
    color: 15485081,
    imageUrl: RITZ_WELCOME_COVER_IMAGE_URL,
    footerText: "RitzSMP AI \u2022 \u0E41\u0E1C\u0E07\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07"
  } : {
    title: "\u0E44\u0E27\u0E49\u0E40\u0E08\u0E2D\u0E01\u0E31\u0E19\u0E43\u0E2B\u0E21\u0E48\u0E19\u0E30\u0E04\u0E30 \u{1F44B}",
    description: "\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP \u0E04\u0E48\u0E30",
    color: 16020150,
    imageUrl: RITZ_WELCOME_COVER_IMAGE_URL,
    footerText: "RitzSMP AI \u2022 \u0E41\u0E1C\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E17\u0E35\u0E48\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07"
  };
  return buildManualEmbedPayload({ ...defaults, ...overrides });
}
function isDiscordAdministrator(interaction) {
  if (!interaction?.guild) return false;
  const permissions = interaction.memberPermissions ?? interaction.member?.permissions;
  if (permissions?.has)
    return permissions.has(PermissionsBitField.Flags.Administrator);
  return false;
}
function getEmbedData(message) {
  const source = message?.embeds?.[0]?.data ?? message?.embeds?.[0] ?? {};
  return {
    title: String(source.title ?? "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28 RitzSMP AI"),
    description: String(source.description ?? ""),
    color: source.color,
    imageUrl: source.image?.url ?? null,
    footerText: source.footer?.text ?? "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E14\u0E22\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19 \u2022 RitzSMP AI"
  };
}
async function requireDiscordAdministrator(interaction) {
  if (isDiscordAdministrator(interaction)) return true;
  await safeReply(interaction, {
    content: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30 \u{1F512}",
    ephemeral: true
  });
  return false;
}
function getInteractionTextChannel(interaction) {
  const channel = interaction?.channel;
  return channel?.isTextBased?.() && typeof channel.send === "function" ? channel : null;
}
function isMisroutedWelcomePanelMessage(message) {
  const titles = (message.embeds ?? []).map(
    (embed) => String(embed?.title ?? embed?.data?.title ?? "")
  );
  const footers = (message.embeds ?? []).map(
    (embed) => String(embed?.footer?.text ?? embed?.data?.footer?.text ?? "")
  );
  const customIds = (message.components ?? []).flatMap((row) => row?.components ?? []).map(
    (component) => String(
      component?.customId ?? component?.data?.custom_id ?? component?.custom_id ?? ""
    )
  );
  const isWelcomeTitle = titles.some(
    (title) => title.includes("\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48 RitzSMP")
  );
  const isWelcomeFooter = footers.some(
    (footer) => footer.includes("\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48")
  );
  return (isWelcomeTitle || isWelcomeFooter) && customIds.includes("ritz_verify_button");
}
function planMisroutedWelcomePanelCleanup(messages) {
  return Array.from(messages).filter(isMisroutedWelcomePanelMessage).map((message) => message.id);
}
var ACCOUNT_LIST_PANEL_MARKER = "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35 \u2022 canonical-v1";
var LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME = "\u{1F9FE}\u2502\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08";
var LEGACY_KANOPI_BOT_USER_ID = "1369921212062629939";
function isLegacyKanopiRankLogMessage(message) {
  const authorId = String(message.author?.id ?? "");
  const authorName = String(message.author?.username ?? "").toLowerCase();
  const isLegacyAuthor = authorId === LEGACY_KANOPI_BOT_USER_ID || message.author?.bot === true && (authorName === "botnasa000" || authorName.includes("kanopi"));
  if (!isLegacyAuthor) return false;
  const content = String(message.content ?? "");
  const embedFields = (message.embeds ?? []).flatMap(
    (embed) => embed?.fields ?? embed?.data?.fields ?? []
  );
  const fieldNames = embedFields.map((field) => String(field?.name ?? "")).join(" ");
  const footers = (message.embeds ?? []).map(
    (embed) => String(embed?.footer?.text ?? embed?.data?.footer?.text ?? "")
  );
  const hasRankLogContent = content.includes("\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27");
  const hasRankLogFields = fieldNames.includes("\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21") && fieldNames.includes("\u0E2A\u0E44\u0E15\u0E25\u0E4C \u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19");
  const hasLegacyIdFooter = footers.some((footer) => /^ID:\s*\d+/.test(footer));
  return hasRankLogContent || hasRankLogFields && hasLegacyIdFooter;
}
function planLegacyKanopiRankLogCleanup(messages) {
  return Array.from(messages).filter(isLegacyKanopiRankLogMessage).map((message) => message.id);
}
var RITZ_SYSTEM_CHANNEL_TARGETS = [
  {
    name: "\u{1F517}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
    legacyNames: ["\u2705\u2502\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E14\u0E34\u0E2A\u0E04\u0E2D\u0E23\u0E4C\u0E14", "\u{1F517}\u2502\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35-Minecraft"],
    type: ChannelType3.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Discord \u0E01\u0E31\u0E1A Minecraft \u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E23\u0E2B\u0E31\u0E2A /verify 4 \u0E2B\u0E25\u0E31\u0E01"
  },
  {
    name: "\u{1F4CB}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
    legacyNames: [
      "\u{1F4CB}\u2502\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
      "\u{1F4CB}\uFE31\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
      "\u{1F4CB}\u2502\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D-\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19"
    ],
    type: ChannelType3.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E2A\u0E14\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Minecraft \u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27"
  },
  {
    name: "\u{1F396}\uFE0F\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E22\u0E28",
    legacyNames: ["\u{1FAAA}\u2502\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E21\u0E30", "\u{1F396}\uFE0F\u2502\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19-\u0E23\u0E31\u0E1A\u0E22\u0E28"],
    type: ChannelType3.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E30\u0E01\u0E14\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 RitzSMP AI"
  },
  {
    name: "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A",
    legacyNames: [
      "\u{1F44B}\u2502welcome",
      "\u{1F44B}\u2502\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A-\u0E40\u0E02\u0E49\u0E32\u0E2D\u0E2D\u0E01",
      "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A-\u0E40\u0E02\u0E49\u0E32\u0E2D\u0E2D\u0E01",
      "\u{1F91E}\u{1F3FB}\u2502leave"
    ],
    type: ChannelType3.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E41\u0E25\u0E30\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E02\u0E49\u0E32\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
  },
  {
    name: "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01",
    legacyNames: ["\u{1F44B}\u2502leave", "\u{1F44B}\u2502\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01", "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"],
    type: ChannelType3.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
  }
];
function planManagedSystemChannelCleanup(channels, target) {
  const candidates = Array.from(channels).filter(
    (channel) => (channel.type === void 0 || channel.type === ChannelType3.GuildText) && (channel.name === target.name || target.legacyNames.includes(channel.name))
  ).sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id)
  );
  const exactMatches = candidates.filter(
    (channel) => channel.name === target.name
  );
  const canonical = exactMatches[0] ?? candidates[0];
  return {
    canonicalId: canonical?.id ?? null,
    duplicateIds: candidates.filter((channel) => channel.id !== canonical?.id).map((channel) => channel.id)
  };
}
function isAccountListPanelMessage(message, botUserId) {
  if (botUserId && message.author?.id !== botUserId) return false;
  const titles = (message.embeds ?? []).map(
    (embed) => String(embed?.title ?? embed?.data?.title ?? "")
  );
  const customIds = (message.components ?? []).flatMap((row) => row?.components ?? []).map(
    (component) => String(component?.customId ?? component?.data?.custom_id ?? "")
  );
  return titles.some((title) => title.includes("\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E0D\u0E0A\u0E35")) || customIds.includes("ritz_profile_button");
}
function planAccountListPanelCleanup(messages, botUserId) {
  const panels = Array.from(messages).filter((message) => isAccountListPanelMessage(message, botUserId)).sort(
    (a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0) || a.id.localeCompare(b.id)
  );
  return {
    canonicalId: panels[0]?.id ?? null,
    duplicateIds: panels.slice(1).map((message) => message.id)
  };
}
function buildAccountListPanelPayload() {
  const embed = new EmbedBuilder2().setTitle("\u{1F4CB} \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19").setDescription(
    "\u0E23\u0E30\u0E1A\u0E1A\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 RitzSMP \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E42\u0E14\u0E22\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 \u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E04\u0E48\u0E30 \u2728"
  ).setColor(3900150).setFooter({ text: ACCOUNT_LIST_PANEL_MARKER }).setTimestamp();
  const profileRow = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId("ritz_profile_button").setLabel("\u{1FAAA} \u0E14\u0E39\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19").setStyle(ButtonStyle2.Primary),
    new ButtonBuilder2().setCustomId("ritz_discord_members_button").setLabel("\u{1F465} \u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord").setStyle(ButtonStyle2.Secondary),
    new ButtonBuilder2().setCustomId("ritz_players_button").setLabel("\u26CF\uFE0F \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 Minecraft \u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C").setStyle(ButtonStyle2.Secondary),
    new ButtonBuilder2().setCustomId("ritz_unlink_button").setLabel("\u{1F513} \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35").setStyle(ButtonStyle2.Danger)
  );
  return { embeds: [embed], components: [profileRow] };
}
async function fetchRecentChannelMessages(channel, limit = 100) {
  const collection = await channel.messages.fetch({ limit });
  return Array.from(collection.values());
}
async function cleanupLegacyKanopiRankLogMessages(client) {
  const rankLogChannelId = ENV.discordSupportChannelId?.trim() || "";
  if (!rankLogChannelId) return;
  const channel = await client.channels.fetch(rankLogChannelId).catch(() => null);
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const staleIds = planLegacyKanopiRankLogCleanup(messages);
  for (const message of messages.filter(
    (message2) => staleIds.includes(message2.id)
  )) {
    await message.delete(
      "Remove legacy Kanopi rank-log message from RitzSMP purchase-success channel"
    ).then(() => {
      pushLog(
        "SUCCESS",
        `Removed legacy Kanopi rank-log message ${message.id}`
      );
    }).catch((error) => {
      pushLog(
        "WARN",
        `Could not remove legacy Kanopi rank-log message ${message.id}: ${String(error)}`
      );
    });
  }
}
async function cleanupMisroutedWelcomePanels(client) {
  const purchaseChannelId = ENV.discordSupportChannelId?.trim() || "";
  if (!purchaseChannelId) return;
  const channel = await client.channels.fetch(purchaseChannelId).catch(() => null);
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const staleIds = planMisroutedWelcomePanelCleanup(messages);
  for (const message of messages.filter(
    (message2) => staleIds.includes(message2.id)
  )) {
    await message.delete("Remove misrouted welcome panel from purchase-success channel").then(() => {
      pushLog(
        "SUCCESS",
        `Removed misrouted welcome panel ${message.id} from purchase-success channel`
      );
    }).catch((error) => {
      pushLog(
        "WARN",
        `Could not remove misrouted welcome panel ${message.id}: ${String(error)}`
      );
    });
  }
}
async function reconcileAccountListPanel(channel, client) {
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const cleanupPlan = planAccountListPanelCleanup(messages, botUserId);
  const canonicalPanel = messages.find(
    (message) => message.id === cleanupPlan.canonicalId
  );
  if (canonicalPanel) {
    await canonicalPanel.edit(buildAccountListPanelPayload());
  } else {
    await channel.send(buildAccountListPanelPayload());
  }
  for (const stalePanel of messages.filter(
    (message) => cleanupPlan.duplicateIds.includes(message.id)
  )) {
    await stalePanel.delete("Remove duplicate RitzSMP AI account-list panel").catch((error) => {
      pushLog(
        "WARN",
        `Could not delete duplicate account-list panel: ${String(error)}`
      );
    });
  }
}
async function cleanupDuplicateAccountListChannel(channel, client) {
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const duplicatePanels = messages.filter(
    (message) => isAccountListPanelMessage(message, botUserId)
  );
  for (const panel of duplicatePanels) {
    await panel.delete(
      "Remove duplicate RitzSMP AI account-list panel from legacy channel"
    ).catch((error) => {
      pushLog(
        "WARN",
        `Could not delete legacy account-list panel: ${String(error)}`
      );
    });
  }
  const nonPanelMessages = messages.filter(
    (message) => !isAccountListPanelMessage(message, botUserId)
  );
  if (nonPanelMessages.length > 0) {
    if (channel.name !== LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME && typeof channel.setName === "function") {
      const previousName = channel.name;
      await channel.setName(
        LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME,
        "Clarify preserved rank-fulfillment log channel"
      ).then(() => {
        pushLog(
          "SUCCESS",
          `Renamed preserved legacy channel ${previousName} to ${LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME}`
        );
      }).catch((error) => {
        pushLog(
          "WARN",
          `Could not rename preserved legacy account-list channel ${channel.id}: ${String(error)}`
        );
      });
    }
    return;
  }
  if (messages.length < 100 && typeof channel.delete === "function") {
    await channel.delete("Remove empty legacy RitzSMP AI account-list channel").catch((error) => {
      pushLog(
        "WARN",
        `Could not delete duplicate account-list channel ${channel.id}: ${String(error)}`
      );
    });
  }
}
async function addConfiguredRole(interaction, roleId, reason) {
  if (!roleId || !interaction.guild) return false;
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId, reason);
    }
    return true;
  } catch (error) {
    pushLog(
      "WARN",
      `Could not add configured Discord role ${roleId}: ${String(error)}`
    );
    return false;
  }
}
function getVerificationConflict(existingForDiscord, existingForMinecraft, discordUserId, minecraftUuid) {
  if (existingForMinecraft && existingForMinecraft.discordUserId !== discordUserId)
    return "minecraft-linked-to-other-discord";
  if (existingForDiscord && existingForDiscord.minecraftUuid !== minecraftUuid)
    return "discord-linked-to-other-minecraft";
  return null;
}
async function verifyDiscordNativeAccount(interaction, shouldClaimRank) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  const rawInput = interaction.fields.getTextInputValue("minecraft_ign").trim();
  let minecraftInfo = "\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D Minecraft (\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E1C\u0E48\u0E32\u0E19 Discord 100%)";
  let verified = await addConfiguredRole(
    interaction,
    ENV.discordVerifiedRoleId,
    "RitzSMP AI Discord-native verification"
  );
  let rankMessage = "";
  if (rawInput && rawInput.length > 0 && !/^none$/i.test(rawInput)) {
    const profile = await fetchMinecraftProfile(rawInput);
    if (profile) {
      try {
        const existingForDiscord = await getDiscordVerification(
          interaction.user.id
        );
        const existingForMinecraft = await getDiscordVerificationByMinecraftUuid(profile.id);
        const verificationConflict = getVerificationConflict(
          existingForDiscord,
          existingForMinecraft,
          interaction.user.id,
          profile.id
        );
        if (verificationConflict === "minecraft-linked-to-other-discord") {
          await safeReply(
            interaction,
            "\u0E0A\u0E37\u0E48\u0E2D Minecraft \u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E01\u0E31\u0E1A Discord \u0E2D\u0E37\u0E48\u0E19\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E41\u0E15\u0E48\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E43\u0E19 Discord \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27\u0E19\u0E30\u0E08\u0E4A\u0E30 \u{1F495}"
          );
          return;
        }
        if (!existingForDiscord) {
          await createDiscordVerification({
            discordUserId: interaction.user.id,
            minecraftIGN: profile.name,
            minecraftUuid: profile.id
          });
        }
        minecraftInfo = `**${profile.name}**`;
        if (shouldClaimRank) {
          const rankResult = await grantMinecraftRank(
            profile.name,
            ENV.discordClaimRankGroup
          );
          const memberRoleAdded2 = await addConfiguredRole(
            interaction,
            ENV.discordMemberRoleId,
            "RitzSMP member rank claim"
          );
          rankMessage = rankResult.executed ? `
\u{1F396}\uFE0F \u0E21\u0E2D\u0E1A\u0E01\u0E25\u0E38\u0E48\u0E21 LuckPerms **${ENV.discordClaimRankGroup}** \u0E43\u0E2B\u0E49\u0E43\u0E19\u0E40\u0E01\u0E21\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30${memberRoleAdded2 ? " \u0E41\u0E25\u0E30\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19 Discord \u0E41\u0E25\u0E49\u0E27\u0E19\u0E30\u0E04\u0E49\u0E32" : ""}` : `
\u{1F396}\uFE0F \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30 \u0E41\u0E15\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E1B\u0E34\u0E14 RCON \u0E43\u0E19\u0E40\u0E01\u0E21${memberRoleAdded2 ? " (\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19 Discord \u0E41\u0E25\u0E49\u0E27\u0E08\u0E49\u0E32)" : ""}`;
        }
      } catch (err) {
        pushLog("WARN", `Optional Minecraft lookup note: ${String(err)}`);
      }
    } else {
      try {
        const existingForDiscord = await getDiscordVerification(
          interaction.user.id
        );
        if (!existingForDiscord) {
          await createDiscordVerification({
            discordUserId: interaction.user.id,
            minecraftIGN: rawInput.slice(0, 16),
            minecraftUuid: `discord-native-${interaction.user.id}`
          });
        }
        minecraftInfo = `**${rawInput}** (Discord-native alias)`;
      } catch (e) {
      }
    }
  } else {
    try {
      const existingForDiscord = await getDiscordVerification(
        interaction.user.id
      );
      if (!existingForDiscord) {
        await createDiscordVerification({
          discordUserId: interaction.user.id,
          minecraftIGN: interaction.user.username.slice(0, 16),
          minecraftUuid: `discord-native-${interaction.user.id}`
        });
      }
    } catch (e) {
    }
  }
  const memberRoleAdded = shouldClaimRank ? await addConfiguredRole(
    interaction,
    ENV.discordMemberRoleId,
    "RitzSMP member role claim"
  ) : false;
  await safeReply(
    interaction,
    `\u0E22\u0E34\u0E19\u0E14\u0E35\u0E14\u0E49\u0E27\u0E22\u0E19\u0E30\u0E04\u0E30! \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E43\u0E19 Discord \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E32 \u2728
\u{1F464} \u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01: **${interaction.user.tag}**
\u26CF\uFE0F Minecraft: ${minecraftInfo}
${verified ? "\u2705 \u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E22\u0E28 Verified \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E19\u0E30\u0E04\u0E30 \u{1F495}" : "\u26A0\uFE0F \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 Verified Role \u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A"}`
  );
  pushLog("SUCCESS", `Discord-native verified ${interaction.user.id}`);
}
function buildDiscordMembersEmbed(members) {
  const visibleMembers = members.filter((member) => !member.user?.bot).slice(0, 25);
  const description = visibleMembers.length > 0 ? visibleMembers.map((member, index) => {
    const displayName = member.displayName || member.user?.globalName || member.user?.username || `\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 ${index + 1}`;
    return `**${index + 1}.** ${displayName} (<@${member.id}>)`;
  }).join("\n") : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord \u0E17\u0E35\u0E48\u0E41\u0E2A\u0E14\u0E07\u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49\u0E04\u0E48\u0E30";
  return new EmbedBuilder2().setTitle("\u{1F465} \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord RitzSMP").setDescription(description).addFields({
    name: "\u{1F512} \u0E04\u0E27\u0E32\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27",
    value: "\u0E41\u0E2A\u0E14\u0E07\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E0A\u0E37\u0E48\u0E2D Discord \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23 mention \u0E02\u0E2D\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C \u0E44\u0E21\u0E48\u0E41\u0E2A\u0E14\u0E07\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E2B\u0E23\u0E37\u0E2D\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27\u0E04\u0E48\u0E30"
  }).setColor(9133302).setFooter({
    text: visibleMembers.length >= 25 ? "\u0E41\u0E2A\u0E14\u0E07 25 \u0E04\u0E19\u0E41\u0E23\u0E01 \u2022 \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E15\u0E47\u0E21\u0E14\u0E39\u0E44\u0E14\u0E49\u0E43\u0E19 Discord" : `\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E17\u0E35\u0E48\u0E41\u0E2A\u0E14\u0E07 ${visibleMembers.length} \u0E04\u0E19`
  }).setTimestamp();
}
async function replyWithDiscordMembers(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  try {
    if (!interaction.guild?.members?.fetch) {
      await safeReply(interaction, {
        content: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E20\u0E32\u0E22\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Discord \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30",
        ephemeral: true
      });
      return;
    }
    const fetched = await interaction.guild.members.fetch();
    const members = Array.from(
      typeof fetched.values === "function" ? fetched.values() : []
    );
    await safeReply(interaction, {
      embeds: [buildDiscordMembersEmbed(members)],
      ephemeral: true
    });
  } catch (error) {
    pushLog("ERROR", `Failed to load Discord member list: ${String(error)}`);
    await safeReply(interaction, {
      content: "\u0E22\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30",
      ephemeral: true
    });
  }
}
function buildMinecraftPlayersEmbed(status) {
  const playerCount = Number.isFinite(status.players) ? Math.max(0, status.players) : 0;
  const maxPlayers = Number.isFinite(status.maxPlayers) ? Math.max(0, status.maxPlayers) : 0;
  const description = status.online ? playerCount === 0 ? "\u{1F7E2} \u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C\u0E04\u0E48\u0E30 \u0E41\u0E15\u0E48\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C" : status.playerNames.length > 0 ? status.playerNames.map((name) => `\u2022 ${name}`).join("\n") : "\u{1F7E2} \u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C \u0E41\u0E15\u0E48 API \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1C\u0E22\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49\u0E04\u0E48\u0E30" : "\u{1F534} \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C\u0E04\u0E48\u0E30 \u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 0 \u0E04\u0E19\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27";
  const statusValue = status.online ? `\u{1F7E2} \u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C ${playerCount}/${maxPlayers} \u0E04\u0E19` : "\u{1F534} \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 \u2022 \u0E41\u0E2A\u0E14\u0E07 0 \u0E04\u0E19\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27";
  return new EmbedBuilder2().setTitle("\u{1F465} \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E43\u0E19 RitzSMP").setDescription(description).addFields({ name: "\u0E2A\u0E16\u0E32\u0E19\u0E30", value: statusValue, inline: true }).setColor(status.online ? 2278750 : 15680580).setTimestamp().setFooter({
    text: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E32\u0E01 Minecraft status API \u2022 \u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A"
  });
}
async function replyWithPlayers(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  try {
    const mc = await fetchMinecraftServerStatus();
    await safeReply(interaction, {
      embeds: [buildMinecraftPlayersEmbed(mc)],
      ephemeral: true
    });
  } catch (error) {
    pushLog("WARN", `Minecraft player status fallback: ${String(error)}`);
    await safeReply(interaction, {
      content: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Minecraft \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30 \u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 0 \u0E04\u0E19\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E19\u0E30\u0E04\u0E30",
      ephemeral: true
    });
  }
}
async function replyWithVerificationCode(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  try {
    const codeRow = await createDiscordVerificationCode(interaction.user.id);
    const embed = new EmbedBuilder2().setTitle("\u{1F517} \u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19 Minecraft").setDescription(
      `\u0E19\u0E35\u0E48\u0E04\u0E37\u0E2D\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E04\u0E48\u0E30:

# \`${codeRow.code}\`

\u{1F4CC} **\u0E27\u0E34\u0E18\u0E35\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19:**
1. \u0E40\u0E02\u0E49\u0E32\u0E40\u0E01\u0E21 Minecraft (ritz.mcsv.me)
2. \u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 \`/verify ${codeRow.code}\` \u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E41\u0E0A\u0E17
3. \u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E08\u0E30\u0E16\u0E39\u0E01\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30! \u{1F495}`
    ).setColor(15485081).setFooter({
      text: `\u0E23\u0E2B\u0E31\u0E2A\u0E19\u0E35\u0E49\u0E08\u0E30\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38\u0E43\u0E19 10 \u0E19\u0E32\u0E17\u0E35 (${new Date(codeRow.expiresAt).toLocaleTimeString("th-TH")})`
    }).setTimestamp();
    await safeReply(interaction, { embeds: [embed], ephemeral: true });
    pushLog(
      "SUCCESS",
      `Generated verification code ${codeRow.code} for ${interaction.user.id}`
    );
  } catch (err) {
    pushLog("ERROR", `Failed to generate verification code: ${String(err)}`);
    await safeReply(interaction, {
      content: "\u0E02\u0E2D\u0E2D\u0E20\u0E31\u0E22\u0E04\u0E48\u0E30 \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30",
      ephemeral: true
    });
  }
}
async function showMinecraftModal(interaction, customId, title) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder().setCustomId("minecraft_ign").setLabel(
    "\u0E0A\u0E37\u0E48\u0E2D Minecraft (\u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E34\u0E21\u0E1E\u0E4C 'none' \u0E2B\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1C\u0E48\u0E32\u0E19 Discord \u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27)"
  ).setPlaceholder("\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E27\u0E49\u0E19\u0E27\u0E48\u0E32\u0E07\u0E44\u0E14\u0E49\u0E08\u0E49\u0E32").setStyle(TextInputStyle.Short).setMinLength(0).setMaxLength(32).setRequired(false);
  modal.addComponents(
    new ActionRowBuilder2().addComponents(input)
  );
  await interaction.showModal(modal);
}
function isProfileOwner(discordUserId, verification) {
  return typeof verification.discordUserId !== "string" || discordUserId === verification.discordUserId;
}
function canEditProfile(discordUserId, verification) {
  return isProfileOwner(discordUserId, verification);
}
function buildProfileEmbed(interaction, verification) {
  if (!isProfileOwner(interaction.user.id, verification)) {
    throw new Error("\u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E2B\u0E49\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1C\u0E22\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E04\u0E19\u0E2D\u0E37\u0E48\u0E19");
  }
  const skinUrl = `https://mc-heads.net/avatar/${encodeURIComponent(verification.minecraftIGN)}/128`;
  return new EmbedBuilder2().setTitle(`\u{1FAAA} \u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 ${interaction.user.username}`).setDescription(
    verification.bio || "\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E04\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E02\u0E35\u0E22\u0E19\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27\u0E04\u0E48\u0E30"
  ).setColor(15485081).setThumbnail(skinUrl).addFields(
    {
      name: "Discord",
      value: `${interaction.user.tag}
ID: \`${interaction.user.id}\``,
      inline: false
    },
    {
      name: "Minecraft",
      value: `**${verification.minecraftIGN}**
UUID: \`${verification.minecraftUuid}\``,
      inline: false
    },
    {
      name: "\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19",
      value: verification.playStyle || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E30\u0E1A\u0E38",
      inline: true
    },
    { name: "\u0E2A\u0E16\u0E32\u0E19\u0E30", value: "\u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E49\u0E27", inline: true },
    {
      name: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D",
      value: new Date(verification.verifiedAt).toLocaleString("th-TH"),
      inline: false
    }
  ).setFooter({
    text: "\u0E01\u0E14 \u270F\uFE0F \u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27\u0E41\u0E25\u0E30\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19"
  }).setTimestamp();
}
async function replyWithProfile(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  let verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    try {
      await createDiscordVerification({
        discordUserId: interaction.user.id,
        minecraftIGN: interaction.user.username.slice(0, 16),
        minecraftUuid: `discord-native-${interaction.user.id}`
      });
      verification = await getDiscordVerification(interaction.user.id);
    } catch (e) {
    }
  }
  if (!verification) {
    await interaction.editReply(
      "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E14 \u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E19\u0E30\u0E04\u0E30 \u{1F495}"
    );
    return;
  }
  await interaction.editReply({
    embeds: [buildProfileEmbed(interaction, verification)]
  });
}
async function showProfileModal(interaction) {
  let verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    try {
      await createDiscordVerification({
        discordUserId: interaction.user.id,
        minecraftIGN: interaction.user.username.slice(0, 16),
        minecraftUuid: `discord-native-${interaction.user.id}`
      });
      verification = await getDiscordVerification(interaction.user.id);
    } catch (e) {
    }
  }
  if (!verification) {
    await interaction.reply({
      content: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E14 \u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E19\u0E30\u0E04\u0E30 \u{1F495}",
      ephemeral: true
    });
    return;
  }
  const modal = new ModalBuilder().setCustomId("ritz_profile_modal").setTitle("\u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C RitzSMP");
  const bioInput = new TextInputBuilder().setCustomId("profile_bio").setLabel("\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27\u0E2A\u0E31\u0E49\u0E19 \u0E46").setPlaceholder("\u0E40\u0E0A\u0E48\u0E19 \u0E0A\u0E2D\u0E1A\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1A\u0E49\u0E32\u0E19\u0E41\u0E25\u0E30\u0E40\u0E25\u0E48\u0E19\u0E01\u0E31\u0E1A\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E19 \u0E46").setStyle(TextInputStyle.Paragraph).setMaxLength(300).setRequired(false).setValue(verification.bio || "");
  const styleInput = new TextInputBuilder().setCustomId("profile_play_style").setLabel("\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19").setPlaceholder("\u0E40\u0E0A\u0E48\u0E19 \u0E2A\u0E32\u0E22\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1A\u0E49\u0E32\u0E19 / \u0E2A\u0E32\u0E22\u0E1C\u0E08\u0E0D\u0E20\u0E31\u0E22").setStyle(TextInputStyle.Short).setMaxLength(128).setRequired(false).setValue(verification.playStyle || "");
  modal.addComponents(
    new ActionRowBuilder2().addComponents(bioInput),
    new ActionRowBuilder2().addComponents(styleInput)
  );
  await interaction.showModal(modal);
}
async function updateProfileFromModal(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  const verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    await interaction.editReply(
      "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E01\u0E48\u0E2D\u0E19\u0E19\u0E30\u0E04\u0E30"
    );
    return;
  }
  if (!canEditProfile(interaction.user.id, verification)) {
    await interaction.editReply("\u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E2B\u0E49\u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E04\u0E19\u0E2D\u0E37\u0E48\u0E19\u0E04\u0E48\u0E30");
    return;
  }
  const bio = interaction.fields.getTextInputValue("profile_bio").trim().slice(0, 300) || null;
  const playStyle = interaction.fields.getTextInputValue("profile_play_style").trim().slice(0, 128) || null;
  const updated = await updateDiscordProfile(interaction.user.id, {
    bio,
    playStyle
  });
  if (!updated) {
    await interaction.editReply(
      "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30"
    );
    return;
  }
  await interaction.editReply({
    content: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F496}",
    embeds: [buildProfileEmbed(interaction, updated)]
  });
  pushLog("SUCCESS", `Updated Discord profile for ${interaction.user.id}`);
}
function isWelcomeSystemPanelMessage(message) {
  const titles = (message.embeds ?? []).map(
    (embed) => String(embed?.title ?? embed?.data?.title ?? "")
  );
  const footers = (message.embeds ?? []).map(
    (embed) => String(embed?.footer?.text ?? embed?.data?.footer?.text ?? "")
  );
  return titles.some(
    (title) => title.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48 RitzSMP") || title.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E30\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E40\u0E02\u0E49\u0E32-\u0E2D\u0E2D\u0E01")
  ) || footers.some(
    (footer) => footer.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48") || footer.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E30\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E02\u0E49\u0E32-\u0E2D\u0E2D\u0E01")
  );
}
function isLeaveSystemPanelMessage(message) {
  const footers = (message.embeds ?? []).map(
    (embed) => String(embed?.footer?.text ?? embed?.data?.footer?.text ?? "")
  );
  return footers.some((footer) => footer.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01"));
}
function buildWelcomeSystemPanelPayload() {
  const embed = new EmbedBuilder2().setTitle("\u{1F44B} \u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48 RitzSMP").setDescription(
    "\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E40\u0E02\u0E49\u0E32\u0E23\u0E48\u0E27\u0E21\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E04\u0E48\u0E30 \u{1F496}"
  ).setColor(15485081).setImage(RITZ_WELCOME_COVER_IMAGE_URL).setTimestamp().setFooter({ text: "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48" });
  return { embeds: [embed] };
}
function buildLeaveSystemPanelPayload() {
  const embed = new EmbedBuilder2().setTitle("\u0E44\u0E27\u0E49\u0E40\u0E08\u0E2D\u0E01\u0E31\u0E19\u0E43\u0E2B\u0E21\u0E48\u0E19\u0E30\u0E04\u0E30 \u{1F44B}").setDescription(
    "\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP \u0E04\u0E48\u0E30"
  ).setColor(16020150).setImage(RITZ_WELCOME_COVER_IMAGE_URL).setTimestamp().setFooter({ text: "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01" });
  return { embeds: [embed] };
}
async function cleanupDuplicateMemberEventChannel(channel, client, type) {
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const stalePanels = messages.filter((message) => {
    if (botUserId && message.author?.id !== botUserId) return false;
    return isWelcomeSystemPanelMessage(message) || isLeaveSystemPanelMessage(message);
  });
  for (const panel of stalePanels) {
    await panel.delete(`Remove duplicate ${type} system panel from legacy channel`).catch((error) => {
      pushLog(
        "WARN",
        `Could not delete duplicate ${type} panel from legacy channel: ${String(error)}`
      );
    });
  }
  const userMessages = messages.filter(
    (message) => !stalePanels.some((panel) => panel.id === message.id)
  );
  if (userMessages.length === 0 && typeof channel.delete === "function") {
    await channel.delete(`Remove duplicate ${type} notification channel`).then(() => {
      pushLog(
        "SUCCESS",
        `Removed duplicate ${type} notification channel ${channel.id}`
      );
    }).catch((error) => {
      pushLog(
        "WARN",
        `Could not remove duplicate ${type} notification channel ${channel.id}: ${String(error)}`
      );
    });
  }
}
async function reconcileMemberEventSystemPanel(channel, client, type) {
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const detector = type === "welcome" ? isWelcomeSystemPanelMessage : isLeaveSystemPanelMessage;
  const panels = messages.filter(
    (message) => (!botUserId || message.author?.id === botUserId) && detector(message)
  ).sort(
    (a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0) || a.id.localeCompare(b.id)
  );
  const canonicalPanel = panels[0];
  const payload = type === "welcome" ? buildWelcomeSystemPanelPayload() : buildLeaveSystemPanelPayload();
  if (canonicalPanel) {
    await canonicalPanel.edit(payload);
  } else {
    await channel.send(payload);
  }
  for (const duplicate of panels.slice(1)) {
    await duplicate.delete(`Remove duplicate ${type} system panel`).catch((error) => {
      pushLog(
        "WARN",
        `Could not delete duplicate ${type} system panel: ${String(error)}`
      );
    });
  }
}
async function handleOnboardingInteraction(interaction) {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === "ritz_verify_button") {
        await replyWithVerificationCode(interaction);
        return true;
      }
      if (interaction.customId === "ritz_claim_rank_button") {
        const existing = await getDiscordVerification(interaction.user.id);
        if (!existing) {
          await showMinecraftModal(
            interaction,
            "ritz_claim_rank_modal",
            "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28 RitzSMP"
          );
          return true;
        }
        if (!await ensureDeferredReply(interaction, { ephemeral: true }))
          return true;
        const rankResult = await grantMinecraftRank(
          existing.minecraftIGN,
          ENV.discordClaimRankGroup
        );
        const memberRoleAdded = await addConfiguredRole(
          interaction,
          ENV.discordMemberRoleId,
          "RitzSMP member rank claim"
        );
        await safeReply(interaction, {
          content: rankResult.executed ? `\u0E21\u0E2D\u0E1A\u0E01\u0E25\u0E38\u0E48\u0E21 LuckPerms **${ENV.discordClaimRankGroup}** \u0E43\u0E2B\u0E49 **${existing.minecraftIGN}** \u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30${memberRoleAdded ? " \u0E41\u0E25\u0E30\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19 Discord \u0E41\u0E25\u0E49\u0E27" : ""}` : `\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E44\u0E27\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E41\u0E15\u0E48\u0E22\u0E31\u0E07\u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E43\u0E19\u0E40\u0E01\u0E21\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 RCON${memberRoleAdded ? " (\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19 Discord \u0E41\u0E25\u0E49\u0E27)" : ""}`,
          ephemeral: true
        });
        return true;
      }
      if (interaction.customId === "ritz_players_button") {
        await replyWithPlayers(interaction);
        return true;
      }
      if (interaction.customId === "ritz_discord_members_button") {
        await replyWithDiscordMembers(interaction);
        return true;
      }
      if (interaction.customId === "ritz_profile_button") {
        await replyWithProfile(interaction);
        return true;
      }
      if (interaction.customId === "ritz_edit_profile_button") {
        await showProfileModal(interaction);
        return true;
      }
      if (interaction.customId === "ritz_cancel_verify_button") {
        if (!await ensureDeferredReply(interaction, { ephemeral: true }))
          return true;
        await cancelDiscordVerificationCode(interaction.user.id);
        await safeReply(interaction, {
          content: "\u274C \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E40\u0E14\u0E34\u0E21\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E04\u0E38\u0E13\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21 **\u{1F517} \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35** \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E43\u0E2B\u0E21\u0E48 4 \u0E2B\u0E25\u0E31\u0E01\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E30 \u{1F495}",
          ephemeral: true
        });
        return true;
      }
      if (interaction.customId === "ritz_unlink_button") {
        if (!await ensureDeferredReply(interaction, { ephemeral: true }))
          return true;
        await unlinkDiscordVerification(interaction.user.id);
        await safeReply(interaction, {
          content: "\u{1F513} \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Minecraft \u0E41\u0E25\u0E30\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E2B\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E43\u0E2B\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21 **\u{1F517} \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35** \u0E44\u0E14\u0E49\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E27\u0E25\u0E32\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E30 \u2728",
          ephemeral: true
        });
        return true;
      }
    }
    if (interaction.isModalSubmit()) {
      if (interaction.customId === "ritz_verify_modal") {
        await verifyDiscordNativeAccount(interaction, false);
        return true;
      }
      if (interaction.customId === "ritz_claim_rank_modal") {
        await verifyDiscordNativeAccount(interaction, true);
        return true;
      }
      if (interaction.customId === "ritz_profile_modal") {
        await updateProfileFromModal(interaction);
        return true;
      }
    }
  } catch (err) {
    pushLog("ERROR", `Error in handleOnboardingInteraction: ${String(err)}`);
    await safeReply(interaction, {
      content: "\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E04\u0E33\u0E02\u0E2D\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F495} \u0E01\u0E33\u0E25\u0E31\u0E07\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D",
      ephemeral: true
    });
    return true;
  }
  return false;
}
function startRitzSmpAiBot() {
  if (botStartup.promise) {
    pushLog(
      "WARN",
      "RitzSMP AI startup already in progress; reusing the existing startup promise."
    );
  }
  return botStartup.run(async () => {
    try {
      activeManagedServerRuntime = await getActiveManagedServerRuntimeConfig() ?? null;
      if (activeManagedServerRuntime) {
        pushLog(
          "INFO",
          `Using managed-server runtime overlay for ${activeManagedServerRuntime.slug}`
        );
      }
    } catch (error) {
      activeManagedServerRuntime = null;
      pushLog(
        "WARN",
        `Managed-server runtime overlay unavailable; using default environment: ${String(error)}`
      );
    }
    return createRitzSmpAiBot(activeManagedServerRuntime ?? void 0);
  });
}
function createRitzSmpAiBot(runtime) {
  if (runtime) activeManagedServerRuntime = runtime;
  const token = runtime?.discordBotToken || process.env.DISCORD_AI_BOT_TOKEN || ENV.discordAiBotToken;
  if (!token || token.trim() === "" || token === "102031") {
    pushLog("WARN", "No Discord AI Bot token provided. Bot disabled.");
    return null;
  }
  const client = new Client2({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates
    ]
  });
  botClient = client;
  let readyBootstrapStarted = false;
  client.once("ready", async () => {
    if (readyBootstrapStarted) {
      pushLog(
        "WARN",
        "Ignoring duplicate RitzSMP AI ready bootstrap for the same client."
      );
      return;
    }
    readyBootstrapStarted = true;
    botStartTime = Date.now();
    pushLog("SUCCESS", `RitzSMP AI bot logged in as ${client.user?.tag}`);
    const storeUrl = ENV.publicStoreUrl || "https://ritz.mcsv.me";
    const commands = [
      new SlashCommandBuilder2().setName("ask").setDescription(
        "\u{1F4AC} \u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22\u0E41\u0E25\u0E30\u0E2A\u0E2D\u0E1A\u0E16\u0E32\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E31\u0E1A RitzSMP AI \u0E2A\u0E32\u0E27\u0E19\u0E49\u0E2D\u0E22\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E38\u0E14\u0E19\u0E48\u0E32\u0E23\u0E31\u0E01"
      ).addStringOption(
        (option) => option.setName("question").setDescription("\u0E04\u0E33\u0E16\u0E32\u0E21\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E16\u0E32\u0E21\u0E19\u0E49\u0E2D\u0E07 AI").setRequired(true)
      ),
      new SlashCommandBuilder2().setName("status").setDescription(
        "\u{1F4CA} \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1A\u0E2D\u0E17\u0E41\u0E25\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft RitzSMP \u0E41\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E25\u0E44\u0E17\u0E21\u0E4C"
      ),
      new SlashCommandBuilder2().setName("ai-status").setDescription(
        "\u{1F4CA} [Legacy Alias] \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1A\u0E2D\u0E17\u0E41\u0E25\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft RitzSMP"
      ),
      new SlashCommandBuilder2().setName("store").setDescription("\u{1F6D2} \u0E41\u0E2A\u0E14\u0E07\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07 RitzSMP Store"),
      new SlashCommandBuilder2().setName("ranks").setDescription(
        "\u{1F451} \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E22\u0E28\u0E1E\u0E34\u0E40\u0E28\u0E29\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C\u0E20\u0E32\u0E22\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
      ),
      new SlashCommandBuilder2().setName("topup").setDescription(
        "\u{1F4B3} \u0E14\u0E39\u0E27\u0E34\u0E18\u0E35\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E2A\u0E25\u0E34\u0E1B\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E1C\u0E48\u0E32\u0E19\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32"
      ),
      new SlashCommandBuilder2().setName("verify").setDescription("\u2705 \u0E40\u0E1B\u0E34\u0E14\u0E41\u0E1C\u0E07\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E30\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E0A\u0E37\u0E48\u0E2D Minecraft"),
      new SlashCommandBuilder2().setName("players").setDescription("\u26CF\uFE0F \u0E41\u0E2A\u0E14\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E35\u0E48\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C\u0E43\u0E19 RitzSMP"),
      new SlashCommandBuilder2().setName("members").setDescription("\u{1F465} \u0E41\u0E2A\u0E14\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord \u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"),
      new SlashCommandBuilder2().setName("profile").setDescription("\u{1FAAA} \u0E14\u0E39\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 RitzSMP \u0E17\u0E35\u0E48\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E01\u0E31\u0E1A Minecraft"),
      musicCommand,
      playShortcutCommand,
      leaveShortcutCommand,
      new SlashCommandBuilder2().setName("setup").setDescription("\u{1F6E0}\uFE0F \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 (\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19)").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).addSubcommand(
        (sub) => sub.setName("panel").setDescription("\u0E2A\u0E48\u0E07\u0E41\u0E1C\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E25\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49")
      ).addSubcommand(
        (sub) => sub.setName("welcome").setDescription("\u0E2A\u0E23\u0E49\u0E32\u0E07 Embed \u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E25\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E14\u0E49\u0E27\u0E22\u0E15\u0E19\u0E40\u0E2D\u0E07")
      ).addSubcommand(
        (sub) => sub.setName("leave").setDescription("\u0E2A\u0E23\u0E49\u0E32\u0E07 Embed \u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E25\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E14\u0E49\u0E27\u0E22\u0E15\u0E19\u0E40\u0E2D\u0E07")
      ),
      new SlashCommandBuilder2().setName("help").setDescription("\u{1F4D6} \u0E41\u0E2A\u0E14\u0E07\u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E02\u0E2D\u0E07 RitzSMP AI"),
      new SlashCommandBuilder2().setName("embed").setDescription(
        "\u{1F4E2} \u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28 Embed \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E1B\u0E38\u0E48\u0E21\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E41\u0E1A\u0E1A\u0E2A\u0E32\u0E18\u0E32\u0E23\u0E13\u0E30\u0E17\u0E31\u0E19\u0E17\u0E35 (\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B)"
      ).setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).addSubcommand(
        (sub) => sub.setName("default").setDescription("\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 Embed \u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B\u0E17\u0E31\u0E19\u0E17\u0E35")
      ).addSubcommand(
        (sub) => sub.setName("create").setDescription("\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28 Embed \u0E41\u0E1A\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E40\u0E2D\u0E07").addStringOption(
          (o) => o.setName("title").setDescription("\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28").setRequired(true)
        ).addStringOption(
          (o) => o.setName("description").setDescription("\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28").setRequired(true)
        ).addStringOption(
          (o) => o.setName("color").setDescription("\u0E2A\u0E35 \u0E40\u0E0A\u0E48\u0E19 #ff69b4 \u0E2B\u0E23\u0E37\u0E2D #00ffcc").setRequired(false)
        ).addStringOption(
          (o) => o.setName("image_url").setDescription("\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E1B\u0E23\u0E30\u0E01\u0E2D\u0E1A").setRequired(false)
        ).addStringOption(
          (o) => o.setName("button_label").setDescription("\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1A\u0E19\u0E1B\u0E38\u0E48\u0E21\u0E25\u0E34\u0E07\u0E01\u0E4C").setRequired(false)
        ).addStringOption(
          (o) => o.setName("button_url").setDescription("\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E1B\u0E38\u0E48\u0E21").setRequired(false)
        )
      ).addSubcommand(
        (sub) => sub.setName("edit").setDescription("\u0E41\u0E01\u0E49\u0E44\u0E02 Embed \u0E02\u0E2D\u0E07 RitzSMP AI \u0E15\u0E32\u0E21 Message ID").addStringOption(
          (o) => o.setName("message_id").setDescription("Message ID \u0E02\u0E2D\u0E07 Embed \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49").setRequired(true)
        ).addStringOption(
          (o) => o.setName("title").setDescription("\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E43\u0E2B\u0E21\u0E48 (\u0E44\u0E21\u0E48\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A)").setRequired(false)
        ).addStringOption(
          (o) => o.setName("description").setDescription("\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32\u0E43\u0E2B\u0E21\u0E48 (\u0E44\u0E21\u0E48\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A)").setRequired(false)
        ).addStringOption(
          (o) => o.setName("color").setDescription("\u0E2A\u0E35\u0E43\u0E2B\u0E21\u0E48 \u0E40\u0E0A\u0E48\u0E19 #ff69b4 (\u0E44\u0E21\u0E48\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A)").setRequired(false)
        ).addStringOption(
          (o) => o.setName("image_url").setDescription("URL \u0E23\u0E39\u0E1B\u0E43\u0E2B\u0E21\u0E48 (\u0E44\u0E21\u0E48\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A)").setRequired(false)
        ).addStringOption(
          (o) => o.setName("button_label").setDescription("\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E38\u0E48\u0E21\u0E43\u0E2B\u0E21\u0E48 (\u0E44\u0E21\u0E48\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A)").setRequired(false)
        ).addStringOption(
          (o) => o.setName("button_url").setDescription("URL \u0E1B\u0E38\u0E48\u0E21\u0E43\u0E2B\u0E21\u0E48 (\u0E44\u0E21\u0E48\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A)").setRequired(false)
        )
      ).addSubcommand(
        (sub) => sub.setName("delete").setDescription("\u0E25\u0E1A Embed \u0E02\u0E2D\u0E07 RitzSMP AI \u0E15\u0E32\u0E21 Message ID").addStringOption(
          (o) => o.setName("message_id").setDescription("Message ID \u0E02\u0E2D\u0E07 Embed \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E25\u0E1A").setRequired(true)
        )
      )
    ].map((cmd) => cmd.toJSON());
    const rest = new REST({ version: "10" }).setToken(token);
    const clientId = client.user?.id;
    if (!clientId) return;
    try {
      pushLog("INFO", "Registering global slash commands...");
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      pushLog(
        "SUCCESS",
        "Successfully registered global slash commands for RitzSMP AI."
      );
      const musicChannelId = await ensureMusicTextChannel(
        client,
        getConfiguredDiscordGuildId()
      );
      if (musicChannelId) {
        pushLog(
          "SUCCESS",
          `Dedicated music text channel ready: ${musicChannelId}`
        );
      } else {
        pushLog(
          "WARN",
          "Dedicated music channel was not created; check DISCORD_GUILD_ID and Manage Channels permission."
        );
      }
      const statusChannelId = await ensureMinecraftStatusTextChannel(
        client,
        getConfiguredDiscordGuildId()
      );
      if (statusChannelId) {
        pushLog(
          "SUCCESS",
          `Dedicated Minecraft status channel ready: ${statusChannelId}`
        );
      } else {
        pushLog(
          "WARN",
          "Minecraft status channel was not created; presence announcements remain disabled until it is configured."
        );
      }
      await cleanupMisroutedWelcomePanels(client);
      await cleanupLegacyKanopiRankLogMessages(client);
      if (AUTO_SYSTEM_PANEL_DEPLOYMENT_ENABLED) {
        try {
          const guild = await client.guilds.fetch(getConfiguredDiscordGuildId()).catch(() => null);
          if (guild) {
            const channelsToEnsure = RITZ_SYSTEM_CHANNEL_TARGETS;
            for (const target of channelsToEnsure) {
              const cleanupPlan = planManagedSystemChannelCleanup(
                guild.channels.cache.values(),
                target
              );
              if (target.name === "\u{1F4CB}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35") {
                for (const duplicateId of cleanupPlan.duplicateIds) {
                  const duplicateChannel = guild.channels.cache.get(duplicateId);
                  await cleanupDuplicateAccountListChannel(
                    duplicateChannel,
                    client
                  );
                }
              } else if (target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" || target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01") {
                for (const duplicateId of cleanupPlan.duplicateIds) {
                  const duplicateChannel = guild.channels.cache.get(duplicateId);
                  await cleanupDuplicateMemberEventChannel(
                    duplicateChannel,
                    client,
                    target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" ? "welcome" : "leave"
                  );
                }
              }
              let channel = cleanupPlan.canonicalId ? guild.channels.cache.get(cleanupPlan.canonicalId) : void 0;
              if (channel && channel.name !== target.name) {
                const previousName = channel.name;
                try {
                  await channel.setName(
                    target.name,
                    "Standardize RitzSMP AI system channel name"
                  );
                  pushLog(
                    "SUCCESS",
                    `Renamed legacy channel ${previousName} to ${target.name}`
                  );
                } catch (renameErr) {
                  pushLog(
                    "WARN",
                    `Could not rename legacy channel ${previousName} to ${target.name}: ${String(renameErr)}`
                  );
                }
              }
              if (channel && channel.type === ChannelType3.GuildText && "setTopic" in channel) {
                await channel.setTopic(target.topic).catch((topicErr) => {
                  pushLog(
                    "WARN",
                    `Could not update topic for ${target.name}: ${String(topicErr)}`
                  );
                });
              }
              if (!channel) {
                try {
                  channel = await guild.channels.create({
                    name: target.name,
                    type: target.type,
                    topic: target.topic
                  });
                  pushLog("SUCCESS", `Auto-created channel: ${target.name}`);
                } catch (createErr) {
                  pushLog(
                    "WARN",
                    `Could not create channel ${target.name}: ${String(createErr)}`
                  );
                }
              }
              if (channel && channel.isTextBased()) {
                try {
                  if (target.name === "\u{1F4CB}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35") {
                    await reconcileAccountListPanel(channel, client);
                    pushLog(
                      "SUCCESS",
                      `Reconciled one canonical panel in ${target.name}`
                    );
                  } else if (target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" || target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01") {
                    await reconcileMemberEventSystemPanel(
                      channel,
                      client,
                      target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" ? "welcome" : "leave"
                    );
                    pushLog(
                      "SUCCESS",
                      `Reconciled one ${target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" ? "welcome" : "leave"} panel in ${target.name}`
                    );
                  } else {
                    const messages = await channel.messages.fetch({
                      limit: 100
                    });
                    const existingBotMsg = messages.find(
                      (m) => m.author.id === client.user?.id
                    );
                    if (!existingBotMsg) {
                      if (target.name === "\u{1F517}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35") {
                        const embed = new EmbedBuilder2().setTitle("\u2728 \u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Minecraft RitzSMP").setDescription(
                          "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48 RitzSMP! \u{1F338}\n\n\u{1F4CC} **\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35:**\n1. \u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21 **\u{1F517} \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35** \u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E19\u0E35\u0E49\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E1A\u0E23\u0E2B\u0E31\u0E2A 4 \u0E2B\u0E25\u0E31\u0E01\n2. \u0E40\u0E02\u0E49\u0E32\u0E40\u0E01\u0E21 Minecraft \u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 `/verify <\u0E23\u0E2B\u0E31\u0E2A 4 \u0E2B\u0E25\u0E31\u0E01>` \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E01\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30! \u{1F495}"
                        ).setColor(15485081).setImage(RITZ_WELCOME_COVER_IMAGE_URL).setTimestamp().setFooter({
                          text: "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 24 \u0E0A\u0E21."
                        });
                        await channel.send({
                          embeds: [embed],
                          components: buildOnboardingComponents()
                        });
                      } else if (target.name === "\u{1F396}\uFE0F\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E22\u0E28") {
                        await channel.send({
                          embeds: [buildRankClaimEmbed()],
                          components: buildRankClaimComponents()
                        });
                      }
                      pushLog(
                        "SUCCESS",
                        `Posted panel to channel ${target.name}`
                      );
                    }
                  }
                } catch (msgErr) {
                  pushLog(
                    "WARN",
                    `Could not post panel to ${target.name}: ${String(msgErr)}`
                  );
                }
              }
            }
          }
        } catch (panelDeployErr) {
          pushLog(
            "WARN",
            `Channel auto-deployment note: ${String(panelDeployErr)}`
          );
        }
      }
    } catch (error) {
      pushLog(
        "ERROR",
        `RitzSMP AI ready bootstrap failed after command registration: ${String(error)}`
      );
    }
  });
  client.on(
    "disconnect",
    () => pushLog("WARN", "RitzSMP AI bot disconnected from Discord")
  );
  client.on(
    "reconnecting",
    () => pushLog("INFO", "RitzSMP AI bot attempting to reconnect...")
  );
  client.on(
    "error",
    (error) => pushLog("ERROR", `Discord client error: ${error.message}`)
  );
  client.on("interactionCreate", async (interaction) => {
    try {
      if (await handleMusicButtonInteraction(interaction)) {
        pushLog(
          "SUCCESS",
          `Handled music interaction ${"customId" in interaction ? interaction.customId : "unknown"}`
        );
        return;
      }
      if (await handleOnboardingInteraction(interaction)) {
        pushLog(
          "SUCCESS",
          `Handled onboarding interaction ${"customId" in interaction ? interaction.customId : "unknown"}`
        );
        return;
      }
    } catch (err) {
      pushLog("ERROR", `Onboarding interaction failed: ${String(err)}`);
      try {
        if (interaction.isRepliable()) {
          await safeReply(interaction, {
            content: "\u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E33\u0E25\u0E31\u0E07\u0E02\u0E31\u0E14\u0E02\u0E49\u0E2D\u0E07\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30",
            ephemeral: true
          });
        }
      } catch (replyError) {
        pushLog(
          "WARN",
          `Could not reply to onboarding error: ${String(replyError)}`
        );
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    totalInteractionsCount++;
    const commandName = interaction.commandName;
    const storeUrl = ENV.publicStoreUrl || "https://ritz.mcsv.me";
    pushLog(
      "INFO",
      `Received command /${commandName} from ${interaction.user.tag}`
    );
    try {
      if (commandName === "music" || commandName === "play" || commandName === "leave") {
        await handleMusicCommand(interaction);
        pushLog("SUCCESS", `Handled /${commandName} command`);
        return;
      }
      if (commandName === "status" || commandName === "ai-status") {
        if (!await ensureDeferredReply(interaction, { ephemeral: false }))
          return;
        const mc = await checkMinecraftServerStatus();
        const uptimeMin = botStartTime ? Math.floor((Date.now() - botStartTime) / 6e4) : 0;
        const statusEmbed = new EmbedBuilder2().setTitle("\u{1F4CA} RitzSMP System & Server Status").setDescription(
          "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1A\u0E2D\u0E17\u0E41\u0E25\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft RitzSMP \u0E41\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E25\u0E44\u0E17\u0E21\u0E4C \u2728"
        ).setColor(mc.online ? 2278750 : 15680580).addFields(
          {
            name: "\u{1F916} \u0E1A\u0E2D\u0E17 RitzSMP AI",
            value: `\u{1F7E2} \u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C (${uptimeMin} \u0E19\u0E32\u0E17\u0E35)
\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E17\u0E35\u0E48\u0E43\u0E2B\u0E49\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23: ${totalInteractionsCount} \u0E04\u0E23\u0E31\u0E49\u0E07`,
            inline: false
          },
          {
            name: "\u26CF\uFE0F \u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft (ritz.mcsv.me)",
            value: mc.online ? `\u{1F7E2} **\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C**
\u{1F465} \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C: \`${mc.players} / ${mc.maxPlayers}\`
\u{1F4CC} \u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19: \`${mc.version}\`
\u26A1 \u0E04\u0E27\u0E32\u0E21\u0E2B\u0E19\u0E48\u0E27\u0E07 (Latency): \`${mc.latency}ms\`
\u{1F4AC} MOTD: *${mc.motd}*` : "\u{1F534} **\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E1B\u0E34\u0E14\u0E1B\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E38\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27**",
            inline: false
          }
        ).setTimestamp().setFooter({ text: "RitzSMP \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 24 \u0E0A\u0E21." });
        await safeReply(interaction, { embeds: [statusEmbed] });
        pushLog("SUCCESS", `Executed /${commandName} successfully`);
        return;
      }
      if (commandName === "profile") {
        await replyWithProfile(interaction);
        pushLog("SUCCESS", "Executed /profile successfully");
        return;
      }
      if (commandName === "verify") {
        await replyWithVerificationCode(interaction);
        pushLog("SUCCESS", "Executed /verify successfully");
        return;
      }
      if (commandName === "players") {
        await replyWithPlayers(interaction);
        pushLog("SUCCESS", "Executed /players successfully");
        return;
      }
      if (commandName === "members") {
        await replyWithDiscordMembers(interaction);
        pushLog("SUCCESS", "Executed /members successfully");
        return;
      }
      if (commandName === "store") {
        const storeEmbed = new EmbedBuilder2().setTitle("\u{1F6D2} \u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32 RitzSMP Store").setDescription(
          "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48\u0E40\u0E27\u0E47\u0E1A\u0E2A\u0E42\u0E15\u0E23\u0E4C\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E02\u0E2D\u0E07 RitzSMP!\n\n\u2022 \u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E2A\u0E25\u0E34\u0E1B\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19 (PromptPay / TrueMoney Wallet)\n\u2022 \u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E1E\u0E34\u0E40\u0E28\u0E29\u0E2A\u0E38\u0E14\u0E04\u0E38\u0E49\u0E21 (\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E15\u0E34\u0E21\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E02\u0E49\u0E32\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E17\u0E31\u0E19\u0E17\u0E35\u0E1C\u0E48\u0E32\u0E19 RCON)\n\u2022 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E41\u0E25\u0E30\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D\u0E44\u0E14\u0E49\u0E15\u0E25\u0E2D\u0E14 24 \u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07"
        ).setColor(49151).setFooter({ text: "RitzSMP Store \u2022 \u0E2A\u0E30\u0E14\u0E27\u0E01 \u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22 \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 100%" });
        const row = new ActionRowBuilder2().addComponents(
          new ButtonBuilder2().setLabel("\u{1F310} \u0E40\u0E1B\u0E34\u0E14\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32 RitzSMP").setStyle(ButtonStyle2.Link).setURL(storeUrl)
        );
        await safeReply(interaction, {
          embeds: [storeEmbed],
          components: [row],
          ephemeral: false
        });
        pushLog("SUCCESS", "Executed /store successfully");
        return;
      }
      if (commandName === "ranks") {
        const ranksEmbed = new EmbedBuilder2().setTitle("\u{1F451} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E22\u0E28\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C\u0E1E\u0E34\u0E40\u0E28\u0E29\u0E43\u0E19 RitzSMP").setDescription(
          "\u0E22\u0E01\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19\u0E40\u0E01\u0E21\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E43\u0E19\u0E2D\u0E32\u0E13\u0E32\u0E08\u0E31\u0E01\u0E23 RitzSMP \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C\u0E2A\u0E38\u0E14\u0E04\u0E38\u0E49\u0E21\u0E04\u0E48\u0E32:\n\n\u{1F48E} **VIP Tier:** \u0E44\u0E14\u0E49\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E43\u0E0A\u0E49 `/fly`, `/nv`, `/craft`, \u0E41\u0E25\u0E30 `/hat` \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E02\u0E36\u0E49\u0E19\n\u{1F451} **Royal Tier:** \u0E22\u0E28\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E2A\u0E39\u0E07 \u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1E\u0E34\u0E40\u0E28\u0E29\u0E40\u0E15\u0E47\u0E21\u0E1E\u0E34\u0E01\u0E31\u0E14 \u0E1A\u0E34\u0E19\u0E44\u0E14\u0E49 \u0E21\u0E2D\u0E07\u0E43\u0E19\u0E17\u0E35\u0E48\u0E21\u0E37\u0E14 \u0E41\u0E25\u0E30\u0E40\u0E0B\u0E47\u0E15\u0E1A\u0E49\u0E32\u0E19\u0E44\u0E14\u0E49\u0E08\u0E38\u0E43\u0E08\n\n\u0E0B\u0E37\u0E49\u0E2D\u0E44\u0E14\u0E49\u0E07\u0E48\u0E32\u0E22\u0E46 \u0E1C\u0E48\u0E32\u0E19\u0E40\u0E27\u0E47\u0E1A\u0E2A\u0E42\u0E15\u0E23\u0E4C \u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E31\u0E14\u0E40\u0E07\u0E34\u0E19\u0E08\u0E32\u0E01\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E41\u0E25\u0E30\u0E40\u0E15\u0E34\u0E21\u0E22\u0E28\u0E40\u0E02\u0E49\u0E32\u0E40\u0E01\u0E21\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E1C\u0E48\u0E32\u0E19 RCON \u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30!"
        ).setColor(16766720).setFooter({ text: "RitzSMP \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 24 \u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07" });
        const row = new ActionRowBuilder2().addComponents(
          new ButtonBuilder2().setLabel("\u{1F6D2} \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E43\u0E19\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C").setStyle(ButtonStyle2.Link).setURL(storeUrl)
        );
        await safeReply(interaction, {
          embeds: [ranksEmbed],
          components: [row],
          ephemeral: false
        });
        pushLog("SUCCESS", "Executed /ranks successfully");
        return;
      }
      if (commandName === "topup") {
        const topupEmbed = new EmbedBuilder2().setTitle("\u{1F4B3} \u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E01\u0E32\u0E23\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28 RitzSMP Store").setDescription(
          "\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C:\n\n1\uFE0F\u20E3 **\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E32\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32 (\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E19\u0E1A\u0E2A\u0E25\u0E34\u0E1B):**\n\u2022 \u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19 PromptPay / TrueMoney Wallet: `0930286252`\n\u2022 \u0E44\u0E1B\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E21\u0E19\u0E39\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19 \u0E01\u0E23\u0E2D\u0E01\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19 \u0E41\u0E25\u0E30\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2A\u0E25\u0E34\u0E1B\n\u2022 \u0E23\u0E2D\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E32\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\n\n2\uFE0F\u20E3 **\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28 (\u0E43\u0E0A\u0E49\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E40\u0E07\u0E34\u0E19 \u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E19\u0E1A\u0E2A\u0E25\u0E34\u0E1B):**\n\u2022 \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E22\u0E28\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23 \u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21 (Minecraft IGN)\n\u2022 \u0E01\u0E14\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E2B\u0E31\u0E01\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E41\u0E25\u0E30\u0E40\u0E15\u0E34\u0E21\u0E22\u0E28\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30!"
        ).setColor(65484).setFooter({ text: "RitzSMP Store \u2022 \u0E2A\u0E30\u0E14\u0E27\u0E01 \u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22 \u0E23\u0E27\u0E14\u0E40\u0E23\u0E47\u0E27\u0E17\u0E31\u0E19\u0E43\u0E08" });
        const row = new ActionRowBuilder2().addComponents(
          new ButtonBuilder2().setLabel("\u{1F4B3} \u0E44\u0E1B\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19 / \u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28").setStyle(ButtonStyle2.Link).setURL(storeUrl)
        );
        await safeReply(interaction, {
          embeds: [topupEmbed],
          components: [row],
          ephemeral: false
        });
        pushLog("SUCCESS", "Executed /topup successfully");
        return;
      }
      if (commandName === "help") {
        const helpEmbed = new EmbedBuilder2().setTitle("\u{1F4D6} \u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E1A\u0E2D\u0E17 RitzSMP AI").setDescription(
          "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E23\u0E48\u0E27\u0E21\u0E01\u0E31\u0E1A\u0E19\u0E49\u0E2D\u0E07 RitzSMP AI \u0E44\u0E14\u0E49\u0E04\u0E48\u0E30:"
        ).setColor(11032055).addFields(
          {
            name: "/ask <\u0E04\u0E33\u0E16\u0E32\u0E21>",
            value: "\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22 \u0E1B\u0E23\u0E36\u0E01\u0E29\u0E32 \u0E2B\u0E23\u0E37\u0E2D\u0E2A\u0E2D\u0E1A\u0E16\u0E32\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E31\u0E1A\u0E19\u0E49\u0E2D\u0E07 AI \u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E32\u0E27\u0E19\u0E49\u0E2D\u0E22",
            inline: false
          },
          {
            name: "/status (\u0E2B\u0E23\u0E37\u0E2D /ai-status)",
            value: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1A\u0E2D\u0E17\u0E41\u0E25\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft \u0E41\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E25\u0E44\u0E17\u0E21\u0E4C",
            inline: false
          },
          {
            name: "/store",
            value: "\u0E40\u0E1B\u0E34\u0E14\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07 RitzSMP",
            inline: false
          },
          {
            name: "/ranks",
            value: "\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C\u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E22\u0E28",
            inline: false
          },
          {
            name: "/topup",
            value: "\u0E14\u0E39\u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E01\u0E32\u0E23\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28",
            inline: false
          },
          {
            name: "/profile",
            value: "\u0E14\u0E39\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E41\u0E25\u0E30\u0E41\u0E01\u0E49\u0E44\u0E02\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27/\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19",
            inline: false
          },
          {
            name: "/music play <url>",
            value: "\u0E40\u0E25\u0E48\u0E19\u0E40\u0E1E\u0E25\u0E07\u0E08\u0E32\u0E01 YouTube/SoundCloud; \u0E43\u0E0A\u0E49 /music queue, /music skip, /music stop \u0E41\u0E25\u0E30 /music leave \u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E04\u0E34\u0E27\u0E04\u0E48\u0E30 (\u0E42\u0E2B\u0E21\u0E14\u0E1F\u0E23\u0E35\u0E2D\u0E32\u0E08\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E23\u0E30\u0E1A\u0E1A\u0E1E\u0E31\u0E01\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07)",
            inline: false
          },
          {
            name: "/setup panel",
            value: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E1C\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19",
            inline: false
          },
          {
            name: "/setup welcome / /setup leave",
            value: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2B\u0E23\u0E37\u0E2D\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E40\u0E2D\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27 \u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E42\u0E1E\u0E2A\u0E15\u0E4C\u0E0B\u0E49\u0E33\u0E15\u0E2D\u0E19\u0E23\u0E35\u0E2A\u0E15\u0E32\u0E23\u0E4C\u0E15",
            inline: false
          },
          {
            name: "/embed default",
            value: "\u0E2A\u0E48\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E1B\u0E38\u0E48\u0E21\u0E25\u0E34\u0E07\u0E01\u0E4C",
            inline: false
          },
          {
            name: "/embed create",
            value: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28 Embed \u0E41\u0E1A\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E40\u0E2D\u0E07",
            inline: false
          },
          {
            name: "/embed edit <message_id>",
            value: "\u0E41\u0E01\u0E49\u0E44\u0E02 Embed \u0E17\u0E35\u0E48 RitzSMP AI \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19",
            inline: false
          },
          {
            name: "/embed delete <message_id>",
            value: "\u0E25\u0E1A Embed \u0E17\u0E35\u0E48 RitzSMP AI \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19",
            inline: false
          }
        ).setTimestamp().setFooter({ text: "RitzSMP AI Bot \u2022 \u0E1E\u0E31\u0E12\u0E19\u0E32\u0E14\u0E49\u0E27\u0E22\u0E04\u0E27\u0E32\u0E21\u0E23\u0E31\u0E01\u0E04\u0E48\u0E30 \u{1F496}" });
        await safeReply(interaction, { embeds: [helpEmbed], ephemeral: false });
        pushLog("SUCCESS", "Executed /help successfully");
        return;
      }
      if (commandName === "setup") {
        if (!await requireDiscordAdministrator(interaction)) return;
        const subcommand = interaction.options.getSubcommand();
        const channel = getInteractionTextChannel(interaction);
        if (!channel) {
          await safeReply(interaction, {
            content: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E04\u0E48\u0E30",
            ephemeral: true
          });
          return;
        }
        if (!await ensureDeferredReply(interaction, { ephemeral: true }))
          return;
        if (subcommand === "panel") {
          const onboardingEmbed = new EmbedBuilder2().setTitle("\u2728 \u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E1A\u0E31\u0E0D\u0E0A\u0E35 RitzSMP").setDescription(
            "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48\u0E04\u0E2D\u0E21\u0E21\u0E39\u0E19\u0E34\u0E15\u0E35\u0E49 RitzSMP \u0E04\u0E48\u0E30! \u{1F338}\n\n\u2022 **\u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19:** \u0E1C\u0E39\u0E01\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Discord \u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E01\u0E31\u0E1A\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E1A\u0E22\u0E28 Verified \u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E1E\u0E34\u0E40\u0E28\u0E29\n\u2022 **\u{1F396}\uFE0F \u0E23\u0E31\u0E1A\u0E22\u0E28\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19:** \u0E01\u0E14\u0E23\u0E31\u0E1A\u0E01\u0E25\u0E38\u0E48\u0E21 LuckPerms \u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft \u0E41\u0E25\u0E30\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19\u0E14\u0E34\u0E2A\u0E04\u0E2D\u0E23\u0E4C\u0E14\n\u2022 **\u{1F465} \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F:** \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E35\u0E48\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C\u0E2D\u0E22\u0E39\u0E48\u0E41\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E25\u0E44\u0E17\u0E21\u0E4C\n\u2022 **\u{1FAAA} \u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19:** \u0E14\u0E39\u0E41\u0E25\u0E30\u0E41\u0E01\u0E49\u0E44\u0E02\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27\u0E2B\u0E23\u0E37\u0E2D\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\n\n\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E30! \u{1F495}"
          ).setColor(15485081).setTimestamp().setFooter({ text: "RitzSMP AI \u2022 \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19" });
          await channel.send({
            embeds: [onboardingEmbed],
            components: buildOnboardingComponents()
          });
          await channel.send({
            embeds: [buildRankClaimEmbed()],
            components: buildRankClaimComponents()
          });
          await safeReply(interaction, {
            content: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E1C\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19 \u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E25\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u2728",
            ephemeral: true
          });
          pushLog("SUCCESS", "Executed /setup panel successfully");
          return;
        }
        if (subcommand === "welcome" || subcommand === "leave") {
          await channel.send(buildManualSystemPanelPayload(subcommand));
          await safeReply(interaction, {
            content: `\u0E2A\u0E23\u0E49\u0E32\u0E07 Embed ${subcommand === "welcome" ? "\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01" : "\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01"} \u0E25\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E42\u0E14\u0E22\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E44\u0E21\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E0B\u0E49\u0E33\u0E40\u0E2D\u0E07\u0E15\u0E2D\u0E19\u0E1A\u0E2D\u0E17\u0E23\u0E35\u0E2A\u0E15\u0E32\u0E23\u0E4C\u0E15\u0E19\u0E30\u0E04\u0E30`,
            ephemeral: true
          });
          pushLog("SUCCESS", `Executed /setup ${subcommand} successfully`);
          return;
        }
      }
      if (commandName === "embed") {
        if (!await requireDiscordAdministrator(interaction)) return;
        const subcommand = interaction.options.getSubcommand();
        const channel = getInteractionTextChannel(interaction);
        if (subcommand === "default") {
          const embed = new EmbedBuilder2().setTitle("\u{1F31F} \u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP").setDescription(
            "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E38\u0E01\u0E17\u0E48\u0E32\u0E19\u0E2A\u0E39\u0E48 RitzSMP \u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Survival \u0E41\u0E25\u0E30 Economy \u0E2A\u0E38\u0E14\u0E21\u0E31\u0E19\u0E2A\u0E4C!\n\n\u{1F6D2} **\u0E2A\u0E19\u0E43\u0E08\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19:** \u0E04\u0E25\u0E34\u0E01\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E40\u0E23\u0E32\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30!"
          ).setColor(15485081).addFields(
            { name: "\u{1F310} \u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E2B\u0E25\u0E31\u0E01", value: storeUrl, inline: true },
            {
              name: "\u{1F4AC} \u0E14\u0E34\u0E2A\u0E04\u0E2D\u0E23\u0E4C\u0E14\u0E04\u0E2D\u0E21\u0E21\u0E39\u0E19\u0E34\u0E15\u0E35\u0E49",
              value: "\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22 \u0E41\u0E08\u0E49\u0E07\u0E1B\u0E31\u0E0D\u0E2B\u0E32 \u0E41\u0E25\u0E30\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E02\u0E48\u0E32\u0E27\u0E2A\u0E32\u0E23\u0E44\u0E14\u0E49\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48",
              inline: true
            }
          ).setTimestamp().setFooter({ text: "RitzSMP Official Announcement" });
          const row = new ActionRowBuilder2().addComponents(
            new ButtonBuilder2().setLabel("\u{1F310} \u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32 RitzSMP").setStyle(ButtonStyle2.Link).setURL(storeUrl),
            new ButtonBuilder2().setLabel("\u{1F4B3} \u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19 / \u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28").setStyle(ButtonStyle2.Link).setURL(storeUrl)
          );
          await safeReply(interaction, {
            embeds: [embed],
            components: [row],
            ephemeral: false
          });
          pushLog("SUCCESS", "Executed /embed default successfully");
          return;
        }
        if (subcommand === "create") {
          const title = interaction.options.getString("title", true);
          const description = interaction.options.getString(
            "description",
            true
          );
          const colorInput = interaction.options.getString("color") || "#ec4899";
          const imageUrl = interaction.options.getString("image_url");
          const btnLabel = interaction.options.getString("button_label");
          const btnUrl = interaction.options.getString("button_url");
          if (btnLabel && !btnUrl || !btnLabel && btnUrl) {
            await safeReply(interaction, {
              content: "\u0E16\u0E49\u0E32\u0E08\u0E30\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1B\u0E38\u0E48\u0E21 \u0E15\u0E49\u0E2D\u0E07\u0E43\u0E2A\u0E48\u0E17\u0E31\u0E49\u0E07 button_label \u0E41\u0E25\u0E30 button_url \u0E19\u0E30\u0E04\u0E30",
              ephemeral: true
            });
            return;
          }
          if (imageUrl && !isHttpUrl(imageUrl)) {
            await safeReply(interaction, {
              content: "image_url \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E34\u0E07\u0E01\u0E4C http \u0E2B\u0E23\u0E37\u0E2D https \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30",
              ephemeral: true
            });
            return;
          }
          await safeReply(interaction, {
            ...buildManualEmbedPayload({
              title,
              description,
              color: parseEmbedColor(colorInput),
              imageUrl,
              buttonLabel: btnLabel,
              buttonUrl: btnUrl,
              footerText: "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E42\u0E14\u0E22\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19 \u2022 RitzSMP AI"
            }),
            ephemeral: false
          });
          pushLog("SUCCESS", "Executed /embed create successfully");
          return;
        }
        if (subcommand === "edit" || subcommand === "delete") {
          if (!channel) {
            await safeReply(interaction, {
              content: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48\u0E21\u0E35 Embed \u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22\u0E04\u0E48\u0E30",
              ephemeral: true
            });
            return;
          }
          const messageId = interaction.options.getString("message_id", true);
          if (!await ensureDeferredReply(interaction, { ephemeral: true }))
            return;
          let message;
          try {
            message = await channel.messages.fetch(messageId);
          } catch {
            await safeReply(interaction, {
              content: "\u0E2B\u0E32 Message ID \u0E19\u0E35\u0E49\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E44\u0E21\u0E48\u0E40\u0E08\u0E2D\u0E04\u0E48\u0E30 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A ID \u0E41\u0E25\u0E49\u0E27\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30",
              ephemeral: true
            });
            return;
          }
          if (message.author?.id && message.author.id !== client.user?.id) {
            await safeReply(interaction, {
              content: "\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22 \u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E41\u0E01\u0E49\u0E44\u0E02\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E1A\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48 RitzSMP AI \u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30",
              ephemeral: true
            });
            return;
          }
          if (subcommand === "delete") {
            await message.delete();
            await safeReply(interaction, {
              content: `\u0E25\u0E1A Embed \u0E02\u0E2D\u0E07 RitzSMP AI \u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 (Message ID: ${messageId})`,
              ephemeral: true
            });
            pushLog(
              "SUCCESS",
              `Executed /embed delete successfully for message ${messageId}`
            );
            return;
          }
          const existing = getEmbedData(message);
          const title = interaction.options.getString("title") ?? existing.title;
          const description = interaction.options.getString("description") ?? existing.description;
          const colorInput = interaction.options.getString("color");
          const imageUrl = interaction.options.getString("image_url");
          const buttonLabel = interaction.options.getString("button_label");
          const buttonUrl = interaction.options.getString("button_url");
          if (buttonLabel && !buttonUrl || !buttonLabel && buttonUrl) {
            await safeReply(interaction, {
              content: "\u0E16\u0E49\u0E32\u0E08\u0E30\u0E41\u0E01\u0E49\u0E1B\u0E38\u0E48\u0E21 \u0E15\u0E49\u0E2D\u0E07\u0E43\u0E2A\u0E48\u0E17\u0E31\u0E49\u0E07 button_label \u0E41\u0E25\u0E30 button_url \u0E19\u0E30\u0E04\u0E30",
              ephemeral: true
            });
            return;
          }
          if (imageUrl && !isHttpUrl(imageUrl)) {
            await safeReply(interaction, {
              content: "image_url \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E34\u0E07\u0E01\u0E4C http \u0E2B\u0E23\u0E37\u0E2D https \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30",
              ephemeral: true
            });
            return;
          }
          const payload = buildManualEmbedPayload({
            title,
            description,
            color: colorInput ?? existing.color ?? 15485081,
            imageUrl: imageUrl ?? existing.imageUrl,
            buttonLabel,
            buttonUrl,
            footerText: existing.footerText
          });
          await message.edit({
            embeds: payload.embeds,
            components: buttonLabel || buttonUrl ? payload.components : message.components ?? []
          });
          await safeReply(interaction, {
            content: `\u0E41\u0E01\u0E49\u0E44\u0E02 Embed \u0E02\u0E2D\u0E07 RitzSMP AI \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 (Message ID: ${messageId})`,
            ephemeral: true
          });
          pushLog(
            "SUCCESS",
            `Executed /embed edit successfully for message ${messageId}`
          );
          return;
        }
      }
      if (commandName === "ask") {
        if (!await ensureDeferredReply(interaction, { ephemeral: false }))
          return;
        const question = interaction.options.getString("question", true);
        const dynamicSeed = Math.random().toString(36).substring(7);
        const systemPrompt = `\u0E04\u0E38\u0E13\u0E04\u0E37\u0E2D\u0E19\u0E49\u0E2D\u0E07 "RitzSMP AI" \u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E32\u0E27\u0E19\u0E49\u0E2D\u0E22\u0E2A\u0E38\u0E14\u0E19\u0E48\u0E32\u0E23\u0E31\u0E01 \u0E1B\u0E23\u0E30\u0E08\u0E33\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft "RitzSMP" (\u0E23\u0E2B\u0E31\u0E2A\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C: ritz.mcsv.me)
\u0E1A\u0E38\u0E04\u0E25\u0E34\u0E01\u0E20\u0E32\u0E1E: \u0E1E\u0E39\u0E14\u0E08\u0E32\u0E2A\u0E38\u0E20\u0E32\u0E1E \u0E19\u0E48\u0E32\u0E23\u0E31\u0E01 \u0E40\u0E1B\u0E47\u0E19\u0E01\u0E31\u0E19\u0E40\u0E2D\u0E07 \u0E21\u0E35\u0E2B\u0E32\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07 "\u0E04\u0E48\u0E30", "\u0E19\u0E30\u0E04\u0E30", "\u0E19\u0E30\u0E04\u0E49\u0E32" \u0E40\u0E2A\u0E21\u0E2D \u0E41\u0E25\u0E30\u0E21\u0E31\u0E01\u0E08\u0E30\u0E21\u0E35 emoji \u0E19\u0E48\u0E32\u0E23\u0E31\u0E01\u0E46 \u0E40\u0E0A\u0E48\u0E19 \u2728, \u{1F496}, \u{1F31F} \u0E1B\u0E23\u0E30\u0E01\u0E2D\u0E1A
\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E2A\u0E33\u0E04\u0E31\u0E0D: \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E43\u0E0A\u0E49 /store \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32, /ranks \u0E14\u0E39\u0E22\u0E28, /topup \u0E27\u0E34\u0E18\u0E35\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19, /status \u0E14\u0E39\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C
\u0E01\u0E0F\u0E40\u0E2B\u0E25\u0E47\u0E01: \u0E2B\u0E49\u0E32\u0E21\u0E15\u0E2D\u0E1A\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B\u0E40\u0E14\u0E34\u0E21\u0E0B\u0E49\u0E33\u0E46 \u0E43\u0E2B\u0E49\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E04\u0E33\u0E16\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E15\u0E31\u0E27\u0E08\u0E23\u0E34\u0E07\u0E23\u0E2D\u0E1A\u0E19\u0E35\u0E49\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 \u0E15\u0E2D\u0E1A\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E07\u0E1B\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19 \u0E2A\u0E14\u0E43\u0E2B\u0E21\u0E48 \u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E41\u0E25\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2A\u0E23\u0E23\u0E04\u0E4C\u0E15\u0E32\u0E21\u0E1A\u0E23\u0E34\u0E1A\u0E17\u0E04\u0E33\u0E16\u0E32\u0E21 (Seed: ${dynamicSeed})`;
        try {
          const aiReply = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: question }
            ]
          });
          const finalMessage = aiReply || "\u0E19\u0E49\u0E2D\u0E07 RitzSMP AI \u0E2D\u0E22\u0E39\u0E48\u0E19\u0E35\u0E48\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30! \u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E2B\u0E49\u0E1E\u0E35\u0E48\u0E2A\u0E32\u0E27\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E2D\u0E1A\u0E16\u0E32\u0E21\u0E2B\u0E23\u0E37\u0E2D\u0E14\u0E39\u0E41\u0E25\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E44\u0E2B\u0E19\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E1A\u0E2D\u0E01\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E49\u0E32 \u{1F496}\u2728";
          await safeReply(interaction, finalMessage);
          pushLog(
            "SUCCESS",
            `Executed /ask successfully for question: "${question.substring(0, 30)}..."`
          );
        } catch (err) {
          pushLog("ERROR", `Failed to invoke LLM for /ask: ${String(err)}`);
          await safeReply(
            interaction,
            "\u0E41\u0E07... \u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E19\u0E49\u0E2D\u0E07 AI \u0E01\u0E33\u0E25\u0E31\u0E07\u0E21\u0E36\u0E19\u0E2B\u0E31\u0E27\u0E19\u0E34\u0E14\u0E2B\u0E19\u0E48\u0E2D\u0E22\u0E04\u0E48\u0E30 \u0E25\u0E2D\u0E07\u0E16\u0E32\u0E21\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E34\u0E21\u0E1E\u0E4C /help \u0E14\u0E39\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E0A\u0E48\u0E27\u0E22\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E49\u0E32 \u{1F97A}\u{1F496}"
          );
        }
      }
    } catch (err) {
      pushLog(
        "ERROR",
        `Error handling command /${commandName}: ${String(err)}`
      );
      await safeReply(interaction, {
        content: "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30 \u{1F495}",
        ephemeral: true
      });
    }
  });
  client.login(token).catch((err) => {
    pushLog("ERROR", `Discord login failed: ${err.message}`);
  });
  return client;
}

// server/discordNotifications.ts
var DISCORD_API = "https://discord.com/api/v10";
function getDiscordToken() {
  return process.env.DISCORD_AI_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || ENV.discordBotToken || "";
}
function getSupportChannelId() {
  return process.env.DISCORD_SUPPORT_CHANNEL_ID || ENV.discordSupportChannelId || process.env.DISCORD_STORE_CHANNEL_ID || ENV.discordStoreChannelId || process.env.DISCORD_DONATE_CHANNEL_ID || ENV.discordDonateChannelId || "";
}
function getDonateLogChannelId() {
  return process.env.DISCORD_DONATE_LOG_CHANNEL_ID || ENV.discordDonateLogChannelId || process.env.DISCORD_DONATE_CHANNEL_ID || ENV.discordDonateChannelId || process.env.DISCORD_ORDERS_CHANNEL_ID || ENV.discordOrdersChannelId || "";
}
function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} \u0E1A\u0E32\u0E17` : `${value} \u0E1A\u0E32\u0E17`;
}
function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? (/* @__PURE__ */ new Date()).toISOString() : date.toISOString();
}
function getSlipFileName(slipKey) {
  const baseName = slipKey.split("/").pop() || "payment-slip.png";
  return baseName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-90) || "payment-slip.png";
}
async function postDiscordMessage(channelId, payload, attachment) {
  const token = getDiscordToken();
  if (!token) return { sent: false, reason: "Discord bot token is not configured" };
  if (!channelId) return { sent: false, reason: "Discord notification channel is not configured" };
  try {
    let response;
    if (attachment) {
      const fileResponse = await fetch(attachment.url, { signal: AbortSignal.timeout(8e3) });
      if (!fileResponse.ok) {
        throw new Error(`slip download failed (${fileResponse.status})`);
      }
      const bytes = await fileResponse.arrayBuffer();
      const form = new FormData();
      const embed = payload.embeds[0];
      const embedWithAttachment = embed ? { ...embed, image: { url: `attachment://${attachment.fileName}` } } : embed;
      form.append("payload_json", JSON.stringify({ ...payload, embeds: embedWithAttachment ? [embedWithAttachment] : [] }));
      form.append("files[0]", new Blob([bytes], { type: attachment.contentType }), attachment.fileName);
      response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}` },
        body: form,
        signal: AbortSignal.timeout(1e4)
      });
    } else {
      response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(1e4)
      });
    }
    if (!response.ok) {
      const details = await response.text().catch(() => response.statusText);
      throw new Error(`Discord message failed (${response.status}): ${details.slice(0, 300)}`);
    }
    const result = await response.json().catch(() => ({}));
    return { sent: true, channelId, messageId: result.id };
  } catch (error) {
    console.error("[DiscordNotifications] Failed to post message:", error);
    return { sent: false, channelId, reason: error instanceof Error ? error.message : String(error) };
  }
}
async function notifyTopupSubmitted(input) {
  const { order, userName, slipType = "image/*" } = input;
  const channelId = getDonateLogChannelId();
  const embed = {
    title: `\u{1F4B8} \u0E04\u0E33\u0E02\u0E2D\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E43\u0E2B\u0E21\u0E48 #${order.id}`,
    description: "\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2A\u0E48\u0E07\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E01\u0E32\u0E23\u0E42\u0E2D\u0E19\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E27\u0E47\u0E1A \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E01\u0E14\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19",
    color: 16038210,
    fields: [
      { name: "\u0E1C\u0E39\u0E49\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E02\u0E2D", value: userName || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D", inline: true },
      { name: "\u0E22\u0E2D\u0E14\u0E40\u0E15\u0E34\u0E21", value: formatAmount(order.amount), inline: true },
      { name: "\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19", value: order.paymentMethod, inline: true },
      { name: "\u0E2A\u0E16\u0E32\u0E19\u0E30", value: order.status, inline: true },
      { name: "\u0E44\u0E1F\u0E25\u0E4C\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19", value: `\u0E41\u0E19\u0E1A\u0E44\u0E1F\u0E25\u0E4C ${slipType}`, inline: true },
      { name: "Order ID", value: `#${order.id}`, inline: true }
    ],
    footer: { text: "RitzSMP \u2022 donate-log \u2022 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19" },
    timestamp: formatTimestamp(order.createdAt)
  };
  if (!order.slipKey) return postDiscordMessage(channelId, { embeds: [embed] });
  try {
    const signedUrl = await storageGetSignedUrl(order.slipKey);
    return await postDiscordMessage(channelId, { embeds: [embed] }, {
      url: signedUrl,
      fileName: getSlipFileName(order.slipKey),
      contentType: slipType
    });
  } catch (error) {
    console.error("[DiscordNotifications] Could not prepare top-up slip attachment:", error);
    const fallbackEmbed = {
      ...embed,
      description: `${embed.description}

\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E2A\u0E25\u0E34\u0E1B\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E44\u0E14\u0E49 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E44\u0E1F\u0E25\u0E4C`
    };
    return postDiscordMessage(channelId, { embeds: [fallbackEmbed] });
  }
}
async function notifyMinecraftPresence(input) {
  const channelId = getMinecraftStatusChannelId() || process.env.DISCORD_ONLINE_CHANNEL_ID || ENV.discordOnlineChannelId || "";
  const names = input.playerNames.length ? input.playerNames.map((name) => `\`${name}\``).join(", ") : "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19";
  const isJoin = input.kind === "join";
  const embed = {
    title: isJoin ? "\u{1F7E2} \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E40\u0E02\u0E49\u0E32\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP" : "\u{1F534} \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP",
    description: isJoin ? `\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E40\u0E02\u0E49\u0E32\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30: ${names}` : `\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30: ${names}`,
    color: isJoin ? 2278750 : 15680580,
    fields: [
      { name: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C", value: `${input.playerNames.length} \u0E04\u0E19`, inline: true },
      { name: "\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25", value: "Minecraft status API \u2022 \u0E23\u0E30\u0E1A\u0E1A Heartbeat", inline: true }
    ],
    footer: { text: "RitzSMP \u2022 \u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34" },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  return postDiscordMessage(channelId, { embeds: [embed] });
}
async function notifyPurchaseCompleted(input) {
  const { order, userName, rconExecuted = false } = input;
  const channelId = getSupportChannelId();
  const embed = {
    title: "\u{1F389} \u0E21\u0E35\u0E1C\u0E39\u0E49\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19 RitzSMP \u0E43\u0E2B\u0E21\u0E48\u0E04\u0E48\u0E30!",
    description: "\u0E02\u0E2D\u0E1A\u0E1E\u0E23\u0E30\u0E04\u0E38\u0E13\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP \u0E02\u0E2D\u0E43\u0E2B\u0E49\u0E2A\u0E19\u0E38\u0E01\u0E01\u0E31\u0E1A\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1E\u0E34\u0E40\u0E28\u0E29\u0E43\u0E19\u0E40\u0E01\u0E21\u0E19\u0E30\u0E04\u0E30",
    color: 13938487,
    fields: [
      { name: "\u0E1C\u0E39\u0E49\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19", value: userName || "\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 RitzSMP", inline: true },
      { name: "Minecraft IGN", value: `\`${order.minecraftIGN}\``, inline: true },
      { name: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", value: order.rankName, inline: true },
      { name: "\u0E22\u0E2D\u0E14\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19", value: formatAmount(order.amount), inline: true },
      { name: "\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E22\u0E28\u0E40\u0E02\u0E49\u0E32\u0E40\u0E01\u0E21", value: rconExecuted ? "\u2705 RCON \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" : "\u23F3 \u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A/\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23", inline: true },
      { name: "\u0E40\u0E25\u0E02\u0E17\u0E35\u0E48\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", value: `#${order.id}`, inline: true }
    ],
    footer: { text: "RitzSMP Supporters \u2022 \u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E23\u0E48\u0E27\u0E21\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E04\u0E48\u0E30" },
    timestamp: formatTimestamp(order.createdAt)
  };
  return postDiscordMessage(channelId, { embeds: [embed] });
}

// server/routers.ts
var allowedSlipTypes = ["image/jpeg", "image/png", "image/webp"];
var orderStatus = z.enum(["\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A", "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08", "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"]);
var sanitizeFileName = (value) => {
  const normalized = value.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-");
  return normalized.slice(-80) || "payment-slip";
};
var decodeSlip = (slipData, slipType) => {
  const match = slipData.match(/^data:[^;]+;base64,(.+)$/);
  if (!match?.[1]) {
    throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0E23\u0E39\u0E1B\u0E2A\u0E25\u0E34\u0E1B\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length > 6 * 1024 * 1024) {
    throw new TRPCError3({ code: "PAYLOAD_TOO_LARGE", message: "\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E25\u0E34\u0E1B\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E02\u0E19\u0E32\u0E14\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19 6 MB" });
  }
  if (buffer.length < 100) {
    throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E25\u0E34\u0E1B\u0E27\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E25\u0E48\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C" });
  }
  return { buffer, slipType };
};
var appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ ok: true, service: "ritz-smp-store" })),
    botStatus: adminProcedure.query(() => {
      try {
        return getRitzSmpAiBotStatus();
      } catch (e) {
        return {
          status: "offline",
          username: null,
          totalInteractions: 0,
          logs: [{ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: "ERROR", message: String(e) }]
        };
      }
    })
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  servers: router({
    list: publicProcedure.query(async () => {
      const servers = await getEnabledManagedServers();
      return servers.map((server) => ({
        id: server.id,
        slug: server.slug,
        displayName: server.displayName,
        minecraftHost: server.minecraftHost,
        minecraftPort: server.minecraftPort,
        discordGuildId: server.discordGuildId,
        enabled: server.enabled === 1,
        updatedAt: server.updatedAt
      }));
    }),
    adminList: ownerProcedure.query(async () => {
      const servers = await getManagedServers();
      return Promise.all(servers.map(async (server) => {
        const config = await getManagedServerConfig(server.id);
        let channelConfig = {};
        try {
          channelConfig = config?.channelConfig ? JSON.parse(config.channelConfig) : {};
        } catch {
          channelConfig = {};
        }
        return {
          ...server,
          enabled: server.enabled === 1,
          config: config ? { ...config, channelConfig } : null
        };
      }));
    }),
    create: ownerProcedure.input(z.object({
      slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, "Slug \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29 \u0E15\u0E31\u0E27\u0E40\u0E25\u0E02 \u0E2B\u0E23\u0E37\u0E2D\u0E02\u0E35\u0E14\u0E01\u0E25\u0E32\u0E07"),
      displayName: z.string().trim().min(2).max(128),
      minecraftHost: z.string().trim().min(1).max(255),
      minecraftPort: z.number().int().min(1).max(65535).default(25565),
      discordGuildId: z.string().trim().max(64).nullable().optional(),
      enabled: z.boolean().default(true),
      config: z.object({
        discordTokenEnv: z.string().trim().max(128).nullable().optional(),
        rconHost: z.string().trim().max(255).nullable().optional(),
        rconPort: z.number().int().min(1).max(65535).nullable().optional(),
        rconPasswordEnv: z.string().trim().max(128).nullable().optional(),
        channelConfig: z.record(z.string(), z.string().trim().max(80)).default({})
      })
    })).mutation(async ({ input }) => createManagedServer({
      ...input,
      config: { ...input.config, channelConfig: JSON.stringify(input.config.channelConfig) }
    })),
    runtime: ownerProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const runtime = await getManagedServerRuntimeConfig(input.id);
      if (!runtime) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E23\u0E30\u0E1A\u0E1A" });
      return runtimeConfigForClient(runtime);
    }),
    update: ownerProcedure.input(z.object({
      id: z.number().int().positive(),
      displayName: z.string().trim().min(2).max(128),
      minecraftHost: z.string().trim().min(1).max(255),
      minecraftPort: z.number().int().min(1).max(65535),
      discordGuildId: z.string().trim().max(64).nullable().optional(),
      enabled: z.boolean(),
      config: z.object({
        discordTokenEnv: z.string().trim().max(128).nullable().optional(),
        rconHost: z.string().trim().max(255).nullable().optional(),
        rconPort: z.number().int().min(1).max(65535).nullable().optional(),
        rconPasswordEnv: z.string().trim().max(128).nullable().optional(),
        channelConfig: z.record(z.string(), z.string().trim().max(80)).default({})
      })
    })).mutation(async ({ input }) => updateManagedServer({
      ...input,
      config: { ...input.config, channelConfig: JSON.stringify(input.config.channelConfig) }
    }))
  }),
  store: router({
    ranks: publicProcedure.query(() => getRanks()),
    myOrders: protectedProcedure.query(({ ctx }) => getOrdersByUser(ctx.user.id)),
    wallet: protectedProcedure.query(async ({ ctx }) => {
      const wallet = await getUserWallet(ctx.user.id);
      const transactions = await getUserWalletTransactions(ctx.user.id);
      return {
        balance: wallet.balance,
        transactions
      };
    }),
    createTopup: protectedProcedure.input(
      z.object({
        amount: z.number().positive("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E15\u0E34\u0E21"),
        paymentMethod: z.enum(["\u0E18\u0E19\u0E32\u0E04\u0E32\u0E23\u0E2D\u0E2D\u0E21\u0E2A\u0E34\u0E19", "PromptPay", "TrueMoney Wallet"]),
        slipData: z.string().min(100).max(85e5),
        slipName: z.string().max(160).default("topup-slip"),
        slipType: z.enum(allowedSlipTypes)
      })
    ).mutation(async ({ ctx, input }) => {
      const amountNum = Number(input.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19\u0E40\u0E15\u0E34\u0E21\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
      }
      const { buffer, slipType } = decodeSlip(input.slipData, input.slipType);
      const fileName = `${Date.now()}-${sanitizeFileName(input.slipName)}`;
      const stored = await storagePut(`topups/${ctx.user.id}/${fileName}`, buffer, slipType);
      const order = await createOrder({
        userId: ctx.user.id,
        minecraftIGN: ctx.user.name ?? "TopupUser",
        rankId: 0,
        rankName: `\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E32\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32 (${amountNum} \u0E1A\u0E32\u0E17)`,
        amount: amountNum.toFixed(2),
        paymentMethod: input.paymentMethod,
        slipUrl: stored.url,
        slipKey: stored.key,
        status: "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A"
      });
      const notificationSent = await notifyOwner({
        title: `RitzSMP: \u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E43\u0E2B\u0E21\u0E48 #${order.id}`,
        content: [
          `\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49: ${ctx.user.name ?? "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D"}`,
          `\u0E22\u0E2D\u0E14\u0E40\u0E15\u0E34\u0E21: ${order.amount} \u0E1A\u0E32\u0E17`,
          `\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07: ${order.paymentMethod}`,
          `\u0E2A\u0E16\u0E32\u0E19\u0E30: ${order.status}`
        ].join("\n")
      });
      const discordNotification = await notifyTopupSubmitted({
        order,
        userName: ctx.user.name ?? ctx.user.email ?? "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D",
        slipType
      }).catch((error) => {
        console.error("[DiscordNotifications] Top-up notification failed:", error);
        return { sent: false, reason: error instanceof Error ? error.message : String(error) };
      });
      return { order, notificationSent, discordNotification };
    }),
    purchaseRank: protectedProcedure.input(
      z.object({
        rankId: z.number().int().positive(),
        minecraftIGN: z.string().trim().min(3, "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21").max(64)
      })
    ).mutation(async ({ ctx, input }) => {
      const rank2 = await getRankById(input.rankId);
      if (!rank2) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E22\u0E28\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01" });
      }
      const priceNum = Number(rank2.price);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0E22\u0E28\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E23\u0E32\u0E04\u0E32\u0E08\u0E23\u0E34\u0E07" });
      }
      const wallet = await getUserWallet(ctx.user.id);
      const currentBalance = Number(wallet.balance);
      if (currentBalance < priceNum) {
        throw new TRPCError3({
          code: "PRECONDITION_FAILED",
          message: `\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E1E\u0E2D (\u0E21\u0E35\u0E2D\u0E22\u0E39\u0E48 ${currentBalance.toLocaleString("th-TH")} \u0E1A\u0E32\u0E17, \u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23 ${priceNum.toLocaleString("th-TH")} \u0E1A\u0E32\u0E17) \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28`
        });
      }
      const refKey = `purchase-rank-${ctx.user.id}-${rank2.id}-${Date.now()}-${randomUUID()}`;
      await adjustUserBalance(
        ctx.user.id,
        -priceNum,
        "purchase",
        `\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28 ${rank2.displayName} \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A IGN: ${input.minecraftIGN}`,
        refKey
      );
      const rankCmd = `lp user ${input.minecraftIGN} parent add ${rank2.name.toLowerCase()}`;
      const rankIndex = rank2.id;
      const coinRewards = [100, 250, 450, 700, 1e3, 1200, 1350, 1420, 1470, 1500];
      const coinAmount = coinRewards[Math.min(Math.max(rankIndex - 1, 0), coinRewards.length - 1)] ?? 100;
      const pointsCmd = `points give ${input.minecraftIGN} ${coinAmount}`;
      let rconDetail = "\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49 RCON";
      let rconExecuted = false;
      if (ENV.rconHost && ENV.rconPort && ENV.rconPassword) {
        let rcon;
        try {
          rcon = await Rcon2.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
          const res1 = await rcon.send(rankCmd);
          const res2 = await rcon.send(pointsCmd);
          rconExecuted = true;
          rconDetail = `${res1 || "\u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08"} | ${res2 || `\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D ${coinAmount} \u0E41\u0E15\u0E49\u0E21\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08`}`;
        } catch (err) {
          console.error("[RCON] Purchase rank/points auto-fulfillment error:", err);
          rconDetail = `RCON \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (${err?.message ?? String(err)} \u0E41\u0E15\u0E48\u0E2B\u0E31\u0E01\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E49\u0E27)`;
        } finally {
          await rcon?.end().catch(() => void 0);
        }
      }
      const order = await createOrder({
        userId: ctx.user.id,
        minecraftIGN: input.minecraftIGN,
        rankId: rank2.id,
        rankName: rank2.displayName,
        amount: rank2.price,
        paymentMethod: "\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E40\u0E07\u0E34\u0E19 (Wallet)",
        slipUrl: "https://ritzsmp.me/wallet-paid",
        slipKey: "wallet-paid",
        status: "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08",
        adminNotes: `\u0E2B\u0E31\u0E01\u0E40\u0E07\u0E34\u0E19\u0E08\u0E32\u0E01\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 [${rconDetail}]`
      });
      await notifyOwner({
        title: `RitzSMP: \u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 #${order.id} (${rank2.displayName})`,
        content: [
          `IGN: ${input.minecraftIGN}`,
          `\u0E1C\u0E39\u0E49\u0E0B\u0E37\u0E49\u0E2D: ${ctx.user.name ?? "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D"}`,
          `\u0E22\u0E28: ${rank2.displayName}`,
          `\u0E23\u0E32\u0E04\u0E32: ${rank2.price} \u0E1A\u0E32\u0E17`,
          `RCON: ${rconExecuted ? "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" : "\u0E23\u0E2D\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23"}`
        ].join("\n")
      }).catch(() => {
      });
      const discordNotification = await notifyPurchaseCompleted({
        order,
        userName: ctx.user.name ?? ctx.user.email ?? "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D",
        rconExecuted
      }).catch((error) => {
        console.error("[DiscordNotifications] Purchase notification failed:", error);
        return { sent: false, reason: error instanceof Error ? error.message : String(error) };
      });
      return { order, rconExecuted, rconDetail, discordNotification };
    })
  }),
  admin: router({
    orders: adminProcedure.query(() => getAllOrders()),
    users: ownerProcedure.query(async () => {
      const allUsers = await getAllUsers();
      return allUsers.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
        isOwner: user.openId === ENV.ownerOpenId
      }));
    }),
    setUserRole: ownerProcedure.input(z.object({ id: z.number().int().positive(), role: z.enum(["user", "admin"]) })).mutation(async ({ input }) => {
      const target = await getUserById(input.id);
      if (!target) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49" });
      }
      if (target.openId === ENV.ownerOpenId) {
        throw new TRPCError3({ code: "FORBIDDEN", message: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E25\u0E14\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E2B\u0E23\u0E37\u0E2D\u0E41\u0E01\u0E49\u0E44\u0E02\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Owner \u0E44\u0E14\u0E49" });
      }
      const updated = await updateUserRole(input.id, input.role);
      if (!updated) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E44\u0E14\u0E49" });
      }
      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        createdAt: updated.createdAt,
        lastSignedIn: updated.lastSignedIn,
        isOwner: updated.openId === ENV.ownerOpenId
      };
    }),
    updateOrderStatus: adminProcedure.input(
      z.object({
        id: z.number().int().positive(),
        status: orderStatus,
        adminNotes: z.string().max(2e3).nullable().optional()
      })
    ).mutation(async ({ input }) => {
      const existing = await getOrderById(input.id);
      if (!existing) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C" });
      }
      let updated = existing;
      if (input.status === "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" && existing.status !== "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08") {
        const rank2 = await getRankById(existing.rankId);
        let rconDetail = "\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49 RCON";
        let rconExecuted = false;
        if (existing.rankId === 0) {
          const walletResult = await adjustUserBalance(
            existing.userId,
            Number(existing.amount),
            "topup",
            `\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19 ${existing.paymentMethod} (\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C #${existing.id})`,
            `order:${existing.id}:topup`
          );
          rconDetail = walletResult.alreadyApplied ? "\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E02\u0E2D\u0E07\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E41\u0E25\u0E49\u0E27" : "\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E32\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08";
        } else {
          if (!rank2) {
            throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E22\u0E28\u0E02\u0E2D\u0E07\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49" });
          }
          const cmd = `lp user ${existing.minecraftIGN} parent add ${rank2.name.toLowerCase()}`;
          if (!ENV.rconHost || !ENV.rconPort || !ENV.rconPassword) {
            throw new TRPCError3({
              code: "PRECONDITION_FAILED",
              message: `\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 RCON \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 (\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E31\u0E19: ${cmd})`
            });
          }
          let rcon;
          try {
            rcon = await Rcon2.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
            const res = await rcon.send(cmd);
            rconExecuted = true;
            rconDetail = res || "RCON \u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08";
          } catch (err) {
            throw new TRPCError3({ code: "PRECONDITION_FAILED", message: `RCON \u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08: ${err?.message ?? String(err)}` });
          } finally {
            await rcon?.end().catch(() => void 0);
          }
        }
        updated = await updateOrder(
          input.id,
          "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08",
          `${input.adminNotes ?? existing.adminNotes ?? ""} [\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34: ${existing.rankId === 0 ? "\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" : "\u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22"} - ${rconDetail}]`.trim()
        );
        if (!updated) {
          throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E44\u0E14\u0E49" });
        }
        await notifyOwner({
          title: `RitzSMP: \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C #${updated.id} \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34`,
          content: [
            `\u2705 \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C #${updated.id} \u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 ${updated.minecraftIGN} \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27`,
            `\u{1F451} \u0E22\u0E28: ${updated.rankName}`,
            `\u2699\uFE0F RCON Status: ${rconExecuted ? "\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E02\u0E49\u0E32\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" : rconDetail}`
          ].join("\n")
        }).catch(() => {
        });
        if (updated.rankId !== 0) {
          const buyer = await getUserById(updated.userId);
          await notifyPurchaseCompleted({
            order: updated,
            userName: buyer?.name ?? buyer?.email ?? "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D",
            rconExecuted
          }).catch((error) => console.error("[DiscordNotifications] Admin purchase notification failed:", error));
        }
      }
      return updated;
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/minecraftPresenceMonitor.ts
function normalizeNames(names) {
  const normalized = /* @__PURE__ */ new Map();
  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!normalized.has(key)) normalized.set(key, name);
  }
  return normalized;
}
function difference(current, previous) {
  return Array.from(current.entries()).filter(([key]) => !previous.has(key)).map(([, name]) => name).sort((left, right) => left.localeCompare(right));
}
function diffMinecraftPresence(previous, current) {
  if (!previous) return { initialized: true, joined: [], left: [] };
  const previousNames = normalizeNames(previous.playerNames);
  const currentNames = normalizeNames(current.playerNames);
  const listComparisonAvailable = previous.playerListKnown && current.playerListKnown;
  if (!current.online) {
    return {
      initialized: false,
      joined: [],
      left: previous.online && previous.playerListKnown ? Array.from(previousNames.values()).sort() : []
    };
  }
  if (!current.playerListKnown) {
    return { initialized: false, joined: [], left: [] };
  }
  if (!previous.online) {
    return {
      initialized: false,
      joined: Array.from(currentNames.values()).sort(),
      left: []
    };
  }
  if (!listComparisonAvailable) {
    return { initialized: false, joined: [], left: [] };
  }
  return {
    initialized: false,
    joined: difference(currentNames, previousNames),
    left: difference(previousNames, currentNames)
  };
}
function parseStoredNames(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}
function comparableStatus(status) {
  return {
    online: status.online,
    playerListKnown: status.playerListKnown,
    playerNames: status.playerNames
  };
}
async function runMinecraftPresenceMonitor() {
  const currentStatus = await fetchMinecraftServerStatus();
  const previousState = await getMinecraftPresenceState();
  const previous = previousState ? {
    online: Boolean(previousState.lastOnline),
    playerListKnown: Boolean(previousState.playerListKnown),
    playerNames: parseStoredNames(previousState.lastPlayerNames)
  } : null;
  const transition = diffMinecraftPresence(previous, comparableStatus(currentStatus));
  if (transition.joined.length) {
    const result = await notifyMinecraftPresence({ kind: "join", playerNames: transition.joined });
    if (!result.sent) throw new Error(`Minecraft join announcement failed: ${result.reason ?? "unknown error"}`);
  }
  if (transition.left.length) {
    const result = await notifyMinecraftPresence({ kind: "leave", playerNames: transition.left });
    if (!result.sent) throw new Error(`Minecraft leave announcement failed: ${result.reason ?? "unknown error"}`);
  }
  await saveMinecraftPresenceState({
    lastOnline: currentStatus.online,
    playerListKnown: currentStatus.playerListKnown,
    lastPlayerNames: currentStatus.playerNames,
    lastCheckedAt: /* @__PURE__ */ new Date()
  });
  return {
    initialized: transition.initialized,
    online: currentStatus.online,
    players: currentStatus.players,
    joined: transition.joined,
    left: transition.left,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function handleMinecraftPresenceScheduled(req, res) {
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  let taskUid;
  try {
    const user = await sdk.authenticateRequest(req);
    taskUid = user.taskUid;
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }
    const state = await getMinecraftPresenceState();
    if (!state || state.scheduleCronTaskUid !== user.taskUid) {
      return res.json({ ok: true, skipped: "orphan" });
    }
    const result = await runMinecraftPresenceMonitor();
    return res.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 403) {
      return res.status(403).json({ error: "forbidden" });
    }
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: message,
      stack: error instanceof Error ? error.stack : void 0,
      context: { url: req.originalUrl, taskUid },
      timestamp: timestamp2
    });
  }
}

// server/_core/index.ts
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/scheduled/minecraft-presence", handleMinecraftPresenceScheduled);
  app.post("/api/minecraft/verify", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { code, minecraftIGN, minecraftUuid } = req.body;
    if (!code || !minecraftIGN || !minecraftUuid) {
      return res.status(400).json({ error: "Missing required fields: code, minecraftIGN, minecraftUuid" });
    }
    try {
      const verification = await redeemDiscordVerificationCode({
        code,
        minecraftIGN,
        minecraftUuid
      });
      console.log(`[MinecraftVerify] Successfully linked ${minecraftIGN} (${minecraftUuid}) to Discord ${verification.discordUserId}`);
      return res.json({ success: true, discordUserId: verification.discordUserId });
    } catch (error) {
      console.error(`[MinecraftVerify] Failed to redeem code ${code}:`, error);
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to redeem code" });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
  try {
    await startRitzSmpAiBot();
  } catch (error) {
    console.error("[RitzSmpAI] Failed to start:", error);
  }
}
startServer().catch(console.error);

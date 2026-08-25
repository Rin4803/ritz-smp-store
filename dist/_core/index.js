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
  discordAiBotToken: process.env.DISCORD_AI_BOT_TOKEN ?? "",
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
var DISCORD_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1e3;
function isValidDiscordVerificationCode(code) {
  return /^\d{4}$/.test(code);
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
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType as ChannelType2,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

// server/minecraftIntegration.ts
import { Rcon } from "rcon-client";
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

// server/discordMinecraftStatusChannel.ts
import { ChannelType, PermissionFlagsBits } from "discord.js";
var configuredMinecraftStatusChannelId = process.env.DISCORD_ONLINE_CHANNEL_ID?.trim() || "";
function getMinecraftStatusChannelId() {
  return configuredMinecraftStatusChannelId;
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
var logsBuffer = [];
var botClient = null;
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
var RITZ_SYSTEM_CHANNEL_TARGETS = [
  {
    name: "\u{1F517}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
    legacyNames: ["\u2705\u2502\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E14\u0E34\u0E2A\u0E04\u0E2D\u0E23\u0E4C\u0E14", "\u{1F517}\u2502\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35-Minecraft"],
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Discord \u0E01\u0E31\u0E1A Minecraft \u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E23\u0E2B\u0E31\u0E2A /verify 4 \u0E2B\u0E25\u0E31\u0E01"
  },
  {
    name: "\u{1F4CB}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
    legacyNames: [
      "\u{1F4CB}\u2502\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
      "\u{1F4CB}\uFE31\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
      "\u{1F4CB}\u2502\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D-\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19"
    ],
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E2A\u0E14\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Minecraft \u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27"
  },
  {
    name: "\u{1F396}\uFE0F\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E22\u0E28",
    legacyNames: ["\u{1FAAA}\u2502\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E21\u0E30", "\u{1F396}\uFE0F\u2502\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19-\u0E23\u0E31\u0E1A\u0E22\u0E28"],
    type: ChannelType2.GuildText,
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
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E41\u0E25\u0E30\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E02\u0E49\u0E32\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
  },
  {
    name: "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01",
    legacyNames: ["\u{1F44B}\u2502leave", "\u{1F44B}\u2502\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01", "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"],
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
  }
];

// server/discordNotifications.ts
var DISCORD_API = "https://discord.com/api/v10";
function getDiscordToken() {
  return process.env.DISCORD_AI_BOT_TOKEN || ENV.discordAiBotToken || "";
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
}
startServer().catch(console.error);

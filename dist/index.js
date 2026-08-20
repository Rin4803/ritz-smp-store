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
  discordOrdersChannelId: process.env.DISCORD_ORDERS_CHANNEL_ID ?? "",
  discordAdminRoleId: process.env.DISCORD_ADMIN_ROLE_ID ?? "",
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
  rank(1, "VIP", "39.00", "silver", "ENTRY", "\u0E22\u0E28\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19 RitzSMP", ["/hat", "/craft", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 3 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 10,000", "Common Key \xD73"]),
  rank(2, "VIP+", "79.00", "gold", "POPULAR", "\u0E2D\u0E31\u0E1B\u0E40\u0E01\u0E23\u0E14\u0E08\u0E32\u0E01 VIP \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E2D\u0E33\u0E19\u0E27\u0E22\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E30\u0E14\u0E27\u0E01\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C VIP \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/enderchest", "/feed", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 5 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 25,000", "Common Key \xD75", "Rare Key \xD71"]),
  rank(3, "Knight", "149.00", "ruby", "ADVENTURE", "\u0E22\u0E28\u0E19\u0E31\u0E01\u0E23\u0E1A\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E27\u0E32\u0E21\u0E04\u0E25\u0E48\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C VIP+ \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/ptime", "/pweather", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 8 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 50,000", "Common Key \xD78", "Rare Key \xD73"]),
  rank(4, "Elite", "249.00", "gold", "ADVANCED", "\u0E22\u0E28\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E2A\u0E39\u0E07\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E0B\u0E48\u0E2D\u0E21\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E44\u0E2D\u0E40\u0E17\u0E21", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Knight \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/repair", "/anvil", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 10 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 80,000", "Rare Key \xD75", "Epic Key \xD72"]),
  rank(5, "Noble", "399.00", "silver", "UTILITY", "\u0E22\u0E28\u0E1C\u0E39\u0E49\u0E14\u0E35\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E30\u0E14\u0E27\u0E01\u0E43\u0E19\u0E01\u0E32\u0E23\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Elite \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/back", "Backpack Lv.1", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 15 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 120,000", "Rare Key \xD78", "Epic Key \xD75"]),
  rank(6, "Lord", "599.00", "ruby", "PRESTIGE", "\u0E22\u0E28\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E28\u0E23\u0E35\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E35\u0E41\u0E0A\u0E17\u0E41\u0E25\u0E30 Fly \u0E17\u0E35\u0E48 Spawn", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Noble \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Chat Color", "Fly \u0E17\u0E35\u0E48 Spawn", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 20 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 200,000", "Epic Key \xD78", "Legendary Key \xD72"]),
  rank(7, "Overlord", "899.00", "gold", "ELITE", "\u0E22\u0E28\u0E0A\u0E31\u0E49\u0E19\u0E2A\u0E39\u0E07\u0E1E\u0E23\u0E49\u0E2D\u0E21 Backpack \u0E41\u0E25\u0E30 Prefix \u0E44\u0E25\u0E48\u0E2A\u0E35", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Lord \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Backpack Lv.2", "Prefix \u0E44\u0E25\u0E48\u0E2A\u0E35", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 30 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 350,000", "Epic Key \xD710", "Legendary Key \xD75"]),
  rank(8, "Mythic", "1299.00", "ruby", "MYTHIC", "\u0E22\u0E28 Mythic \u0E1E\u0E23\u0E49\u0E2D\u0E21 Aura \u0E41\u0E25\u0E30 Cosmetic \u0E1E\u0E34\u0E40\u0E28\u0E29", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Overlord \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Aura \u0E1E\u0E34\u0E40\u0E28\u0E29", "Cosmetic \u0E1E\u0E34\u0E40\u0E28\u0E29", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 40 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 500,000", "Legendary Key \xD710", "Mythic Key \xD73"]),
  rank(9, "Celestial", "1799.00", "gold", "CELESTIAL", "\u0E22\u0E28 Celestial \u0E1E\u0E23\u0E49\u0E2D\u0E21 Join Message \u0E41\u0E25\u0E30 Chat Tag", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Mythic \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Join Message", "Chat Tag", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 50 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 800,000", "Legendary Key \xD715", "Mythic Key \xD78"]),
  rank(10, "Emperor", "2499.00", "ruby", "ULTIMATE", "\u0E22\u0E28\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E08\u0E31\u0E01\u0E23\u0E1E\u0E23\u0E23\u0E14\u0E34\u0E02\u0E2D\u0E07 RitzSMP", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Homes \u0E44\u0E21\u0E48\u0E08\u0E33\u0E01\u0E31\u0E14", "Cosmetic \u0E17\u0E38\u0E01\u0E0A\u0E19\u0E34\u0E14", "Join Message \u0E1E\u0E34\u0E40\u0E28\u0E29", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 1,500,000", "Mythic Key \xD720", "Emperor Key \xD75"])
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
  const result = await db.select().from(ranks);
  const catalog = result.length ? result : DEFAULT_RANKS;
  return [...catalog].sort((left, right) => left.id - right.id);
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
async function ensureDiscordUser(discordUserId, displayName) {
  const openId = `discord:${discordUserId}`;
  await upsertUser({
    openId,
    name: displayName,
    loginMethod: "discord",
    role: "user"
  });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Discord user could not be created");
  return user;
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
        if (existing[0]?.userId !== userId) {
          throw new Error("\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E40\u0E07\u0E34\u0E19\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E0B\u0E49\u0E33\u0E01\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2D\u0E37\u0E48\u0E19");
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
import { Rcon } from "rcon-client";

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
    health: publicProcedure.query(() => ({ ok: true, service: "ritz-smp-store" }))
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
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
    createOrder: protectedProcedure.input(
      z.object({
        rankId: z.number().int().positive(),
        minecraftIGN: z.string().trim().min(3, "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21").max(64),
        paymentMethod: z.enum(["\u0E18\u0E19\u0E32\u0E04\u0E32\u0E23\u0E2D\u0E2D\u0E21\u0E2A\u0E34\u0E19", "PromptPay", "TrueMoney Wallet"]),
        slipData: z.string().min(100).max(85e5),
        slipName: z.string().max(160).default("payment-slip"),
        slipType: z.enum(allowedSlipTypes)
      })
    ).mutation(async ({ ctx, input }) => {
      const rank2 = await getRankById(input.rankId);
      if (!rank2) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E22\u0E28\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01" });
      }
      const amount = Number(rank2.price);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new TRPCError3({
          code: "PRECONDITION_FAILED",
          message: "\u0E22\u0E28\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E23\u0E32\u0E04\u0E32\u0E08\u0E23\u0E34\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
        });
      }
      const { buffer, slipType } = decodeSlip(input.slipData, input.slipType);
      const fileName = `${Date.now()}-${sanitizeFileName(input.slipName)}`;
      const stored = await storagePut(`orders/${ctx.user.id}/${fileName}`, buffer, slipType);
      const order = await createOrder({
        userId: ctx.user.id,
        minecraftIGN: input.minecraftIGN,
        rankId: rank2.id,
        rankName: rank2.displayName,
        amount: rank2.price,
        paymentMethod: input.paymentMethod,
        slipUrl: stored.url,
        slipKey: stored.key,
        status: "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A"
      });
      const notificationSent = await notifyOwner({
        title: `RitzSMP: \u0E21\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E43\u0E2B\u0E21\u0E48 #${order.id}`,
        content: [
          `IGN: ${order.minecraftIGN}`,
          `\u0E22\u0E28: ${order.rankName}`,
          `\u0E22\u0E2D\u0E14\u0E0A\u0E33\u0E23\u0E30: ${order.amount} \u0E1A\u0E32\u0E17`,
          `\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07: ${order.paymentMethod}`,
          `\u0E1C\u0E39\u0E49\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D: ${ctx.user.name ?? "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D"} (${ctx.user.email ?? "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E35\u0E40\u0E21\u0E25"})`,
          `\u0E2A\u0E16\u0E32\u0E19\u0E30: ${order.status}`
        ].join("\n")
      });
      return { order, notificationSent };
    })
  }),
  admin: router({
    orders: adminProcedure.query(() => getAllOrders()),
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
            rcon = await Rcon.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
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

// server/discordBot.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  PermissionsBitField,
  REST,
  Routes,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { Rcon as Rcon2 } from "rcon-client";
var PAYMENT_TEXT = [
  "\u0E18\u0E19\u0E32\u0E04\u0E32\u0E23\u0E2D\u0E2D\u0E21\u0E2A\u0E34\u0E19: 020391511886",
  "PromptPay / TrueMoney: 0930286252"
].join("\n");
var pendingCheckouts = /* @__PURE__ */ new Map();
var botClient = null;
var botStartPromise = null;
function isValidIgn(value) {
  return /^[A-Za-z0-9_]{3,16}$/.test(value);
}
function safeFileName(name) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "slip.jpg";
}
function isStaff(interaction) {
  if (!interaction.inGuild()) return false;
  const member = interaction.member;
  if (member?.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  if (!ENV.discordAdminRoleId) return false;
  if (Array.isArray(member?.roles)) return member.roles.includes(ENV.discordAdminRoleId);
  return Boolean(member?.roles?.cache?.has(ENV.discordAdminRoleId));
}
function normalizePublicStoreUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
function getPublicStoreUrl() {
  return normalizePublicStoreUrl(ENV.publicStoreUrl);
}
function buildStorePanel(ranks2) {
  const publicStoreUrl = getPublicStoreUrl();
  const embed = new EmbedBuilder().setTitle("\u{1F451} RITZSMP OFFICIAL STORE").setDescription(
    "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E22\u0E28\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23 \u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D Minecraft \u0E43\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E02\u0E36\u0E49\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E1A\u0E2D\u0E17\u0E08\u0E30\u0E2A\u0E48\u0E07\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E44\u0E1B\u0E17\u0E32\u0E07 DM \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E04\u0E38\u0E13\u0E41\u0E19\u0E1A\u0E2A\u0E25\u0E34\u0E1B\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27\n\n\u0E2B\u0E25\u0E31\u0E07\u0E2A\u0E48\u0E07\u0E2A\u0E25\u0E34\u0E1B\u0E41\u0E25\u0E49\u0E27 \u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E08\u0E30\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E41\u0E25\u0E30\u0E41\u0E08\u0E49\u0E07\u0E1C\u0E25\u0E01\u0E25\u0E31\u0E1A\u0E17\u0E32\u0E07 DM"
  ).addFields(
    { name: "\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19", value: PAYMENT_TEXT },
    {
      name: "\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32",
      value: publicStoreUrl ? `[\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32](${publicStoreUrl})` : "\u0E23\u0E2D\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 PUBLIC_STORE_URL"
    }
  ).setColor(13938487).setFooter({ text: "RitzSMP Store \u2022 \u0E42\u0E1B\u0E23\u0E14\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21\u0E01\u0E48\u0E2D\u0E19\u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C" });
  const rows = [];
  for (let i = 0; i < ranks2.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const rank2 of ranks2.slice(i, i + 5)) {
      row.addComponents(
        new ButtonBuilder().setCustomId(`buy_rank_${rank2.id}`).setLabel(`${rank2.displayName} ${Number(rank2.price).toLocaleString("th-TH")}\u0E3F`).setStyle(ButtonStyle.Primary)
      );
    }
    rows.push(row);
  }
  return { embeds: [embed], components: rows };
}
async function publishStorePanel(client) {
  if (!ENV.discordStoreChannelId) return;
  const channel = await client.channels.fetch(ENV.discordStoreChannelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;
  const payload = buildStorePanel(await getRanks());
  const messages = await channel.messages.fetch({ limit: 20 });
  const existing = messages.find((message) => message.author.id === client.user?.id);
  if (existing) await existing.edit(payload);
  else await channel.send(payload);
}
async function registerGuildCommands(client) {
  if (!ENV.discordGuildId || !client.user) return;
  const rest = new REST({ version: "10" }).setToken(ENV.discordBotToken);
  await rest.put(Routes.applicationGuildCommands(client.user.id, ENV.discordGuildId), {
    body: [
      {
        name: "setup-store",
        description: "\u0E42\u0E1E\u0E2A\u0E15\u0E4C\u0E2B\u0E23\u0E37\u0E2D\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E41\u0E1C\u0E07\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E22\u0E28 RitzSMP \u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32"
      }
    ]
  });
}
async function sendSlipInstructions(user, rank2) {
  return user.send({
    embeds: [
      new EmbedBuilder().setTitle(`\u{1F9FE} \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E22\u0E28 ${rank2.displayName}`).setDescription(
        `\u0E0A\u0E37\u0E48\u0E2D Minecraft: **${rank2.pendingIgn ?? "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E43\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32"}**
\u0E22\u0E2D\u0E14\u0E0A\u0E33\u0E23\u0E30: **${Number(rank2.price).toLocaleString("th-TH")} \u0E1A\u0E32\u0E17**

\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E15\u0E32\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07 \u0E41\u0E25\u0E49\u0E27\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E2A\u0E25\u0E34\u0E1B\u0E43\u0E19 DM \u0E19\u0E35\u0E49\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22

${PAYMENT_TEXT}

\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E2B\u0E25\u0E31\u0E07\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2A\u0E25\u0E34\u0E1B \u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E43\u0E2B\u0E49\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A`
      ).setColor(13938487)
    ]
  });
}
async function createReviewMessage(client, order) {
  if (!ENV.discordOrdersChannelId) {
    console.warn("[DiscordBot] DISCORD_ORDERS_CHANNEL_ID is not configured");
    return;
  }
  const channel = await client.channels.fetch(ENV.discordOrdersChannelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;
  const slipUrl = await storageGetSignedUrl(order.slipKey).catch(() => void 0);
  const embed = new EmbedBuilder().setTitle(`\u{1F9FE} \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E43\u0E2B\u0E21\u0E48 #${order.id}`).setDescription("\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E22\u0E2D\u0E14\u0E42\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E43\u0E2B\u0E49\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E01\u0E48\u0E2D\u0E19\u0E01\u0E14\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34").addFields(
    { name: "\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 Minecraft", value: `\`${order.minecraftIGN}\``, inline: true },
    { name: "\u0E22\u0E28", value: order.rankName, inline: true },
    { name: "\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19", value: `${Number(order.amount).toLocaleString("th-TH")} \u0E1A\u0E32\u0E17`, inline: true },
    { name: "\u0E1C\u0E39\u0E49\u0E2A\u0E48\u0E07", value: `<@${order.userId}>`, inline: true },
    { name: "\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E2A\u0E25\u0E34\u0E1B", value: slipUrl ? `[\u0E40\u0E1B\u0E34\u0E14\u0E14\u0E39\u0E2A\u0E25\u0E34\u0E1B](${slipUrl})` : "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E2A\u0E25\u0E34\u0E1B\u0E44\u0E14\u0E49" }
  ).setColor(13938487).setTimestamp(new Date(order.createdAt));
  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve_${order.id}`).setLabel("\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject_${order.id}`).setLabel("\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18").setStyle(ButtonStyle.Danger)
  );
  await channel.send({ embeds: [embed], components: [controls] });
}
async function executeRconRank(order, rank2) {
  const command = `lp user ${order.minecraftIGN} parent add ${rank2.name.toLowerCase()}`;
  if (!ENV.rconHost || !ENV.rconPort || !ENV.rconPassword) {
    return { executed: false, command, detail: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 RCON \u0E08\u0E36\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E19\u0E33\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E44\u0E1B\u0E43\u0E0A\u0E49\u0E43\u0E19 Console \u0E14\u0E49\u0E27\u0E22\u0E15\u0E19\u0E40\u0E2D\u0E07" };
  }
  const rcon = await Rcon2.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
  try {
    const response = await rcon.send(command);
    return { executed: true, command, detail: response || "RCON \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E41\u0E25\u0E49\u0E27" };
  } finally {
    await rcon.end();
  }
}
async function handleBuyButton(interaction) {
  const rankId = Number(interaction.customId.replace("buy_rank_", ""));
  const rank2 = await getRankById(rankId);
  if (!rank2) {
    await interaction.reply({ content: "\u274C \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E22\u0E28\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E41\u0E1C\u0E07\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48", ephemeral: true });
    return;
  }
  const modal = new ModalBuilder().setCustomId(`modal_order_${rank2.id}`).setTitle(`\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D ${rank2.displayName}`);
  const ignInput = new TextInputBuilder().setCustomId("minecraft_ign").setLabel("\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21 Minecraft").setPlaceholder("\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29 \u0E15\u0E31\u0E27\u0E40\u0E25\u0E02 \u0E2B\u0E23\u0E37\u0E2D _ \u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27 3-16 \u0E15\u0E31\u0E27").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(16);
  modal.addComponents(new ActionRowBuilder().addComponents(ignInput));
  await interaction.showModal(modal);
}
async function handleModalSubmit(client, interaction) {
  const rankId = Number(interaction.customId.replace("modal_order_", ""));
  const minecraftIGN = interaction.fields.getTextInputValue("minecraft_ign").trim();
  const rank2 = await getRankById(rankId);
  if (!rank2) {
    await interaction.reply({ content: "\u274C \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E22\u0E28 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48", ephemeral: true });
    return;
  }
  if (!isValidIgn(minecraftIGN)) {
    await interaction.reply({ content: "\u274C \u0E0A\u0E37\u0E48\u0E2D Minecraft \u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35 3-16 \u0E15\u0E31\u0E27 \u0E41\u0E25\u0E30\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30 A-Z, 0-9 \u0E2B\u0E23\u0E37\u0E2D _", ephemeral: true });
    return;
  }
  pendingCheckouts.set(interaction.user.id, {
    rankId,
    minecraftIGN,
    paymentMethod: "PromptPay / \u0E2D\u0E2D\u0E21\u0E2A\u0E34\u0E19",
    createdAt: Date.now()
  });
  try {
    const user = await client.users.fetch(interaction.user.id);
    const dmRank = { ...rank2, pendingIgn: minecraftIGN };
    await sendSlipInstructions(user, dmRank);
    await interaction.reply({ content: "\u2705 \u0E2A\u0E48\u0E07\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E44\u0E1B\u0E17\u0E32\u0E07 DM \u0E41\u0E25\u0E49\u0E27 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E2A\u0E25\u0E34\u0E1B\u0E43\u0E19 DM \u0E01\u0E31\u0E1A\u0E1A\u0E2D\u0E17\u0E20\u0E32\u0E22\u0E43\u0E19 30 \u0E19\u0E32\u0E17\u0E35", ephemeral: true });
  } catch {
    pendingCheckouts.delete(interaction.user.id);
    await interaction.reply({ content: "\u274C \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E48\u0E07 DM \u0E44\u0E14\u0E49 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27\u0E08\u0E32\u0E01\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48", ephemeral: true });
  }
}
async function handleSlipMessage(client, message) {
  if (message.author.bot || !message.channel.isDMBased() || message.attachments.size === 0) return;
  const pending = pendingCheckouts.get(message.author.id);
  if (!pending || Date.now() - pending.createdAt > 30 * 60 * 1e3) {
    pendingCheckouts.delete(message.author.id);
    await message.reply("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D\u0E17\u0E35\u0E48\u0E23\u0E2D\u0E23\u0E31\u0E1A\u0E2A\u0E25\u0E34\u0E1B \u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E25\u0E31\u0E1A\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E0A\u0E48\u0E2D\u0E07 #shop \u0E41\u0E25\u0E49\u0E27\u0E40\u0E23\u0E34\u0E48\u0E21\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E21\u0E48");
    return;
  }
  const attachment = message.attachments.find((item) => item.contentType?.startsWith("image/"));
  if (!attachment) {
    await message.reply("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E41\u0E19\u0E1A\u0E44\u0E1F\u0E25\u0E4C\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2A\u0E25\u0E34\u0E1B \u0E40\u0E0A\u0E48\u0E19 PNG, JPG \u0E2B\u0E23\u0E37\u0E2D WEBP");
    return;
  }
  if (attachment.size > 10 * 1024 * 1024) {
    await message.reply("\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E25\u0E34\u0E1B\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E02\u0E19\u0E32\u0E14\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19 10 MB");
    return;
  }
  const rank2 = await getRankById(pending.rankId);
  if (!rank2) {
    pendingCheckouts.delete(message.author.id);
    await message.reply("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E22\u0E28 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E21\u0E48");
    return;
  }
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`Discord attachment download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const upload = await storagePut(
    `discord-slips/${message.author.id}/${Date.now()}-${safeFileName(attachment.name)}`,
    bytes,
    attachment.contentType ?? "image/jpeg"
  );
  const user = await ensureDiscordUser(message.author.id, message.author.username);
  const order = await createOrder({
    userId: user.id,
    minecraftIGN: pending.minecraftIGN,
    rankId: rank2.id,
    rankName: rank2.displayName,
    amount: String(rank2.price),
    paymentMethod: pending.paymentMethod,
    slipUrl: upload.url,
    slipKey: upload.key,
    status: "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A"
  });
  pendingCheckouts.delete(message.author.id);
  await createReviewMessage(client, order);
  await message.reply(`\u2705 \u0E23\u0E31\u0E1A\u0E2A\u0E25\u0E34\u0E1B\u0E41\u0E25\u0E49\u0E27 \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C #${order.id} \u0E2D\u0E22\u0E39\u0E48\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A \u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E08\u0E30\u0E41\u0E08\u0E49\u0E07\u0E1C\u0E25\u0E01\u0E25\u0E31\u0E1A\u0E17\u0E32\u0E07 DM \u0E04\u0E23\u0E31\u0E1A`);
}
async function handleAdminButton(interaction) {
  if (!isStaff(interaction)) {
    await interaction.reply({ content: "\u274C \u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49", ephemeral: true });
    return;
  }
  const orderId = Number(interaction.customId.replace(/^(approve|reject)_/, ""));
  const order = await getOrderById(orderId);
  if (!order) {
    await interaction.reply({ content: "\u274C \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49", ephemeral: true });
    return;
  }
  if (order.status !== "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A") {
    await interaction.reply({ content: `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E44\u0E1B\u0E41\u0E25\u0E49\u0E27 \u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19: ${order.status}`, ephemeral: true });
    return;
  }
  if (interaction.customId.startsWith("reject_")) {
    const updated2 = await updateOrder(orderId, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01", `\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E1C\u0E48\u0E32\u0E19 Discord \u0E42\u0E14\u0E22 ${interaction.user.tag}`);
    await interaction.update({ content: `\u274C \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C #${orderId} \u0E16\u0E39\u0E01\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E42\u0E14\u0E22 ${interaction.user.tag}`, embeds: updated2 ? [] : void 0, components: [] });
    const user2 = await getUserById(order.userId);
    if (user2?.openId.startsWith("discord:")) {
      const discordUser = await interaction.client.users.fetch(user2.openId.replace("discord:", ""));
      await discordUser.send(`\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C #${orderId} \u0E16\u0E39\u0E01\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E17\u0E35\u0E21\u0E07\u0E32\u0E19\u0E43\u0E19 Discord \u0E2B\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E2D\u0E1A\u0E16\u0E32\u0E21\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21`).catch(() => void 0);
    }
    return;
  }
  const rank2 = await getRankById(order.rankId);
  if (!rank2) {
    await interaction.reply({ content: "\u274C \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E22\u0E28\u0E02\u0E2D\u0E07\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49", ephemeral: true });
    return;
  }
  const fulfillment = await executeRconRank(order, rank2);
  const updated = await updateOrder(orderId, "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08", `\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E1C\u0E48\u0E32\u0E19 Discord \u0E42\u0E14\u0E22 ${interaction.user.tag}; ${fulfillment.detail}`);
  await interaction.update({
    content: `\u2705 \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C #${orderId} \u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E41\u0E25\u0E49\u0E27\u0E42\u0E14\u0E22 ${interaction.user.tag}
${fulfillment.executed ? "RCON \u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27" : "\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E43\u0E19 Console \u0E14\u0E49\u0E27\u0E22\u0E15\u0E19\u0E40\u0E2D\u0E07"}
\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07: \`${fulfillment.command}\``,
    embeds: updated ? [] : void 0,
    components: []
  });
  const user = await getUserById(order.userId);
  if (user?.openId.startsWith("discord:")) {
    const discordUser = await interaction.client.users.fetch(user.openId.replace("discord:", ""));
    await discordUser.send(`\u2705 \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C #${orderId} \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27 \u0E22\u0E28 ${rank2.displayName} \u0E16\u0E39\u0E01\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A ${order.minecraftIGN}`).catch(() => void 0);
  }
}
function createDiscordStoreBot(token) {
  if (botClient) return botClient;
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages]
  });
  client.once("ready", async () => {
    console.log(`[DiscordBot] Logged in as ${client.user?.tag}`);
    await registerGuildCommands(client).catch((error) => console.error("[DiscordBot] Command registration failed", error));
    await publishStorePanel(client).catch((error) => console.error("[DiscordBot] Store panel publish failed", error));
  });
  client.on("messageCreate", (message) => handleSlipMessage(client, message).catch((error) => console.error("[DiscordBot] Slip handling failed", error)));
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === "setup-store") {
        if (!isStaff(interaction)) {
          await interaction.reply({ content: "\u274C \u0E40\u0E09\u0E1E\u0E32\u0E30\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49", ephemeral: true });
          return;
        }
        await interaction.reply({ content: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E41\u0E1C\u0E07\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32...", ephemeral: true });
        await publishStorePanel(client);
        return;
      }
      if (interaction.isButton() && interaction.customId.startsWith("buy_rank_")) return handleBuyButton(interaction);
      if (interaction.isButton() && /^(approve|reject)_\d+$/.test(interaction.customId)) return handleAdminButton(interaction);
      if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_order_")) return handleModalSubmit(client, interaction);
    } catch (error) {
      console.error("[DiscordBot] Interaction failed", error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07", ephemeral: true }).catch(() => void 0);
      }
    }
  });
  botClient = client;
  return client;
}
async function startDiscordStoreBot() {
  if (!ENV.discordBotToken) {
    console.log("[DiscordBot] DISCORD_BOT_TOKEN is not configured; bot is disabled");
    return null;
  }
  if (!botStartPromise) {
    botStartPromise = (async () => {
      const client = createDiscordStoreBot(ENV.discordBotToken);
      await client.login(ENV.discordBotToken);
      return client;
    })();
  }
  return botStartPromise;
}

// server/discordAiBot.ts
import { Client as Client2, GatewayIntentBits as GatewayIntentBits2, REST as REST2, Routes as Routes2, SlashCommandBuilder } from "discord.js";

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

// server/discordAiBot.ts
function createRitzSmpAiBot() {
  const token = process.env.DISCORD_AI_BOT_TOKEN;
  if (!token) {
    console.warn("[RitzSmpAI] DISCORD_AI_BOT_TOKEN not provided, skipping AI bot startup.");
    return null;
  }
  const client = new Client2({
    intents: [
      GatewayIntentBits2.Guilds,
      GatewayIntentBits2.GuildMessages,
      GatewayIntentBits2.MessageContent
    ]
  });
  client.once("ready", async () => {
    console.log(`[RitzSmpAI] Logged in as ${client.user?.tag}`);
    const commands = [
      new SlashCommandBuilder().setName("ask").setDescription("\u0E2A\u0E2D\u0E1A\u0E16\u0E32\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP, \u0E22\u0E28, \u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32").addStringOption(
        (option) => option.setName("question").setDescription("\u0E04\u0E33\u0E16\u0E32\u0E21\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E16\u0E32\u0E21 AI").setRequired(true)
      ),
      new SlashCommandBuilder().setName("ai-status").setDescription("\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E23\u0E30\u0E1A\u0E1A RitzSMP AI \u0E41\u0E25\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft")
    ].map((cmd) => cmd.toJSON());
    const rest = new REST2({ version: "10" }).setToken(token);
    const clientId = client.user?.id;
    if (!clientId) return;
    try {
      console.log("[RitzSmpAI] Registering global slash commands...");
      await rest.put(Routes2.applicationCommands(clientId), { body: commands });
      console.log("[RitzSmpAI] Global slash commands registered successfully!");
      const guildIds = Array.from(client.guilds.cache.keys());
      for (const guildId of guildIds) {
        try {
          await rest.put(Routes2.applicationGuildCommands(clientId, guildId), { body: commands });
          console.log(`[RitzSmpAI] Guild commands registered for guild ${guildId}`);
        } catch (err) {
          console.error(`[RitzSmpAI] Failed to register guild commands for ${guildId}:`, err);
        }
      }
    } catch (error) {
      console.error("[RitzSmpAI] Failed to register slash commands:", error);
    }
  });
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;
    if (commandName === "ai-status") {
      try {
        await interaction.deferReply();
        await interaction.editReply(
          "\u{1F496} **RitzSMP AI** \u0E15\u0E31\u0E27\u0E19\u0E49\u0E2D\u0E22\u0E2A\u0E41\u0E15\u0E19\u0E14\u0E4C\u0E1A\u0E32\u0E22\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E14\u0E39\u0E41\u0E25\u0E17\u0E38\u0E01\u0E04\u0E19\u0E41\u0E25\u0E49\u0E27\u0E19\u0E30\u0E04\u0E30! \u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E14\u0E35\u0E04\u0E48\u0E30 \u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E2B\u0E49\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E19\u0E49\u0E2D\u0E07\u0E44\u0E2D\u0E0A\u0E48\u0E27\u0E22\u0E14\u0E39\u0E41\u0E25\u0E1A\u0E2D\u0E01\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E30 \u2728"
        );
      } catch (err) {
        console.error("[RitzSmpAI] ai-status error:", err);
      }
      return;
    }
    if (commandName === "ask") {
      const question = interaction.options.getString("question", true);
      try {
        await interaction.deferReply();
      } catch (err) {
        console.error("[RitzSmpAI] deferReply failed:", err);
        return;
      }
      try {
        const prompt = `\u0E04\u0E38\u0E13\u0E04\u0E37\u0E2D RitzSMP AI \u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E32\u0E27\u0E2A\u0E38\u0E14\u0E19\u0E48\u0E32\u0E23\u0E31\u0E01\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft RitzSMP \u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E1E\u0E39\u0E14\u0E08\u0E32\u0E2A\u0E38\u0E20\u0E32\u0E1E \u0E02\u0E35\u0E49\u0E40\u0E25\u0E48\u0E19 \u0E40\u0E1B\u0E47\u0E19\u0E01\u0E31\u0E19\u0E40\u0E2D\u0E07 \u0E41\u0E25\u0E30\u0E25\u0E07\u0E17\u0E49\u0E32\u0E22\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E27\u0E48\u0E32 "\u0E04\u0E48\u0E30", "\u0E19\u0E30\u0E04\u0E30", "\u0E19\u0E30\u0E04\u0E49\u0E32" \u0E40\u0E2A\u0E21\u0E2D \u0E08\u0E07\u0E15\u0E2D\u0E1A\u0E04\u0E33\u0E16\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E04\u0E19\u0E19\u0E35\u0E49\u0E43\u0E2B\u0E49\u0E2A\u0E14\u0E43\u0E2A\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14: "${question}"`;
        const aiRes = await invokeLLM({
          messages: [{ role: "user", content: prompt }]
        });
        const replyContent = aiRes.choices[0]?.message?.content;
        const replyText = typeof replyContent === "string" ? replyContent : "\u0E02\u0E2D\u0E42\u0E17\u0E29\u0E14\u0E49\u0E27\u0E22\u0E19\u0E30\u0E04\u0E30 \u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E19\u0E49\u0E2D\u0E07\u0E44\u0E2D\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E44\u0E21\u0E48\u0E17\u0E31\u0E19 \u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E23\u0E2D\u0E1A\u0E19\u0E30\u0E04\u0E30\u0E04\u0E19\u0E40\u0E01\u0E48\u0E07! \u{1F495}";
        await interaction.editReply(replyText);
      } catch (err) {
        console.error("[RitzSmpAI] AI interaction error:", err);
        try {
          await interaction.editReply("\u{1F496} \u0E19\u0E49\u0E2D\u0E07\u0E44\u0E2D\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E0A\u0E48\u0E27\u0E22\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP \u0E40\u0E2A\u0E21\u0E2D\u0E40\u0E25\u0E22\u0E04\u0E48\u0E30! (\u0E04\u0E33\u0E16\u0E32\u0E21: " + question + ")");
        } catch (e) {
        }
      }
    }
  });
  client.login(token).catch((err) => {
    console.error("[RitzSmpAI] Login failed:", err);
  });
  return client;
}
function startRitzSmpAiBot() {
  return createRitzSmpAiBot();
}

// server/_core/index.ts
function isPortAvailable(port) {
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
  startDiscordStoreBot().catch((error) => {
    console.error("[DiscordBot] Failed to start:", error);
  });
  try {
    startRitzSmpAiBot();
  } catch (error) {
    console.error("[RitzSmpAI] Failed to start:", error);
  }
}
startServer().catch(console.error);

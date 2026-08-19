import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Ranks table for server rank store items
 */
export const ranks = mysqlTable("ranks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: varchar("duration", { length: 64 }).default("ถาวร").notNull(),
  color: varchar("color", { length: 32 }).default("gold").notNull(),
  badge: varchar("badge", { length: 64 }).default("POPULAR").notNull(),
  description: text("description").notNull(),
  features: text("features").notNull(), // JSON string array of perks
  roleId: varchar("roleId", { length: 64 }), // Discord role ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rank = typeof ranks.$inferSelect;
export type InsertRank = typeof ranks.$inferInsert;

/**
 * Orders table for purchases and slip uploads
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  minecraftIGN: varchar("minecraftIGN", { length: 64 }).notNull(),
  rankId: int("rankId").notNull(),
  rankName: varchar("rankName", { length: 128 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 64 }).default("PromptPay / ออมสิน").notNull(),
  slipUrl: text("slipUrl").notNull(),
  slipKey: varchar("slipKey", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["รอตรวจสอบ", "สำเร็จ", "ยกเลิก"]).default("รอตรวจสอบ").notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * User wallet balance and ledger transactions
 */
export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

export const walletTransactions = mysqlTable("wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["topup", "purchase", "refund", "admin_adjust"]).notNull(),
  description: text("description").notNull(),
  referenceKey: varchar("referenceKey", { length: 128 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

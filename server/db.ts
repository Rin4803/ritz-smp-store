import { and, count, desc, eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertOrder,
  InsertRank,
  InsertUser,
  Order,
  User,
  Rank,
  orders,
  ranks,
  users,
  wallets,
  walletTransactions,
  discordVerifications,
  DiscordVerification,
  discordVerificationCodes,
  DiscordVerificationCode,
  minecraftPresenceState,
  MinecraftPresenceState,
  ManagedServer,
  ManagedServerConfig,
  managedServers,
  managedServerConfigs,
  discordEmbedTemplates,
  healthEvents,
  DiscordEmbedTemplate,
  InsertDiscordEmbedTemplate,
  HealthEvent,
  PlayerReport,
  InsertPlayerReport,
  playerReports,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

export type PlayerReportDashboardStats = {
  total: number;
  byStatus: Array<{ status: PlayerReport["status"]; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  repeatTargets: Array<{ target: string; minecraftIGN: string | null; count: number }>;
};

let _db: ReturnType<typeof drizzle> | null = null;

const rank = (
  id: number,
  name: string,
  price: string,
  color: string,
  badge: string,
  description: string,
  features: string[],
): Rank => ({
  id,
  name,
  displayName: name,
  price,
  duration: "ถาวร",
  color,
  badge,
  description,
  features: JSON.stringify(features),
  roleId: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

/** Verified against the RitzSMP Discord rank announcement. Prices are Thai baht and all ranks are permanent. */
export const DEFAULT_RANKS: Rank[] = [
  rank(1, "VIP", "39.00", "silver", "ENTRY", "ยศเริ่มต้นสำหรับผู้สนับสนุน RitzSMP", ["/hat", "/craft", "ตั้งบ้าน 3 หลัง", "เงินในเกม 10,000", "รับเหรียญ 100 เหรียญ"]),
  rank(2, "VIP+", "79.00", "gold", "POPULAR", "อัปเกรดจาก VIP พร้อมคำสั่งอำนวยความสะดวกเพิ่มเติม", ["สิทธิ์ VIP ทั้งหมด", "/enderchest", "/feed", "ตั้งบ้าน 5 หลัง", "เงินในเกม 25,000", "รับเหรียญ 250 เหรียญ"]),
  rank(3, "Knight", "149.00", "ruby", "ADVENTURE", "ยศนักรบสำหรับผู้เล่นที่ต้องการความคล่องตัวมากขึ้น", ["สิทธิ์ VIP+ ทั้งหมด", "/ptime", "/pweather", "ตั้งบ้าน 8 หลัง", "เงินในเกม 50,000", "รับเหรียญ 450 เหรียญ"]),
  rank(4, "Elite", "249.00", "gold", "ADVANCED", "ยศระดับสูงพร้อมเครื่องมือซ่อมและจัดการไอเทม", ["สิทธิ์ Knight ทั้งหมด", "/repair", "/anvil", "ตั้งบ้าน 10 หลัง", "เงินในเกม 80,000", "รับเหรียญ 700 เหรียญ"]),
  rank(5, "Noble", "399.00", "silver", "UTILITY", "ยศผู้ดีสำหรับผู้เล่นที่ต้องการความสะดวกในการเดินทาง", ["สิทธิ์ Elite ทั้งหมด", "/back", "Backpack Lv.1", "ตั้งบ้าน 15 หลัง", "เงินในเกม 120,000", "รับเหรียญ 1,000 เหรียญ"]),
  rank(6, "Lord", "599.00", "ruby", "PRESTIGE", "ยศศักดิ์ศรีพร้อมสีแชทและ Fly ที่ Spawn", ["สิทธิ์ Noble ทั้งหมด", "Chat Color", "Fly ที่ Spawn", "ตั้งบ้าน 20 หลัง", "เงินในเกม 200,000", "รับเหรียญ 1,200 เหรียญ"]),
  rank(7, "Overlord", "899.00", "gold", "ELITE", "ยศชั้นสูงพร้อม Backpack และ Prefix ไล่สี", ["สิทธิ์ Lord ทั้งหมด", "Backpack Lv.2", "Prefix ไล่สี", "ตั้งบ้าน 30 หลัง", "เงินในเกม 350,000", "รับเหรียญ 1,350 เหรียญ"]),
  rank(8, "Mythic", "1299.00", "ruby", "MYTHIC", "ยศ Mythic พร้อม Aura และ Cosmetic พิเศษ", ["สิทธิ์ Overlord ทั้งหมด", "Aura พิเศษ", "Cosmetic พิเศษ", "ตั้งบ้าน 40 หลัง", "เงินในเกม 500,000", "รับเหรียญ 1,420 เหรียญ"]),
  rank(9, "Celestial", "1799.00", "gold", "CELESTIAL", "ยศ Celestial พร้อม Join Message และ Chat Tag", ["สิทธิ์ Mythic ทั้งหมด", "Join Message", "Chat Tag", "ตั้งบ้าน 50 หลัง", "เงินในเกม 800,000", "รับเหรียญ 1,470 เหรียญ"]),
  rank(10, "Emperor", "2499.00", "ruby", "ULTIMATE", "ยศสูงสุดสำหรับผู้สนับสนุนระดับจักรพรรดิของ RitzSMP", ["สิทธิ์ทั้งหมด", "Homes ไม่จำกัด", "Cosmetic ทุกชนิด", "Join Message พิเศษ", "เงินในเกม 1,500,000", "รับเหรียญ 1,500 เหรียญ"]),
];

export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "passwordHash", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getRanks(): Promise<Rank[]> {
  const db = await getDb();
  if (!db) return DEFAULT_RANKS;
  // Always return the updated DEFAULT_RANKS (with coin points and no keys)
  // and ensure database ranks table is upserted/synced
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
        features: r.features,
      }).onDuplicateKeyUpdate({
        set: {
          name: r.name,
          displayName: r.displayName,
          price: r.price,
          duration: r.duration,
          color: r.color,
          badge: r.badge,
          description: r.description,
          features: r.features,
        }
      });
    }
  } catch (err) {
    console.warn("[Database] Failed to sync ranks table:", err);
  }
  return DEFAULT_RANKS;
}

export async function getRankById(id: number): Promise<Rank | undefined> {
  const db = await getDb();
  if (!db) return DEFAULT_RANKS.find(rank => rank.id === id);
  const result = await db.select().from(ranks).where(eq(ranks.id, id)).limit(1);
  return result[0] ?? DEFAULT_RANKS.find(rank => rank.id === id);
}

export async function createOrder(order: InsertOrder): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(orders).values(order);
  const created = await db.select().from(orders).where(eq(orders.id, result[0].insertId)).limit(1);
  if (!created[0]) throw new Error("Order could not be created");
  return created[0];
}

export async function getOrderById(id: number): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return undefined;
  const result = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  return result[0];
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(id: number, role: User["role"]): Promise<User | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
  return getUserById(id);
}

export async function getUserByDiscordId(discordUserId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, `discord:${discordUserId}`)).limit(1);
  return result[0];
}

export async function getDiscordVerification(discordUserId: string): Promise<DiscordVerification | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(discordVerifications)
    .where(eq(discordVerifications.discordUserId, discordUserId))
    .limit(1);
  return result[0];
}

export async function getDiscordVerificationByMinecraftUuid(minecraftUuid: string): Promise<DiscordVerification | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(discordVerifications)
    .where(eq(discordVerifications.minecraftUuid, minecraftUuid))
    .limit(1);
  return result[0];
}

export async function createDiscordVerification(input: {
  discordUserId: string;
  minecraftIGN: string;
  minecraftUuid: string;
}): Promise<DiscordVerification> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(discordVerifications).values(input);
  const created = await db
    .select()
    .from(discordVerifications)
    .where(eq(discordVerifications.discordUserId, input.discordUserId))
    .limit(1);
  if (!created[0]) throw new Error("ไม่สามารถบันทึกการยืนยันตัวตนได้");
  return created[0];
}

export const DISCORD_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

export function isValidDiscordVerificationCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

export function generateDiscordVerificationCode(): string {
  return randomInt(0, 10_000).toString().padStart(4, "0");
}

export async function createDiscordVerificationCode(discordUserId: string, forceNew = false): Promise<DiscordVerificationCode> {
  if (!discordUserId) throw new Error("Discord user ID is required");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  // Check if an active unexpired, unused code already exists
  if (!forceNew) {
    const existingRows = await db.select().from(discordVerificationCodes)
      .where(eq(discordVerificationCodes.discordUserId, discordUserId)).limit(1);
    const existing = existingRows[0];
    const now = Date.now();
    if (existing && !existing.usedAt && existing.expiresAt.getTime() > now) {
      return existing; // Reuse existing active code idempotently
    }
  }

  const code = generateDiscordVerificationCode();
  const expiresAt = new Date(Date.now() + DISCORD_VERIFICATION_CODE_TTL_MS);
  await db.insert(discordVerificationCodes).values({
    discordUserId,
    code,
    expiresAt,
    usedAt: null,
  }).onDuplicateKeyUpdate({
    set: { code, expiresAt, usedAt: null },
  });
  const created = await db.select().from(discordVerificationCodes)
    .where(eq(discordVerificationCodes.discordUserId, discordUserId)).limit(1);
  if (!created[0]) throw new Error("ไม่สามารถสร้างรหัสยืนยันตัวตนได้");
  return created[0];
}

export async function cancelDiscordVerificationCode(discordUserId: string): Promise<boolean> {
  if (!discordUserId) return false;
  const db = await getDb();
  if (!db) return false;
  await db.delete(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId));
  return true;
}

export async function unlinkDiscordVerification(discordUserId: string): Promise<boolean> {
  if (!discordUserId) return false;
  const db = await getDb();
  if (!db) return false;
  await db.delete(discordVerifications).where(eq(discordVerifications.discordUserId, discordUserId));
  await db.delete(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId));
  return true;
}

export async function redeemDiscordVerificationCode(input: {
  code: string;
  minecraftIGN: string;
  minecraftUuid: string;
}): Promise<DiscordVerification> {
  if (!isValidDiscordVerificationCode(input.code)) throw new Error("รหัสยืนยันต้องเป็นตัวเลข 4 หลัก");
  if (!input.minecraftIGN || !input.minecraftUuid) throw new Error("ต้องระบุชื่อและ UUID ของ Minecraft");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  return db.transaction(async tx => {
    const codeRows = await tx.select().from(discordVerificationCodes)
      .where(eq(discordVerificationCodes.code, input.code)).limit(1);
    const codeRow = codeRows[0];
    if (!codeRow || codeRow.usedAt || codeRow.expiresAt.getTime() <= Date.now()) {
      throw new Error("รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว");
    }

    const discordRows = await tx.select().from(discordVerifications)
      .where(eq(discordVerifications.discordUserId, codeRow.discordUserId)).limit(1);
    const minecraftRows = await tx.select().from(discordVerifications)
      .where(eq(discordVerifications.minecraftUuid, input.minecraftUuid)).limit(1);
    const existingDiscord = discordRows[0];
    const existingMinecraft = minecraftRows[0];
    if (existingMinecraft && existingMinecraft.discordUserId !== codeRow.discordUserId) {
      throw new Error("Minecraft บัญชีนี้เชื่อมกับ Discord อื่นแล้ว");
    }
    if (existingDiscord && existingDiscord.minecraftUuid !== input.minecraftUuid) {
      throw new Error("Discord บัญชีนี้เชื่อมกับ Minecraft อื่นแล้ว");
    }

    const now = new Date();
    if (!existingDiscord) {
      await tx.insert(discordVerifications).values({
        discordUserId: codeRow.discordUserId,
        minecraftIGN: input.minecraftIGN.slice(0, 16),
        minecraftUuid: input.minecraftUuid,
        verifiedAt: now,
        updatedAt: now,
      });
    }
    await tx.update(discordVerificationCodes).set({ usedAt: now }).where(eq(discordVerificationCodes.id, codeRow.id));
    const linkedRows = await tx.select().from(discordVerifications)
      .where(eq(discordVerifications.discordUserId, codeRow.discordUserId)).limit(1);
    if (!linkedRows[0]) throw new Error("ไม่สามารถบันทึกการเชื่อมบัญชีได้");
    return linkedRows[0];
  });
}

export async function updateDiscordProfile(
  discordUserId: string,
  input: { bio?: string | null; playStyle?: string | null },
): Promise<DiscordVerification | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const updates: { bio?: string | null; playStyle?: string | null } = {};
  if (input.bio !== undefined) updates.bio = input.bio;
  if (input.playStyle !== undefined) updates.playStyle = input.playStyle;
  if (Object.keys(updates).length > 0) {
    await db.update(discordVerifications).set(updates).where(eq(discordVerifications.discordUserId, discordUserId));
  }
  return getDiscordVerification(discordUserId);
}

export async function getMinecraftPresenceState(): Promise<MinecraftPresenceState | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(minecraftPresenceState)
    .where(eq(minecraftPresenceState.id, 1))
    .limit(1);
  return result[0];
}

export async function saveMinecraftPresenceState(input: {
  scheduleCronTaskUid?: string | null;
  lastOnline: boolean;
  playerListKnown: boolean;
  lastPlayerNames: string[];
  lastCheckedAt?: Date;
}): Promise<MinecraftPresenceState> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await getMinecraftPresenceState();
  const values = {
    id: 1,
    scheduleCronTaskUid: input.scheduleCronTaskUid !== undefined
      ? input.scheduleCronTaskUid
      : existing?.scheduleCronTaskUid ?? null,
    lastOnline: input.lastOnline ? 1 : 0,
    playerListKnown: input.playerListKnown ? 1 : 0,
    lastPlayerNames: JSON.stringify(input.lastPlayerNames),
    lastCheckedAt: input.lastCheckedAt ?? new Date(),
  };
  await db.insert(minecraftPresenceState).values(values).onDuplicateKeyUpdate({
    set: {
      scheduleCronTaskUid: values.scheduleCronTaskUid,
      lastOnline: values.lastOnline,
      playerListKnown: values.playerListKnown,
      lastPlayerNames: values.lastPlayerNames,
      lastCheckedAt: values.lastCheckedAt,
    },
  });
  const saved = await getMinecraftPresenceState();
  if (!saved) throw new Error("Minecraft presence state could not be saved");
  return saved;
}

export async function setMinecraftPresenceScheduleTaskUid(taskUid: string): Promise<MinecraftPresenceState> {
  const existing = await getMinecraftPresenceState();
  return saveMinecraftPresenceState({
    scheduleCronTaskUid: taskUid,
    lastOnline: Boolean(existing?.lastOnline),
    playerListKnown: Boolean(existing?.playerListKnown),
    lastPlayerNames: parsePresenceNames(existing?.lastPlayerNames),
    lastCheckedAt: existing?.lastCheckedAt ?? new Date(),
  });
}

function parsePresenceNames(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string") : [];
  } catch {
    return [];
  }
}

export async function ensureDiscordUser(discordUserId: string, displayName: string): Promise<User> {
  const openId = `discord:${discordUserId}`;
  await upsertUser({
    openId,
    name: displayName,
    loginMethod: "discord",
    role: "user",
  });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Discord user could not be created");
  return user;
}

export async function getOrdersByUser(userId: number): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getAllOrders(): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function updateOrder(id: number, status: Order["status"], adminNotes?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(orders).set({ status, adminNotes: adminNotes ?? null }).where(eq(orders.id, id));
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function countOrdersByStatus(status: Order["status"]) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(orders).where(eq(orders.status, status));
  return result.length;
}

export async function getUserWallet(userId: number) {
  const db = await getDb();
  if (!db) return { userId, balance: "0.00" };
  const res = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (res[0]) return res[0];
  await db.insert(wallets).values({ userId, balance: "0.00" }).onDuplicateKeyUpdate({ set: { userId } });
  const created = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return created[0] ?? { userId, balance: "0.00" };
}

export async function adjustUserBalance(
  userId: number,
  amount: number,
  type: "topup" | "purchase" | "refund" | "admin_adjust",
  description: string,
  referenceKey?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (!Number.isFinite(amount) || Math.round(amount * 100) !== amount * 100) {
    throw new Error("จำนวนเงินไม่ถูกต้อง");
  }

  return db.transaction(async tx => {
    await tx.insert(wallets).values({ userId, balance: "0.00" }).onDuplicateKeyUpdate({ set: { userId } });

    if (referenceKey) {
      const inserted = await tx
        .insert(walletTransactions)
        .values({ userId, amount: String(amount), type, description, referenceKey })
        .onDuplicateKeyUpdate({ set: { id: sql`${walletTransactions.id}` } });
      const affectedRows = Number((inserted as any)?.[0]?.affectedRows ?? 0);
      if (affectedRows === 0) {
        const existing = await tx
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.referenceKey, referenceKey))
          .limit(1);
        const existingTransaction = existing[0];
        if (existingTransaction?.userId !== userId) {
          throw new Error("รายการกระเป๋าเงินอ้างอิงซ้ำกับผู้ใช้อื่น");
        }
        if (
          !existingTransaction
          || Number(existingTransaction.amount) !== amount
          || existingTransaction.type !== type
        ) {
          throw new Error("referenceKey ถูกใช้กับรายการกระเป๋าเงินคนละรายการ");
        }
        const current = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
        return { userId, newBalance: Number(current[0]?.balance) || 0, alreadyApplied: true };
      }
    }

    const updated = await tx
      .update(wallets)
      .set({ balance: sql`${wallets.balance} + ${amount}` })
      .where(and(eq(wallets.userId, userId), sql`${wallets.balance} + ${amount} >= 0`));
    const affectedRows = Number((updated as any)?.[0]?.affectedRows ?? 0);
    if (affectedRows === 0) {
      throw new Error("ยอดเงินในบัญชีไม่พอสำหรับการทำรายการ");
    }

    if (!referenceKey) {
      await tx.insert(walletTransactions).values({
        userId,
        amount: String(amount),
        type,
        description,
      });
    }

    const current = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    return { userId, newBalance: Number(current[0]?.balance) || 0, alreadyApplied: false };
  });
}

export async function getUserWalletTransactions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt));
}

export async function insertRank(rank: InsertRank) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.insert(ranks).values(rank);
}

export async function getManagedServers(): Promise<ManagedServer[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(managedServers).orderBy(desc(managedServers.displayName));
}

export async function getEnabledManagedServers(): Promise<ManagedServer[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(managedServers).where(eq(managedServers.enabled, 1)).orderBy(desc(managedServers.displayName));
}

export async function getManagedServerById(id: number): Promise<ManagedServer | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(managedServers).where(eq(managedServers.id, id)).limit(1);
  return result[0];
}

export async function getManagedServerConfig(serverId: number): Promise<ManagedServerConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(managedServerConfigs).where(eq(managedServerConfigs.managedServerId, serverId)).limit(1);
  return result[0];
}

export async function createManagedServer(input: {
  slug: string;
  displayName: string;
  minecraftHost: string;
  minecraftPort: number;
  discordGuildId?: string | null;
  enabled?: boolean;
  config: {
    discordTokenEnv?: string | null;
    rconHost?: string | null;
    rconPort?: number | null;
    rconPasswordEnv?: string | null;
    channelConfig: string;
  };
}): Promise<ManagedServer> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const inserted = await tx.insert(managedServers).values({
      slug: input.slug,
      displayName: input.displayName,
      minecraftHost: input.minecraftHost,
      minecraftPort: input.minecraftPort,
      discordGuildId: input.discordGuildId ?? null,
      enabled: input.enabled === false ? 0 : 1,
    });
    const serverId = Number(inserted[0].insertId);
    await tx.insert(managedServerConfigs).values({
      managedServerId: serverId,
      discordTokenEnv: input.config.discordTokenEnv ?? null,
      rconHost: input.config.rconHost ?? null,
      rconPort: input.config.rconPort ?? null,
      rconPasswordEnv: input.config.rconPasswordEnv ?? null,
      channelConfig: input.config.channelConfig,
    });
    const created = await tx.select().from(managedServers).where(eq(managedServers.id, serverId)).limit(1);
    if (!created[0]) throw new Error("ไม่สามารถสร้างเซิร์ฟเวอร์ได้");
    return created[0];
  });
}

export async function updateManagedServer(input: {
  id: number;
  displayName: string;
  minecraftHost: string;
  minecraftPort: number;
  discordGuildId?: string | null;
  enabled: boolean;
  config: {
    discordTokenEnv?: string | null;
    rconHost?: string | null;
    rconPort?: number | null;
    rconPasswordEnv?: string | null;
    channelConfig: string;
  };
}): Promise<ManagedServer | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.transaction(async tx => {
    await tx.update(managedServers).set({
      displayName: input.displayName,
      minecraftHost: input.minecraftHost,
      minecraftPort: input.minecraftPort,
      discordGuildId: input.discordGuildId ?? null,
      enabled: input.enabled ? 1 : 0,
    }).where(eq(managedServers.id, input.id));
    await tx.insert(managedServerConfigs).values({
      managedServerId: input.id,
      discordTokenEnv: input.config.discordTokenEnv ?? null,
      rconHost: input.config.rconHost ?? null,
      rconPort: input.config.rconPort ?? null,
      rconPasswordEnv: input.config.rconPasswordEnv ?? null,
      channelConfig: input.config.channelConfig,
    }).onDuplicateKeyUpdate({ set: {
      discordTokenEnv: input.config.discordTokenEnv ?? null,
      rconHost: input.config.rconHost ?? null,
      rconPort: input.config.rconPort ?? null,
      rconPasswordEnv: input.config.rconPasswordEnv ?? null,
      channelConfig: input.config.channelConfig,
    }});
  });
  return getManagedServerById(input.id);
}


export async function listDiscordEmbedTemplates(guildId: string): Promise<DiscordEmbedTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discordEmbedTemplates)
    .where(eq(discordEmbedTemplates.guildId, guildId))
    .orderBy(desc(discordEmbedTemplates.updatedAt));
}

export async function getDiscordEmbedTemplate(guildId: string, name: string): Promise<DiscordEmbedTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(discordEmbedTemplates)
    .where(and(eq(discordEmbedTemplates.guildId, guildId), eq(discordEmbedTemplates.name, name)))
    .limit(1);
  return rows[0];
}

export async function createDiscordEmbedTemplate(input: InsertDiscordEmbedTemplate): Promise<DiscordEmbedTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const inserted = await db.insert(discordEmbedTemplates).values(input);
  const rows = await db.select().from(discordEmbedTemplates)
    .where(eq(discordEmbedTemplates.id, Number(inserted[0].insertId))).limit(1);
  if (!rows[0]) throw new Error("ไม่สามารถบันทึก Embed Template ได้");
  return rows[0];
}

export async function updateDiscordEmbedTemplate(
  guildId: string,
  name: string,
  patch: Partial<Pick<InsertDiscordEmbedTemplate, "title" | "description" | "color" | "imageUrl" | "footer" | "defaultChannelId" | "updatedBy">>,
): Promise<DiscordEmbedTemplate | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(discordEmbedTemplates).set(patch)
    .where(and(eq(discordEmbedTemplates.guildId, guildId), eq(discordEmbedTemplates.name, name)));
  return getDiscordEmbedTemplate(guildId, name);
}

export async function deleteDiscordEmbedTemplate(guildId: string, name: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.delete(discordEmbedTemplates)
    .where(and(eq(discordEmbedTemplates.guildId, guildId), eq(discordEmbedTemplates.name, name)));
  return Number(result[0].affectedRows ?? 0) > 0;
}

export async function recordHealthEvent(input: {
  service: string;
  status: HealthEvent["status"];
  message: string;
  metadata?: Record<string, unknown>;
  guildId?: string | null;
}): Promise<HealthEvent | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const inserted = await db.insert(healthEvents).values({
    service: input.service,
    status: input.status,
    message: input.message,
    metadata: JSON.stringify(input.metadata ?? {}),
    guildId: input.guildId ?? null,
  });
  const rows = await db.select().from(healthEvents)
    .where(eq(healthEvents.id, Number(inserted[0].insertId))).limit(1);
  return rows[0];
}

export async function getRecentHealthEvents(input?: { service?: string; limit?: number }): Promise<HealthEvent[]> {
  const db = await getDb();
  if (!db) return [];
  const condition = input?.service ? eq(healthEvents.service, input.service) : undefined;
  const limit = Math.max(1, Math.min(input?.limit ?? 20, 100));
  const query = db.select().from(healthEvents).orderBy(desc(healthEvents.createdAt)).limit(limit);
  return condition ? query.where(condition) : query;
}

export type CreatePlayerReportInput = Omit<InsertPlayerReport, "id" | "createdAt" | "updatedAt" | "editCount" | "status"> & {
  status?: PlayerReport["status"];
};

export async function createPlayerReport(input: CreatePlayerReportInput): Promise<PlayerReport> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(playerReports).values({
    ...input,
    status: input.status ?? "ใหม่",
    editCount: 0,
  });
  const created = await db.select().from(playerReports).where(eq(playerReports.id, result[0].insertId)).limit(1);
  if (!created[0]) throw new Error("ไม่สามารถสร้างรายงานได้");
  return created[0];
}

export async function getPlayerReportById(id: number): Promise<PlayerReport | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(playerReports).where(eq(playerReports.id, id)).limit(1);
  return rows[0];
}
export async function getLinkedDiscordVerifications(): Promise<DiscordVerification[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discordVerifications).orderBy(desc(discordVerifications.minecraftIGN));
}
export async function getLatestPlayerReportByReporter(reporterDiscordId: string): Promise<PlayerReport | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(playerReports)
    .where(eq(playerReports.reporterDiscordId, reporterDiscordId))
    .orderBy(desc(playerReports.createdAt)).limit(1);
  return rows[0];
}

export async function getPlayerReportDashboardStats(): Promise<PlayerReportDashboardStats> {
  const db = await getDb();
  if (!db) return { total: 0, byStatus: [], byCategory: [], repeatTargets: [] };

  const [totalRows, statusRows, categoryRows, targetRows] = await Promise.all([
    db.select({ count: count() }).from(playerReports),
    db.select({ status: playerReports.status, count: count() }).from(playerReports).groupBy(playerReports.status),
    db.select({ category: playerReports.category, count: count() }).from(playerReports).groupBy(playerReports.category).orderBy(desc(sql`count(*)`)),
    db.select({ target: playerReports.targetDiscordName, minecraftIGN: playerReports.targetMinecraftIGN, count: count() })
      .from(playerReports)
      .groupBy(playerReports.targetDiscordName, playerReports.targetMinecraftIGN)
      .having(sql`count(*) > 1`)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
  ]);

  return {
    total: Number(totalRows[0]?.count ?? 0),
    byStatus: statusRows.map(row => ({ status: row.status, count: Number(row.count) })),
    byCategory: categoryRows.map(row => ({ category: row.category, count: Number(row.count) })),
    repeatTargets: targetRows.map(row => ({ target: row.target, minecraftIGN: row.minecraftIGN, count: Number(row.count) })),
  };
}

export async function updatePlayerReportCaseChannel(input: {
  id: number;
  caseChannelId: string;
  caseCategoryId?: string | null;
}): Promise<PlayerReport | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.update(playerReports)
    .set({
      caseChannelId: input.caseChannelId.slice(0, 64),
      caseCategoryId: input.caseCategoryId ? input.caseCategoryId.slice(0, 64) : null,
      updatedAt: new Date(),
    })
    .where(and(eq(playerReports.id, input.id), sql`${playerReports.caseChannelId} IS NULL`));
  if (!result[0].affectedRows) return getPlayerReportById(input.id);
  return getPlayerReportById(input.id);
}

export async function updatePlayerReportStatus(input: {
  id: number;
  status: Extract<PlayerReport["status"], "กำลังตรวจสอบ" | "ปิดแล้ว">;
  handledByDiscordId: string;
  handledByDisplayName: string;
}): Promise<PlayerReport | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = await getPlayerReportById(input.id);
  if (!current) return undefined;
  const validTransition = input.status === "กำลังตรวจสอบ"
    ? current.status === "ใหม่"
    : current.status === "กำลังตรวจสอบ";
  if (!validTransition) return undefined;
  const now = new Date();
  const result = await db.update(playerReports)
    .set({
      status: input.status,
      handledByDiscordId: input.handledByDiscordId,
      handledByDisplayName: input.handledByDisplayName.slice(0, 128),
      handledAt: current.handledAt ?? now,
      closedAt: input.status === "ปิดแล้ว" ? now : current.closedAt,
      updatedAt: now,
    })
    .where(and(eq(playerReports.id, input.id), eq(playerReports.status, current.status)));
  if (!result[0].affectedRows) return undefined;
  return getPlayerReportById(input.id);
}

export async function updatePlayerReportOnce(input: {
  id: number;
  reporterDiscordId: string;
  category: string;
  details: string;
}): Promise<PlayerReport | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.update(playerReports)
    .set({ category: input.category, details: input.details, editCount: 1, updatedAt: new Date() })
    .where(and(
      eq(playerReports.id, input.id),
      eq(playerReports.reporterDiscordId, input.reporterDiscordId),
      eq(playerReports.editCount, 0),
    ));
  if (!result[0].affectedRows) return undefined;
  return getPlayerReportById(input.id);
}

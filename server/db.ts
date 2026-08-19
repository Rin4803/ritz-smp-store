import { desc, eq } from "drizzle-orm";
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
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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
  rank(1, "VIP", "39.00", "silver", "ENTRY", "ยศเริ่มต้นสำหรับผู้สนับสนุน RitzSMP", ["/hat", "/craft", "ตั้งบ้าน 3 หลัง", "เงินในเกม 10,000", "Common Key ×3"]),
  rank(2, "VIP+", "79.00", "gold", "POPULAR", "อัปเกรดจาก VIP พร้อมคำสั่งอำนวยความสะดวกเพิ่มเติม", ["สิทธิ์ VIP ทั้งหมด", "/enderchest", "/feed", "ตั้งบ้าน 5 หลัง", "เงินในเกม 25,000", "Common Key ×5", "Rare Key ×1"]),
  rank(3, "Knight", "149.00", "ruby", "ADVENTURE", "ยศนักรบสำหรับผู้เล่นที่ต้องการความคล่องตัวมากขึ้น", ["สิทธิ์ VIP+ ทั้งหมด", "/ptime", "/pweather", "ตั้งบ้าน 8 หลัง", "เงินในเกม 50,000", "Common Key ×8", "Rare Key ×3"]),
  rank(4, "Elite", "249.00", "gold", "ADVANCED", "ยศระดับสูงพร้อมเครื่องมือซ่อมและจัดการไอเทม", ["สิทธิ์ Knight ทั้งหมด", "/repair", "/anvil", "ตั้งบ้าน 10 หลัง", "เงินในเกม 80,000", "Rare Key ×5", "Epic Key ×2"]),
  rank(5, "Noble", "399.00", "silver", "UTILITY", "ยศผู้ดีสำหรับผู้เล่นที่ต้องการความสะดวกในการเดินทาง", ["สิทธิ์ Elite ทั้งหมด", "/back", "Backpack Lv.1", "ตั้งบ้าน 15 หลัง", "เงินในเกม 120,000", "Rare Key ×8", "Epic Key ×5"]),
  rank(6, "Lord", "599.00", "ruby", "PRESTIGE", "ยศศักดิ์ศรีพร้อมสีแชทและ Fly ที่ Spawn", ["สิทธิ์ Noble ทั้งหมด", "Chat Color", "Fly ที่ Spawn", "ตั้งบ้าน 20 หลัง", "เงินในเกม 200,000", "Epic Key ×8", "Legendary Key ×2"]),
  rank(7, "Overlord", "899.00", "gold", "ELITE", "ยศชั้นสูงพร้อม Backpack และ Prefix ไล่สี", ["สิทธิ์ Lord ทั้งหมด", "Backpack Lv.2", "Prefix ไล่สี", "ตั้งบ้าน 30 หลัง", "เงินในเกม 350,000", "Epic Key ×10", "Legendary Key ×5"]),
  rank(8, "Mythic", "1299.00", "ruby", "MYTHIC", "ยศ Mythic พร้อม Aura และ Cosmetic พิเศษ", ["สิทธิ์ Overlord ทั้งหมด", "Aura พิเศษ", "Cosmetic พิเศษ", "ตั้งบ้าน 40 หลัง", "เงินในเกม 500,000", "Legendary Key ×10", "Mythic Key ×3"]),
  rank(9, "Celestial", "1799.00", "gold", "CELESTIAL", "ยศ Celestial พร้อม Join Message และ Chat Tag", ["สิทธิ์ Mythic ทั้งหมด", "Join Message", "Chat Tag", "ตั้งบ้าน 50 หลัง", "เงินในเกม 800,000", "Legendary Key ×15", "Mythic Key ×8"]),
  rank(10, "Emperor", "2499.00", "ruby", "ULTIMATE", "ยศสูงสุดสำหรับผู้สนับสนุนระดับจักรพรรดิของ RitzSMP", ["สิทธิ์ทั้งหมด", "Homes ไม่จำกัด", "Cosmetic ทุกชนิด", "Join Message พิเศษ", "เงินในเกม 1,500,000", "Mythic Key ×20", "Emperor Key ×5"]),
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
  const textFields = ["name", "email", "loginMethod"] as const;

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
  const result = await db.select().from(ranks);
  const catalog = result.length ? result : DEFAULT_RANKS;
  return [...catalog].sort((left, right) => left.id - right.id);
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

export async function getUserByDiscordId(discordUserId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, `discord:${discordUserId}`)).limit(1);
  return result[0];
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

export async function insertRank(rank: InsertRank) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.insert(ranks).values(rank);
}

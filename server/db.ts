import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertOrder,
  InsertRank,
  InsertUser,
  Order,
  Rank,
  orders,
  ranks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export const DEFAULT_RANKS: Rank[] = [
  {
    id: 1,
    name: "starter",
    displayName: "Ritz Starter",
    price: "0.00",
    duration: "ถาวร",
    color: "silver",
    badge: "TEMPLATE",
    description: "โครงสร้างยศสำหรับเริ่มต้นปรับแต่งตามเซิร์ฟเวอร์จริง",
    features: JSON.stringify(["กำหนดชื่อยศในเกม", "ปรับราคาได้จากข้อมูลจริง", "รองรับคำสั่ง LuckPerms"]),
    roleId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: 2,
    name: "elite",
    displayName: "Ritz Elite",
    price: "0.00",
    duration: "ถาวร",
    color: "gold",
    badge: "POPULAR",
    description: "ยศระดับกลางสำหรับสิทธิ์พิเศษในเซิร์ฟเวอร์",
    features: JSON.stringify(["สิทธิ์พิเศษในเกม", "คิวเข้าเซิร์ฟเวอร์ที่ดีขึ้น", "ป้ายชื่อสีทอง"]),
    roleId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: 3,
    name: "royal",
    displayName: "Ritz Royal",
    price: "0.00",
    duration: "ถาวร",
    color: "ruby",
    badge: "PREMIUM",
    description: "ยศพรีเมียมสำหรับผู้สนับสนุนหลักของ RitzSMP",
    features: JSON.stringify(["สิทธิ์พรีเมียมทั้งหมด", "คำสั่งเฉพาะยศ", "ป้ายชื่อสีแดงรูบี้"]),
    roleId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
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
  return result.length ? result : DEFAULT_RANKS;
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

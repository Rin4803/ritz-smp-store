import { afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { ranks, orders } from "../drizzle/schema";

type User = NonNullable<TrpcContext["user"]>;

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({
    key: "orders/7/test-slip.png",
    url: "https://example.com/storage/test-slip.png",
  })),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(async () => true),
}));

function createTestContext(role: User["role"] = "user"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: role === "admin" ? 99 : 7,
      openId: `${role}-test-openId`,
      email: `${role}@ritzsmp.test`,
      name: role === "admin" ? "Ritz Admin" : "Ritz Player",
      loginMethod: "test",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

const TEST_IGN = "__ritzsmp_vitest__";

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  await db.delete(orders).where(eq(orders.minecraftIGN, TEST_IGN));
  await db.delete(ranks).where(eq(ranks.id, 999));
});

describe("RitzSMP Order Success Path & Admin Workflow", () => {
  it("allows a user to create an order successfully when valid priced rank and slip are provided", async () => {
    const db = await getDb();
    if (db) {
      await db.insert(ranks).values({
        id: 999,
        name: "test-elite",
        displayName: "Ritz Test Elite",
        price: "150.00",
        duration: "ถาวร",
        color: "gold",
        badge: "TEST",
        description: "Test Rank",
        features: JSON.stringify(["Feature 1"]),
      }).onDuplicateKeyUpdate({ set: { price: "150.00" } });
    }

    const caller = appRouter.createCaller(createTestContext("user"));
    const dummyBytes = Buffer.alloc(200, 99);
    const validBase64Slip = "data:image/png;base64," + dummyBytes.toString("base64");

    const result = await caller.store.createOrder({
      rankId: 999,
      minecraftIGN: TEST_IGN,
      paymentMethod: "PromptPay",
      slipData: validBase64Slip,
      slipName: "test-slip.png",
      slipType: "image/png",
    });

    expect(result).toHaveProperty("order");
    expect(result.order).toMatchObject({
      minecraftIGN: TEST_IGN,
      paymentMethod: "PromptPay",
      status: "รอตรวจสอบ",
    });
    expect(result.order.slipUrl).toContain("test-slip.png");
  });

  it("allows admin to update order status once an order exists", async () => {
    const db = await getDb();
    let orderId = 1;
    if (db) {
      const res = await db.insert(orders).values({
        userId: 7,
        minecraftIGN: TEST_IGN,
        rankId: 999,
        rankName: "Ritz Test Elite",
        amount: "150.00",
        paymentMethod: "PromptPay",
        slipUrl: "https://example.com/slip.png",
        slipKey: "slip.png",
        status: "รอตรวจสอบ",
      });
      orderId = res[0].insertId;
    }

    const adminCaller = appRouter.createCaller(createTestContext("admin"));
    const updated = await adminCaller.admin.updateOrderStatus({
      id: orderId,
      status: "สำเร็จ",
      adminNotes: "ตรวจสอบสลิปเรียบร้อย มอบยศในเกมแล้ว",
    });
    expect(updated).toMatchObject({
      status: "สำเร็จ",
      adminNotes: "ตรวจสอบสลิปเรียบร้อย มอบยศในเกมแล้ว",
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;

vi.mock("./db", () => ({
  getRankById: vi.fn(async () => ({
    id: 999,
    name: "test-elite",
    displayName: "Ritz Test Elite",
    price: "150.00",
    duration: "ถาวร",
    color: "gold",
    badge: "TEST",
    description: "Test Rank",
    features: JSON.stringify(["Feature 1"]),
    roleId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })),
  createOrder: vi.fn(async (input: Record<string, unknown>) => ({
    id: 5001,
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  updateOrder: vi.fn(async (id: number, status: string, adminNotes?: string | null) => ({
    id,
    userId: 7,
    minecraftIGN: "RitzWarrior",
    rankId: 999,
    rankName: "Ritz Test Elite",
    amount: "150.00",
    paymentMethod: "PromptPay",
    slipUrl: "https://example.com/slip.png",
    slipKey: "slip.png",
    status,
    adminNotes: adminNotes ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  getRanks: vi.fn(async () => []),
  getAllOrders: vi.fn(async () => []),
  getOrdersByUser: vi.fn(async () => []),
  getOrderById: vi.fn(async (id: number) => ({
    id,
    userId: 7,
    minecraftIGN: "RitzWarrior",
    rankId: 999,
    rankName: "Ritz Test Elite",
    amount: "150.00",
    paymentMethod: "PromptPay",
    slipUrl: "https://example.com/slip.png",
    slipKey: "slip.png",
    status: "รอตรวจสอบ",
    adminNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  getUserWallet: vi.fn(async () => ({ userId: 7, balance: "500.00" })),
  getUserWalletTransactions: vi.fn(async () => []),
  adjustUserBalance: vi.fn(async () => ({})),
}));

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

describe("RitzSMP Order Success Path & Admin Workflow", () => {
  it("allows a user to create an order successfully with a valid priced rank and slip", async () => {
    const caller = appRouter.createCaller(createTestContext("user"));
    const dummyBytes = Buffer.alloc(200, 99);
    const validBase64Slip = "data:image/png;base64," + dummyBytes.toString("base64");

    const result = await caller.store.createOrder({
      rankId: 999,
      minecraftIGN: "RitzWarrior",
      paymentMethod: "PromptPay",
      slipData: validBase64Slip,
      slipName: "test-slip.png",
      slipType: "image/png",
    });

    expect(result).toHaveProperty("order");
    expect(result.order).toMatchObject({
      minecraftIGN: "RitzWarrior",
      paymentMethod: "PromptPay",
      status: "รอตรวจสอบ",
    });
    expect(result.order.slipUrl).toContain("test-slip.png");
  });

  it("allows an admin to update an order status without a database write", async () => {
    const adminCaller = appRouter.createCaller(createTestContext("admin"));
    const updated = await adminCaller.admin.updateOrderStatus({
      id: 5001,
      status: "สำเร็จ",
      adminNotes: "ตรวจสอบสลิปเรียบร้อย มอบยศในเกมแล้ว",
    });

    expect(updated).toMatchObject({
      status: "สำเร็จ",
      adminNotes: "ตรวจสอบสลิปเรียบร้อย มอบยศในเกมแล้ว",
    });
  });
});

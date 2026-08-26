import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { Rcon } from "rcon-client";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;

vi.mock("./_core/env", () => ({
  ENV: {
    rconHost: "127.0.0.1",
    rconPort: 25575,
    rconPassword: "test-rcon-password",
  },
}));

vi.mock("rcon-client", () => ({
  Rcon: {
    connect: vi.fn(async () => ({
      send: vi.fn(async () => "OK"),
      end: vi.fn(async () => undefined),
    })),
  },
}));

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
  getUserById: vi.fn(async () => ({ id: 7, name: "Ritz Player", email: "user@ritzsmp.test", openId: "user-test-openId" })),
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
  adjustUserBalance: vi.fn(async () => ({ userId: 7, newBalance: 650, alreadyApplied: false })),
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

vi.mock("./discordNotifications", () => ({
  notifyTopupSubmitted: vi.fn(async () => ({ sent: true, channelId: "donate-log" })),
  notifyPurchaseCompleted: vi.fn(async () => ({ sent: true, channelId: "support" })),
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
  it("allows a user to create a topup request successfully with a valid slip", async () => {
    const caller = appRouter.createCaller(createTestContext("user"));
    const dummyBytes = Buffer.alloc(200, 99);
    const validBase64Slip = "data:image/png;base64," + dummyBytes.toString("base64");

    const result = await caller.store.createTopup({
      amount: 150,
      paymentMethod: "PromptPay",
      slipData: validBase64Slip,
      slipName: "topup-slip.png",
      slipType: "image/png",
    });

    expect(result).toHaveProperty("order");
    expect(result.order).toMatchObject({
      amount: "150.00",
      paymentMethod: "PromptPay",
      status: "รอตรวจสอบ",
    });
    expect(result.order.slipUrl).toBeTruthy();
    expect(result.discordNotification).toMatchObject({ sent: true, channelId: "donate-log" });
  });

  it("broadcasts a successful wallet purchase to the Discord support channel", async () => {
    const caller = appRouter.createCaller(createTestContext("user"));
    const result = await caller.store.purchaseRank({ rankId: 999, minecraftIGN: "RitzWarrior" });
    expect(result.order.status).toBe("สำเร็จ");
    expect(result.discordNotification).toMatchObject({ sent: true, channelId: "support" });
  });

  it("keeps a wallet purchase pending when RCON fulfillment fails", async () => {
    vi.mocked(Rcon.connect).mockRejectedValueOnce(new Error("เชื่อมต่อ RCON ไม่ได้"));
    const caller = appRouter.createCaller(createTestContext("user"));

    const result = await caller.store.purchaseRank({ rankId: 999, minecraftIGN: "RitzWarrior" });

    expect(result.rconExecuted).toBe(false);
    expect(result.order.status).toBe("รอตรวจสอบ");
    expect(result.order.adminNotes).toContain("RCON ไม่สำเร็จ");
    expect(result.discordNotification).toMatchObject({ sent: true, channelId: "support" });
  });

  it("allows an admin to approve a rank order and fulfills both rank and coins", async () => {
    vi.mocked(Rcon.connect).mockClear();
    const adminCaller = appRouter.createCaller(createTestContext("admin"));
    const updated = await adminCaller.admin.updateOrderStatus({
      id: 5001,
      status: "สำเร็จ",
      adminNotes: "ตรวจสอบสลิปเรียบร้อย มอบยศในเกมแล้ว",
    });

    expect(updated).toMatchObject({
      status: "สำเร็จ",
      adminNotes: expect.stringContaining("ตรวจสอบสลิปเรียบร้อย มอบยศในเกมแล้ว"),
    });
    expect(Rcon.connect).toHaveBeenCalledTimes(1);
    const connection = await vi.mocked(Rcon.connect).mock.results[0]?.value;
    expect(connection.send).toHaveBeenNthCalledWith(1, "lp user RitzWarrior parent add test-elite");
    expect(connection.send).toHaveBeenNthCalledWith(2, "points give RitzWarrior 1500");
  });

  it("verifies wallet balance procedure execution", async () => {
    const userCaller = appRouter.createCaller(createTestContext("user"));
    const wallet = await userCaller.store.wallet();
    expect(wallet).toHaveProperty("balance", "500.00");
    expect(wallet.transactions).toEqual([]);
  });
});

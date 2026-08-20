import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;

vi.mock("./db", () => ({
  getDb: vi.fn(async () => {
    throw new Error("Real database access is forbidden in unit tests");
  }),
  getOrderById: vi.fn(async (id: number) => {
    if (id === 1) {
      return {
        id: 1,
        userId: 7,
        minecraftIGN: "TestPlayer",
        rankId: 1,
        rankName: "VIP",
        amount: "39.00",
        paymentMethod: "PromptPay",
        status: "รอตรวจสอบ",
        slipUrl: "https://example.com/slip.jpg",
        slipKey: "slip.jpg",
        adminNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return null;
  }),
  updateOrder: vi.fn(async (id: number, status: string, notes: string) => ({
    id,
    status,
    adminNotes: notes,
    minecraftIGN: "TestPlayer",
  })),
  getRankById: vi.fn(async () => ({
    id: 1,
    name: "VIP",
    displayName: "VIP",
    price: "39.00",
  })),
}));

function createContext(role: User["role"] = "user"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: role === "admin" ? 99 : 7,
      openId: `${role}-security-user`,
      email: `${role}@example.com`,
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

describe("RitzSMP Security & Permission Regression Tests", () => {
  it("forbids regular users from calling admin order listing", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.admin.orders()).rejects.toThrow();
  });

  it("forbids regular users from calling admin order status updates", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(
      caller.admin.updateOrderStatus({
        id: 1,
        status: "สำเร็จ",
        adminNotes: "Unauthorized approval attempt",
      }),
    ).rejects.toThrow();
  });

  it("handles non-existent order updates gracefully with NOT_FOUND error for admin", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(
      caller.admin.updateOrderStatus({
        id: 9999,
        status: "สำเร็จ",
      }),
    ).rejects.toThrow("ไม่พบออเดอร์");
  });
});

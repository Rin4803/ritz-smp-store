import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";

type User = NonNullable<TrpcContext["user"]>;

vi.mock("./db", () => {
  const names = ["VIP", "VIP+", "Knight", "Elite", "Noble", "Lord", "Overlord", "Mythic", "Celestial", "Emperor"];
  const prices = [39, 79, 149, 249, 399, 599, 899, 1299, 1799, 2499];
  const catalog = names.map((displayName, index) => ({
    id: index + 1,
    name: displayName,
    displayName,
    price: prices[index].toFixed(2),
    duration: "ถาวร",
    color: index % 3 === 0 ? "silver" : index % 3 === 1 ? "gold" : "ruby",
    badge: index === 1 ? "POPULAR" : "CATALOG",
    description: `ยศ ${displayName} สำหรับผู้สนับสนุน RitzSMP`,
    features: JSON.stringify(["สิทธิ์พิเศษในเกม"]),
    roleId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));

  return {
    getDb: vi.fn(async () => {
      throw new Error("Real database access is forbidden in unit tests");
    }),
    getRanks: vi.fn(async () => catalog),
    getRankById: vi.fn(async (id: number) => catalog.find(rank => rank.id === id)),
    getOrdersByUser: vi.fn(async () => []),
    getAllOrders: vi.fn(async () => []),
    createOrder: vi.fn(),
    updateOrder: vi.fn(),
  };
});

function createContext(role: User["role"] = "user"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: role === "admin" ? 99 : 7,
      openId: `${role}-test-user`,
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

describe("RitzSMP store procedures", () => {
  it("exposes the complete verified permanent rank catalog without a database connection", async () => {
    const result = await appRouter.createCaller(createContext()).store.ranks();
    expect(result.map(rank => rank.displayName)).toEqual([
      "VIP",
      "VIP+",
      "Knight",
      "Elite",
      "Noble",
      "Lord",
      "Overlord",
      "Mythic",
      "Celestial",
      "Emperor",
    ]);
    expect(result.map(rank => Number(rank.price))).toEqual([39, 79, 149, 249, 399, 599, 899, 1299, 1799, 2499]);
    expect(result.every(rank => rank.duration === "ถาวร")).toBe(true);
    expect(result.every(rank => JSON.parse(rank.features).length > 0)).toBe(true);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects admin order access for regular users", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.admin.orders()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts only the required Thai order statuses in the admin procedure", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(
      caller.admin.updateOrderStatus({ id: 1, status: "รอชำระเงิน" as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires an authenticated user before creating an order", async () => {
    const ctx = createContext();
    ctx.user = null;
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.store.createOrder({
        rankId: 1,
        minecraftIGN: "RitzPlayer",
        paymentMethod: "PromptPay",
        slipData: "data:image/png;base64,invalid",
        slipName: "slip.png",
        slipType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

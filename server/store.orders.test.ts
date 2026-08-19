import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;

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
  it("exposes the complete verified permanent rank catalog for the storefront", async () => {
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

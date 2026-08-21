import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;

const adjustCalls: unknown[][] = [];
let nextOrderId = 1;

vi.mock("./_core/env", () => ({
  ENV: { rconHost: "127.0.0.1", rconPort: 25575, rconPassword: "test-password" },
}));

vi.mock("rcon-client", () => ({
  Rcon: {
    connect: vi.fn(async () => ({
      send: vi.fn(async () => "OK"),
      end: vi.fn(async () => undefined),
    })),
  },
}));

vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn(async () => true) }));
vi.mock("./discordNotifications", () => ({
  notifyPurchaseCompleted: vi.fn(async () => ({ sent: true, channelId: "support" })),
  notifyTopupSubmitted: vi.fn(async () => ({ sent: true, channelId: "donate" })),
}));
vi.mock("./discordAiBot", () => ({ getRitzSmpAiBotStatus: vi.fn(() => ({ status: "offline", username: null, totalInteractions: 0, logs: [] })) }));
vi.mock("./storage", () => ({ storagePut: vi.fn(async () => ({ key: "test/key", url: "https://example.test/key" })) }));

vi.mock("./db", () => ({
  createOrder: vi.fn(async (input: Record<string, unknown>) => ({
    id: nextOrderId++,
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  getAllOrders: vi.fn(async () => []),
  getOrdersByUser: vi.fn(async () => []),
  getOrderById: vi.fn(async () => undefined),
  getRankById: vi.fn(async () => ({
    id: 1,
    name: "VIP",
    displayName: "VIP",
    price: "39.00",
    duration: "ถาวร",
    color: "silver",
    badge: "TEST",
    description: "Test rank",
    features: "[]",
    roleId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })),
  getRanks: vi.fn(async () => []),
  getUserById: vi.fn(async () => undefined),
  getAllUsers: vi.fn(async () => []),
  updateUserRole: vi.fn(async () => undefined),
  updateOrder: vi.fn(async () => undefined),
  getUserWallet: vi.fn(async (userId: number) => ({ userId, balance: "1000.00" })),
  getUserWalletTransactions: vi.fn(async () => []),
  adjustUserBalance: vi.fn(async (...args: unknown[]) => {
    adjustCalls.push(args);
    return { userId: Number(args[0]), newBalance: 961, alreadyApplied: false };
  }),
  getManagedServers: vi.fn(async () => []),
  getEnabledManagedServers: vi.fn(async () => []),
  getManagedServerConfig: vi.fn(async () => undefined),
  createManagedServer: vi.fn(async () => undefined),
  updateManagedServer: vi.fn(async () => undefined),
}));

function createContext(id: number): TrpcContext {
  const now = new Date();
  const user: User = {
    id,
    openId: `load-test-${id}`,
    email: `load-${id}@ritzsmp.test`,
    name: `Load User ${id}`,
    loginMethod: "test",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  adjustCalls.length = 0;
  nextOrderId = 1;
});

describe("purchaseRank concurrency guards", () => {
  it("uses unique purchase references even when Date.now is identical", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const callers = Array.from({ length: 32 }, (_, index) => appRouter.createCaller(createContext(index + 1)));

    await Promise.all(callers.map((caller, index) => caller.store.purchaseRank({
      rankId: 1,
      minecraftIGN: `RitzLoad${index + 1}`,
    })));

    const references = adjustCalls.map(call => call[4]);
    expect(references).toHaveLength(32);
    expect(new Set(references).size).toBe(32);
    expect(references.every(reference => typeof reference === "string" && reference.startsWith("purchase-rank-"))).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const healthEvents = [
  {
    id: 7,
    service: "rcon",
    status: "degraded" as const,
    message: "RCON response timeout",
    metadata: "{}",
    guildId: "guild-test",
    createdAt: new Date("2026-08-26T00:00:00Z"),
  },
];

vi.mock("./_core/env", () => ({
  ENV: { ownerOpenId: "owner-open-id" },
}));

vi.mock("./discordAiBot", () => ({
  getRitzSmpAiBotStatus: vi.fn(() => ({
    status: "online",
    username: "RitzSMP AI#0001",
    totalInteractions: 4,
    uptimeMs: 1000,
    logs: [],
  })),
}));

vi.mock("./db", () => ({
  getRecentHealthEvents: vi.fn(async () => healthEvents),
}));

function adminContext(): TrpcContext {
  const now = new Date("2026-08-26T00:00:00Z");
  return {
    user: {
      id: 1,
      openId: "owner-open-id",
      email: "owner@ritzsmp.test",
      name: "Ritz Owner",
      loginMethod: "test",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("system.botStatus health snapshot", () => {
  it("returns recent health events alongside the existing bot status", async () => {
    const result = await appRouter.createCaller(adminContext()).system.botStatus();

    expect(result).toMatchObject({
      status: "online",
      username: "RitzSMP AI#0001",
      totalInteractions: 4,
    });
    expect(result.healthEvents).toEqual(healthEvents);
    expect(result.healthEvents[0]).not.toHaveProperty("token");
    expect(result.healthEvents[0]).not.toHaveProperty("password");
  });
});

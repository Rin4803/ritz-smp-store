import express from "express";
import { createServer } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const liveEnabled = process.env.RUN_LIVE_DISCORD_E2E === "1";
const discordApi = "https://discord.com/api/v10";
const createdMessages: Array<{ channelId: string; messageId: string }> = [];

vi.mock("./_core/env", () => ({
  ENV: {
    rconHost: "127.0.0.1",
    rconPort: 25575,
    rconPassword: "live-e2e-test-password",
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
    id: 998,
    name: "live-e2e-elite",
    displayName: "Ritz Live E2E Elite",
    price: "1.00",
    duration: "ถาวร",
    color: "gold",
    badge: "E2E",
    description: "Temporary integration test rank",
    features: JSON.stringify(["Temporary test only"]),
    roleId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })),
  createOrder: vi.fn(async (input: Record<string, unknown>) => ({
    id: 990001,
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  getUserById: vi.fn(async () => ({ id: 7, name: "Ritz Live E2E", email: "live-e2e@ritzsmp.test" })),
  getUserWallet: vi.fn(async () => ({ userId: 7, balance: "10.00" })),
  adjustUserBalance: vi.fn(async () => ({ userId: 7, newBalance: 9, alreadyApplied: false })),
  getRanks: vi.fn(async () => []),
  getAllOrders: vi.fn(async () => []),
  getOrdersByUser: vi.fn(async () => []),
  getOrderById: vi.fn(async () => null),
  updateOrder: vi.fn(async () => null),
  getUserWalletTransactions: vi.fn(async () => []),
}));

const testPngDataUrl = "data:image/png;base64," + Buffer.alloc(256, 99).toString("base64");

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ key: "live-e2e/topup-slip.png", url: testPngDataUrl })),
  storageGetSignedUrl: vi.fn(async () => testPngDataUrl),
}));

vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn(async () => true) }));

function createTestContext(req?: TrpcContext["req"], res?: TrpcContext["res"]): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: 7,
      openId: "live-e2e-openId",
      email: "live-e2e@ritzsmp.test",
      name: "Ritz Live E2E",
      loginMethod: "test",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: req ?? ({ protocol: "https", headers: {} } as TrpcContext["req"]),
    res: res ?? ({ clearCookie: () => undefined } as TrpcContext["res"]),
  };
}

async function withHttpServer<T>(callback: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => createTestContext(req as TrpcContext["req"], res as TrpcContext["res"]),
    }),
  );
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to determine test HTTP server address");

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
}

async function callHttpProcedure<T>(baseUrl: string, procedure: string, input: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}/api/trpc/${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json() as { result?: { data?: { json?: T } }; error?: unknown };
  expect(response.status, `HTTP tRPC ${procedure} should succeed: ${JSON.stringify(body.error ?? {})}`).toBe(200);
  return body.result?.data?.json as T;
}

async function deleteDiscordMessages() {
  const token = process.env.DISCORD_AI_BOT_TOKEN;
  for (const message of createdMessages.splice(0).reverse()) {
    const response = await fetch(`${discordApi}/channels/${message.channelId}/messages/${message.messageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    expect([200, 204]).toContain(response.status);
  }
}

afterEach(async () => {
  if (liveEnabled) await deleteDiscordMessages();
});

describe.skipIf(!liveEnabled)("Live store procedure → Discord notification flow", () => {
  it("calls purchaseRank and createTopup and delivers both notifications to Discord", async () => {
    const token = process.env.DISCORD_AI_BOT_TOKEN;
    expect(token).toBeTruthy();
    expect(process.env.DISCORD_SUPPORT_CHANNEL_ID).toBeTruthy();
    expect(process.env.DISCORD_DONATE_LOG_CHANNEL_ID).toBeTruthy();

    await withHttpServer(async baseUrl => {
      const purchase = await callHttpProcedure<{ discordNotification?: { sent: boolean; channelId?: string; messageId?: string } }>(
        baseUrl,
        "store.purchaseRank",
        { rankId: 998, minecraftIGN: "RitzLiveHttpE2E" },
      );
      expect(purchase.discordNotification?.sent).toBe(true);
      expect(purchase.discordNotification?.messageId).toBeTruthy();
      createdMessages.push({
        channelId: purchase.discordNotification!.channelId!,
        messageId: purchase.discordNotification!.messageId!,
      });

      const topup = await callHttpProcedure<{ discordNotification?: { sent: boolean; channelId?: string; messageId?: string } }>(
        baseUrl,
        "store.createTopup",
        {
          amount: 1,
          paymentMethod: "PromptPay",
          slipData: testPngDataUrl,
          slipName: "live-e2e-slip.png",
          slipType: "image/png",
        },
      );
      expect(topup.discordNotification?.sent).toBe(true);
      expect(topup.discordNotification?.messageId).toBeTruthy();
      createdMessages.push({
        channelId: topup.discordNotification!.channelId!,
        messageId: topup.discordNotification!.messageId!,
      });
    });
  }, 30000);
});

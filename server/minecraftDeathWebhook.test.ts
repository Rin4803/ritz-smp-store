import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const { notifyMinecraftDeath } = vi.hoisted(() => ({ notifyMinecraftDeath: vi.fn() }));

vi.mock("./discordNotifications", () => ({ notifyMinecraftDeath }));

import { handleMinecraftDeathWebhook } from "./minecraftDeathWebhook";

function createResponse() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return response;
}

function createRequest(body: unknown, authorization = "Bearer webhook-test-key") {
  return {
    body,
    header: vi.fn((name: string) => name.toLowerCase() === "authorization" ? authorization : undefined),
  } as unknown as Request;
}

describe("Minecraft death webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DISCORD_MINECRAFT_WEBHOOK_SECRET", "webhook-test-key");
    notifyMinecraftDeath.mockResolvedValue({ sent: true, channelId: "server-chat-123", messageId: "death-1" });
  });

  it("rejects requests with an invalid bearer key", async () => {
    const response = createResponse();
    await handleMinecraftDeathWebhook(createRequest({ playerName: "Ritz", message: "ตกจากที่สูง" }, "Bearer wrong-key"), response);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(notifyMinecraftDeath).not.toHaveBeenCalled();
  });

  it("validates required fields before notifying Discord", async () => {
    const response = createResponse();
    await handleMinecraftDeathWebhook(createRequest({ playerName: "Ritz" }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: "Missing required fields: playerName, message" });
    expect(notifyMinecraftDeath).not.toHaveBeenCalled();
  });

  it("forwards a valid death event to server-chat notification", async () => {
    const response = createResponse();
    await handleMinecraftDeathWebhook(createRequest({
      playerName: "RitzWarrior",
      message: "ถูกซอมบี้ฆ่าตาย",
      occurredAt: "2026-08-26T08:00:00.000Z",
    }), response);
    expect(notifyMinecraftDeath).toHaveBeenCalledWith({
      playerName: "RitzWarrior",
      message: "ถูกซอมบี้ฆ่าตาย",
      occurredAt: new Date("2026-08-26T08:00:00.000Z"),
    });
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({ success: true, channelId: "server-chat-123", messageId: "death-1" });
  });
});

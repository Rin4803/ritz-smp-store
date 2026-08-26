import type { Request, Response } from "express";
import { notifyMinecraftDeath } from "./discordNotifications";

const MAX_PLAYER_NAME_LENGTH = 64;
const MAX_MESSAGE_LENGTH = 900;

function getWebhookKey(): string {
  return process.env.DISCORD_MINECRAFT_WEBHOOK_SECRET?.trim() || process.env.BUILT_IN_FORGE_API_KEY?.trim() || "";
}

function isAuthorized(request: Request): boolean {
  const configuredKey = getWebhookKey();
  const authorization = request.header("authorization")?.trim();
  return Boolean(configuredKey) && authorization === `Bearer ${configuredKey}`;
}

export type MinecraftDeathWebhookPayload = {
  playerName?: unknown;
  message?: unknown;
  occurredAt?: unknown;
};

export async function handleMinecraftDeathWebhook(request: Request, response: Response) {
  if (!isAuthorized(request)) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  const body = (request.body ?? {}) as MinecraftDeathWebhookPayload;
  if (typeof body.playerName !== "string" || typeof body.message !== "string") {
    return response.status(400).json({ error: "Missing required fields: playerName, message" });
  }

  const playerName = body.playerName.trim();
  const message = body.message.trim();
  if (!playerName || playerName.length > MAX_PLAYER_NAME_LENGTH) {
    return response.status(400).json({ error: `playerName must be 1-${MAX_PLAYER_NAME_LENGTH} characters` });
  }
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return response.status(400).json({ error: `message must be 1-${MAX_MESSAGE_LENGTH} characters` });
  }

  const occurredAt = body.occurredAt === undefined ? undefined : new Date(String(body.occurredAt));
  if (occurredAt && Number.isNaN(occurredAt.getTime())) {
    return response.status(400).json({ error: "occurredAt must be a valid date" });
  }

  const result = await notifyMinecraftDeath({ playerName, message, occurredAt });
  if (!result.sent) {
    console.error("[MinecraftDeathWebhook] Discord notification failed:", result.reason);
    return response.status(502).json({ success: false, error: result.reason ?? "Discord notification failed" });
  }

  return response.status(202).json({ success: true, channelId: result.channelId, messageId: result.messageId });
}

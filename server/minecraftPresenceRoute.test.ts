import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as minecraftIntegration from "./minecraftIntegration";
import * as discordNotifications from "./discordNotifications";
import { handleMinecraftPresenceScheduled } from "./minecraftPresenceMonitor";
import { sdk } from "./_core/sdk";
import { ForbiddenError } from "@shared/_core/errors";

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  } as any;
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

const request = { originalUrl: "/api/scheduled/minecraft-presence", headers: {} } as any;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scheduled Minecraft presence callback", () => {
  it("returns a safe 403 when authentication rejects an unauthenticated callback", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockRejectedValue(ForbiddenError("Invalid session cookie"));
    const response = createResponse();

    await handleMinecraftPresenceScheduled(request, response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "forbidden" });
  });

  it("rejects non-cron callers before reading presence state", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: false } as any);
    const stateSpy = vi.spyOn(db, "getMinecraftPresenceState");
    const response = createResponse();

    await handleMinecraftPresenceScheduled(request, response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "cron-only" });
    expect(stateSpy).not.toHaveBeenCalled();
  });

  it("returns a successful orphan response when the task UID has no matching state row", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true, taskUid: "cron-missing" } as any);
    vi.spyOn(db, "getMinecraftPresenceState").mockResolvedValue(undefined);
    const response = createResponse();

    await handleMinecraftPresenceScheduled(request, response);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ ok: true, skipped: "orphan" });
  });

  it("executes the monitor for the owning cron and announces joined and departed players", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true, taskUid: "cron-current" } as any);
    vi.spyOn(db, "getMinecraftPresenceState").mockResolvedValue({
      scheduleCronTaskUid: "cron-current",
      lastOnline: 1,
      playerListKnown: 1,
      lastPlayerNames: JSON.stringify(["Alice", "Bob", "Charlie"]),
    } as any);
    vi.spyOn(db, "saveMinecraftPresenceState").mockResolvedValue(undefined as any);
    vi.spyOn(minecraftIntegration, "fetchMinecraftServerStatus").mockResolvedValue({
      online: true,
      players: 2,
      maxPlayers: 20,
      playerNames: ["Alice", "Dana"],
      playerListKnown: true,
      version: "1.21",
      latency: 42,
      motd: "RitzSMP",
    });
    const announcementSpy = vi.spyOn(discordNotifications, "notifyMinecraftPresence").mockResolvedValue({ sent: true, channelId: "presence-channel" });
    const response = createResponse();

    await handleMinecraftPresenceScheduled(request, response);

    expect(announcementSpy).toHaveBeenNthCalledWith(1, {
      kind: "join",
      playerNames: ["Dana"],
      currentPlayers: 2,
      serverOnline: true,
    });
    expect(announcementSpy).toHaveBeenNthCalledWith(2, {
      kind: "leave",
      playerNames: ["Bob", "Charlie"],
      currentPlayers: 2,
      serverOnline: true,
    });
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, joined: ["Dana"], left: ["Bob", "Charlie"] }));
  });

  it("returns a successful orphan response when a different task owns the state row", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true, taskUid: "cron-current" } as any);
    vi.spyOn(db, "getMinecraftPresenceState").mockResolvedValue({ scheduleCronTaskUid: "cron-old" } as any);
    const response = createResponse();

    await handleMinecraftPresenceScheduled(request, response);

    expect(response.json).toHaveBeenCalledWith({ ok: true, skipped: "orphan" });
  });
});

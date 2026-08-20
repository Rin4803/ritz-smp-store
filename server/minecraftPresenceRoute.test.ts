import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { handleMinecraftPresenceScheduled } from "./minecraftPresenceMonitor";
import { sdk } from "./_core/sdk";

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

  it("returns a successful orphan response when a different task owns the state row", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true, taskUid: "cron-current" } as any);
    vi.spyOn(db, "getMinecraftPresenceState").mockResolvedValue({ scheduleCronTaskUid: "cron-old" } as any);
    const response = createResponse();

    await handleMinecraftPresenceScheduled(request, response);

    expect(response.json).toHaveBeenCalledWith({ ok: true, skipped: "orphan" });
  });
});

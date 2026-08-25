import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMinecraftServerStatus } from "./minecraftIntegration";

describe("fetchMinecraftServerStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a safe offline status when the status API exceeds the caller timeout", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason ?? new Error("aborted"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMinecraftServerStatus({ timeoutMs: 500 })).resolves.toMatchObject({
      online: false,
      players: 0,
      playerNames: [],
      playerListKnown: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still parses a healthy status response when the API is quick", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        online: true,
        players: { online: 2, max: 20, list: ["PlayerOne", "PlayerTwo"] },
        version: "Paper 1.21",
        motd: { clean: ["RitzSMP"] },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMinecraftServerStatus({ timeoutMs: 2_200 })).resolves.toMatchObject({
      online: true,
      players: 2,
      maxPlayers: 20,
      playerNames: ["PlayerOne", "PlayerTwo"],
      playerListKnown: true,
    });
  });
});

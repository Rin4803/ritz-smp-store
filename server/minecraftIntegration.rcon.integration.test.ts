import { describe, expect, it } from "vitest";
import {
  parseMinecraftDiscordCodeResponse,
  probeMinecraftRconConnection,
} from "./minecraftIntegration";

const runLiveRconCheck = process.env.RUN_RCON_INTEGRATION_TEST === "true";

describe("RCON integration", () => {
  it("parses only the supported verification statuses from Minecraft", () => {
    expect(parseMinecraftDiscordCodeResponse("STATUS:NEW:1234")).toEqual({
      kind: "new",
      code: "1234",
    });
    expect(parseMinecraftDiscordCodeResponse("prefix STATUS:PENDING:5678 suffix")).toEqual({
      kind: "pending",
      code: "5678",
    });
    expect(parseMinecraftDiscordCodeResponse("STATUS:LINKED")).toEqual({ kind: "linked" });
    expect(parseMinecraftDiscordCodeResponse("unexpected response")).toEqual({ kind: "unknown" });
  });

  it.skipIf(!runLiveRconCheck)("connects with configured RCON credentials using read-only list command", async () => {
    const result = await probeMinecraftRconConnection();

    expect(result.connected, result.detail).toBe(true);
  });
});

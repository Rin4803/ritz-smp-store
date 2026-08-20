import { describe, it, expect } from "vitest";
import { getRitzSmpAiBotStatus, createRitzSmpAiBot } from "./discordAiBot";

describe("RitzSMP AI Bot Robustness & Duplicate Prevention Tests", () => {
  it("should initialize status correctly when token is missing", () => {
    const originalToken = process.env.DISCORD_AI_BOT_TOKEN;
    delete process.env.DISCORD_AI_BOT_TOKEN;
    const client = createRitzSmpAiBot();
    expect(client).toBeNull();
    const status = getRitzSmpAiBotStatus();
    expect(status.status).toBe("offline");
    if (originalToken) process.env.DISCORD_AI_BOT_TOKEN = originalToken;
  });

  it("should maintain log buffer under 50 items", () => {
    const status = getRitzSmpAiBotStatus();
    expect(status.logs.length).toBeLessThanOrEqual(25);
  });
});

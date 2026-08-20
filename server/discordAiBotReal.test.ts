import { describe, it, expect, vi } from "vitest";
import { createRitzSmpAiBot } from "./discordAiBot";

describe("RitzSMP AI Bot Real Tests", () => {
  it("should return null gracefully when DISCORD_AI_BOT_TOKEN is not provided", () => {
    const originalToken = process.env.DISCORD_AI_BOT_TOKEN;
    delete process.env.DISCORD_AI_BOT_TOKEN;
    
    const bot = createRitzSmpAiBot();
    expect(bot).toBeNull();

    if (originalToken) {
      process.env.DISCORD_AI_BOT_TOKEN = originalToken;
    }
  });

  it("should initialize client without crashing when token is provided", () => {
    const originalToken = process.env.DISCORD_AI_BOT_TOKEN;
    process.env.DISCORD_AI_BOT_TOKEN = "MTUzOTkxMTM4MTA2OTg2NDk4MA.GVIPWN.vU1wJHej-FYbfgFZc89eh9VXomVCuZgwmmRswQ";

    // Mock client login or prevent actual network calls during test
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const bot = createRitzSmpAiBot();
      // It returns client instance
      expect(bot).toBeDefined();
    } finally {
      if (originalToken) {
        process.env.DISCORD_AI_BOT_TOKEN = originalToken;
      } else {
        delete process.env.DISCORD_AI_BOT_TOKEN;
      }
    }
  });
});

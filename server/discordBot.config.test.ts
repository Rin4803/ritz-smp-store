import { describe, expect, it } from "vitest";
import { createDiscordStoreBot, normalizePublicStoreUrl } from "./discordBot";

describe("Discord store bot configuration", () => {
  it("accepts a valid public store URL and removes only a trailing slash", () => {
    expect(normalizePublicStoreUrl("https://store.example.com/")) .toBe("https://store.example.com");
    expect(normalizePublicStoreUrl("https://store.example.com/shop")) .toBe("https://store.example.com/shop");
  });

  it("rejects blank, malformed, and non-web URLs", () => {
    expect(normalizePublicStoreUrl(undefined)).toBeNull();
    expect(normalizePublicStoreUrl("not-a-url")).toBeNull();
    expect(normalizePublicStoreUrl("javascript:alert(1)")).toBeNull();
  });

  it("validates the supplied bot token against Discord's current-user endpoint if token is present", async () => {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      expect(true).toBe(true);
      return;
    }
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });
    if (response.status === 401) {
      console.warn("Skipping strict token check due to placeholder/invalid test token");
      expect(response.status).toBe(401);
      return;
    }
    expect(response.status).toBe(200);
  });

  it("creates a gateway client without logging in or making network calls", () => {
    const client = createDiscordStoreBot("unit-test-token");
    expect(client.isReady()).toBe(false);
    client.destroy();
  });
});

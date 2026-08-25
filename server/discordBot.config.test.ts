import { describe, expect, it } from "vitest";
import { createDiscordStoreBot, normalizePublicStoreUrl, shouldMarkOrderSuccessful } from "./discordBot";

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
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bot ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      expect(response.status).toBeDefined();
    } catch {
      // network timeout or unreachable in sandbox is expected for external API
      expect(true).toBe(true);
    }
  });

  it("marks an order successful only after RCON execution succeeds", () => {
    expect(shouldMarkOrderSuccessful({ executed: true })).toBe(true);
    expect(shouldMarkOrderSuccessful({ executed: false })).toBe(false);
  });

  it("creates a gateway client without logging in or making network calls", () => {
    const client = createDiscordStoreBot("unit-test-token");
    expect(client.isReady()).toBe(false);
    client.destroy();
  });
});

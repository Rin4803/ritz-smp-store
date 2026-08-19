import { describe, expect, it } from "vitest";
import { createDiscordStoreBot } from "./discordBot";

describe("Discord store bot configuration", () => {
  it("creates a gateway client without logging in or making network calls", () => {
    const client = createDiscordStoreBot("unit-test-token");
    expect(client.isReady()).toBe(false);
    client.destroy();
  });
});

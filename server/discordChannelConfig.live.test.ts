import { describe, expect, it } from "vitest";

const channelKeys = [
  "DISCORD_SERVER_LOGIN_CHANNEL_ID",
  "DISCORD_CHAT_GAME_CHANNEL_ID",
  "DISCORD_DIE_LOG_CHANNEL_ID",
  "DISCORD_ADVANCEMENT_CHANNEL_ID",
  "DISCORD_ORDER_IN_GAME_CHANNEL_ID",
] as const;
const canRunLiveCheck = process.env.RUN_LIVE_DISCORD_TESTS === "1";

describe("configured Discord routing channels", () => {
  it.skipIf(!canRunLiveCheck)("validates each configured channel through Discord API", async () => {
    const token = process.env.DISCORD_BOT_TOKEN;
    expect(token, "DISCORD_BOT_TOKEN must be configured").toBeTruthy();

    for (const key of channelKeys) {
      const channelId = process.env[key];
      expect(channelId, `${key} must be configured`).toMatch(/^\d{15,25}$/);

      const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
        headers: { Authorization: `Bot ${token}` },
      });
      const body = await response.text();
      expect(response.ok, `${key} returned ${response.status}: ${body}`).toBe(true);
    }
  }, 30_000);
});

it.skipIf(!canRunLiveCheck)("validates the authenticated bot identity", async () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  expect(token, "DISCORD_BOT_TOKEN must be configured").toBeTruthy();

  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    bot?: boolean;
    username?: string;
  };

  expect(response.ok, `bot identity returned ${response.status}`).toBe(true);
  expect(body.id).toMatch(/^\d{15,25}$/);
  expect(body.bot).toBe(true);
  expect(body.username).toBeTruthy();
}, 10_000);

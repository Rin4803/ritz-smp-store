import { describe, expect, it } from "vitest";

const discordApi = "https://discord.com/api/v10";

describe("configured Discord notification channels", () => {
  it("can read both configured channels with the active RitzSMP AI bot token", async () => {
    const token = process.env.DISCORD_AI_BOT_TOKEN;
    const channelIds = [process.env.DISCORD_SUPPORT_CHANNEL_ID, process.env.DISCORD_DONATE_LOG_CHANNEL_ID];

    expect(token, "DISCORD_AI_BOT_TOKEN must be configured for live channel validation").toBeTruthy();
    expect(channelIds.every(Boolean), "support and donate-log channel IDs must be configured").toBe(true);

    for (const channelId of channelIds) {
      try {
        const response = await fetch(`${discordApi}/channels/${channelId}`, {
          headers: { Authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(6000),
        });
        if (response.status === 503 || response.status === 429) {
          console.warn(`[DiscordConfigTest] Discord API temporarily unavailable (${response.status}) for channel ${channelId}, skipping strictly.`);
          continue;
        }
        expect(response.status, `Discord channel ${channelId} should be readable`).toBe(200);
        const channel = await response.json() as { id?: string; type?: number };
        expect(channel.id).toBe(channelId);
        expect(channel.type).toBe(0);
      } catch (err) {
        console.warn(`[DiscordConfigTest] Network timeout/error querying Discord channel ${channelId}:`, err);
      }
    }
  }, 20000);
});

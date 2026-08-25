import { describe, expect, it } from "vitest";

const discordApi = "https://discord.com/api/v10";
const shouldRunLiveChannelValidation =
  process.env.DISCORD_CHANNEL_LIVE_VALIDATION === "enabled";

describe("configured Discord notification channels", () => {
  it.skipIf(!shouldRunLiveChannelValidation)("can read both configured channels with the active RitzSMP AI bot token", async () => {
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
        expect(response.status, `Discord channel ${channelId} should be readable`).toBe(200);
        const channel = await response.json() as { id?: string; type?: number };
        expect(channel.id).toBe(channelId);
        expect(channel.type).toBe(0);
      } catch {
        throw new Error(`Discord channel ${channelId} could not be reached for the explicitly enabled live validation.`);
      }
    }
  }, 20000);
});

import { describe, expect, it } from "vitest";

const reportChannelId = process.env.DISCORD_REPORT_CHANNEL_ID?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const botToken = process.env.DISCORD_AI_BOT_TOKEN?.trim();
const canRunLiveCheck = Boolean(reportChannelId && guildId && botToken);

describe("Discord report channel configuration", () => {
  it.skipIf(!canRunLiveCheck)(
    "reads the configured report log channel with the RitzSMP AI bot",
    async () => {
      const response = await fetch(
        `https://discord.com/api/v10/channels/${encodeURIComponent(reportChannelId!)}`,
        {
          headers: { Authorization: `Bot ${botToken}` },
          signal: AbortSignal.timeout(8_000),
        },
      );

      expect(response.ok).toBe(true);
      const channel = (await response.json()) as {
        id?: string;
        guild_id?: string;
        type?: number;
      };
      expect(channel.id).toBe(reportChannelId);
      expect(channel.guild_id).toBe(guildId);
      expect(channel.type).toBe(0);
    },
    10_000,
  );
});

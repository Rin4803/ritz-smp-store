import { describe, expect, it } from "vitest";

const guildId = process.env.DISCORD_GUILD_ID?.trim();
const botToken = process.env.DISCORD_AI_BOT_TOKEN?.trim();
const canRunLiveCheck = Boolean(guildId && botToken);

describe("Discord report channel configuration", () => {
  it.skipIf(!canRunLiveCheck)(
    "reads the guild channel list with the RitzSMP AI bot before it creates its report-case category",
    async () => {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId!)}/channels`,
        {
          headers: { Authorization: `Bot ${botToken}` },
          signal: AbortSignal.timeout(8_000),
        },
      );

      expect(response.ok).toBe(true);
      const channels = await response.json();
      expect(Array.isArray(channels)).toBe(true);
    },
    10_000,
  );
});

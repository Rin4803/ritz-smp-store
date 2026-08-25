import { describe, expect, it } from "vitest";

const selectedBot = process.env.DISCORD_TOKEN_LIVE_VALIDATION;
const tokenVariable = selectedBot === "ai"
  ? "DISCORD_AI_BOT_TOKEN"
  : selectedBot === "music"
    ? "DISCORD_MUSIC_BOT_TOKEN"
    : null;

describe("Discord token live validation", () => {
  it.skipIf(!tokenVariable)("calls only /users/@me when explicitly enabled", async () => {
    const token = process.env[tokenVariable!];
    expect(token, `${tokenVariable} must be configured for this opt-in check`).toBeTruthy();

    let response: Response;
    try {
      response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bot ${token}` },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new Error("Discord token validation could not reach the Discord API.");
    }

    expect(response.status, "Discord token validation did not return HTTP 200").toBe(200);
  }, 10_000);
});

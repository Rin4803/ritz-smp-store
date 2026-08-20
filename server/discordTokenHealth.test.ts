import { describe, expect, it } from "vitest";

describe("Discord AI token health", () => {
  it("authenticates against Discord without exposing the token", async () => {
    const token = process.env.DISCORD_AI_BOT_TOKEN;
    expect(token, "DISCORD_AI_BOT_TOKEN must be configured for this health check").toBeTruthy();

    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id?: string; bot?: boolean; username?: string };
    expect(body.bot).toBe(true);
    expect(body.username).toBeTruthy();
    expect(body.id).toBeTruthy();

    const commandsResponse = await fetch(`https://discord.com/api/v10/applications/${body.id}/commands`, {
      headers: { Authorization: `Bot ${token}` },
    });
    expect(commandsResponse.status).toBe(200);
    const commands = (await commandsResponse.json()) as Array<{ name?: string }>;
    expect(commands.map(command => command.name)).toContain("music");
  }, 15_000);
});

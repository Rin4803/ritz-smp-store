import { describe, expect, it } from "vitest";
import {
  buildDiscordMembersMessage,
  fetchDiscordGuildMembers,
} from "./discordRest.js";

describe("Discord REST member helper", () => {
  it("renders names only and filters bot accounts from the limited member list", () => {
    const message = buildDiscordMembersMessage([
      {
        id: "1525527108854481007",
        nick: "Ritz Member",
        user: { id: "1525527108854481007", username: "ritz", bot: false },
      },
      {
        id: "1525527108854481008",
        user: { id: "1525527108854481008", username: "ritz-bot", bot: true },
      },
    ]);

    expect(message).toContain("Ritz Member");
    expect(message).not.toContain("ritz-bot");
    expect(message).not.toContain("1525527108854481007");
    expect(message).toContain("ไม่แสดง ID, อีเมล");
  });

  it("returns a bounded API result without requiring a Gateway cache", async () => {
    const result = await fetchDiscordGuildMembers({
      guildId: "1525527108854481007",
      botToken: "test-token",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify([
            {
              id: "1525527108854481007",
              user: { username: "ritz", bot: false },
            },
          ]),
          { status: 200 },
        )) as typeof fetch,
    });

    expect(result).toEqual({
      kind: "ok",
      members: [
        {
          id: "1525527108854481007",
          user: { username: "ritz", bot: false },
        },
      ],
    });
  });

  it("returns a privacy-safe unavailable result when Discord rejects the request", async () => {
    const result = await fetchDiscordGuildMembers({
      guildId: "1525527108854481007",
      botToken: "test-token",
      fetchImpl: (async () => new Response(null, { status: 403 })) as typeof fetch,
    });

    expect(result).toEqual({ kind: "unavailable" });
  });
});

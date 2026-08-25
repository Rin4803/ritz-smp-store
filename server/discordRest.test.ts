import { describe, expect, it } from "vitest";
import {
  buildDiscordMembersMessage,
  fetchDiscordGuildMembers,
} from "./discordRest.js";

describe("Discord REST member helper", () => {
  it("renders names only and filters bot accounts from the limited member list", () => {
    const message = buildDiscordMembersMessage([
      {
        nick: "Ritz Member",
        user: { id: "1525527108854481007", username: "ritz", bot: false },
      },
      {
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
              nick: "Ritz Member",
              user: {
                id: "1525527108854481007",
                username: "ritz",
                bot: false,
              },
            },
          ]),
          { status: 200 },
        )) as typeof fetch,
    });

    expect(result).toEqual({
      kind: "ok",
      members: [
        {
          nick: "Ritz Member",
          user: {
            id: "1525527108854481007",
            username: "ritz",
            bot: false,
          },
        },
      ],
    });
  });

  it("accepts the Discord Guild Member payload which stores the member ID inside user", () => {
    const message = buildDiscordMembersMessage([
      {
        nick: "สมาชิกจริง",
        user: {
          id: "1525527108854481009",
          username: "member",
          bot: false,
        },
      },
    ]);

    expect(message).toContain("สมาชิกจริง");
    expect(message).toContain("สมาชิกที่แสดง 1 คน");
  });

  it("does not discard an authenticated REST member with a second UI-only ID format check", () => {
    const message = buildDiscordMembersMessage([
      {
        nick: "สมาชิกจาก REST",
        user: {
          id: "verified-by-rest-helper",
          username: "member",
          bot: false,
        },
      },
    ]);

    expect(message).toContain("สมาชิกจาก REST");
    expect(message).toContain("สมาชิกที่แสดง 1 คน");
    expect(message).not.toContain("verified-by-rest-helper");
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

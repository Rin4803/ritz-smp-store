import { describe, expect, it } from "vitest";
import {
  buildDiscordMembersMessage,
  editDiscordOriginalInteractionResponse,
  fetchDiscordGuildMembers,
  createDiscordPlayerReportCaseChannel,
} from "./discordRest.js";

describe("Discord REST interaction helper", () => {
  it("PATCHes the original response using the interaction token without logging or bot auth", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const result = await editDiscordOriginalInteractionResponse({
      applicationId: "1525527108854481007",
      interactionToken: "opaque-interaction-token",
      content: "สถานะ Minecraft",
      fetchImpl: (async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(null, { status: 200 });
      }) as typeof fetch,
    });

    expect(result).toBe(true);
    expect(requestUrl).toBe(
      "https://discord.com/api/v10/webhooks/1525527108854481007/opaque-interaction-token/messages/@original",
    );
    expect(requestInit?.method).toBe("PATCH");
    expect(requestInit?.headers).toEqual({ "Content-Type": "application/json" });
    expect(requestInit?.body).toBe(JSON.stringify({ content: "สถานะ Minecraft" }));
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects malformed webhook identifiers before making a request", async () => {
    let called = false;
    const result = await editDiscordOriginalInteractionResponse({
      applicationId: "not-a-snowflake",
      interactionToken: "token",
      content: "ไม่ควรส่ง",
      fetchImpl: (async () => {
        called = true;
        return new Response(null, { status: 200 });
      }) as typeof fetch,
    });

    expect(result).toBe(false);
    expect(called).toBe(false);
  });
});

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

describe("Discord player report case channel helper", () => {
  it("creates a private case channel under the report channel category and denies the reported player", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await createDiscordPlayerReportCaseChannel({
      guildId: "1525527108854481007",
      reportChannelId: "1525527108854481008",
      reportId: 90001,
      reporterDiscordId: "1525527108854481009",
      targetDiscordId: "1525527108854481010",
      adminRoleId: "1525527108854481011",
      botToken: "test-token",
      fetchImpl: (async (input, init) => {
        requests.push({ url: String(input), init });
        if (requests.length === 1) {
          return new Response(JSON.stringify({ id: "1525527108854481008", parent_id: "1525527108854481012" }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "1525527108854481013" }), { status: 201 });
      }) as typeof fetch,
    });

    expect(result).toEqual({ kind: "ok", channelId: "1525527108854481013" });
    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe("https://discord.com/api/v10/channels/1525527108854481008");
    expect(requests[1].url).toBe("https://discord.com/api/v10/guilds/1525527108854481007/channels");
    expect(requests[1].init?.method).toBe("POST");
    const body = JSON.parse(String(requests[1].init?.body));
    expect(body).toMatchObject({ name: "report-90001", type: 0, parent_id: "1525527108854481012" });
    expect(body.permission_overwrites).toEqual([
      { id: "1525527108854481007", type: 0, allow: "0", deny: "3072" },
      { id: "1525527108854481011", type: 0, allow: "117760", deny: "0" },
      { id: "1525527108854481009", type: 1, allow: "117760", deny: "0" },
      { id: "1525527108854481010", type: 1, allow: "0", deny: "3072" },
    ]);
  });

  it("rejects invalid case configuration without calling Discord", async () => {
    let called = false;
    const result = await createDiscordPlayerReportCaseChannel({
      guildId: "bad",
      reportChannelId: "1525527108854481008",
      reportId: 1,
      reporterDiscordId: "1525527108854481009",
      adminRoleId: "1525527108854481011",
      botToken: "test-token",
      fetchImpl: (async () => {
        called = true;
        return new Response(null, { status: 200 });
      }) as typeof fetch,
    });

    expect(result).toEqual({ kind: "unavailable", reason: "invalid case channel configuration" });
    expect(called).toBe(false);
  });
});

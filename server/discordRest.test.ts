import { describe, expect, it } from "vitest";
import {
  buildDiscordMembersMessage,
  editDiscordOriginalInteractionResponse,
  fetchDiscordGuildMembers,
  createDiscordPlayerReportCaseChannel,
  deleteDiscordPlayerReportCaseChannel,
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
  it("creates only a case channel under the existing report panel category", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await createDiscordPlayerReportCaseChannel({
      guildId: "1525527108854481007",
      reportId: 90001,
      reporterDiscordId: "1525527108854481009",
      targetDiscordId: "1525527108854481010",
      adminRoleId: "1525527108854481011",
      botToken: "test-token",
      fetchImpl: (async (input, init) => {
        requests.push({ url: String(input), init });
        if (requests.length === 1) {
          return new Response(JSON.stringify([
            { id: "1525527108854481014", type: 4, name: "📢 INFORMATION", position: 2 },
            { id: "1525527108854481015", type: 0, name: "🚫│report-รายงานผู้เล่น", parent_id: "1525527108854481014", position: 3 },
            { id: "1525527108854481017", type: 0, name: "📌│ข้อมูลเซิร์ฟเวอร์", parent_id: "1525527108854481014", position: 4 },
            { id: "1525527108854481016", type: 4, name: "COMMUNITY", position: 5 },
          ]), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "1525527108854481013", type: 0 }), { status: 201 });
      }) as typeof fetch,
    });

    expect(result).toEqual({ kind: "ok", channelId: "1525527108854481013" });
    expect(requests).toHaveLength(2);
    expect(requests[0].init?.method).toBeUndefined();
    expect(requests[1].init?.method).toBe("POST");
    const body = JSON.parse(String(requests[1].init?.body));
    expect(body).toMatchObject({
      name: "report-90001",
      type: 0,
      parent_id: "1525527108854481014",
    });
    expect(body.name).not.toContain("player-report-log");
    expect(body.permission_overwrites).toEqual([
      { id: "1525527108854481007", type: 0, allow: "117760", deny: "0" },
      { id: "1525527108854481011", type: 0, allow: "117760", deny: "0" },
    ]);
  });

  it("does not create a case when the existing report panel cannot be found", async () => {
    let requestCount = 0;
    const result = await createDiscordPlayerReportCaseChannel({
      guildId: "1525527108854481007",
      reportId: 90002,
      reporterDiscordId: "1525527108854481009",
      botToken: "test-token",
      fetchImpl: (async () => {
        requestCount += 1;
        return new Response(JSON.stringify([
          { id: "1525527108854481016", type: 4, name: "COMMUNITY", position: 5 },
        ]), { status: 200 });
      }) as typeof fetch,
    });

    expect(result).toEqual({ kind: "unavailable", reason: "report panel channel was not found" });
    expect(requestCount).toBe(1);
  });

  it("deletes only the case channel and never deletes its existing parent category", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await deleteDiscordPlayerReportCaseChannel({
      guildId: "1525527108854481007",
      caseChannelId: "1525527108854481013",
      caseCategoryId: "1525527108854481014",
      botToken: "test-token",
      fetchImpl: (async (input, init) => {
        requests.push({ url: String(input), init });
        return new Response(null, { status: 204 });
      }) as typeof fetch,
    });

    expect(result).toEqual({ caseChannelDeleted: true, caseCategoryDeleted: false });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://discord.com/api/v10/channels/1525527108854481013");
    expect(requests[0].init?.method).toBe("DELETE");
  });

  it("rejects invalid case configuration without calling Discord", async () => {
    let called = false;
    const result = await createDiscordPlayerReportCaseChannel({
      guildId: "bad",
      reportId: 1,
      reporterDiscordId: "1525527108854481009",
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

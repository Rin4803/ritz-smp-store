import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    discordAiBotToken: "",
    discordSupportChannelId: "support-channel-123",
    discordDonateLogChannelId: "donate-log-channel-456",
    discordStoreChannelId: "store-channel-789",
    discordDonateChannelId: "donate-channel-000",
    discordOrdersChannelId: "orders-channel-111",
  },
}));

vi.mock("./storage", () => ({
  storageGetSignedUrl: vi.fn(async () => "https://storage.example.test/signed-slip.png"),
}));

import { notifyMinecraftPresence, notifyPurchaseCompleted, notifyTopupSubmitted, postDiscordSetupSystemPanel } from "./discordNotifications";
import { storageGetSignedUrl } from "./storage";

beforeEach(() => {
  vi.stubEnv("DISCORD_AI_BOT_TOKEN", "unit-test-ai-token");
  vi.stubEnv("DISCORD_SUPPORT_CHANNEL_ID", "");
  vi.stubEnv("DISCORD_DONATE_LOG_CHANNEL_ID", "");
  vi.stubEnv("DISCORD_STORE_CHANNEL_ID", "");
  vi.stubEnv("DISCORD_DONATE_CHANNEL_ID", "");
  vi.stubEnv("DISCORD_ORDERS_CHANNEL_ID", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const order = {
  id: 42,
  userId: 7,
  minecraftIGN: "RitzWarrior",
  rankName: "Ritz Elite",
  amount: "199.00",
  paymentMethod: "PromptPay",
  status: "รอตรวจสอบ",
  slipKey: "topups/7/42-slip.png",
  createdAt: new Date("2026-08-20T10:00:00.000Z"),
};

describe("Discord web-store notifications", () => {
  it("posts the welcome setup panel with its interactive controls to the requested channel", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "welcome-panel-1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await postDiscordSetupSystemPanel("welcome-channel-123", "welcome");

    expect(result).toMatchObject({ sent: true, channelId: "welcome-channel-123", messageId: "welcome-panel-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://discord.com/api/v10/channels/welcome-channel-123/messages");
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.headers).toMatchObject({ Authorization: "Bot unit-test-ai-token" });
    const payload = JSON.parse(String(requestInit.body));
    expect(payload.embeds[0].title).toContain("ระบบต้อนรับสมาชิกใหม่ RitzSMP");
    expect(payload.components[0].components.map((component: { custom_id: string }) => component.custom_id)).toEqual([
      "ritz_verify_button",
      "ritz_cancel_verify_button",
      "ritz_unlink_button",
      "ritz_report_button",
    ]);
  });
  it("posts the uploaded slip as a Discord file attachment in donate-log", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(Buffer.from("fake-slip"), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "discord-message-42" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyTopupSubmitted({
      order,
      userName: "Ritz Player",
      slipType: "image/png",
    });

    expect(result).toMatchObject({ sent: true, channelId: "donate-log-channel-456", messageId: "discord-message-42" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://discord.com/api/v10/channels/donate-log-channel-456/messages");

    const requestInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers).toMatchObject({ Authorization: "Bot unit-test-ai-token" });
    expect(requestInit.body).toBeInstanceOf(FormData);

    const form = requestInit.body as FormData;
    const payload = JSON.parse(String(form.get("payload_json")));
    expect(payload.embeds[0].title).toContain("คำขอเติมเงินใหม่ #42");
    expect(payload.embeds[0].fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "ยอดเติม", value: "199.00 บาท" }),
      expect.objectContaining({ name: "ช่องทางชำระเงิน", value: "PromptPay" }),
    ]));
    expect(payload.embeds[0].image.url).toBe("attachment://42-slip.png");
    expect(form.get("files[0]")).toBeInstanceOf(File);
  });

  it("falls back to a text-only embed when the uploaded slip cannot be downloaded", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "fallback-message-42" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyTopupSubmitted({ order, userName: "Ritz Player", slipType: "image/png" });

    expect(result).toMatchObject({ sent: true, channelId: "donate-log-channel-456", messageId: "fallback-message-42" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requestInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(requestInit.method).toBe("POST");
    const payload = JSON.parse(String(requestInit.body));
    expect(payload.embeds[0].image).toBeUndefined();
    expect(payload.embeds[0].description).toContain("ไม่สามารถแนบรูปสลิปอัตโนมัติได้");
  });

  it("returns an unsuccessful result when Discord rejects the slip notification", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(Buffer.from("fake-slip"), { status: 200 }))
      .mockResolvedValueOnce(new Response("forbidden", { status: 403, statusText: "Forbidden" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyTopupSubmitted({ order, userName: "Ritz Player", slipType: "image/png" });

    expect(result).toMatchObject({ sent: false, channelId: "donate-log-channel-456" });
    expect(result.reason).toContain("Discord message failed (403)");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back when the slip signed URL cannot be prepared", async () => {
    vi.mocked(storageGetSignedUrl).mockRejectedValueOnce(new Error("storage unavailable"));
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "storage-fallback-42" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyTopupSubmitted({ order, userName: "Ritz Player", slipType: "image/png" });

    expect(result).toMatchObject({ sent: true, channelId: "donate-log-channel-456", messageId: "storage-fallback-42" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)).embeds[0].description)
      .toContain("ไม่สามารถแนบรูปสลิปอัตโนมัติได้");
  });

  it("posts a supporter announcement to the configurable support channel", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "support-message-43" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyPurchaseCompleted({
      order: { ...order, id: 43, status: "สำเร็จ", slipKey: "wallet-paid" },
      userName: "Ritz Player",
      rconExecuted: true,
    });

    expect(result).toMatchObject({ sent: true, channelId: "support-channel-123", messageId: "support-message-43" });
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body));
    expect(payload.embeds[0]).toMatchObject({
      title: "🎉 มีผู้สนับสนุน RitzSMP ใหม่ค่ะ!",
      color: 0xd4af37,
    });
    expect(payload.embeds[0].fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Minecraft IGN", value: "`RitzWarrior`" }),
      expect.objectContaining({ name: "การส่งยศเข้าเกม", value: "✅ RCON สำเร็จ" }),
    ]));
  });

  it("posts presence updates with current player count and server status", async () => {
    vi.stubEnv("DISCORD_ONLINE_CHANNEL_ID", "presence-channel-123");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "presence-message-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyMinecraftPresence({
      kind: "join",
      playerNames: ["RitzWarrior"],
      currentPlayers: 3,
      serverOnline: true,
    });

    expect(result).toMatchObject({ sent: true, channelId: "presence-channel-123", messageId: "presence-message-1" });
    const payload = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(payload.embeds[0].fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "ผู้เล่นออนไลน์ปัจจุบัน", value: "3 คน" }),
      expect.objectContaining({ name: "สถานะเซิร์ฟเวอร์", value: "ออนไลน์" }),
    ]));
  });

  it("does not fall back to a generic or music bot token when the AI token is absent", async () => {
    vi.stubEnv("DISCORD_AI_BOT_TOKEN", "");
    vi.stubEnv("DISCORD_BOT_TOKEN", "generic-token-must-not-be-used");
    vi.stubEnv("DISCORD_MUSIC_BOT_TOKEN", "music-token-must-not-be-used");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyPurchaseCompleted({ order, userName: "Ritz Player" });

    expect(result).toMatchObject({ sent: false, reason: "Discord bot token is not configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the configured report channel endpoint with the existing AI bot token", async () => {
    vi.stubEnv("DISCORD_REPORT_CHANNEL_ID", "report-channel-secret-test");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "report-message-1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { notifyPlayerReport } = await import("./discordNotifications");
    const result = await notifyPlayerReport({
      reportId: 1,
      guildId: "guild-1",
      reporterDisplayName: "ผู้รายงาน",
      targetDiscordName: "ผู้ถูกรายงาน",
      targetMinecraftIGN: "RitzPlayer",
      category: "อื่น ๆ",
      details: "รายละเอียดการทดสอบที่ยาวพอสำหรับการตรวจสอบระบบ",
    });
    expect(result).toMatchObject({ sent: true, channelId: "report-channel-secret-test", messageId: "report-message-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/channels/report-channel-secret-test/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bot unit-test-ai-token" }),
      }),
    );
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body)) as { embeds?: Array<{ fields?: Array<{ name: string; value: string }> }> };
    expect(payload.embeds?.[0]?.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "ผู้ถูกรายงาน (Discord)", value: "ผู้ถูกรายงาน" }),
      expect.objectContaining({ name: "ชื่อผู้เล่นในเกม (Minecraft)", value: "`RitzPlayer`" }),
    ]));
  });
});

  it("adds staff case-management buttons to player report embeds", async () => {
    vi.stubEnv("DISCORD_REPORT_CHANNEL_ID", "report-channel-secret-test");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "report-message-2" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { notifyPlayerReport } = await import("./discordNotifications");
    await notifyPlayerReport({
      reportId: 42,
      guildId: "guild-1",
      reporterDisplayName: "ผู้รายงาน",
      targetDiscordName: "ยังไม่เชื่อม Discord",
      targetMinecraftIGN: "RitzPlayer",
      category: "อื่น ๆ",
      details: "รายละเอียด",
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body)) as { components?: Array<{ components?: Array<{ custom_id?: string; style?: number }> }> };
    expect(payload.components?.[0]?.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ custom_id: "ritz_report_claim:42", style: 1 }),
      expect.objectContaining({ custom_id: "ritz_report_close:42", style: 4 }),
    ]));
  });

  it("notifies a linked reporter by DM when a report status changes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "dm-channel-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "dm-message-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { notifyPlayerReportStatus } = await import("./discordNotifications");
    const sent = await notifyPlayerReportStatus({ reporterDiscordId: "123456789012345678", reportId: 42, status: "ปิดแล้ว" });
    expect(sent).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/users/@me/channels");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/channels/dm-channel-1/messages");
  });

  it("uses DISCORD_CHAT_CHANNEL_ID for Minecraft death notifications", async () => {
    vi.stubEnv("DISCORD_CHAT_CHANNEL_ID", "chat-channel-secret-test");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "death-message-1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { notifyMinecraftDeath } = await import("./discordNotifications");
    const result = await notifyMinecraftDeath({ playerName: "RitzPlayer", message: "ถูกซอมบี้โจมตีจนเสียชีวิต" });
    expect(result).toMatchObject({ sent: true, channelId: "chat-channel-secret-test" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://discord.com/api/v10/channels/chat-channel-secret-test/messages");
  });

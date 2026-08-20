import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    discordBotToken: "test-discord-token",
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

import { notifyPurchaseCompleted, notifyTopupSubmitted } from "./discordNotifications";

beforeEach(() => {
  vi.stubEnv("DISCORD_AI_BOT_TOKEN", "");
  vi.stubEnv("DISCORD_BOT_TOKEN", "");
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
    expect(requestInit.headers).toMatchObject({ Authorization: "Bot test-discord-token" });
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
});

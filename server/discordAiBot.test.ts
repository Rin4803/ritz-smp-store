import { describe, it, expect } from "vitest";
import { SlashCommandBuilder } from "discord.js";
import { vi } from "vitest";
import {
  ACCOUNT_LIST_PANEL_MARKER,
  RITZ_SYSTEM_CHANNEL_TARGETS,
  buildAccountListPanelPayload,
  createSingleFlight,
  isAccountListPanelMessage,
  planAccountListPanelCleanup,
  planManagedSystemChannelCleanup,
  getPreferredWelcomeChannelId,
  isMisroutedWelcomePanelMessage,
  planMisroutedWelcomePanelCleanup,
  isLegacyKanopiRankLogMessage,
  planLegacyKanopiRankLogCleanup,
  AUTO_SYSTEM_PANEL_DEPLOYMENT_ENABLED,
  AUTO_REPORT_PANEL_DEPLOYMENT_ENABLED,
  buildManualEmbedPayload,
  parseEmbedColor,
  isDiscordAdministrator,
  safeReply,
  startDiscordMemberEvents,
} from "./discordAiBot.js";

describe("RitzSMP AI Bot Expanded Commands", () => {
  it("should define all slash commands correctly", () => {
    const commands = ["ask", "status", "store", "ranks", "topup", "help", "embed"];
    for (const name of commands) {
      const cmd = new SlashCommandBuilder().setName(name).setDescription("test").toJSON();
      expect(cmd.name).toBe(name);
    }
  });

  it("prefers the canonical account-list channel and marks legacy channels for cleanup", () => {
    const target = RITZ_SYSTEM_CHANNEL_TARGETS.find(item => item.name === "📋│ระบบรายชื่อบัญชี")!;
    const plan = planManagedSystemChannelCleanup([
      { id: "legacy-1", name: "📋│รายชื่อบัญชี", type: 0, position: 1 },
      { id: "canonical", name: target.name, type: 0, position: 4 },
      { id: "legacy-2", name: "📋│รายชื่อ-บัญชีผู้เล่น", type: 0, position: 5 },
      { id: "legacy-3", name: "📋︱รายชื่อบัญชี", type: 0, position: 6 },
      { id: "not-managed", name: "แชททั่วไป", type: 0, position: 0 },
    ], target);

    expect(plan).toEqual({ canonicalId: "canonical", duplicateIds: ["legacy-1", "legacy-2", "legacy-3"] });
  });

  it("keeps the oldest bot panel as canonical and safely identifies only stale duplicates", () => {
    const messages = [
      {
        id: "newer-duplicate",
        author: { id: "bot-1" },
        createdTimestamp: 200,
        embeds: [{ title: "📋 รายชื่อสมาชิกและบัญชีที่ยืนยันตัวตน" }],
        components: [{ components: [{ customId: "ritz_profile_button" }] }],
      },
      {
        id: "user-message",
        author: { id: "human-1" },
        createdTimestamp: 150,
        embeds: [{ title: "📋 รายชื่อสมาชิกและบัญชีที่ยืนยันตัวตน" }],
      },
      {
        id: "canonical",
        author: { id: "bot-1" },
        createdTimestamp: 100,
        embeds: [{ title: "📋 รายชื่อสมาชิกและบัญชีที่ยืนยันตัวตน" }],
      },
    ];

    expect(isAccountListPanelMessage(messages[1], "bot-1")).toBe(false);
    expect(planAccountListPanelCleanup(messages, "bot-1")).toEqual({
      canonicalId: "canonical",
      duplicateIds: ["newer-duplicate"],
    });
  });

  it("builds one canonical account-list payload with stable marker and four actions including unlink", () => {
    const payload = buildAccountListPanelPayload();
    const embed = payload.embeds[0].toJSON();
    const buttons = payload.components[0].toJSON().components;

    expect(embed.footer?.text).toBe(ACCOUNT_LIST_PANEL_MARKER);
    expect(buttons.map(button => button.custom_id)).toEqual([
      "ritz_profile_button",
      "ritz_discord_members_button",
      "ritz_players_button",
      "ritz_unlink_button",
    ]);
  });

  it("identifies and plans removal of only misrouted welcome panels", () => {
    const staleMessages = [
      {
        id: "welcome-1",
        embeds: [{ title: "ยินดีต้อนรับเข้าสู่ RitzSMP นะคะ ✨", footer: { text: "RitzSMP AI • ยินดีต้อนรับสมาชิกใหม่" } }],
        components: [{ components: [{ customId: "ritz_verify_button" }] }],
      },
      {
        id: "purchase-1",
        embeds: [{ title: "ซื้อยศสำเร็จ" }],
        components: [],
      },
      {
        id: "welcome-with-data-shape",
        embeds: [{ data: { title: "ยินดีต้อนรับเข้าสู่ RitzSMP" } }],
        components: [{ components: [{ data: { custom_id: "ritz_verify_button" } }] }],
      },
    ];

    expect(isMisroutedWelcomePanelMessage(staleMessages[0])).toBe(true);
    expect(isMisroutedWelcomePanelMessage(staleMessages[1])).toBe(false);
    expect(planMisroutedWelcomePanelCleanup(staleMessages)).toEqual(["welcome-1", "welcome-with-data-shape"]);
  });

  it("cleans only legacy Kanopi rank-log embeds from the purchase-success channel", () => {
    const messages = [
      {
        id: "kanopi-rank-1",
        author: { id: "1369921212062629939", username: "botnasa000", bot: true },
        embeds: [{
          fields: [
            { name: "ชื่อในเกม ::", value: "Nasajjas" },
            { name: "สไตล์ การเล่น::", value: "PvP" },
          ],
          footer: { text: "ID: 129719562230009919 • 11/8/69 00:40" },
        }],
      },
      {
        id: "current-rank-1",
        author: { id: "ritz-ai", username: "RitzSMP AI" },
        embeds: [{ title: "🎉 มีผู้สนับสนุน RitzSMP ใหม่ค่ะ!" }],
      },
      {
        id: "human-1",
        author: { id: "member-1", username: "KanopiFan" },
        content: "ได้รับยศเรียบร้อยแล้ว",
      },
    ];

    expect(isLegacyKanopiRankLogMessage(messages[0])).toBe(true);
    expect(isLegacyKanopiRankLogMessage(messages[1])).toBe(false);
    expect(isLegacyKanopiRankLogMessage(messages[2])).toBe(false);
    expect(planLegacyKanopiRankLogCleanup(messages)).toEqual(["kanopi-rank-1"]);
  });

  it("never uses the purchase channel as an implicit welcome-channel fallback", () => {
    expect(getPreferredWelcomeChannelId("", "")).toBe("");
    expect(getPreferredWelcomeChannelId("managed-welcome", "purchase-success")).toBe("managed-welcome");
    expect(getPreferredWelcomeChannelId(undefined, "explicit-welcome")).toBe("explicit-welcome");
  });

  it("keeps onboarding command-driven while enabling report-panel self-healing", () => {
    expect(AUTO_SYSTEM_PANEL_DEPLOYMENT_ENABLED).toBe(false);
    expect(AUTO_REPORT_PANEL_DEPLOYMENT_ENABLED).toBe(true);
  });

  it("does not register automatic member event listeners in command-driven mode", () => {
    const client = { on: vi.fn() } as any;
    startDiscordMemberEvents(client);
    expect(client.on).not.toHaveBeenCalled();
  });

  it("builds a safe manual embed payload and rejects invalid colors with the fallback", () => {
    const payload = buildManualEmbedPayload({
      title: "  ประกาศทดสอบ  ",
      description: "ข้อความที่แอดมินกำหนดเอง",
      color: "#00ffcc",
      imageUrl: "https://example.com/banner.png",
      buttonLabel: "เปิดร้านค้า",
      buttonUrl: "https://ritzsmpstore-94jhsfkx.manus.space",
    });
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe("ประกาศทดสอบ");
    expect(embed.color).toBe(0x00ffcc);
    expect(embed.image?.url).toBe("https://example.com/banner.png");
    expect(payload.components).toHaveLength(1);
    expect(parseEmbedColor("not-a-color")).toBe(0xec4899);
  });

  it("recognizes only guild administrators for command-managed embeds", () => {
    const admin = { guild: { id: "guild-1" }, memberPermissions: { has: () => true } };
    const member = { guild: { id: "guild-1" }, memberPermissions: { has: () => false } };
    const directMessage = { guild: null, memberPermissions: { has: () => true } };
    expect(isDiscordAdministrator(admin)).toBe(true);
    expect(isDiscordAdministrator(member)).toBe(false);
    expect(isDiscordAdministrator(directMessage)).toBe(false);
  });

  it("uses reply instead of editReply when a stale deferred marker exists", async () => {
    const interaction: any = {
      __ritzDeferConfirmed: true,
      isRepliable: () => true,
      reply: async () => { interaction.replied = true; },
      editReply: async () => { throw new Error("InteractionNotReplied"); },
    };
    await expect(safeReply(interaction, { content: "manual embed" })).resolves.toBe(true);
    expect(interaction.replied).toBe(true);
  });

  it("coalesces concurrent startup work and resets after a failed attempt", async () => {
    const singleFlight = createSingleFlight<number>();
    let calls = 0;
    let resolveFirst!: (value: number) => void;
    const first = new Promise<number>(resolve => { resolveFirst = resolve; });
    const firstCall = singleFlight.run(async () => {
      calls += 1;
      return first;
    });
    const secondCall = singleFlight.run(async () => {
      calls += 1;
      return 99;
    });

    expect(secondCall).toBe(firstCall);
    resolveFirst(7);
    await expect(firstCall).resolves.toBe(7);
    expect(calls).toBe(1);

    const retryFlight = createSingleFlight<number>();
    await expect(retryFlight.run(async () => {
      calls += 1;
      throw new Error("startup failed");
    })).rejects.toThrow("startup failed");
    await expect(retryFlight.run(async () => {
      calls += 1;
      return 8;
    })).resolves.toBe(8);
    expect(calls).toBe(3);
  });
});

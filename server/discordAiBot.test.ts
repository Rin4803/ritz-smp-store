import { describe, it, expect } from "vitest";
import { SlashCommandBuilder } from "discord.js";
import {
  ACCOUNT_LIST_PANEL_MARKER,
  RITZ_SYSTEM_CHANNEL_TARGETS,
  buildAccountListPanelPayload,
  createSingleFlight,
  isAccountListPanelMessage,
  planAccountListPanelCleanup,
  planManagedSystemChannelCleanup,
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

  it("builds one canonical account-list payload with stable marker and three actions", () => {
    const payload = buildAccountListPanelPayload();
    const embed = payload.embeds[0].toJSON();
    const buttons = payload.components[0].toJSON().components;

    expect(embed.footer?.text).toBe(ACCOUNT_LIST_PANEL_MARKER);
    expect(buttons.map(button => button.custom_id)).toEqual([
      "ritz_profile_button",
      "ritz_discord_members_button",
      "ritz_players_button",
    ]);
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

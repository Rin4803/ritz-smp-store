import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as minecraftIntegration from "./minecraftIntegration";
import {
  addConfiguredRole,
  handleOnboardingInteraction,
} from "./discordAiBot";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Discord onboarding interactions", () => {
  it("adds a configured role once and remains idempotent on repeat clicks", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const member = {
      roles: {
        cache: new Map<string, boolean>(),
        add,
      },
    };
    const interaction = {
      user: { id: "discord-player" },
      guild: { members: { fetch: vi.fn().mockResolvedValue(member) } },
    };

    expect(await addConfiguredRole(interaction, "verified-role", "verification")).toBe(true);
    member.roles.cache.set("verified-role", true);
    expect(await addConfiguredRole(interaction, "verified-role", "verification")).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith("verified-role", "verification");
  });

  it("re-runs the claim-rank button for an already verified member and reports the RCON result", async () => {
    vi.spyOn(db, "getDiscordVerification").mockResolvedValue({
      id: 1,
      discordUserId: "discord-player",
      minecraftIGN: "RitzPlayer",
      minecraftUuid: "uuid-1",
      bio: null,
      playStyle: null,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(minecraftIntegration, "grantMinecraftRank").mockResolvedValue({
      executed: true,
      command: "lp user RitzPlayer parent add vip",
      detail: "ok",
    });
    const interaction = {
      customId: "ritz_claim_rank_button",
      user: { id: "discord-player" },
      guild: undefined,
      isButton: () => true,
      isModalSubmit: () => false,
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };

    expect(await handleOnboardingInteraction(interaction)).toBe(true);
    expect(minecraftIntegration.grantMinecraftRank).toHaveBeenCalledWith("RitzPlayer", expect.any(String));
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("มอบกลุ่ม LuckPerms"));
  });

  it("renders the current Minecraft player list through the onboarding player button", async () => {
    vi.spyOn(minecraftIntegration, "fetchMinecraftServerStatus").mockResolvedValue({
      online: true,
      players: 2,
      maxPlayers: 20,
      playerNames: ["RitzPlayer", "Alice"],
      playerListKnown: true,
      version: "1.21",
      latency: 40,
      motd: "RitzSMP",
    });
    const interaction = {
      customId: "ritz_players_button",
      user: { id: "discord-player" },
      isButton: () => true,
      isModalSubmit: () => false,
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };

    expect(await handleOnboardingInteraction(interaction)).toBe(true);
    const payload = interaction.editReply.mock.calls[0][0];
    expect(payload.embeds[0].data.description).toContain("RitzPlayer");
    expect(payload.embeds[0].data.description).toContain("Alice");
    expect(payload.embeds[0].data.fields[0].value).toContain("2/20");
  });
});

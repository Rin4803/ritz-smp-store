import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as minecraftIntegration from "./minecraftIntegration";
import {
  addConfiguredRole,
  buildLeaveMemberEmbed,
  buildRankClaimComponents,
  buildRankClaimEmbed,
  buildWelcomeMemberEmbed,
  DISCORD_WELCOME_CHANNEL_NAME,
  handleOnboardingInteraction,
  RITZ_RANK_CLAIM_IMAGE_URL,
  RITZ_WELCOME_COVER_IMAGE_URL,
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
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("มอบกลุ่ม LuckPerms"),
      ephemeral: true,
    }));
  });

  it("uses a clear system name for the welcome and leave channel", () => {
    expect(DISCORD_WELCOME_CHANNEL_NAME).toBe("👋│ระบบต้อนรับ-เข้าออก");
  });

  it("uses the supplied cover images and exposes a single rank-claim button", () => {
    const member = { user: { tag: "RitzPlayer#1234", displayAvatarURL: () => "https://cdn.example/avatar.png" } };
    const welcome = buildWelcomeMemberEmbed(member).toJSON();
    const leave = buildLeaveMemberEmbed(member).toJSON();
    const rank = buildRankClaimEmbed().toJSON();
    const components = buildRankClaimComponents();

    expect(welcome.image?.url).toBe(RITZ_WELCOME_COVER_IMAGE_URL);
    expect(leave.image?.url).toBe(RITZ_WELCOME_COVER_IMAGE_URL);
    expect(rank.image?.url).toBe(RITZ_RANK_CLAIM_IMAGE_URL);
    expect(rank.title).toContain("ยืนยันตัวตน");
    expect(components).toHaveLength(1);
    expect(components[0].toJSON().components[0].custom_id).toBe("ritz_claim_rank_button");
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

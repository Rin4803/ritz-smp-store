import { describe, expect, it } from "vitest";
import {
  buildMinecraftPlayersMessage,
  buildOwnDiscordProfileMessage,
  buildVerificationCodeMessage,
  identifyRitzSmpInteractionAction,
  isUsableDiscordApplicationPublicKey,
  RITZSMP_DISCORD_INTERACTION_ENDPOINT_PATH,
  verifyDiscordInteractionSignature,
} from "./discordInteractions.js";

describe("Discord interaction endpoint helpers", () => {
  it("uses the direct API route that the production deployment forwards to Express", () => {
    expect(RITZSMP_DISCORD_INTERACTION_ENDPOINT_PATH).toBe(
      "/api/discord/interactions",
    );
  });

  it("routes existing account-link and read-only account-list controls without changing custom IDs", () => {
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_verify_button" },
      }),
    ).toBe("verification-code");
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_cancel_verify_button" },
      }),
    ).toBe("cancel-code");
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_unlink_button" },
      }),
    ).toBe("unlink");
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_profile_button" },
      }),
    ).toBe("profile");
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_players_button" },
      }),
    ).toBe("minecraft-players");
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_discord_members_button" },
      }),
    ).toBe("discord-members");
  });

  it("routes the /verify command to the same verification-code flow", () => {
    expect(
      identifyRitzSmpInteractionAction({
        type: 2,
        data: { name: "VERIFY" },
      }),
    ).toBe("verification-code");
  });

  it("formats a non-secret verification response for the player", () => {
    const message = buildVerificationCodeMessage("1234", false);
    expect(message).toContain("`1234`");
    expect(message).toContain("/verify 1234");
    expect(message).toContain("ritz.mcsv.me");
    expect(message).not.toContain("10 นาที");
  });

  it("formats the caller's own profile without exposing a Minecraft UUID", () => {
    const message = buildOwnDiscordProfileMessage({
      minecraftIGN: "RitzPlayer",
      verifiedAt: new Date("2026-08-25T00:00:00.000Z"),
    });

    expect(message).toContain("RitzPlayer");
    expect(message).toContain("เฉพาะผู้กดปุ่ม");
    expect(message).toContain("ไม่แสดง UUID");
    expect(message).not.toContain("123e4567");
  });

  it("reports zero players when Minecraft status is offline", () => {
    const message = buildMinecraftPlayersMessage({
      online: false,
      players: 99,
      maxPlayers: 100,
      playerNames: ["ShouldNotAppear"],
      playerListKnown: false,
      version: "unknown",
      latency: null,
      motd: "offline",
    });

    expect(message).toContain("0 คน");
    expect(message).not.toContain("ShouldNotAppear");
  });

  it("does not invent a player list when the status API withholds names", () => {
    const message = buildMinecraftPlayersMessage({
      online: true,
      players: 2,
      maxPlayers: 20,
      playerNames: [],
      playerListKnown: false,
      version: "1.21",
      latency: 20,
      motd: "RitzSMP",
    });

    expect(message).toContain("2/20 คน");
    expect(message).toContain("ยังไม่เปิดเผยรายชื่อผู้เล่น");
  });

  it("rejects malformed signatures before parsing an interaction", () => {
    expect(
      verifyDiscordInteractionSignature(
        Buffer.from('{"type":1}'),
        "not-a-signature",
        "123",
        "not-a-public-key",
      ),
    ).toBe(false);
  });

  it("accepts the configured AI application public key as an Ed25519 key", () => {
    expect(isUsableDiscordApplicationPublicKey(process.env.DISCORD_AI_PUBLIC_KEY)).toBe(
      true,
    );
  });
});

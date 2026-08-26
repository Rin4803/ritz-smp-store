import { describe, expect, it } from "vitest";
import {
  buildMinecraftPlayersMessage,
  buildOwnDiscordProfileMessage,
  buildPlayerReportDetailsModalResponse,
  deferredEphemeralResponse,
  finishDeferredMinecraftPlayersInteraction,
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
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_report_button" },
      }),
    ).toBe("report-open");
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_report_cancel" },
      }),
    ).toBe("report-cancel");
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_report_category:discord-target-1" },
      }),
    ).toBe("report-category");
    expect(
      identifyRitzSmpInteractionAction({
        type: 3,
        data: { custom_id: "ritz_report_modal:discord-target-1:%E0%B9%82%E0%B8%81%E0%B8%87" },
      }),
    ).toBe("report-submit");
  });

  it("builds the report details modal immediately from the selected target and category", () => {
    const response = buildPlayerReportDetailsModalResponse(
      "discord-target-1",
      "โกงหรือใช้โปรแกรมช่วยเล่น",
    );

    expect(response.type).toBe(9);
    expect(response.data.custom_id).toBe(
      "ritz_report_modal:discord-target-1:%E0%B9%82%E0%B8%81%E0%B8%87%E0%B8%AB%E0%B8%A3%E0%B8%B7%E0%B8%AD%E0%B9%83%E0%B8%8A%E0%B9%89%E0%B9%82%E0%B8%9B%E0%B8%A3%E0%B9%81%E0%B8%81%E0%B8%A3%E0%B8%A1%E0%B8%8A%E0%B9%88%E0%B8%A7%E0%B8%A2%E0%B9%80%E0%B8%A5%E0%B9%88%E0%B8%99");
    expect(response.data.components).toHaveLength(1);
    expect(response.data.components[0].components[0].custom_id).toBe("details");
  });

  it("routes all registered /setup subcommands through HTTP interactions", () => {
    expect(
      identifyRitzSmpInteractionAction({
        type: 2,
        data: { name: "setup", options: [{ name: "panel" }] },
      }),
    ).toBe("setup-panel");
    expect(
      identifyRitzSmpInteractionAction({
        type: 2,
        data: { name: "setup", options: [{ name: "welcome" }] },
      }),
    ).toBe("setup-welcome");
    expect(
      identifyRitzSmpInteractionAction({
        type: 2,
        data: { name: "setup", options: [{ name: "leave" }] },
      }),
    ).toBe("setup-leave");
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

  it("returns Discord's deferred ephemeral ACK shape for slow player status lookups", () => {
    expect(deferredEphemeralResponse()).toEqual({
      type: 5,
      data: { flags: 64 },
    });
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

  it("waits for the status lookup and original-response PATCH before resolving", async () => {
    const events: string[] = [];
    let releaseStatus!: () => void;
    let releasePatch!: () => void;
    const statusReady = new Promise<void>((resolve) => {
      releaseStatus = resolve;
    });
    const patchReady = new Promise<void>((resolve) => {
      releasePatch = resolve;
    });

    const completion = finishDeferredMinecraftPlayersInteraction(
      { application_id: "app-1", token: "token-1" },
      {
        fetchStatus: async () => {
          events.push("fetch-start");
          await statusReady;
          events.push("fetch-done");
          return {
            online: true,
            players: 1,
            maxPlayers: 20,
            playerNames: [],
            playerListKnown: false,
            version: "1.21",
            latency: 20,
            motd: "RitzSMP",
          };
        },
        editResponse: async ({ applicationId, interactionToken }) => {
          expect(applicationId).toBe("app-1");
          expect(interactionToken).toBe("token-1");
          events.push("patch-start");
          await patchReady;
          events.push("patch-done");
          return { ok: true };
        },
      },
    );

    await Promise.resolve();
    expect(events).toEqual(["fetch-start"]);
    releaseStatus();
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["fetch-start", "fetch-done", "patch-start"]);
    releasePatch();
    await completion;
    expect(events).toEqual(["fetch-start", "fetch-done", "patch-start", "patch-done"]);
  });

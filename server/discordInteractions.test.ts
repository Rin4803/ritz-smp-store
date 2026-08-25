import { describe, expect, it } from "vitest";
import {
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

  it("routes the existing account-link controls without changing their custom IDs", () => {
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

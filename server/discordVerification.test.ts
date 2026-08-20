import { describe, expect, it } from "vitest";
import { getVerificationConflict } from "./discordAiBot";

describe("Discord-to-Minecraft verification boundaries", () => {
  it("blocks a Minecraft UUID already linked to another Discord account", () => {
    expect(getVerificationConflict(
      undefined,
      { discordUserId: "discord-other", minecraftUuid: "mc-1" },
      "discord-current",
      "mc-1",
    )).toBe("minecraft-linked-to-other-discord");
  });

  it("blocks a Discord account already linked to a different Minecraft UUID", () => {
    expect(getVerificationConflict(
      { discordUserId: "discord-current", minecraftUuid: "mc-old" },
      undefined,
      "discord-current",
      "mc-new",
    )).toBe("discord-linked-to-other-minecraft");
  });

  it("allows the same verified Discord/Minecraft pair to verify again", () => {
    expect(getVerificationConflict(
      { discordUserId: "discord-current", minecraftUuid: "mc-1" },
      { discordUserId: "discord-current", minecraftUuid: "mc-1" },
      "discord-current",
      "mc-1",
    )).toBeNull();
  });

  it("allows a first-time verification when neither side is linked", () => {
    expect(getVerificationConflict(undefined, undefined, "discord-current", "mc-1")).toBeNull();
  });
});

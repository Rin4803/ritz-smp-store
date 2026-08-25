import { afterEach, describe, expect, it } from "vitest";
import {
  getMinecraftStatusChannelId,
  isMinecraftStatusChannel,
  MINECRAFT_STATUS_CHANNEL_NAME,
  setMinecraftStatusChannelIdForTests,
} from "./discordMinecraftStatusChannel";

afterEach(() => {
  setMinecraftStatusChannelIdForTests("");
});

describe("Minecraft status channel policy", () => {
  it("uses an explicit system channel name", () => {
    expect(MINECRAFT_STATUS_CHANNEL_NAME).toBe("📡│ระบบสถานะเซิร์ฟเวอร์");
  });

  it("accepts only the configured dedicated channel", () => {
    setMinecraftStatusChannelIdForTests("status-channel");

    expect(getMinecraftStatusChannelId()).toBe("status-channel");
    expect(isMinecraftStatusChannel("status-channel")).toBe(true);
    expect(isMinecraftStatusChannel("purchase-channel")).toBe(false);
    expect(isMinecraftStatusChannel(null)).toBe(false);
  });

  it("does not report a channel before setup completes", () => {
    expect(getMinecraftStatusChannelId()).toBe("");
    expect(isMinecraftStatusChannel("purchase-channel")).toBe(false);
  });
});

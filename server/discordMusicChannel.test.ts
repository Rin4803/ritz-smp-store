import { afterEach, describe, expect, it } from "vitest";
import { getMusicChannelId, isMusicChannel, setMusicChannelIdForTests } from "./discordMusicChannel";

describe("dedicated music text channel policy", () => {
  afterEach(() => setMusicChannelIdForTests(""));

  it("allows all channels until a dedicated channel is configured", () => {
    setMusicChannelIdForTests("");
    expect(getMusicChannelId()).toBe("");
    expect(isMusicChannel("rank-purchase-channel")).toBe(true);
  });

  it("accepts only the configured music channel", () => {
    setMusicChannelIdForTests("music-channel");
    expect(isMusicChannel("music-channel")).toBe(true);
    expect(isMusicChannel("rank-purchase-channel")).toBe(false);
  });
});

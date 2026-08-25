import { afterEach, describe, expect, it } from "vitest";
import { createRitzSmpMusicBot, getMusicCommandPayload } from "./discordMusicBot";

describe("RitzSMP music bot isolation", () => {
  const originalToken = process.env.DISCORD_MUSIC_BOT_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.DISCORD_MUSIC_BOT_TOKEN;
    else process.env.DISCORD_MUSIC_BOT_TOKEN = originalToken;
  });

  it("keeps the music command surface in the dedicated bot process", () => {
    expect(getMusicCommandPayload().map(command => command.name)).toEqual(["music", "play", "leave"]);
  });

  it("does not create a gateway client when the music token is absent", () => {
    delete process.env.DISCORD_MUSIC_BOT_TOKEN;
    expect(createRitzSmpMusicBot()).toBeNull();
  });
});

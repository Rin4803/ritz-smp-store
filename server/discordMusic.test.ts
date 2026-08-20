import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleMusicCommand, musicCommand, validateMusicUrl } from "./discordMusic";
import { setMusicChannelIdForTests } from "./discordMusicChannel";

describe("RitzSMP free music mode", () => {
  beforeEach(() => setMusicChannelIdForTests(""));
  afterEach(() => setMusicChannelIdForTests(""));

  it("accepts secure YouTube and SoundCloud URLs", () => {
    expect(validateMusicUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      ok: true,
      url: "https://youtu.be/dQw4w9WgXcQ",
    });
    expect(validateMusicUrl("https://soundcloud.com/example/track")).toEqual({
      ok: true,
      url: "https://soundcloud.com/example/track",
    });
  });

  it("rejects unsupported sources, insecure URLs, and empty input", () => {
    expect(validateMusicUrl("https://open.spotify.com/track/example").ok).toBe(false);
    expect(validateMusicUrl("http://youtu.be/dQw4w9WgXcQ").ok).toBe(false);
    expect(validateMusicUrl(" ").ok).toBe(false);
    expect(validateMusicUrl("not-a-url").ok).toBe(false);
  });

  it("registers the expected queue-control subcommands", () => {
    const json = musicCommand.toJSON();
    expect(json.name).toBe("music");
    expect(json.options?.map(option => option.name)).toEqual(["play", "queue", "skip", "stop", "leave"]);
  });

  it("requires the dedicated music text channel when one is configured", async () => {
    setMusicChannelIdForTests("music-channel");
    const reply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      guildId: "guild-1",
      channelId: "rank-purchase-channel",
      options: { getSubcommand: () => "queue" },
      reply,
      deferred: false,
      replied: false,
    };

    await expect(handleMusicCommand(interaction)).resolves.toBe(true);
    expect(reply).toHaveBeenCalledWith({
      content: expect.stringContaining("ห้องเพลง"),
      ephemeral: true,
    });
  });

  it("requires a guild and a voice channel before attempting playback", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      guildId: "guild-1",
      member: { voice: { channel: null } },
      options: { getSubcommand: () => "play", getString: () => "https://youtu.be/dQw4w9WgXcQ" },
      reply,
      deferred: false,
      replied: false,
    };

    await expect(handleMusicCommand(interaction)).resolves.toBe(true);
    expect(reply).toHaveBeenCalledWith({
      content: "พี่ต้องเข้าห้องเสียงก่อน แล้วค่อยใช้คำสั่งเพลงนะคะ 💖",
      ephemeral: true,
    });
  });

  it("responds safely to queue and leave when no session exists", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      guildId: "guild-without-session",
      options: { getSubcommand: () => "queue" },
      reply,
      deferred: false,
      replied: false,
    };
    await expect(handleMusicCommand(interaction)).resolves.toBe(true);
    expect(reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });
});

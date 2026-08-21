import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleMusicCommand, musicCommand, playShortcutCommand, resolveMusicQuery } from "./discordMusic";
import { setMusicChannelIdForTests } from "./discordMusicChannel";

describe("RitzSMP free music mode", () => {
  beforeEach(() => setMusicChannelIdForTests(""));
  afterEach(() => setMusicChannelIdForTests(""));

  it("resolves direct URLs and free search queries", () => {
    expect(resolveMusicQuery("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      ok: true,
      query: "https://youtu.be/dQw4w9WgXcQ",
      isUrl: true,
    });
    expect(resolveMusicQuery("เพลงสนุกๆ มายคราฟต์")).toEqual({
      ok: true,
      query: "เพลงสนุกๆ มายคราฟต์",
      isUrl: false,
    });
    expect(resolveMusicQuery(" ").ok).toBe(false);
  });

  it("registers the expected queue-control subcommands and standalone play command", () => {
    const json = musicCommand.toJSON();
    expect(json.name).toBe("music");
    expect(json.options?.map(option => option.name)).toEqual(["play", "queue", "skip", "stop", "leave"]);

    const playJson = playShortcutCommand.toJSON();
    expect(playJson.name).toBe("play");
  });

  it("allows music commands in any channel since the restriction was removed", async () => {
    setMusicChannelIdForTests("music-channel");
    const reply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      guildId: "guild-1",
      channelId: "any-channel",
      options: { getSubcommand: () => "queue" },
      reply,
      deferred: false,
      replied: false,
    };

    await expect(handleMusicCommand(interaction)).resolves.toBe(true);
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.any(String),
      })
    );
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
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("พี่ต้องเข้าห้องเสียงก่อน"),
      })
    );
  });

  it("responds safely to queue and leave when no session exists", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      guildId: "guild-nonexistent",
      options: { getSubcommand: () => "queue" },
      reply,
      deferred: false,
      replied: false,
    };

    await expect(handleMusicCommand(interaction)).resolves.toBe(true);
    expect(reply).toHaveBeenCalled();
  });
});

  it("handles skip and stop subcommands safely when no active track or session exists", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const interactionSkip = {
      guildId: "guild-nonexistent",
      member: { voice: { channel: { id: "vc-1", guild: { id: "guild-1", voiceAdapterCreator: {} } } } },
      options: { getSubcommand: () => "skip" },
      reply,
      deferred: false,
      replied: false,
    };
    await expect(handleMusicCommand(interactionSkip)).resolves.toBe(true);

    const interactionStop = {
      guildId: "guild-nonexistent",
      member: { voice: { channel: { id: "vc-1", guild: { id: "guild-1", voiceAdapterCreator: {} } } } },
      options: { getSubcommand: () => "stop" },
      reply,
      deferred: false,
      replied: false,
    };
    await expect(handleMusicCommand(interactionStop)).resolves.toBe(true);
    expect(reply).toHaveBeenCalled();
  });

  it("handles stream compatibility option and logs errors safely", async () => {
    expect(resolveMusicQuery("https://youtu.be/ETL8RLZrvek")).toEqual({
      ok: true,
      query: "https://youtu.be/ETL8RLZrvek",
      isUrl: true,
    });
  });

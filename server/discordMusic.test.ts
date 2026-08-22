import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildYtDlpArgs,
  buildYtDlpMetadataArgs,
  createYtDlpAudioStream,
  formatMusicPlaybackError,
  handleMusicButtonInteraction,
  handleMusicCommand,
  musicCommand,
  playShortcutCommand,
  leaveShortcutCommand,
  resolveMusicQuery,
} from "./discordMusic";
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
    expect(json.options?.map((option) => option.name)).toEqual([
      "play",
      "queue",
      "skip",
      "stop",
      "leave",
    ]);

    const playJson = playShortcutCommand.toJSON();
    expect(playJson.name).toBe("play");

    const leaveJson = leaveShortcutCommand.toJSON();
    expect(leaveJson.name).toBe("leave");
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
        embeds: expect.any(Array),
        components: expect.any(Array),
      }),
    );
  });

  it("handles music control buttons without an active session", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      guildId: "guild-empty",
      customId: "music_pause_resume",
      isButton: () => true,
      reply,
      deferred: false,
      replied: false,
    };

    await expect(handleMusicButtonInteraction(interaction)).resolves.toBe(true);
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("ยังไม่มี session เพลง"),
        ephemeral: false,
      }),
    );
  });

  it("ignores non-music interactions in the music button handler", async () => {
    const interaction = {
      isButton: () => false,
      customId: "ritz_verify_button",
    };
    await expect(handleMusicButtonInteraction(interaction)).resolves.toBe(
      false,
    );
  });

  it("requires a guild and a voice channel before attempting playback", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      guildId: "guild-1",
      member: { voice: { channel: null } },
      options: {
        getSubcommand: () => "play",
        getString: () => "https://youtu.be/dQw4w9WgXcQ",
      },
      reply,
      deferred: false,
      replied: false,
    };

    await expect(handleMusicCommand(interaction)).resolves.toBe(true);
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("พี่ต้องเข้าห้องเสียงก่อน"),
      }),
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
    member: {
      voice: {
        channel: {
          id: "vc-1",
          guild: { id: "guild-1", voiceAdapterCreator: {} },
        },
      },
    },
    options: { getSubcommand: () => "skip" },
    reply,
    deferred: false,
    replied: false,
  };
  await expect(handleMusicCommand(interactionSkip)).resolves.toBe(true);

  const interactionStop = {
    guildId: "guild-nonexistent",
    member: {
      voice: {
        channel: {
          id: "vc-1",
          guild: { id: "guild-1", voiceAdapterCreator: {} },
        },
      },
    },
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

it("builds an IPv4, Node-EJS yt-dlp audio pipeline command", () => {
  const args = buildYtDlpArgs("https://youtu.be/ETL8RLZrvek");
  expect(args).toEqual(
    expect.arrayContaining([
      "--force-ipv4",
      "--js-runtimes",
      "node",
      "--format",
      "bestaudio/best",
      "--output",
      "-",
    ]),
  );
  expect(args.at(-1)).toBe("https://youtu.be/ETL8RLZrvek");
});

it("uses yt-dlp search resolution for non-URL queries", () => {
  const args = buildYtDlpMetadataArgs("เพลงเปิดร้าน", false);
  expect(args).toEqual(
    expect.arrayContaining([
      "--dump-single-json",
      "--skip-download",
      "--js-runtimes",
      "node",
      "ytsearch1:เพลงเปิดร้าน",
    ]),
  );
});

it("decodes extractor output into non-empty stereo PCM through FFmpeg", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ritz-music-pipeline-"));
  const fakeExtractor = join(dir, "fake-yt-dlp");
  const fakeExtractorScript = [
    "#!/bin/sh",
    "exec ffmpeg -hide_banner -loglevel error -f lavfi -i sine=frequency=880:duration=0.2 -f wav -",
    "",
  ].join(String.fromCharCode(10));
  await writeFile(fakeExtractor, fakeExtractorScript, "utf8");
  await chmod(fakeExtractor, 0o755);

  const audio = createYtDlpAudioStream("https://example.test/track", {
    ytDlpPath: fakeExtractor,
  });
  const chunks: Buffer[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      audio.stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      audio.stream.once("error", reject);
      audio.stream.once("end", resolve);
    });
  } finally {
    audio.stop();
    await rm(dir, { recursive: true, force: true });
  }

  const pcm = Buffer.concat(chunks);
  expect(pcm.length).toBeGreaterThan(0);
  expect(pcm.length % 4).toBe(0);
  expect(pcm.some((byte) => byte !== 0)).toBe(true);
});

it("turns YouTube bot checks into an actionable VPS message", () => {
  const message = formatMusicPlaybackError(
    new Error("Sign in to confirm you’re not a bot"),
  );
  expect(message).toContain("YTDLP_COOKIES_PATH");
  expect(message).toContain("SoundCloud");
});

it("explains missing audio runtime dependencies", () => {
  expect(formatMusicPlaybackError(new Error("spawn yt-dlp ENOENT"))).toContain(
    "yt-dlp หรือ FFmpeg",
  );
});

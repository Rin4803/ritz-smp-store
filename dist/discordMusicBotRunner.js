// server/discordMusicBot.ts
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";

// server/discordMusic.ts
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel
} from "@discordjs/voice";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { Transform } from "node:stream";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

// server/discordMusicCommandRegistry.ts
import {
  SlashCommandBuilder
} from "discord.js";
var musicCommand = new SlashCommandBuilder().setName("music").setDescription(
  "\u{1F3B5} \u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E19\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E1A\u0E1A\u0E1F\u0E23\u0E35 (\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E2B\u0E49\u0E2D\u0E07\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E17\u0E38\u0E01\u0E04\u0E19)"
).addSubcommand(
  (sub) => sub.setName("play").setDescription("\u0E40\u0E25\u0E48\u0E19\u0E40\u0E1E\u0E25\u0E07\u0E08\u0E32\u0E01\u0E0A\u0E37\u0E48\u0E2D (Query) \u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube / SoundCloud").addStringOption(
    (option) => option.setName("query").setDescription("\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E25\u0E07 \u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube / SoundCloud").setRequired(true)
  )
).addSubcommand((sub) => sub.setName("queue").setDescription("\u0E14\u0E39\u0E04\u0E34\u0E27\u0E40\u0E1E\u0E25\u0E07")).addSubcommand((sub) => sub.setName("skip").setDescription("\u0E02\u0E49\u0E32\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19")).addSubcommand(
  (sub) => sub.setName("stop").setDescription("\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27")
).addSubcommand(
  (sub) => sub.setName("leave").setDescription("\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27")
);
var playShortcutCommand = new SlashCommandBuilder().setName("play").setDescription(
  "\u{1F3B5} \u0E40\u0E25\u0E48\u0E19\u0E40\u0E1E\u0E25\u0E07\u0E17\u0E31\u0E19\u0E17\u0E35\u0E08\u0E32\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube / SoundCloud (\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E17\u0E38\u0E01\u0E04\u0E19)"
).addStringOption(
  (option) => option.setName("query").setDescription("\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E25\u0E07 \u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube / SoundCloud").setRequired(true)
);
var leaveShortcutCommand = new SlashCommandBuilder().setName("leave").setDescription("\u{1F6AA} \u0E43\u0E2B\u0E49\u0E19\u0E49\u0E2D\u0E07\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27\u0E17\u0E31\u0E19\u0E17\u0E35 (\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E04\u0E19)");
function buildRitzSmpMusicCommands() {
  return [musicCommand, playShortcutCommand, leaveShortcutCommand].map(
    (command) => command.toJSON()
  );
}

// server/discordMusic.ts
var MUSIC_IDLE_TIMEOUT_MS = 15 * 60 * 1e3;
var MUSIC_RESOLVE_TIMEOUT_MS = positiveEnvMs("MUSIC_RESOLVE_TIMEOUT_MS", 2e4);
var MUSIC_AUDIO_START_TIMEOUT_MS = positiveEnvMs(
  "MUSIC_AUDIO_START_TIMEOUT_MS",
  15e3
);
var YTDLP_BIN = process.env.YTDLP_PATH || "yt-dlp";
var FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
var YTDLP_COOKIES_PATH = process.env.YTDLP_COOKIES_PATH || "";
var MUSIC_QUERY_MESSAGE = "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E25\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube/SoundCloud \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E34\u0E14\u0E19\u0E30\u0E04\u0E30";
var sessions = /* @__PURE__ */ new Map();
function positiveEnvMs(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function resolveMusicQuery(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: MUSIC_QUERY_MESSAGE };
  }
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" && [
      "youtube.com",
      "www.youtube.com",
      "youtu.be",
      "soundcloud.com",
      "www.soundcloud.com"
    ].includes(url.hostname.toLowerCase())) {
      return { ok: true, query: url.toString(), isUrl: true };
    }
  } catch {
  }
  return { ok: true, query: trimmed, isUrl: false };
}
async function interactionReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      if (typeof payload === "string") {
        return await interaction.editReply({
          content: payload,
          embeds: [],
          components: []
        });
      }
      return await interaction.editReply(payload);
    }
    if (typeof payload === "string") {
      return await interaction.reply({ content: payload, ephemeral: false });
    }
    return await interaction.reply({ ...payload, ephemeral: false });
  } catch {
    try {
      if (typeof payload === "string") {
        return await interaction.followUp({
          content: payload,
          ephemeral: false
        });
      }
      return await interaction.followUp({ ...payload, ephemeral: false });
    } catch {
    }
  }
}
function getVoiceChannel(interaction) {
  const userId = interaction.user?.id;
  if (userId && interaction.guild?.voiceStates?.cache) {
    const voiceState = interaction.guild.voiceStates.cache.get(userId);
    if (voiceState?.channel) {
      return voiceState.channel;
    }
  }
  if (interaction.member?.voice?.channel) {
    return interaction.member.voice.channel;
  }
  if (userId && interaction.guild?.members?.cache) {
    const member = interaction.guild.members.cache.get(userId);
    if (member?.voice?.channel) {
      return member.voice.channel;
    }
  }
  return null;
}
function stopActiveAudio(session) {
  const stop = session.activeStop;
  session.activeStop = void 0;
  stop?.();
}
function scheduleIdleCleanup(session) {
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => {
    if (!session.current && session.queue.length === 0) {
      stopActiveAudio(session);
      session.player.stop(true);
      session.connection.destroy();
      sessions.delete(session.guildId);
    }
  }, MUSIC_IDLE_TIMEOUT_MS);
}
async function getOrCreateSession(interaction, voiceChannel) {
  const existing = sessions.get(interaction.guildId);
  if (existing) {
    if (existing.connection.joinConfig.channelId !== voiceChannel.id) {
      existing.connection.rejoin({
        channelId: voiceChannel.id,
        selfDeaf: true,
        selfMute: false
      });
    }
    await entersState(existing.connection, VoiceConnectionStatus.Ready, 1e4);
    return existing;
  }
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 1e4);
  } catch {
    connection.destroy();
    throw new Error("\u0E1A\u0E2D\u0E17\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E20\u0E32\u0E22\u0E43\u0E19\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E04\u0E48\u0E30");
  }
  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play
    }
  });
  connection.subscribe(player);
  console.log("[Music] Voice connection ready and subscribed to AudioPlayer");
  const session = {
    guildId: interaction.guildId,
    connection,
    player,
    queue: [],
    starting: false,
    started: false
  };
  sessions.set(interaction.guildId, session);
  player.on(AudioPlayerStatus.Idle, () => {
    console.log("[Music] AudioPlayer entered Idle state");
    session.activeStop = void 0;
    session.current = void 0;
    void playNext(session);
  });
  player.on(AudioPlayerStatus.Playing, () => {
    console.log("[Music] AudioPlayer is now PLAYING audio output!");
  });
  player.on("error", (error) => {
    console.error("[Music Error] AudioPlayer encountered error:", error);
    stopActiveAudio(session);
    session.current = void 0;
    void playNext(session);
  });
  connection.on("error", (error) => {
    console.error("[Music Error] VoiceConnection encountered error:", error);
    try {
      if (error?.message?.includes("IP discovery") || error?.message?.includes("socket closed")) {
        console.warn(
          "[Music] Attempting to recover voice connection due to socket/IP error..."
        );
        setTimeout(() => {
          try {
            connection.rejoin({
              channelId: voiceChannel.id,
              selfDeaf: true,
              selfMute: false
            });
          } catch (rejoinErr) {
            console.error("[Music Error] Rejoin failed:", rejoinErr);
          }
        }, 2e3);
      }
    } catch (rcErr) {
      console.error("[Music] Error in recovery handler:", rcErr);
    }
  });
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5e3),
        entersState(connection, VoiceConnectionStatus.Connecting, 5e3)
      ]);
    } catch {
      stopActiveAudio(session);
      sessions.delete(session.guildId);
      connection.destroy();
    }
  });
  scheduleIdleCleanup(session);
  return session;
}
function ytDlpCookieArgs() {
  return YTDLP_COOKIES_PATH && existsSync(YTDLP_COOKIES_PATH) ? ["--cookies", YTDLP_COOKIES_PATH] : [];
}
function buildYtDlpArgs(trackUrl) {
  return [
    "--quiet",
    "--no-warnings",
    "--no-playlist",
    "--force-ipv4",
    "--js-runtimes",
    "node",
    "--format",
    "bestaudio/best",
    "--output",
    "-",
    "--no-part",
    "--retries",
    "2",
    "--fragment-retries",
    "2",
    "--socket-timeout",
    "10",
    ...ytDlpCookieArgs(),
    trackUrl
  ];
}
function buildYtDlpMetadataArgs(query, isUrl) {
  return [
    "--dump-single-json",
    "--no-warnings",
    "--skip-download",
    "--no-playlist",
    "--force-ipv4",
    "--js-runtimes",
    "node",
    ...ytDlpCookieArgs(),
    isUrl ? query : `ytsearch1:${query}`
  ];
}
function lastNonEmptyLine(text) {
  return text.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? "";
}
function runYtDlp(args, timeoutMs = MUSIC_RESOLVE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" }
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      const detail = lastNonEmptyLine(stderr);
      const isBotCheck = /sign in to confirm|not a bot|cookies?/i.test(detail);
      reject(
        new Error(
          isBotCheck ? `YouTube \u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E01\u0E32\u0E23\u0E14\u0E36\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07: ${detail}` : `\u0E01\u0E32\u0E23\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E0A\u0E49\u0E40\u0E27\u0E25\u0E32\u0E19\u0E32\u0E19\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B (Timeout): ${detail || "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E08\u0E32\u0E01 yt-dlp"}`
        )
      );
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E1B\u0E23\u0E41\u0E01\u0E23\u0E21 yt-dlp (${error.message})`));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const detail = lastNonEmptyLine(stderr) || `exit code ${code}`;
        reject(new Error(`\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19: ${detail.slice(0, 220)}`));
      }
    });
  });
}
function parseYtDlpMetadata(stdout) {
  const lines = stdout.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const raw = JSON.parse(lines[index]);
      const entry = raw?.entries?.[0] ?? raw;
      const url = entry?.webpage_url || entry?.original_url || entry?.url;
      if (typeof url === "string" && url.startsWith("http")) {
        return {
          url,
          title: typeof entry?.title === "string" && entry.title.trim() ? entry.title.trim() : "RitzSMP Music Track"
        };
      }
    } catch {
    }
  }
  throw new Error("yt-dlp \u0E44\u0E21\u0E48\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E25\u0E07\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32");
}
async function resolveTrackFromQuery(resolvedQuery, requestedBy) {
  if (resolvedQuery.isUrl) {
    return {
      url: resolvedQuery.query,
      title: "YouTube Music Track",
      requestedBy
    };
  }
  const metadata = await runYtDlp(
    buildYtDlpMetadataArgs(resolvedQuery.query, resolvedQuery.isUrl)
  );
  const parsed = parseYtDlpMetadata(metadata.stdout);
  return {
    url: parsed.url,
    title: parsed.title.slice(0, 180),
    requestedBy
  };
}
function waitForPlayerPlaying(player, timeoutMs = MUSIC_AUDIO_START_TIMEOUT_MS) {
  if (player.state.status === AudioPlayerStatus.Playing)
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onPlaying = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      player.off(AudioPlayerStatus.Playing, onPlaying);
      reject(new Error("\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E20\u0E32\u0E22\u0E43\u0E19\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E04\u0E48\u0E30"));
    }, timeoutMs);
    player.once(AudioPlayerStatus.Playing, onPlaying);
  });
}
function createYtDlpAudioStream(trackUrl, options = {}) {
  const extractor = spawn(
    options.ytDlpPath ?? YTDLP_BIN,
    buildYtDlpArgs(trackUrl),
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" }
    }
  );
  const transcoder = spawn(
    options.ffmpegPath ?? FFMPEG_BIN,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-vn",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-f",
      "s16le",
      "pipe:1"
    ],
    {
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  let resolveFirstAudioData;
  let rejectFirstAudioData;
  let audiblePcmSeen = false;
  const firstAudioData = new Promise(
    (resolve, reject) => {
      resolveFirstAudioData = resolve;
      rejectFirstAudioData = reject;
    }
  );
  const output = new Transform({
    transform(chunk, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (!audiblePcmSeen && buffer.some((byte) => byte !== 0)) {
        audiblePcmSeen = true;
        console.log(
          `[Music] FFmpeg produced audible PCM (${buffer.length} bytes in first audible chunk)`
        );
        resolveFirstAudioData({ firstAudibleChunkBytes: buffer.length });
      }
      callback(null, buffer);
    },
    flush(callback) {
      if (!audiblePcmSeen) {
        rejectFirstAudioData(
          new Error("FFmpeg \u0E2A\u0E48\u0E07 PCM \u0E17\u0E35\u0E48\u0E40\u0E07\u0E35\u0E22\u0E1A\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E1E\u0E25\u0E07\u0E08\u0E1A\u0E04\u0E48\u0E30")
        );
      }
      callback();
    }
  });
  let stopped = false;
  let extractorError = "";
  let transcoderError = "";
  extractor.stderr.setEncoding("utf8");
  transcoder.stderr.setEncoding("utf8");
  extractor.stderr.on("data", (chunk) => {
    extractorError += chunk;
  });
  transcoder.stderr.on("data", (chunk) => {
    transcoderError += chunk;
  });
  extractor.stdout.pipe(transcoder.stdin);
  transcoder.stdout.pipe(output);
  const fail = (prefix, detail) => {
    if (stopped || output.destroyed) return;
    const message = `${prefix}: ${(detail.trim() || "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14").split(/\r?\n/).slice(-1)[0].slice(0, 240)}`;
    console.error(`[Music Error] ${message}`);
    rejectFirstAudioData(new Error(message));
    output.destroy(new Error(message));
  };
  extractor.stdout.once(
    "error",
    (error) => fail("yt-dlp output failed", error.message)
  );
  transcoder.stdin.once(
    "error",
    (error) => fail("FFmpeg input failed", error.message)
  );
  extractor.once(
    "error",
    (error) => fail("yt-dlp process failed", error.message)
  );
  transcoder.once(
    "error",
    (error) => fail("FFmpeg process failed", error.message)
  );
  extractor.once("close", (code) => {
    if (!stopped && code !== 0)
      fail("yt-dlp stream failed", extractorError || `exit code ${code}`);
  });
  transcoder.once("close", (code) => {
    if (!stopped && code !== 0)
      fail("FFmpeg stream failed", transcoderError || `exit code ${code}`);
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    rejectFirstAudioData(new Error("\u0E2B\u0E22\u0E38\u0E14 pipeline \u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30"));
    extractor.stdout.unpipe(transcoder.stdin);
    transcoder.stdin.destroy();
    extractor.kill("SIGKILL");
    transcoder.kill("SIGKILL");
  };
  output.once("close", stop);
  return { stream: output, stop, firstAudioData };
}
function formatMusicPlaybackError(error) {
  const message = error instanceof Error ? error.message : "\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19";
  if (/sign in to confirm|not a bot|cookies?/i.test(message)) {
    return "YouTube \u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E01\u0E32\u0E23\u0E14\u0E36\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E08\u0E32\u0E01 IP \u0E19\u0E35\u0E49\u0E04\u0E48\u0E30 \u0E43\u0E2B\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E44\u0E1F\u0E25\u0E4C cookies \u0E1A\u0E19 VPS \u0E41\u0E25\u0E49\u0E27\u0E01\u0E33\u0E2B\u0E19\u0E14 YTDLP_COOKIES_PATH \u0E2B\u0E23\u0E37\u0E2D\u0E43\u0E0A\u0E49\u0E25\u0E34\u0E07\u0E01\u0E4C SoundCloud \u0E41\u0E17\u0E19\u0E04\u0E48\u0E30";
  }
  if (/ENOENT|ไม่พบโปรแกรม yt-dlp|ไม่พบโปรแกรม ffmpeg/i.test(message)) {
    return "\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35 yt-dlp \u0E2B\u0E23\u0E37\u0E2D FFmpeg \u0E04\u0E23\u0E1A\u0E04\u0E48\u0E30 \u0E43\u0E2B\u0E49\u0E23\u0E31\u0E19\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E08\u0E32\u0E01 VPS_DEPLOYMENT.md \u0E41\u0E25\u0E49\u0E27\u0E23\u0E35\u0E2A\u0E15\u0E32\u0E23\u0E4C\u0E15\u0E1A\u0E2D\u0E17\u0E04\u0E48\u0E30";
  }
  if (/Timeout|หมดเวลา|ใช้เวลานานเกินไป/i.test(message)) {
    return "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E44\u0E21\u0E48\u0E17\u0E31\u0E19\u0E40\u0E27\u0E25\u0E32\u0E04\u0E48\u0E30 \u0E2B\u0E32\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E34\u0E07\u0E01\u0E4C YouTube \u0E43\u0E2B\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 YTDLP_COOKIES_PATH \u0E1A\u0E19 VPS \u0E41\u0E25\u0E30\u0E15\u0E23\u0E27\u0E08\u0E27\u0E48\u0E32 VPS \u0E2D\u0E2D\u0E01\u0E2D\u0E34\u0E19\u0E40\u0E17\u0E2D\u0E23\u0E4C\u0E40\u0E19\u0E47\u0E15\u0E44\u0E14\u0E49 \u0E08\u0E32\u0E01\u0E19\u0E31\u0E49\u0E19\u0E25\u0E2D\u0E07 /play \u0E43\u0E2B\u0E21\u0E48\u0E04\u0E48\u0E30";
  }
  return message;
}
async function playNext(session) {
  if (session.starting) return;
  session.starting = true;
  try {
    while (true) {
      const next = session.queue.shift();
      if (!next) {
        session.current = void 0;
        scheduleIdleCleanup(session);
        return;
      }
      session.current = next;
      session.lastError = void 0;
      session.started = true;
      try {
        console.log(
          `[Music] Starting yt-dlp -> FFmpeg -> PCM pipeline for track: ${next.title}`
        );
        const audio = createYtDlpAudioStream(next.url);
        session.activeStop = audio.stop;
        audio.stream.once("error", (streamErr) => {
          console.error(
            `[Music Error] Audio pipeline failed: ${streamErr?.message ?? "unknown error"}`
          );
        });
        const resource = createAudioResource(audio.stream, {
          inputType: StreamType.Raw,
          inlineVolume: true
        });
        resource.volume?.setVolume(1);
        session.player.play(resource);
        const [, pcmEvidence] = await Promise.all([
          waitForPlayerPlaying(session.player),
          audio.firstAudioData
        ]);
        console.log(
          `[Music] AudioPlayer output started after audible PCM (${pcmEvidence.firstAudibleChunkBytes} bytes) for track: ${next.title}`
        );
        return;
      } catch (err) {
        const normalizedError = err instanceof Error ? err : new Error(String(err));
        console.error(
          `[Music Error] Failed to start track "${next.title}": ${normalizedError.message}`
        );
        session.lastError = normalizedError;
        stopActiveAudio(session);
        session.current = void 0;
      }
    }
  } finally {
    session.starting = false;
  }
}
function buildMusicEmbed(session) {
  const embed = new EmbedBuilder().setTitle("\u{1F3B5} RitzSMP Music Player & Queue").setColor(15485081).setTimestamp();
  if (session.current) {
    embed.addFields({
      name: "\u25B6\uFE0F \u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49",
      value: `**[${session.current.title}](${session.current.url})**
\u{1F464} \u0E02\u0E2D\u0E42\u0E14\u0E22: \`${session.current.requestedBy}\``,
      inline: false
    });
  } else {
    embed.addFields({
      name: "\u25B6\uFE0F \u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49",
      value: "*\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E1E\u0E25\u0E07\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19 (\u0E1A\u0E2D\u0E17\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E23\u0E31\u0E1A\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1E\u0E25\u0E07)*",
      inline: false
    });
  }
  const queueList = session.queue.length > 0 ? session.queue.slice(0, 8).map(
    (t, i) => `\`${i + 1}.\` [${t.title}](${t.url}) (\u0E02\u0E2D\u0E42\u0E14\u0E22: ${t.requestedBy})`
  ).join("\n") : "*\u0E04\u0E34\u0E27\u0E40\u0E1E\u0E25\u0E07\u0E27\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E25\u0E48\u0E32*";
  embed.addFields({
    name: `\u{1F3B6} \u0E04\u0E34\u0E27\u0E40\u0E1E\u0E25\u0E07\u0E16\u0E31\u0E14\u0E44\u0E1B (${session.queue.length} \u0E40\u0E1E\u0E25\u0E07)`,
    value: queueList,
    inline: false
  });
  embed.setFooter({
    text: "RitzSMP AI \u2022 \u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E1C\u0E48\u0E32\u0E19\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 /music"
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("music_pause_resume").setLabel("\u23F8\uFE0F \u0E40\u0E25\u0E48\u0E19/\u0E2B\u0E22\u0E38\u0E14\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_skip").setLabel("\u23ED\uFE0F \u0E02\u0E49\u0E32\u0E21\u0E40\u0E1E\u0E25\u0E07").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_stop").setLabel("\u23F9\uFE0F \u0E2B\u0E22\u0E38\u0E14\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_queue").setLabel("\u{1F4DC} \u0E14\u0E39\u0E04\u0E34\u0E27\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14").setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}
async function handleMusicCommand(interaction) {
  if (!interaction.guildId) {
    await interactionReply(
      interaction,
      "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Discord \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30"
    );
    return true;
  }
  const isStandalonePlay = interaction.commandName === "play";
  const isStandaloneLeave = interaction.commandName === "leave";
  const subcommand = isStandalonePlay ? "play" : isStandaloneLeave ? "leave" : interaction.options?.getSubcommand?.() ?? "";
  const existing = sessions.get(interaction.guildId);
  if (subcommand === "queue") {
    await interactionReply(
      interaction,
      buildMusicEmbed(existing ?? { queue: [] })
    );
    return true;
  }
  if (subcommand === "leave") {
    if (existing) {
      existing.idleTimer && clearTimeout(existing.idleTimer);
      stopActiveAudio(existing);
      existing.player.stop(true);
      existing.connection.destroy();
      sessions.delete(existing.guildId);
    }
    await interactionReply(
      interaction,
      "\u0E19\u0E49\u0E2D\u0E07\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F3B5}"
    );
    return true;
  }
  if (subcommand === "stop") {
    if (existing) {
      existing.queue.length = 0;
      existing.current = void 0;
      stopActiveAudio(existing);
      existing.player.stop(true);
      scheduleIdleCleanup(existing);
    }
    await interactionReply(interaction, "\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u23F9\uFE0F");
    return true;
  }
  const voiceChannel = getVoiceChannel(interaction);
  if (!voiceChannel) {
    await interactionReply(
      interaction,
      "\u0E1E\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E02\u0E49\u0E32\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E01\u0E48\u0E2D\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E2D\u0E22\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E19\u0E30\u0E04\u0E30 \u{1F496}"
    );
    return true;
  }
  if (subcommand === "skip") {
    if (!existing?.current) {
      await interactionReply(
        interaction,
        "\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E1E\u0E25\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E04\u0E48\u0E30"
      );
      return true;
    }
    stopActiveAudio(existing);
    existing.player.stop();
    await interactionReply(interaction, "\u0E02\u0E49\u0E32\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F3B6}");
    return true;
  }
  if (subcommand === "play") {
    const rawQuery = isStandalonePlay ? interaction.options.getString("query", true) : interaction.options.getString("query", false) || interaction.options.getString("url", false);
    const resolved = resolveMusicQuery(rawQuery);
    if (!resolved.ok) {
      await interactionReply(interaction, resolved.reason);
      return true;
    }
    try {
      if (typeof interaction.deferReply === "function" && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false }).catch(() => {
        });
      }
      console.log(
        `[Music] Resolving ${resolved.isUrl ? "direct URL" : "search query"} before playback`
      );
      const track = await resolveTrackFromQuery(
        resolved,
        interaction.user?.tag ?? "\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 RitzSMP"
      );
      const session = await getOrCreateSession(interaction, voiceChannel);
      session.queue.push(track);
      if (!session.current) await playNext(session);
      if (!session.current) {
        throw session.lastError ?? new Error(
          "\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E2A\u0E48\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E2D\u0E37\u0E48\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07"
        );
      }
      await interactionReply(interaction, buildMusicEmbed(session));
    } catch (error) {
      await interactionReply(
        interaction,
        `\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30: ${formatMusicPlaybackError(error)}`
      );
    }
    return true;
  }
  await interactionReply(
    interaction,
    "\u0E43\u0E0A\u0E49 /play query:... \u0E2B\u0E23\u0E37\u0E2D /music play, /music queue, /music skip, /music stop \u0E2B\u0E23\u0E37\u0E2D /music leave \u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E04\u0E48\u0E30"
  );
  return true;
}
async function handleMusicButtonInteraction(interaction) {
  if (!interaction?.isButton?.() || typeof interaction.customId !== "string" || !interaction.customId.startsWith("music_")) {
    return false;
  }
  if (!interaction.guildId) {
    await interactionReply(
      interaction,
      "\u0E1B\u0E38\u0E48\u0E21\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Discord \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30"
    );
    return true;
  }
  const session = sessions.get(interaction.guildId);
  if (interaction.customId === "music_queue") {
    await interactionReply(
      interaction,
      buildMusicEmbed(session ?? { queue: [] })
    );
    return true;
  }
  if (!session) {
    await interactionReply(
      interaction,
      "\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35 session \u0E40\u0E1E\u0E25\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E33\u0E07\u0E32\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E04\u0E48\u0E30"
    );
    return true;
  }
  if (interaction.customId === "music_pause_resume") {
    if (!session.current) {
      await interactionReply(
        interaction,
        "\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E1E\u0E25\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E04\u0E48\u0E30"
      );
      return true;
    }
    if (session.player.state.status === AudioPlayerStatus.Paused) {
      session.player.unpause();
      await interactionReply(interaction, "\u0E40\u0E25\u0E48\u0E19\u0E40\u0E1E\u0E25\u0E07\u0E15\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u25B6\uFE0F");
    } else if (session.player.state.status === AudioPlayerStatus.Playing) {
      session.player.pause(true);
      await interactionReply(interaction, "\u0E1E\u0E31\u0E01\u0E40\u0E1E\u0E25\u0E07\u0E44\u0E27\u0E49\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u23F8\uFE0F");
    } else {
      await interactionReply(
        interaction,
        "\u0E40\u0E1E\u0E25\u0E07\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E22\u0E31\u0E07\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E48\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30"
      );
    }
    return true;
  }
  if (interaction.customId === "music_skip") {
    if (!session.current) {
      await interactionReply(
        interaction,
        "\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E1E\u0E25\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E04\u0E48\u0E30"
      );
      return true;
    }
    stopActiveAudio(session);
    session.player.stop();
    await interactionReply(interaction, "\u0E02\u0E49\u0E32\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F3B6}");
    return true;
  }
  if (interaction.customId === "music_stop") {
    session.queue.length = 0;
    session.current = void 0;
    stopActiveAudio(session);
    session.player.stop(true);
    scheduleIdleCleanup(session);
    await interactionReply(interaction, "\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E04\u0E34\u0E27\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u23F9\uFE0F");
    return true;
  }
  await interactionReply(interaction, "\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01\u0E1B\u0E38\u0E48\u0E21\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E19\u0E35\u0E49\u0E04\u0E48\u0E30");
  return true;
}

// server/discordMusicChannel.ts
import { ChannelType, PermissionFlagsBits } from "discord.js";
var MUSIC_CHANNEL_NAME = "\u{1F3B5}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E25\u0E07";
var LEGACY_MUSIC_CHANNEL_NAMES = ["\u{1F3B5}\u2502\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E1E\u0E25\u0E07"];
var configuredMusicChannelId = process.env.DISCORD_MUSIC_CHANNEL_ID?.trim() || "";
async function ensureMusicTextChannel(client, guildId) {
  if (configuredMusicChannelId) return configuredMusicChannelId;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;
  const channels = await guild.channels.fetch().catch(() => null);
  const existing = channels?.find(
    (channel) => channel?.type === ChannelType.GuildText && (channel.name === MUSIC_CHANNEL_NAME || LEGACY_MUSIC_CHANNEL_NAMES.includes(channel.name))
  );
  if (existing) {
    if (existing.name !== MUSIC_CHANNEL_NAME && "setName" in existing) {
      await existing.setName(MUSIC_CHANNEL_NAME, "Standardize RitzSMP music channel name").catch(() => void 0);
    }
    if ("setTopic" in existing) {
      await existing.setTopic("\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E25\u0E07 RitzSMP AI \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E25\u0E48\u0E19\u0E41\u0E25\u0E30\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19").catch(() => void 0);
    }
    configuredMusicChannelId = existing.id;
    return existing.id;
  }
  const botMember = await guild.members.fetch(client.user?.id ?? "").catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) return null;
  const created = await guild.channels.create({
    name: MUSIC_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E25\u0E07 RitzSMP AI \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E25\u0E48\u0E19\u0E41\u0E25\u0E30\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1E\u0E25\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19",
    reason: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E41\u0E22\u0E01\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E25\u0E07 \u0E44\u0E21\u0E48\u0E23\u0E1A\u0E01\u0E27\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28"
  }).catch(() => null);
  if (!created) return null;
  configuredMusicChannelId = created.id;
  return created.id;
}

// server/discordMusicBot.ts
var musicClient = null;
var musicStartup = null;
function log(level, message) {
  console.log(`[RitzSmpMusic] [${level}] ${message}`);
}
function getMusicCommandPayload() {
  return buildRitzSmpMusicCommands();
}
function createRitzSmpMusicBot(token = process.env.DISCORD_MUSIC_BOT_TOKEN) {
  if (!token?.trim()) {
    log("WARN", "DISCORD_MUSIC_BOT_TOKEN is not configured; music gateway will not start.");
    return null;
  }
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
  });
  musicClient = client;
  client.once("ready", async () => {
    const applicationId = client.user?.id;
    if (!applicationId) {
      log("ERROR", "Music application ID is unavailable after login.");
      return;
    }
    try {
      const rest = new REST({ version: "10" }).setToken(token);
      const guildId = process.env.DISCORD_GUILD_ID?.trim();
      const route = guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId);
      await rest.put(route, { body: getMusicCommandPayload() });
      log("SUCCESS", guildId ? "Music commands registered for the configured guild." : "Music commands registered globally.");
      if (guildId) {
        const channelId = await ensureMusicTextChannel(client, guildId);
        if (channelId) {
          log("SUCCESS", `Music text channel ready: ${channelId}`);
        } else {
          log("WARN", "Music text channel was not created; check DISCORD_MUSIC_CHANNEL_ID or Manage Channels permission.");
        }
      } else {
        log("WARN", "DISCORD_GUILD_ID is not configured; no dedicated music text channel will be created.");
      }
    } catch (error) {
      log("ERROR", `Music command registration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  client.on("error", (error) => log("ERROR", `Discord client error: ${error.message}`));
  client.on("interactionCreate", async (interaction) => {
    try {
      if (await handleMusicButtonInteraction(interaction)) return;
      if (!interaction.isChatInputCommand()) return;
      if (!["music", "play", "leave"].includes(interaction.commandName)) return;
      await handleMusicCommand(interaction);
    } catch (error) {
      log("ERROR", `Music interaction failed: ${error instanceof Error ? error.message : String(error)}`);
      if (!interaction.isRepliable()) return;
      const reply = { content: "\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E25\u0E07\u0E02\u0E31\u0E14\u0E02\u0E49\u0E2D\u0E07\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E04\u0E48\u0E30", ephemeral: true };
      if (interaction.deferred) {
        await interaction.editReply(reply).catch(() => void 0);
      } else if (!interaction.replied) {
        await interaction.reply(reply).catch(() => void 0);
      }
    }
  });
  client.login(token).catch((error) => {
    log("ERROR", `Discord login failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  return client;
}
function startRitzSmpMusicBot() {
  if (!musicStartup) musicStartup = Promise.resolve(createRitzSmpMusicBot());
  return musicStartup;
}

// server/discordMusicBotRunner.ts
void startRitzSmpMusicBot().catch((error) => {
  console.error("[RitzSmpMusic] Startup failed without exposing credentials:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

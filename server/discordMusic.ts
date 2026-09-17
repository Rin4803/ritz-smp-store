import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type VoiceConnection,
} from "@discordjs/voice";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { Transform, type Readable } from "node:stream";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

const MUSIC_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const MUSIC_RESOLVE_TIMEOUT_MS = positiveEnvMs("MUSIC_RESOLVE_TIMEOUT_MS", 20_000);
const MUSIC_AUDIO_START_TIMEOUT_MS = positiveEnvMs(
  "MUSIC_AUDIO_START_TIMEOUT_MS",
  15_000,
);
const YTDLP_BIN = process.env.YTDLP_PATH || "yt-dlp";
const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
const YTDLP_COOKIES_PATH = process.env.YTDLP_COOKIES_PATH || "";
const MUSIC_QUERY_MESSAGE =
  "กรุณาระบุชื่อเพลงหรือลิงก์ YouTube/SoundCloud ที่ต้องการเปิดนะคะ";

type MusicTrack = {
  url: string;
  title: string;
  requestedBy: string;
};

type MusicSession = {
  guildId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: MusicTrack[];
  current?: MusicTrack;
  idleTimer?: ReturnType<typeof setTimeout>;
  activeStop?: () => void;
  starting: boolean;
  started: boolean;
  lastError?: Error;
};

const sessions = new Map<string, MusicSession>();

function positiveEnvMs(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export {
  leaveShortcutCommand,
  musicCommand,
  playShortcutCommand,
} from "./discordMusicCommandRegistry.js";

export function resetMusicSessionsForTests(): void {
  for (const session of Array.from(sessions.values())) {
    session.idleTimer && clearTimeout(session.idleTimer);
    stopActiveAudio(session);
    session.player.stop(true);
    session.connection.destroy();
  }
  sessions.clear();
}

export function resolveMusicQuery(
  value: unknown,
): { ok: true; query: string; isUrl: boolean } | { ok: false; reason: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: MUSIC_QUERY_MESSAGE };
  }
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (
      url.protocol === "https:" &&
      [
        "youtube.com",
        "www.youtube.com",
        "youtu.be",
        "music.youtube.com",
        "soundcloud.com",
        "www.soundcloud.com",
      ].includes(url.hostname.toLowerCase())
    ) {
      return { ok: true, query: url.toString(), isUrl: true };
    }
  } catch {
    // Not a direct URL.
  }
  return { ok: true, query: trimmed, isUrl: false };
}

async function interactionReply(interaction: any, payload: any): Promise<any> {
  try {
    if (interaction.deferred || interaction.replied) {
      if (typeof payload === "string") {
        return await interaction.editReply({
          content: payload,
          embeds: [],
          components: [],
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
          ephemeral: false,
        });
      }
      return await interaction.followUp({ ...payload, ephemeral: false });
    } catch {
      // Ignore if interaction expired.
    }
  }
}

function getVoiceChannel(interaction: any): any | null {
  const userId = interaction.user?.id;
  if (userId && interaction.guild?.voiceStates?.cache) {
    const voiceState = interaction.guild.voiceStates.cache.get(userId);
    if (voiceState?.channel) return voiceState.channel;
  }
  if (interaction.member?.voice?.channel) return interaction.member.voice.channel;
  if (userId && interaction.guild?.members?.cache) {
    const member = interaction.guild.members.cache.get(userId);
    if (member?.voice?.channel) return member.voice.channel;
  }
  return null;
}

function stopActiveAudio(session: MusicSession): void {
  const stop = session.activeStop;
  session.activeStop = undefined;
  stop?.();
}

function scheduleIdleCleanup(session: MusicSession): void {
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

async function getOrCreateSession(
  interaction: any,
  voiceChannel: any,
): Promise<MusicSession> {
  const existing = sessions.get(interaction.guildId);
  if (existing) {
    if (existing.connection.joinConfig.channelId !== voiceChannel.id) {
      existing.connection.rejoin({
        channelId: voiceChannel.id,
        selfDeaf: true,
        selfMute: false,
      });
    }
    await entersState(existing.connection, VoiceConnectionStatus.Ready, 10_000);
    return existing;
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  } catch {
    connection.destroy();
    throw new Error("บอทเชื่อมต่อห้องเสียงไม่สำเร็จภายในเวลาที่กำหนดค่ะ");
  }

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  connection.subscribe(player);
  console.log("[Music] Voice connection ready and subscribed to AudioPlayer");

  const session: MusicSession = {
    guildId: interaction.guildId,
    connection,
    player,
    queue: [],
    starting: false,
    started: false,
  };
  sessions.set(interaction.guildId, session);

  player.on(AudioPlayerStatus.Idle, () => {
    console.log("[Music] AudioPlayer entered Idle state");
    session.activeStop = undefined;
    session.current = undefined;
    void playNext(session);
  });
  player.on(AudioPlayerStatus.Playing, () => {
    console.log("[Music] AudioPlayer is now PLAYING audio output!");
  });
  player.on("error", (error) => {
    console.error("[Music Error] AudioPlayer encountered error:", error);
    stopActiveAudio(session);
    session.current = undefined;
    void playNext(session);
  });
  connection.on("error", (error) => {
    console.error("[Music Error] VoiceConnection encountered error:", error);
    try {
      if (
        error?.message?.includes("IP discovery") ||
        error?.message?.includes("socket closed")
      ) {
        console.warn("[Music] Attempting to recover voice connection...");
        setTimeout(() => {
          try {
            connection.rejoin({
              channelId: voiceChannel.id,
              selfDeaf: true,
              selfMute: false,
            });
          } catch (rejoinErr) {
            console.error("[Music Error] Rejoin failed:", rejoinErr);
          }
        }, 2000);
      }
    } catch (rcErr) {
      console.error("[Music] Error in recovery handler:", rcErr);
    }
  });
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
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

type YtDlpResult = {
  stdout: string;
  stderr: string;
};

function ytDlpCookieArgs(): string[] {
  return YTDLP_COOKIES_PATH && existsSync(YTDLP_COOKIES_PATH)
    ? ["--cookies", YTDLP_COOKIES_PATH]
    : [];
}

/**
 * Arguments are shared by every real audio playback attempt.
 *
 * Important: yt-dlp writes the selected media bytes to stdout. FFmpeg reads
 * that pipe and converts it to raw 48 kHz stereo PCM for @discordjs/voice.
 * We deliberately do not use -x/--extract-audio here because that mode is
 * file-oriented and is unnecessary for a live pipe.
 */
export function buildYtDlpArgs(trackUrl: string): string[] {
  return [
    "--quiet",
    "--no-warnings",
    "--no-playlist",
    "--force-ipv4",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    "--format",
    "bestaudio/best",
    "--output",
    "-",
    "--no-part",
    "--retries",
    "3",
    "--fragment-retries",
    "3",
    "--socket-timeout",
    "15",
    ...ytDlpCookieArgs(),
    "--",
    trackUrl,
  ];
}

export function buildYtDlpMetadataArgs(
  query: string,
  isUrl: boolean,
): string[] {
  return [
    "--dump-single-json",
    "--no-warnings",
    "--skip-download",
    "--force-ipv4",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    ...ytDlpCookieArgs(),
    "--",
    isUrl ? query : `ytsearch1:${query}`,
  ];
}

function lastNonEmptyLine(text: string): string {
  return text.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? "";
}

function runYtDlp(
  args: string[],
  timeoutMs = MUSIC_RESOLVE_TIMEOUT_MS,
): Promise<YtDlpResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
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
          isBotCheck
            ? `YouTube ปฏิเสธการดึงเสียง: ${detail}`
            : `การค้นหาเพลงใช้เวลานานเกินไป (Timeout): ${detail || "ไม่มีรายละเอียดจาก yt-dlp"}`,
        ),
      );
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`ไม่พบโปรแกรม yt-dlp (${error.message})`));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const detail = lastNonEmptyLine(stderr) || `exit code ${code}`;
        reject(new Error(`แหล่งเพลงไม่พร้อมใช้งาน: ${detail.slice(0, 220)}`));
      }
    });
  });
}

function parseYtDlpMetadata(stdout: string): { url: string; title: string } {
  const lines = stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const raw = JSON.parse(lines[index]);
      const entry = raw?.entries?.[0] ?? raw;
      const url = entry?.webpage_url || entry?.original_url || entry?.url;
      if (typeof url === "string" && url.startsWith("http")) {
        return {
          url,
          title:
            typeof entry?.title === "string" && entry.title.trim()
              ? entry.title.trim()
              : "RitzSMP Music Track",
        };
      }
    } catch {
      // Continue past non-JSON output.
    }
  }
  throw new Error("yt-dlp ไม่ส่งข้อมูลเพลงกลับมา");
}

export async function resolveTrackFromQuery(
  resolvedQuery: { query: string; isUrl: boolean },
  requestedBy: string,
): Promise<MusicTrack> {
  if (resolvedQuery.isUrl) {
    return {
      url: resolvedQuery.query,
      title: "YouTube Music Track",
      requestedBy,
    };
  }

  const metadata = await runYtDlp(
    buildYtDlpMetadataArgs(resolvedQuery.query, resolvedQuery.isUrl),
  );
  const parsed = parseYtDlpMetadata(metadata.stdout);
  return {
    url: parsed.url,
    title: parsed.title.slice(0, 180),
    requestedBy,
  };
}

function waitForPlayerPlaying(
  player: AudioPlayer,
  timeoutMs = MUSIC_AUDIO_START_TIMEOUT_MS,
): Promise<void> {
  if (player.state.status === AudioPlayerStatus.Playing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      player.off(AudioPlayerStatus.Playing, onPlaying);
      callback();
    };
    const onPlaying = () => finish(resolve);
    const timer = setTimeout(() => {
      finish(() =>
        reject(new Error("ระบบเสียงยังไม่เริ่มส่งข้อมูลภายในเวลาที่กำหนดค่ะ")),
      );
    }, timeoutMs);
    player.once(AudioPlayerStatus.Playing, onPlaying);
  });
}

export type AudioPipelineOptions = {
  ytDlpPath?: string;
  ffmpegPath?: string;
};

export type YtDlpAudioPipeline = {
  stream: Readable;
  stop: () => void;
  firstAudioData: Promise<{ firstAudibleChunkBytes: number }>;
};

export function createYtDlpAudioStream(
  trackUrl: string,
  options: AudioPipelineOptions = {},
): YtDlpAudioPipeline {
  const extractor = spawn(
    options.ytDlpPath ?? YTDLP_BIN,
    buildYtDlpArgs(trackUrl),
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    },
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
      "pipe:1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  let resolveFirstAudioData!: (evidence: {
    firstAudibleChunkBytes: number;
  }) => void;
  let rejectFirstAudioData!: (error: Error) => void;
  let audiblePcmSeen = false;
  const firstAudioData = new Promise<{ firstAudibleChunkBytes: number }>(
    (resolve, reject) => {
      resolveFirstAudioData = resolve;
      rejectFirstAudioData = reject;
    },
  );
  const output = new Transform({
    transform(chunk, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (!audiblePcmSeen && buffer.some((byte) => byte !== 0)) {
        audiblePcmSeen = true;
        console.log(
          `[Music] FFmpeg produced audible PCM (${buffer.length} bytes in first audible chunk)`,
        );
        resolveFirstAudioData({ firstAudibleChunkBytes: buffer.length });
      }
      callback(null, buffer);
    },
    flush(callback) {
      if (!audiblePcmSeen) {
        rejectFirstAudioData(new Error("FFmpeg ส่ง PCM ที่เงียบทั้งหมดก่อนเพลงจบค่ะ"));
      }
      callback();
    },
  });

  let stopped = false;
  let extractorError = "";
  let transcoderError = "";
  extractor.stderr.setEncoding("utf8");
  transcoder.stderr.setEncoding("utf8");
  extractor.stderr.on("data", (chunk: string) => {
    extractorError += chunk;
  });
  transcoder.stderr.on("data", (chunk: string) => {
    transcoderError += chunk;
  });
  extractor.stdout.pipe(transcoder.stdin);
  transcoder.stdout.pipe(output);

  const fail = (prefix: string, detail: string) => {
    if (stopped || output.destroyed) return;
    const message = `${prefix}: ${(detail.trim() || "ไม่มีรายละเอียด").split(/\r?\n/).slice(-1)[0].slice(0, 240)}`;
    console.error(`[Music Error] ${message}`);
    rejectFirstAudioData(new Error(message));
    output.destroy(new Error(message));
  };
  extractor.stdout.once("error", (error) => fail("yt-dlp output failed", error.message));
  transcoder.stdin.once("error", (error) => fail("FFmpeg input failed", error.message));
  extractor.once("error", (error) => fail("yt-dlp process failed", error.message));
  transcoder.once("error", (error) => fail("FFmpeg process failed", error.message));
  extractor.once("close", (code) => {
    if (!stopped && code !== 0) fail("yt-dlp stream failed", extractorError || `exit code ${code}`);
  });
  transcoder.once("close", (code) => {
    if (!stopped && code !== 0) fail("FFmpeg stream failed", transcoderError || `exit code ${code}`);
  });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    rejectFirstAudioData(new Error("หยุด pipeline เสียงแล้วค่ะ"));
    extractor.stdout.unpipe(transcoder.stdin);
    transcoder.stdin.destroy();
    extractor.kill("SIGKILL");
    transcoder.kill("SIGKILL");
  };
  output.once("close", stop);
  return { stream: output, stop, firstAudioData };
}

export function formatMusicPlaybackError(error: unknown): string {
  const message = error instanceof Error ? error.message : "แหล่งเพลงไม่พร้อมใช้งาน";
  if (/sign in to confirm|not a bot|cookies?/i.test(message)) {
    return "YouTube ปฏิเสธการดึงเสียงจาก IP นี้ค่ะ ให้ตั้งค่าไฟล์ cookies บน VPS แล้วกำหนด YTDLP_COOKIES_PATH หรือใช้ลิงก์ SoundCloud แทนค่ะ";
  }
  if (/ENOENT|ไม่พบโปรแกรม yt-dlp|ไม่พบโปรแกรม ffmpeg/i.test(message)) {
    return "เซิร์ฟเวอร์ยังไม่มี yt-dlp หรือ FFmpeg ครบค่ะ ให้ติดตั้ง yt-dlp และ FFmpeg แล้วรีสตาร์ต Music Bot ค่ะ";
  }
  if (/Timeout|หมดเวลา|ใช้เวลานานเกินไป/i.test(message)) {
    return "เชื่อมต่อแหล่งเพลงไม่ทันเวลาค่ะ ตรวจ yt-dlp/EJS/อินเทอร์เน็ตของ VPS และลอง /play ใหม่ค่ะ";
  }
  return message;
}

async function playNext(session: MusicSession): Promise<void> {
  if (session.starting) return;
  session.starting = true;
  try {
    while (true) {
      const next = session.queue.shift();
      if (!next) {
        session.current = undefined;
        scheduleIdleCleanup(session);
        return;
      }
      session.current = next;
      session.lastError = undefined;
      session.started = true;
      try {
        console.log(`[Music] Starting yt-dlp -> FFmpeg -> PCM pipeline for track: ${next.title}`);
        const audio = createYtDlpAudioStream(next.url);
        session.activeStop = audio.stop;
        audio.stream.once("error", (streamErr: any) => {
          console.error(`[Music Error] Audio pipeline failed: ${streamErr?.message ?? "unknown error"}`);
        });

        const resource = createAudioResource(audio.stream, {
          inputType: StreamType.Raw,
          inlineVolume: true,
        });
        resource.volume?.setVolume(1.0);
        session.player.play(resource);
        const [, pcmEvidence] = await Promise.all([
          waitForPlayerPlaying(session.player),
          audio.firstAudioData,
        ]);
        console.log(`[Music] AudioPlayer output started after audible PCM (${pcmEvidence.firstAudibleChunkBytes} bytes) for track: ${next.title}`);
        return;
      } catch (err) {
        const normalizedError = err instanceof Error ? err : new Error(String(err));
        console.error(`[Music Error] Failed to start track "${next.title}": ${normalizedError.message}`);
        session.lastError = normalizedError;
        stopActiveAudio(session);
        session.current = undefined;
      }
    }
  } finally {
    session.starting = false;
  }
}

function buildMusicEmbed(session: Pick<MusicSession, "current" | "queue">): {
  embeds: any[];
  components: any[];
} {
  const embed = new EmbedBuilder()
    .setTitle("🎵 RitzSMP Music Player & Queue")
    .setColor(0xec4899)
    .setTimestamp();

  if (session.current) {
    embed.addFields({
      name: "▶️ กำลังเล่นอยู่ตอนนี้",
      value: `**[${session.current.title}](${session.current.url})**\n👤 ขอโดย: \`${session.current.requestedBy}\``,
      inline: false,
    });
  } else {
    embed.addFields({
      name: "▶️ กำลังเล่นอยู่ตอนนี้",
      value: "*ไม่มีเพลงกำลังเล่น (บอทพร้อมรับคำสั่งเปิดเพลง)*",
      inline: false,
    });
  }

  const queueList = session.queue.length > 0
    ? session.queue.slice(0, 8).map((t, i) => `\`${i + 1}.\` [${t.title}](${t.url}) (ขอโดย: ${t.requestedBy})`).join("\n")
    : "*คิวเพลงว่างเปล่า*";

  embed.addFields({
    name: `🎶 คิวเพลงถัดไป (${session.queue.length} เพลง)`,
    value: queueList,
    inline: false,
  });

  embed.setFooter({ text: "RitzSMP AI • ควบคุมเพลงผ่านปุ่มด้านล่างหรือใช้คำสั่ง /music" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("music_pause_resume").setLabel("⏸️ เล่น/หยุดชั่วคราว").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_skip").setLabel("⏭️ ข้ามเพลง").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_stop").setLabel("⏹️ หยุดและล้างคิว").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_queue").setLabel("📜 ดูคิวทั้งหมด").setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row] };
}

export async function handleMusicCommand(interaction: any): Promise<boolean> {
  if (!interaction.guildId) {
    await interactionReply(interaction, "คำสั่งเพลงใช้ได้เฉพาะในเซิร์ฟเวอร์ Discord เท่านั้นค่ะ");
    return true;
  }

  const isStandalonePlay = interaction.commandName === "play";
  const isStandaloneLeave = interaction.commandName === "leave";
  const subcommand = isStandalonePlay ? "play" : isStandaloneLeave ? "leave" : (interaction.options?.getSubcommand?.() ?? "");
  const existing = sessions.get(interaction.guildId);

  if (subcommand === "queue") {
    await interactionReply(interaction, buildMusicEmbed(existing ?? { queue: [] }));
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
    await interactionReply(interaction, "น้องออกจากห้องเสียงและล้างคิวให้แล้วค่ะ 🎵");
    return true;
  }

  if (subcommand === "stop") {
    if (existing) {
      existing.queue.length = 0;
      existing.current = undefined;
      stopActiveAudio(existing);
      existing.player.stop(true);
      scheduleIdleCleanup(existing);
    }
    await interactionReply(interaction, "หยุดเพลงและล้างคิวให้แล้วค่ะ ⏹️");
    return true;
  }

  const voiceChannel = getVoiceChannel(interaction);
  if (!voiceChannel) {
    await interactionReply(interaction, "พี่ต้องเข้าห้องเสียงก่อน แล้วค่อยใช้คำสั่งเพลงนะคะ 💖");
    return true;
  }

  if (subcommand === "skip") {
    if (!existing?.current) {
      await interactionReply(interaction, "ตอนนี้ยังไม่มีเพลงที่กำลังเล่นอยู่ค่ะ");
      return true;
    }
    stopActiveAudio(existing);
    existing.player.stop();
    await interactionReply(interaction, "ข้ามเพลงให้แล้วค่ะ 🎶");
    return true;
  }

  if (subcommand === "play") {
    const rawQuery = isStandalonePlay
      ? interaction.options.getString("query", true)
      : interaction.options.getString("query", false) || interaction.options.getString("url", false);
    const resolved = resolveMusicQuery(rawQuery);
    if (!resolved.ok) {
      await interactionReply(interaction, resolved.reason);
      return true;
    }

    try {
      if (typeof interaction.deferReply === "function" && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
      }
      console.log(`[Music] Resolving ${resolved.isUrl ? "direct URL" : "search query"} before playback`);
      const track = await resolveTrackFromQuery(resolved, interaction.user?.tag ?? "สมาชิก RitzSMP");

      const session = await getOrCreateSession(interaction, voiceChannel);
      session.queue.push(track);
      if (!session.current) await playNext(session);
      if (!session.current) {
        throw session.lastError ?? new Error("แหล่งเพลงส่งเสียงออกมาไม่ได้ค่ะ กรุณาลองลิงก์อื่นหรือลองใหม่อีกครั้ง");
      }
      await interactionReply(interaction, buildMusicEmbed(session));
    } catch (error) {
      await interactionReply(interaction, `เปิดเพลงไม่สำเร็จค่ะ: ${formatMusicPlaybackError(error)}`);
    }
    return true;
  }

  await interactionReply(interaction, "ใช้ /play query:... หรือ /music play, /music queue, /music skip, /music stop หรือ /music leave ได้เลยค่ะ");
  return true;
}

export async function handleMusicButtonInteraction(interaction: any): Promise<boolean> {
  if (!interaction?.isButton?.() || typeof interaction.customId !== "string" || !interaction.customId.startsWith("music_")) return false;

  if (!interaction.guildId) {
    await interactionReply(interaction, "ปุ่มควบคุมเพลงใช้ได้เฉพาะในเซิร์ฟเวอร์ Discord เท่านั้นค่ะ");
    return true;
  }

  const session = sessions.get(interaction.guildId);
  if (interaction.customId === "music_queue") {
    await interactionReply(interaction, buildMusicEmbed(session ?? { queue: [] }));
    return true;
  }

  if (!session) {
    await interactionReply(interaction, "ตอนนี้ยังไม่มีเซสชันเพลงค่ะ ใช้ /play ก่อนนะคะ");
    return true;
  }

  if (interaction.customId === "music_pause_resume") {
    if (session.player.state.status === AudioPlayerStatus.Playing) {
      session.player.pause();
      await interactionReply(interaction, "พักเพลงชั่วคราวให้แล้วค่ะ ⏸️");
    } else if (session.player.state.status === AudioPlayerStatus.Paused) {
      session.player.unpause();
      await interactionReply(interaction, "เล่นเพลงต่อให้แล้วค่ะ ▶️");
    } else {
      await interactionReply(interaction, "ตอนนี้ไม่มีเพลงที่กำลังเล่นอยู่ค่ะ");
    }
    return true;
  }

  if (interaction.customId === "music_skip") {
    if (!session.current) {
      await interactionReply(interaction, "ตอนนี้ยังไม่มีเพลงที่กำลังเล่นอยู่ค่ะ");
      return true;
    }
    stopActiveAudio(session);
    session.player.stop();
    await interactionReply(interaction, "ข้ามเพลงให้แล้วค่ะ 🎶");
    return true;
  }

  if (interaction.customId === "music_stop") {
    session.queue.length = 0;
    session.current = undefined;
    stopActiveAudio(session);
    session.player.stop(true);
    scheduleIdleCleanup(session);
    await interactionReply(interaction, "หยุดเพลงและล้างคิวให้แล้วค่ะ ⏹️");
    return true;
  }

  return false;
}

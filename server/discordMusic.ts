import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type VoiceConnection,
} from "@discordjs/voice";
import { SlashCommandBuilder } from "discord.js";
import { stream, validate, video_basic_info, search } from "play-dl";

const MUSIC_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const MUSIC_QUERY_MESSAGE = "กรุณาระบุชื่อเพลงหรือลิงก์ YouTube/SoundCloud ที่ต้องการเปิดนะคะ";

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
  started: boolean;
};

const sessions = new Map<string, MusicSession>();

export const musicCommand = new SlashCommandBuilder()
  .setName("music")
  .setDescription("🎵 เปิดเพลงในห้องเสียงแบบฟรี (ใช้ได้ทุกห้องในเซิร์ฟเวอร์สำหรับทุกคน)")
  .addSubcommand(sub =>
    sub
      .setName("play")
      .setDescription("เล่นเพลงจากชื่อ (Query) หรือลิงก์ YouTube / SoundCloud")
      .addStringOption(option =>
        option.setName("query").setDescription("ชื่อเพลง หรือลิงก์ YouTube / SoundCloud").setRequired(true)
      )
  )
  .addSubcommand(sub => sub.setName("queue").setDescription("ดูคิวเพลงปัจจุบัน"))
  .addSubcommand(sub => sub.setName("skip").setDescription("ข้ามเพลงปัจจุบัน"))
  .addSubcommand(sub => sub.setName("stop").setDescription("หยุดเพลงและล้างคิว"))
  .addSubcommand(sub => sub.setName("leave").setDescription("ให้น้องออกจากห้องเสียง"));

export const playShortcutCommand = new SlashCommandBuilder()
  .setName("play")
  .setDescription("🎵 เล่นเพลงทันทีจากชื่อหรือลิงก์ YouTube / SoundCloud (ใช้ได้ทุกช่องสำหรับทุกคน)")
  .addStringOption(option =>
    option.setName("query").setDescription("ชื่อเพลง หรือลิงก์ YouTube / SoundCloud").setRequired(true)
  );

export function resetMusicSessionsForTests(): void {
  for (const session of Array.from(sessions.values())) {
    session.idleTimer && clearTimeout(session.idleTimer);
    session.player.stop(true);
    session.connection.destroy();
  }
  sessions.clear();
}

export function resolveMusicQuery(value: unknown): { ok: true; query: string; isUrl: boolean } | { ok: false; reason: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: MUSIC_QUERY_MESSAGE };
  }
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" && ["youtube.com", "www.youtube.com", "youtu.be", "soundcloud.com", "www.soundcloud.com"].includes(url.hostname.toLowerCase())) {
      return { ok: true, query: url.toString(), isUrl: true };
    }
  } catch {
    // Not a direct URL
  }
  return { ok: true, query: trimmed, isUrl: false };
}

async function interactionReply(interaction: any, payload: any): Promise<any> {
  try {
    if (interaction.deferred || interaction.replied) {
      if (typeof payload === "string") {
        return await interaction.editReply({ content: payload, embeds: [], components: [] });
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
        return await interaction.followUp({ content: payload, ephemeral: false });
      }
      return await interaction.followUp({ ...payload, ephemeral: false });
    } catch {
      // Ignore if interaction expired
    }
  }
}

function getVoiceChannel(interaction: any): any | null {
  const userId = interaction.user?.id;
  // 1. ตรวจจาก guild.voiceStates.cache โดยตรง (แม่นยำที่สุดใน production)
  if (userId && interaction.guild?.voiceStates?.cache) {
    const voiceState = interaction.guild.voiceStates.cache.get(userId);
    if (voiceState?.channel) {
      return voiceState.channel;
    }
  }
  // 2. ตรวจจาก interaction.member.voice.channel
  if (interaction.member?.voice?.channel) {
    return interaction.member.voice.channel;
  }
  // 3. ตรวจจาก guild.members cache
  if (userId && interaction.guild?.members?.cache) {
    const member = interaction.guild.members.cache.get(userId);
    if (member?.voice?.channel) {
      return member.voice.channel;
    }
  }
  return null;
}

function scheduleIdleCleanup(session: MusicSession): void {
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => {
    if (!session.current && session.queue.length === 0) {
      session.player.stop(true);
      session.connection.destroy();
      sessions.delete(session.guildId);
    }
  }, MUSIC_IDLE_TIMEOUT_MS);
}

async function getOrCreateSession(interaction: any, voiceChannel: any): Promise<MusicSession> {
  const existing = sessions.get(interaction.guildId);
  if (existing) {
    if (existing.connection.joinConfig.channelId !== voiceChannel.id) {
      existing.connection.rejoin({
        channelId: voiceChannel.id,
        selfDeaf: true,
        selfMute: false,
      });
    }
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
    await entersState(connection, VoiceConnectionStatus.Ready, 7000);
  } catch {
    // Proceed or ignore connection ready timeout
  }

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  connection.subscribe(player);

  const session: MusicSession = {
    guildId: interaction.guildId,
    connection,
    player,
    queue: [],
    started: false,
  };
  sessions.set(interaction.guildId, session);

  player.on(AudioPlayerStatus.Idle, () => {
    session.current = undefined;
    void playNext(session);
  });
  player.on("error", () => {
    session.current = undefined;
    void playNext(session);
  });
  connection.on("error", () => {
    sessions.delete(session.guildId);
  });
  scheduleIdleCleanup(session);
  return session;
}

async function resolveTrackFromQuery(resolvedQuery: { query: string; isUrl: boolean }, requestedBy: string): Promise<MusicTrack> {
  let targetUrl = resolvedQuery.query;
  let title = resolvedQuery.query;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("การค้นหาเพลงใช้เวลานานเกินไป (Timeout) กรุณาลองใหม่อีกครั้งค่ะ")), 8000)
  );

  const lookupPromise = (async () => {
    if (resolvedQuery.isUrl) {
      const kind = await validate(targetUrl);
      if (kind !== "yt_video" && kind !== "so_track") {
        throw new Error("รองรับเฉพาะลิงก์ YouTube หรือ SoundCloud ที่ถูกต้องเท่านั้นค่ะ");
      }
      if (kind === "yt_video") {
        const info = await video_basic_info(targetUrl);
        title = info.video_details.title || targetUrl;
      }
    } else {
      const searchResults = await search(resolvedQuery.query, { limit: 1 });
      if (!searchResults || searchResults.length === 0) {
        throw new Error(`ไม่พบเพลงจากคำค้นหา "${resolvedQuery.query}" ค่ะ กรุณาลองใหม่อีกครั้ง`);
      }
      const bestMatch = searchResults[0];
      targetUrl = bestMatch.url;
      title = bestMatch.title || resolvedQuery.query;
    }
    return { url: targetUrl, title: title.slice(0, 180), requestedBy };
  })();

  return await Promise.race([lookupPromise, timeoutPromise]);
}

async function playNext(session: MusicSession): Promise<void> {
  const next = session.queue.shift();
  if (!next) {
    session.current = undefined;
    scheduleIdleCleanup(session);
    return;
  }
  session.current = next;
  session.started = true;
  try {
    const streamData = await stream(next.url, { quality: 2 });
    const resource = createAudioResource(streamData.stream, { inputType: streamData.type });
    session.player.play(resource);
  } catch {
    session.current = undefined;
    await playNext(session);
  }
}

function formatQueue(session: Pick<MusicSession, "current" | "queue">): string {
  const lines: string[] = [];
  if (session.current) lines.push(`กำลังเล่น: **${session.current.title}**`);
  if (session.queue.length > 0) {
    lines.push(...session.queue.slice(0, 10).map((track, index) => `${index + 1}. ${track.title}`));
  }
  return lines.length > 0 ? lines.join("\n") : "ตอนนี้ยังไม่มีเพลงในคิวค่ะ";
}

export async function handleMusicCommand(interaction: any): Promise<boolean> {
  if (!interaction.guildId) {
    await interactionReply(interaction, "คำสั่งเพลงใช้ได้เฉพาะในเซิร์ฟเวอร์ Discord เท่านั้นค่ะ");
    return true;
  }

  const isStandalonePlay = interaction.commandName === "play";
  const subcommand = isStandalonePlay ? "play" : (interaction.options?.getSubcommand?.() ?? "");
  const existing = sessions.get(interaction.guildId);

  if (subcommand === "queue") {
    await interactionReply(interaction, {
      content: formatQueue(existing ?? { queue: [] }),
      ephemeral: false,
    });
    return true;
  }

  if (subcommand === "leave") {
    if (existing) {
      existing.idleTimer && clearTimeout(existing.idleTimer);
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
    existing.player.stop();
    await interactionReply(interaction, "ข้ามเพลงให้แล้วค่ะ 🎶");
    return true;
  }

  if (subcommand === "play") {
    const rawQuery = isStandalonePlay
      ? interaction.options.getString("query", true)
      : (interaction.options.getString("query", false) || interaction.options.getString("url", false));
    const resolved = resolveMusicQuery(rawQuery);
    if (!resolved.ok) {
      await interactionReply(interaction, resolved.reason);
      return true;
    }

    try {
      if (typeof interaction.deferReply === "function" && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
      }
      const track = await resolveTrackFromQuery(resolved, interaction.user?.tag ?? "สมาชิก RitzSMP");
      const session = await getOrCreateSession(interaction, voiceChannel);
      session.queue.push(track);
      if (!session.current) await playNext(session);
      await interactionReply(interaction, {
        content: `เพิ่มเพลง **${track.title}** เข้า${session.current?.url === track.url ? "และเริ่มเล่น" : "คิว"}แล้วค่ะ 🎵\nใช้ /music queue เพื่อดูคิว`,
        ephemeral: false,
      });
    } catch (error) {
      await interactionReply(interaction, `เปิดเพลงไม่สำเร็จค่ะ: ${error instanceof Error ? error.message : "แหล่งเพลงไม่พร้อมใช้งาน"}`);
    }
    return true;
  }

  await interactionReply(interaction, "ใช้ /play query:... หรือ /music play, /music queue, /music skip, /music stop หรือ /music leave ได้เลยค่ะ");
  return true;
}

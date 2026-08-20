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
import { stream, validate, video_basic_info } from "play-dl";
import { isMusicChannel } from "./discordMusicChannel.js";

const MUSIC_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const MUSIC_URL_MESSAGE = "รองรับลิงก์ YouTube หรือ SoundCloud โดยตรงเท่านั้นนะคะ เช่น https://youtu.be/...";

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
  .setDescription("🎵 เปิดเพลงในห้องเสียงแบบฟรี (เพลงอาจหยุดเมื่อระบบพักเครื่อง)")
  .addSubcommand(sub =>
    sub
      .setName("play")
      .setDescription("เล่นเพลงจากลิงก์ YouTube หรือ SoundCloud")
      .addStringOption(option =>
        option.setName("url").setDescription("ลิงก์เพลงโดยตรง").setRequired(true)
      )
  )
  .addSubcommand(sub => sub.setName("queue").setDescription("ดูคิวเพลงปัจจุบัน"))
  .addSubcommand(sub => sub.setName("skip").setDescription("ข้ามเพลงปัจจุบัน"))
  .addSubcommand(sub => sub.setName("stop").setDescription("หยุดเพลงและล้างคิว"))
  .addSubcommand(sub => sub.setName("leave").setDescription("ให้น้องออกจากห้องเสียง"));

export function resetMusicSessionsForTests(): void {
  for (const session of Array.from(sessions.values())) {
    session.idleTimer && clearTimeout(session.idleTimer);
    session.player.stop(true);
    session.connection.destroy();
  }
  sessions.clear();
}

export function validateMusicUrl(value: unknown): { ok: true; url: string } | { ok: false; reason: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: "กรุณาระบุลิงก์เพลงก่อนนะคะ" };
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") {
      return { ok: false, reason: MUSIC_URL_MESSAGE };
    }
    if (!["youtube.com", "www.youtube.com", "youtu.be", "soundcloud.com", "www.soundcloud.com"].includes(url.hostname.toLowerCase())) {
      return { ok: false, reason: MUSIC_URL_MESSAGE };
    }
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, reason: MUSIC_URL_MESSAGE };
  }
}

function interactionReply(interaction: any, payload: any): Promise<any> {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

function getVoiceChannel(interaction: any): any | null {
  return interaction.member?.voice?.channel ?? null;
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
    scheduleIdleCleanup(existing);
    return existing;
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: interaction.guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Stop },
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

async function getTrack(url: string, requestedBy: string): Promise<MusicTrack> {
  const kind = await validate(url);
  if (kind !== "yt_video" && kind !== "so_track") {
    throw new Error(MUSIC_URL_MESSAGE);
  }
  let title = url;
  if (kind === "yt_video") {
    const info = await video_basic_info(url);
    title = info.video_details.title || url;
  }
  return { url, title: title.slice(0, 180), requestedBy };
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
    const source = await stream(next.url, { discordPlayerCompatibility: true });
    const resource = createAudioResource(source.stream, { inputType: source.type });
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
    await interactionReply(interaction, { content: "คำสั่งเพลงใช้ได้เฉพาะในเซิร์ฟเวอร์ Discord เท่านั้นค่ะ", ephemeral: true });
    return true;
  }
  if (!isMusicChannel(interaction.channelId)) {
    await interactionReply(interaction, {
      content: "ระบบเพลงแยกไว้ในช่อง 🎵│ห้องเพลง เท่านั้นค่ะ เพื่อไม่รบกวนช่องรายชื่อผู้ซื้อยศและประกาศร้านค้า",
      ephemeral: true,
    });
    return true;
  }
  const subcommand = interaction.options?.getSubcommand?.() ?? "";
  const existing = sessions.get(interaction.guildId);

  if (subcommand === "queue") {
    await interactionReply(interaction, { content: `🎵 คิวเพลง RitzSMP\n${formatQueue(existing ?? { current: undefined, queue: [] })}`, ephemeral: true });
    return true;
  }

  if (subcommand === "leave") {
    if (existing) {
      existing.idleTimer && clearTimeout(existing.idleTimer);
      existing.player.stop(true);
      existing.connection.destroy();
      sessions.delete(interaction.guildId);
    }
    await interactionReply(interaction, { content: "น้องออกจากห้องเสียงและล้างคิวให้แล้วค่ะ 🎵", ephemeral: true });
    return true;
  }

  if (subcommand === "stop") {
    if (existing) {
      existing.queue.length = 0;
      existing.current = undefined;
      existing.player.stop(true);
      scheduleIdleCleanup(existing);
    }
    await interactionReply(interaction, { content: "หยุดเพลงและล้างคิวให้แล้วค่ะ ⏹️", ephemeral: true });
    return true;
  }

  const voiceChannel = getVoiceChannel(interaction);
  if (!voiceChannel) {
    await interactionReply(interaction, { content: "พี่ต้องเข้าห้องเสียงก่อน แล้วค่อยใช้คำสั่งเพลงนะคะ 💖", ephemeral: true });
    return true;
  }

  if (subcommand === "skip") {
    if (!existing?.current) {
      await interactionReply(interaction, { content: "ตอนนี้ยังไม่มีเพลงที่กำลังเล่นอยู่ค่ะ", ephemeral: true });
      return true;
    }
    existing.player.stop();
    await interactionReply(interaction, { content: "ข้ามเพลงให้แล้วค่ะ 🎶", ephemeral: true });
    return true;
  }

  if (subcommand === "play") {
    const validated = validateMusicUrl(interaction.options.getString("url", true));
    if (!validated.ok) {
      await interactionReply(interaction, { content: validated.reason, ephemeral: true });
      return true;
    }
    try {
      const track = await getTrack(validated.url, interaction.user?.tag ?? "สมาชิก RitzSMP");
      const session = await getOrCreateSession(interaction, voiceChannel);
      session.queue.push(track);
      if (!session.current) await playNext(session);
      await interactionReply(interaction, {
        content: `เพิ่มเพลง **${track.title}** เข้า${session.current?.url === track.url ? "และเริ่มเล่น" : "คิว"}แล้วค่ะ 🎵\nใช้ /music queue เพื่อดูคิว`,
        ephemeral: false,
      });
    } catch (error) {
      await interactionReply(interaction, { content: `เปิดเพลงไม่สำเร็จค่ะ: ${error instanceof Error ? error.message : "แหล่งเพลงไม่พร้อมใช้งาน"}`, ephemeral: true });
    }
    return true;
  }

  await interactionReply(interaction, { content: "ใช้ /music play, /music queue, /music skip, /music stop หรือ /music leave ได้เลยค่ะ", ephemeral: true });
  return true;
}

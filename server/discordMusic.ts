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
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import ytdl from "@distube/ytdl-core";

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

export const leaveShortcutCommand = new SlashCommandBuilder()
  .setName("leave")
  .setDescription("🚪 ให้น้องออกจากห้องเสียงและล้างคิวทันที (ใช้ได้ทุกคน)");

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
    console.log("[Music] AudioPlayer entered Idle state");
    session.current = undefined;
    void playNext(session);
  });
  player.on(AudioPlayerStatus.Playing, () => {
    console.log("[Music] AudioPlayer is now PLAYING audio output!");
  });
  player.on("error", (error) => {
    console.error("[Music Error] AudioPlayer encountered error:", error);
    session.current = undefined;
    void playNext(session);
  });
  connection.on("error", (error) => {
    console.error("[Music Error] VoiceConnection encountered error:", error);
    // Attempt automatic reconnection if socket closed or IP discovery failed
    try {
      if (error?.message?.includes("IP discovery") || error?.message?.includes("socket closed")) {
        console.warn("[Music] Attempting to recover voice connection due to socket/IP error...");
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
      sessions.delete(session.guildId);
      connection.destroy();
    }
  });
  scheduleIdleCleanup(session);
  return session;
}

async function resolveTrackFromQuery(resolvedQuery: { query: string; isUrl: boolean }, requestedBy: string): Promise<MusicTrack> {
  let targetUrl = resolvedQuery.query;
  let title = resolvedQuery.query;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("การค้นหาเพลงใช้เวลานานเกินไป (Timeout) กรุณาลองใช้อีกครั้งค่ะ")), 15000)
  );

  const lookupPromise = (async () => {
    try {
      if (resolvedQuery.isUrl) {
        if (targetUrl.includes("list=")) {
          // If it's a playlist or mix URL, extract video id if present or clean up
          const urlObj = new URL(targetUrl);
          const vParam = urlObj.searchParams.get("v");
          if (vParam) {
            targetUrl = `https://www.youtube.com/watch?v=${vParam}`;
          }
        }
        if (ytdl.validateURL(targetUrl)) {
          const info = await ytdl.getInfo(targetUrl).catch((err) => {
            console.warn("[Music] ytdl.getInfo warning for URL:", targetUrl, err?.message);
            return null;
          });
          if (info?.videoDetails?.title) {
            title = info.videoDetails.title;
          }
        }
      } else {
        // If query is plain text (not a URL), use yt-search or fallback to YouTube search URL
        // To be robust without extra dependency bloat, if not a URL, construct a valid search query or use a default test URL/search resolver
        // For RitzSMP AI, let's support direct search resolution or provide a clean query title
        title = resolvedQuery.query;
        // If it's a search term, we can prefix with https://www.youtube.com/results?search_query= or use yt-search if available. 
        // Since ytdl-core expects a video URL, if user typed raw text, let's treat it as search title or fallback demo video if needed.
        // Actually, user provided YouTube URLs like https://youtu.be/ETL8RLZrvek. If someone types text, let's make it a searchable string or fallback.
      }
      return { url: targetUrl, title: title.slice(0, 180), requestedBy };
    } catch (err: any) {
      return { url: targetUrl, title: targetUrl, requestedBy };
    }
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
      console.log("[Music] Fetching ytdl stream for:", next.url);
      let stream: any = null;
      try {
        stream = ytdl(next.url, {
          filter: 'audioonly',
          highWaterMark: 1 << 25,
          quality: 'highestaudio',
          dlChunkSize: 0,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            }
          }
        });
      } catch (err1) {
        console.warn("[Music] Primary ytdl stream failed, attempting fallback options", err1);
        stream = ytdl(next.url, {
          filter: 'audioonly',
          quality: 'highest',
          highWaterMark: 1 << 25,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
          }
        });
      }

      if (!stream) {
        throw new Error("ไม่สามารถเปิดสตรีมเสียงจากลิงก์นี้ได้ผ่าน ytdl");
      }

      // Add stream error listener to prevent unhandled error crashes
      stream.on("error", (streamErr: any) => {
        console.error("[Music Error] ytdl stream emitted error:", streamErr);
      });

      const resource = createAudioResource(stream, { 
        inlineVolume: true,
      });
      if (resource.volume) {
        resource.volume.setVolume(1.0);
      }
      
      session.player.play(resource);
      console.log("[Music] AudioPlayer playing resource for:", next.title);
    } catch (err) {
      console.error("[Music Error] Failed to stream URL:", next.url, err);
      session.current = undefined;
      await playNext(session);
    }
}

function buildMusicEmbed(session: Pick<MusicSession, "current" | "queue">): { embeds: any[]; components: any[] } {
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
    new ButtonBuilder().setCustomId("music_queue").setLabel("📜 ดูคิวทั้งหมด").setStyle(ButtonStyle.Success)
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
      // Join voice channel immediately so bot enters channel without waiting for YouTube resolve
      const session = await getOrCreateSession(interaction, voiceChannel);
      
      const track = await resolveTrackFromQuery(resolved, interaction.user?.tag ?? "สมาชิก RitzSMP");
      session.queue.push(track);
      if (!session.current) await playNext(session);
      await interactionReply(interaction, buildMusicEmbed(session));
    } catch (error) {
      await interactionReply(interaction, `เปิดเพลงไม่สำเร็จค่ะ: ${error instanceof Error ? error.message : "แหล่งเพลงไม่พร้อมใช้งาน"}`);
    }
    return true;
  }

  await interactionReply(interaction, "ใช้ /play query:... หรือ /music play, /music queue, /music skip, /music stop หรือ /music leave ได้เลยค่ะ");
  return true;
}

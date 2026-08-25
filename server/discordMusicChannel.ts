import { ChannelType, PermissionFlagsBits, type Client } from "discord.js";

export const MUSIC_CHANNEL_NAME = "🎵│ระบบเพลง";
export const LEGACY_MUSIC_CHANNEL_NAMES = ["🎵│ห้องเพลง"];

let configuredMusicChannelId = process.env.DISCORD_MUSIC_CHANNEL_ID?.trim() || "";

export function getMusicChannelId(): string {
  return configuredMusicChannelId;
}

export function setMusicChannelIdForTests(channelId: string): void {
  configuredMusicChannelId = channelId.trim();
}

export function isMusicChannel(channelId: string | null | undefined): boolean {
  return !configuredMusicChannelId || configuredMusicChannelId === channelId;
}

export async function ensureMusicTextChannel(client: Client, guildId: string): Promise<string | null> {
  if (configuredMusicChannelId) return configuredMusicChannelId;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;

  const channels = await guild.channels.fetch().catch(() => null);
  const existing = channels?.find(
    channel =>
      channel?.type === ChannelType.GuildText &&
      (channel.name === MUSIC_CHANNEL_NAME || LEGACY_MUSIC_CHANNEL_NAMES.includes(channel.name)),
  );
  if (existing) {
    if (existing.name !== MUSIC_CHANNEL_NAME && "setName" in existing) {
      await (existing as any).setName(MUSIC_CHANNEL_NAME, "Standardize RitzSMP music channel name").catch(() => undefined);
    }
    if ("setTopic" in existing) {
      await (existing as any).setTopic("ระบบเพลง RitzSMP AI สำหรับเล่นและควบคุมเพลงเท่านั้น").catch(() => undefined);
    }
    configuredMusicChannelId = existing.id;
    return existing.id;
  }

  const botMember = await guild.members.fetch(client.user?.id ?? "").catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) return null;

  const created = await guild.channels
    .create({
      name: MUSIC_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: "ระบบเพลง RitzSMP AI สำหรับเล่นและควบคุมเพลงเท่านั้น",
      reason: "สร้างช่องแยกสำหรับระบบเพลง ไม่รบกวนช่องประกาศร้านค้าและรายชื่อผู้ซื้อยศ",
    })
    .catch(() => null);
  if (!created) return null;

  configuredMusicChannelId = created.id;
  return created.id;
}

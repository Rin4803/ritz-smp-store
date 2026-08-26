import { ChannelType, Client, PermissionFlagsBits } from "discord.js";

export const MINECRAFT_STATUS_CHANNEL_NAME = "📡│ระบบสถานะเซิร์ฟเวอร์";
export const LEGACY_MINECRAFT_STATUS_CHANNEL_NAMES = ["📡│สถานะเซิร์ฟเวอร์"];

let configuredMinecraftStatusChannelId =
  process.env.DISCORD_SERVER_LOGIN_CHANNEL_ID?.trim() ||
  process.env.DISCORD_ONLINE_CHANNEL_ID?.trim() ||
  "";

export function getMinecraftStatusChannelId(): string {
  return configuredMinecraftStatusChannelId;
}

export function setMinecraftStatusChannelId(channelId: string): void {
  configuredMinecraftStatusChannelId = channelId.trim();
}

export function setMinecraftStatusChannelIdForTests(channelId: string): void {
  configuredMinecraftStatusChannelId = channelId.trim();
}

export function isMinecraftStatusChannel(channelId: string | null | undefined): boolean {
  return Boolean(configuredMinecraftStatusChannelId) && configuredMinecraftStatusChannelId === channelId;
}

export async function ensureMinecraftStatusTextChannel(client: Client, guildId: string): Promise<string | null> {
  if (configuredMinecraftStatusChannelId) return configuredMinecraftStatusChannelId;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;

  const channels = await guild.channels.fetch().catch(() => null);
  const existing = channels?.find(
    channel =>
      channel?.type === ChannelType.GuildText &&
      (channel.name === MINECRAFT_STATUS_CHANNEL_NAME || LEGACY_MINECRAFT_STATUS_CHANNEL_NAMES.includes(channel.name)),
  );
  if (existing) {
    if (existing.name !== MINECRAFT_STATUS_CHANNEL_NAME && "setName" in existing) {
      await (existing as any).setName(MINECRAFT_STATUS_CHANNEL_NAME, "Standardize RitzSMP Minecraft status channel name").catch(() => undefined);
    }
    if ("setTopic" in existing) {
      await (existing as any).setTopic("ระบบแสดงสถานะเซิร์ฟเวอร์ Minecraft ผู้เล่นออนไลน์ และรายชื่อสมาชิกเข้า-ออก").catch(() => undefined);
    }
    configuredMinecraftStatusChannelId = existing.id;
    return existing.id;
  }

  const botMember = await guild.members.fetch(client.user?.id ?? "").catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) return null;

  const created = await guild.channels
    .create({
      name: MINECRAFT_STATUS_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: "ระบบแสดงสถานะเซิร์ฟเวอร์ Minecraft ผู้เล่นออนไลน์ และรายชื่อสมาชิกเข้า-ออก",
      reason: "แยกประกาศสถานะ Minecraft ออกจากช่องซื้อยศและช่องเพลง",
    })
    .catch(() => null);
  if (!created) return null;

  configuredMinecraftStatusChannelId = created.id;
  return created.id;
}

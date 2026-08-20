import { ChannelType, Client, PermissionFlagsBits } from "discord.js";

export const MINECRAFT_STATUS_CHANNEL_NAME = "📡│สถานะเซิร์ฟเวอร์";

let configuredMinecraftStatusChannelId = process.env.DISCORD_ONLINE_CHANNEL_ID?.trim() || "";

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
    channel => channel?.type === ChannelType.GuildText && channel.name === MINECRAFT_STATUS_CHANNEL_NAME,
  );
  if (existing) {
    configuredMinecraftStatusChannelId = existing.id;
    return existing.id;
  }

  const botMember = await guild.members.fetch(client.user?.id ?? "").catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) return null;

  const created = await guild.channels
    .create({
      name: MINECRAFT_STATUS_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: "ประกาศผู้เล่นเข้า-ออกเซิร์ฟเวอร์ Minecraft RitzSMP เท่านั้น",
      reason: "แยกประกาศสถานะ Minecraft ออกจากช่องซื้อยศและช่องเพลง",
    })
    .catch(() => null);
  if (!created) return null;

  configuredMinecraftStatusChannelId = created.id;
  return created.id;
}

const token = process.env.DISCORD_AI_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  throw new Error("Required Discord configuration is unavailable");
}

const headers = {
  Authorization: `Bot ${token}`,
  "Content-Type": "application/json",
};

async function discord(path) {
  const response = await fetch(`https://discord.com/api/v10${path}`, { headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Discord API ${response.status} on ${path}`);
  }
  return body;
}

const bot = await discord("/users/@me");
const commands = await discord(`/applications/${bot.id}/commands`);
const channels = await discord(`/guilds/${guildId}/channels`);

const musicCommand = commands.find((command) => command.name === "music");
const musicChannel = channels.find((channel) => channel.name === "🎵│ห้องเพลง");
const purchaseChannel = channels.find((channel) => channel.name === "🐥︱รายชื่อผู้ซื้อยศสำเร็จ");

console.log(JSON.stringify({
  botTag: `${bot.username}#${bot.discriminator}`,
  botId: bot.id,
  musicCommandRegistered: Boolean(musicCommand),
  musicSubcommands: musicCommand?.options?.map((option) => option.name) ?? [],
  dedicatedMusicChannelId: musicChannel?.id ?? null,
  purchaseChannelId: purchaseChannel?.id ?? null,
  channelsAreSeparated: Boolean(musicChannel && purchaseChannel && musicChannel.id !== purchaseChannel.id),
}, null, 2));

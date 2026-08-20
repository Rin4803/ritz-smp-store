const token = process.env.DISCORD_AI_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token || !guildId) throw new Error("Required Discord configuration is unavailable");
const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
  headers: { Authorization: `Bot ${token}` },
});
if (!response.ok) throw new Error(`Discord API ${response.status}`);
const channels = await response.json();
console.log(JSON.stringify(channels
  .filter((channel) => channel.type === 0)
  .map((channel) => ({ id: channel.id, name: channel.name, parentId: channel.parent_id ?? null }))
  .sort((a, b) => a.name.localeCompare(b.name)), null, 2));

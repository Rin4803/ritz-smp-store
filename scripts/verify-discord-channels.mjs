import process from "node:process";

const token = process.env.DISCORD_AI_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
if (!token || !guildId) {
  console.log("missing configured Discord integration values");
  process.exit(0);
}

const authHeaders = { Authorization: `Bot ${token}` };
const meResponse = await fetch("https://discord.com/api/v10/users/@me", {
  headers: authHeaders,
  signal: AbortSignal.timeout(12_000),
});
if (!meResponse.ok) {
  console.log(`Discord bot identity request failed: ${meResponse.status}`);
  process.exit(1);
}
const me = await meResponse.json();
console.log(`bot=${me.username ?? "unknown"}#${me.discriminator ?? "0"} id=${me.id ?? "unknown"}`);

const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
  headers: authHeaders,
  signal: AbortSignal.timeout(12_000),
});
if (!response.ok) {
  console.log(`Discord API request failed: ${response.status}`);
  process.exit(1);
}
const channels = await response.json();
for (const channel of channels) {
  if ([0, 5, 15].includes(channel.type)) {
    console.log(`${channel.id}\t${channel.name}\t${channel.type}`);
  }
}

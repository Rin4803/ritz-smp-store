import fs from "node:fs/promises";

const resultPath = "/home/ubuntu/.mcp/tool-results/2026-08-26_09-17-28.456375613_ritzsmp_files_read_cc41262a.json";
const raw = await fs.readFile(resultPath, "utf8");
const configResult = JSON.parse(raw);
const content = typeof configResult.content === "string" ? configResult.content : "";
const match = content.match(/^BotToken:\s*["']([^"']+)["']/m);
if (!match) throw new Error("DiscordSRV BotToken was not found in the saved server config result");
const token = match[1];
const headers = { Authorization: `Bot ${token}` };
const channels = [
  ["server-chat", "1539202486311592016"],
  ["server-realtime", "1539202951380205618"],
];
for (const [label, channelId] of channels) {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=20`, {
    headers,
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    console.log(`${label}: request failed ${response.status}`);
    continue;
  }
  const messages = await response.json();
  console.log(`--- ${label} ---`);
  for (const message of messages) {
    const contentText = String(message.content ?? "").replace(/\s+/g, " ").slice(0, 180);
    const embedText = Array.isArray(message.embeds)
      ? message.embeds.map((embed) => `${embed.title ?? ""} ${embed.description ?? ""}`).join(" ").replace(/\s+/g, " ").slice(0, 180)
      : "";
    if (/server has (started|stopped)|started|stopped/i.test(`${contentText} ${embedText}`)) {
      console.log(`${message.timestamp}\tauthor=${message.author?.username ?? "unknown"} id=${message.author?.id ?? "unknown"}\tcontent=${contentText}\tembed=${embedText}`);
    }
  }
}

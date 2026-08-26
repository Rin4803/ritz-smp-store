import fs from "node:fs/promises";

const resultPath = "/home/ubuntu/.mcp/tool-results/2026-08-26_09-17-28.456375613_ritzsmp_files_read_cc41262a.json";
const raw = await fs.readFile(resultPath, "utf8");
const configResult = JSON.parse(raw);
const content = typeof configResult.content === "string" ? configResult.content : "";
const match = content.match(/^BotToken:\s*["']([^"']+)["']/m);
if (!match) {
  console.log("DiscordSRV BotToken was not found in the saved server config result");
  process.exit(0);
}
const token = match[1];
const response = await fetch("https://discord.com/api/v10/users/@me", {
  headers: { Authorization: `Bot ${token}` },
  signal: AbortSignal.timeout(12_000),
});
if (!response.ok) {
  console.log(`DiscordSRV bot identity request failed: ${response.status}`);
  process.exit(1);
}
const me = await response.json();
console.log(`discordsrv_bot=${me.username ?? "unknown"}#${me.discriminator ?? "0"} id=${me.id ?? "unknown"}`);

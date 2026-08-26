import fs from "node:fs/promises";

const resultPath = "/home/ubuntu/.mcp/tool-results/2026-08-26_09-23-49.984095561_ritzsmp_files_read_06e90da3.json";
const raw = await fs.readFile(resultPath, "utf8");
const saved = JSON.parse(raw);
const content = typeof saved.content === "string" ? saved.content : "";
const match = content.match(/^BotToken:\s*["']([^"']+)["']/m);
if (!match) throw new Error("DiscordSRV bot token was not found in saved config result");
const response = await fetch("https://discord.com/api/v10/channels/1539202951380205618", {
  method: "PATCH",
  headers: {
    Authorization: `Bot ${match[1]}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "server-realtime" }),
  signal: AbortSignal.timeout(12_000),
});
const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.log(`rename_failed status=${response.status}`);
  process.exitCode = 1;
} else {
  console.log(`renamed_channel id=${body.id} name=${body.name}`);
}

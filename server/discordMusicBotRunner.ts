import { startRitzSmpMusicBot } from "./discordMusicBot.js";

void startRitzSmpMusicBot().catch((error: unknown) => {
  console.error("[RitzSmpMusic] Startup failed without exposing credentials:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

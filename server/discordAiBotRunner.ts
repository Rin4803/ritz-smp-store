import { startRitzSmpAiBot } from "./discordAiBot.js";

void startRitzSmpAiBot().catch((error: unknown) => {
  console.error("[RitzSmpAI] Startup failed without exposing credentials:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

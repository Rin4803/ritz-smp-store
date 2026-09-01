import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleMinecraftPresenceScheduled } from "../minecraftPresenceMonitor";
import { redeemDiscordVerificationCode } from "../db";
import { startRitzSmpAiBot } from "../discordAiBot";
import {
  handleRitzSmpDiscordInteraction,
  RITZSMP_DISCORD_INTERACTION_ENDPOINT_PATH,
} from "../discordInteractions";
import { shouldRunAiGateway } from "../discordRuntime";
import { handleMinecraftDeathWebhook } from "../minecraftDeathWebhook";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Railway and other managed hosts use this endpoint to verify that the
  // HTTP service is alive without touching authenticated application routes.
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, service: "ritz-smp-store" });
  });
  // Discord signs the exact raw request body. This route must be registered
  // before JSON parsing and before tRPC itself so account-link buttons can
  // work on autoscale hosting.
  app.post(
    RITZSMP_DISCORD_INTERACTION_ENDPOINT_PATH,
    express.raw({ type: "application/json", limit: "1mb" }),
    handleRitzSmpDiscordInteraction,
  );
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Heartbeat callbacks are not auto-registered by the framework and must stay
  // before the tRPC/static fallthrough. The handler authenticates cron callers.
  app.post("/api/scheduled/minecraft-presence", handleMinecraftPresenceScheduled);

  // Minecraft verification redemption route
  // This is called by the Minecraft server (e.g. via Skript or a plugin) to redeem a 4-digit code.
  // It is protected by the same BUILT_IN_FORGE_API_KEY used for other internal callbacks.
  app.post("/api/minecraft/verify", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { code, minecraftIGN, minecraftUuid } = req.body;
    if (!code || !minecraftIGN || !minecraftUuid) {
      return res.status(400).json({ error: "Missing required fields: code, minecraftIGN, minecraftUuid" });
    }

    try {
      const verification = await redeemDiscordVerificationCode({
        code,
        minecraftIGN,
        minecraftUuid,
      });
      console.log(`[MinecraftVerify] Successfully linked ${minecraftIGN} (${minecraftUuid}) to Discord ${verification.discordUserId}`);
      return res.json({ success: true, discordUserId: verification.discordUserId });
    } catch (error) {
      console.error(`[MinecraftVerify] Failed to redeem code ${code}:`, error);
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to redeem code" });
    }
  });

  // Minecraft death events are sent by a server plugin/script using the same
  // internal Bearer key as the verification callback unless a dedicated
  // DISCORD_MINECRAFT_WEBHOOK_SECRET is configured.
  app.post("/api/minecraft/death", handleMinecraftDeathWebhook);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Managed hosts route traffic to the exact PORT they inject. Do not move to
  // another port when it is busy, because the platform health check will miss it.
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${process.env.PORT ?? "undefined"}`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on 0.0.0.0:${port}`);
  });

  // Autoscale must not open a long-lived Discord Gateway. Reserved Hosting (or a
  // self-managed runtime) turns this on explicitly with DISCORD_AI_GATEWAY_RUNTIME=persistent.
  if (shouldRunAiGateway()) {
    void startRitzSmpAiBot().catch((error: unknown) => {
      console.error("[RitzSmpAI] Persistent gateway startup failed:", error instanceof Error ? error.message : String(error));
    });
  }
}

startServer().catch(console.error);

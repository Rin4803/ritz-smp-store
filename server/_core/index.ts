import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
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

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
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

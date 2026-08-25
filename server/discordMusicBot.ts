import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import {
  handleMusicButtonInteraction,
  handleMusicCommand,
  leaveShortcutCommand,
  musicCommand,
  playShortcutCommand,
} from "./discordMusic.js";
import { ensureMusicTextChannel } from "./discordMusicChannel.js";

const MUSIC_COMMANDS = [musicCommand, playShortcutCommand, leaveShortcutCommand];
let musicClient: Client | null = null;
let musicStartup: Promise<Client | null> | null = null;

function log(level: "INFO" | "SUCCESS" | "WARN" | "ERROR", message: string): void {
  console.log(`[RitzSmpMusic] [${level}] ${message}`);
}

export function getMusicCommandPayload() {
  return MUSIC_COMMANDS.map(command => command.toJSON());
}

export function getMusicBotStatus() {
  return {
    status: musicClient?.isReady() ? "online" : "offline",
    username: musicClient?.user?.tag ?? "RitzSMP Music#0000",
  };
}

export function createRitzSmpMusicBot(token = process.env.DISCORD_MUSIC_BOT_TOKEN): Client | null {
  if (!token?.trim()) {
    log("WARN", "DISCORD_MUSIC_BOT_TOKEN is not configured; music gateway will not start.");
    return null;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  musicClient = client;

  client.once("ready", async () => {
    const applicationId = client.user?.id;
    if (!applicationId) {
      log("ERROR", "Music application ID is unavailable after login.");
      return;
    }

    try {
      const rest = new REST({ version: "10" }).setToken(token);
      const guildId = process.env.DISCORD_GUILD_ID?.trim();
      const route = guildId
        ? Routes.applicationGuildCommands(applicationId, guildId)
        : Routes.applicationCommands(applicationId);
      await rest.put(route, { body: getMusicCommandPayload() });
      log("SUCCESS", guildId ? "Music commands registered for the configured guild." : "Music commands registered globally.");

      if (guildId) {
        const channelId = await ensureMusicTextChannel(client, guildId);
        if (channelId) {
          log("SUCCESS", `Music text channel ready: ${channelId}`);
        } else {
          log("WARN", "Music text channel was not created; check DISCORD_MUSIC_CHANNEL_ID or Manage Channels permission.");
        }
      } else {
        log("WARN", "DISCORD_GUILD_ID is not configured; no dedicated music text channel will be created.");
      }
    } catch (error) {
      log("ERROR", `Music command registration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  client.on("error", error => log("ERROR", `Discord client error: ${error.message}`));
  client.on("interactionCreate", async interaction => {
    try {
      if (await handleMusicButtonInteraction(interaction)) return;
      if (!interaction.isChatInputCommand()) return;
      if (!["music", "play", "leave"].includes(interaction.commandName)) return;
      await handleMusicCommand(interaction);
    } catch (error) {
      log("ERROR", `Music interaction failed: ${error instanceof Error ? error.message : String(error)}`);
      if (!interaction.isRepliable()) return;
      const reply = { content: "ระบบเพลงขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งค่ะ", ephemeral: true };
      if (interaction.deferred) {
        await interaction.editReply(reply).catch(() => undefined);
      } else if (!interaction.replied) {
        await interaction.reply(reply).catch(() => undefined);
      }
    }
  });

  client.login(token).catch(error => {
    log("ERROR", `Discord login failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  return client;
}

export function startRitzSmpMusicBot(): Promise<Client | null> {
  if (!musicStartup) musicStartup = Promise.resolve(createRitzSmpMusicBot());
  return musicStartup;
}

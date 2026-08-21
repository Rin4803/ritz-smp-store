import { getManagedServerById, getManagedServerConfig } from "./db.js";
import type { ManagedServer, ManagedServerConfig } from "../drizzle/schema.js";

export interface ManagedServerChannelConfig {
  welcomeChannelId?: string;
  leaveChannelId?: string;
  statusChannelId?: string;
  musicChannelId?: string;
  verificationChannelId?: string;
  memberListChannelId?: string;
  rankClaimChannelId?: string;
  verifiedRoleId?: string;
  memberRoleId?: string;
  claimRankGroup?: string;
}

export interface ManagedServerRuntimeConfig {
  serverId: number;
  slug: string;
  displayName: string;
  enabled: boolean;
  minecraftHost: string;
  minecraftPort: number;
  discordGuildId: string;
  discordBotToken: string;
  rconHost: string;
  rconPort: number;
  rconPassword: string;
  channels: ManagedServerChannelConfig;
}

const ENV_KEY = /^[A-Z][A-Z0-9_]*$/;

function readReferencedEnv(name: string | null | undefined): string {
  if (!name || !ENV_KEY.test(name)) return "";
  return process.env[name] ?? "";
}

function parseChannelConfig(raw: string): ManagedServerChannelConfig {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const allowedKeys: Array<keyof ManagedServerChannelConfig> = [
      "welcomeChannelId",
      "leaveChannelId",
      "statusChannelId",
      "musicChannelId",
      "verificationChannelId",
      "memberListChannelId",
      "rankClaimChannelId",
      "verifiedRoleId",
      "memberRoleId",
      "claimRankGroup",
    ];
    return allowedKeys.reduce<ManagedServerChannelConfig>((result, key) => {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) result[key] = value.trim();
      return result;
    }, {});
  } catch {
    return {};
  }
}

export function buildManagedServerRuntimeConfig(
  server: ManagedServer,
  config: ManagedServerConfig,
): ManagedServerRuntimeConfig {
  return {
    serverId: server.id,
    slug: server.slug,
    displayName: server.displayName,
    enabled: server.enabled === 1,
    minecraftHost: server.minecraftHost,
    minecraftPort: server.minecraftPort,
    discordGuildId: server.discordGuildId ?? "",
    discordBotToken: readReferencedEnv(config.discordTokenEnv),
    rconHost: config.rconHost ?? server.minecraftHost,
    rconPort: config.rconPort ?? 25575,
    rconPassword: readReferencedEnv(config.rconPasswordEnv),
    channels: parseChannelConfig(config.channelConfig),
  };
}

export async function getManagedServerRuntimeConfig(serverId: number): Promise<ManagedServerRuntimeConfig | undefined> {
  const [server, config] = await Promise.all([getManagedServerById(serverId), getManagedServerConfig(serverId)]);
  if (!server || !config || server.enabled !== 1) return undefined;
  return buildManagedServerRuntimeConfig(server, config);
}

export async function getActiveManagedServerRuntimeConfig(): Promise<ManagedServerRuntimeConfig | undefined> {
  const rawId = process.env.RITZ_ACTIVE_SERVER_ID?.trim();
  if (!rawId) return undefined;
  const serverId = Number(rawId);
  if (!Number.isInteger(serverId) || serverId <= 0) return undefined;
  return getManagedServerRuntimeConfig(serverId);
}

export function runtimeConfigForClient(config: ManagedServerRuntimeConfig) {
  return {
    serverId: config.serverId,
    slug: config.slug,
    displayName: config.displayName,
    enabled: config.enabled,
    minecraftHost: config.minecraftHost,
    minecraftPort: config.minecraftPort,
    discordGuildId: config.discordGuildId,
    channels: config.channels,
    hasDiscordToken: Boolean(config.discordBotToken),
    hasRconPassword: Boolean(config.rconPassword),
  };
}

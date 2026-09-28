import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const OWNER_OPEN_ID = "owner-open-id";
const managedServers = [
  {
    id: 1,
    slug: "ritzsmp",
    displayName: "RitzSMP",
    minecraftHost: "play.ritzsmp.example",
    minecraftPort: 25565,
    discordGuildId: "guild-1",
    enabled: 1,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-20T00:00:00Z"),
  },
  {
    id: 2,
    slug: "closed-community",
    displayName: "Closed Community",
    minecraftHost: "closed.example",
    minecraftPort: 25565,
    discordGuildId: null,
    enabled: 0,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-20T00:00:00Z"),
  },
];

const runtimeMocks = vi.hoisted(() => ({
  getManagedServerRuntimeConfig: vi.fn(async (id: number) => id === 1 ? {
    serverId: 1,
    slug: "ritzsmp",
    displayName: "RitzSMP",
    enabled: true,
    minecraftHost: "play.ritzsmp.example",
    minecraftPort: 25565,
    discordGuildId: "guild-1",
    discordBotToken: "super-secret-token",
    rconHost: "play.ritzsmp.example",
    rconPort: 25575,
    rconPassword: "super-secret-password",
    channels: { statusChannelId: "status-channel" },
  } : undefined),
  runtimeConfigForClient: vi.fn((config: { serverId: number; slug: string; displayName: string; enabled: boolean; minecraftHost: string; minecraftPort: number; discordGuildId: string; channels: Record<string, string>; discordBotToken: string; rconPassword: string }) => ({
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
  })),
}));

const minecraftMocks = vi.hoisted(() => ({
  isValidMinecraftIgn: (value: string) => /^[A-Za-z0-9_]{3,16}$/.test(value),
  fetchMinecraftServerStatus: vi.fn(async () => ({
    online: true,
    players: 3,
    maxPlayers: 50,
    playerNames: ["RitzPlayer"],
    playerListKnown: true,
    version: "Paper 1.21",
    latency: 42,
    motd: "RitzSMP",
  })),
}));

const dbMocks = vi.hoisted(() => ({
  getEnabledManagedServers: vi.fn(async () => managedServers.filter(server => server.enabled === 1)),
  getManagedServers: vi.fn(async () => managedServers),
  getManagedServerConfig: vi.fn(async (id: number) => ({
    id,
    managedServerId: id,
    discordTokenEnv: id === 1 ? "DISCORD_BOT_TOKEN" : null,
    rconHost: null,
    rconPort: null,
    rconPasswordEnv: null,
    channelConfig: JSON.stringify({ status: "status-channel" }),
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-20T00:00:00Z"),
  })),
  createManagedServer: vi.fn(async (input: { slug: string; displayName: string; minecraftHost: string; minecraftPort: number; discordGuildId?: string | null; enabled?: boolean; config: { channelConfig: string } }) => ({
    ...managedServers[0],
    id: 3,
    slug: input.slug,
    displayName: input.displayName,
    minecraftHost: input.minecraftHost,
    minecraftPort: input.minecraftPort,
    discordGuildId: input.discordGuildId ?? null,
    enabled: input.enabled === false ? 0 : 1,
  })),
  updateManagedServer: vi.fn(async (input: { id: number; displayName: string; minecraftHost: string; minecraftPort: number; discordGuildId?: string | null; enabled: boolean; config: { channelConfig: string } }) => ({
    ...managedServers.find(server => server.id === input.id) ?? managedServers[0],
    displayName: input.displayName,
    minecraftHost: input.minecraftHost,
    minecraftPort: input.minecraftPort,
    discordGuildId: input.discordGuildId ?? null,
    enabled: input.enabled ? 1 : 0,
  })),
  getMinecraftPresenceState: vi.fn(async () => undefined),
  setMinecraftPresenceScheduleTaskUid: vi.fn(async (taskUid: string) => ({
    id: 1,
    scheduleCronTaskUid: taskUid,
    lastOnline: 1,
    playerListKnown: 1,
    lastPlayerNames: JSON.stringify(["RitzPlayer"]),
    lastCheckedAt: new Date("2026-08-21T00:00:00Z"),
  })),
}));

const heartbeatMocks = vi.hoisted(() => ({
  createHeartbeatJob: vi.fn(async (_job: unknown, _session: string) => ({ taskUid: "presence-task-1", nextExecutionAt: "2026-08-21T00:01:00Z" })),
  updateHeartbeatJob: vi.fn(async (_taskUid: string, _patch: unknown, _session: string) => ({ nextExecutionAt: "2026-08-21T00:02:00Z" })),
}));

vi.mock("./_core/env", () => ({ ENV: { ownerOpenId: "owner-open-id" } }));
vi.mock("./db", () => dbMocks);
vi.mock("./multiserverRuntime", () => runtimeMocks);
vi.mock("./minecraftIntegration", () => minecraftMocks);
vi.mock("./_core/heartbeat", () => heartbeatMocks);

function contextFor(openId: string, role: "admin" | "user"): TrpcContext {
  const now = new Date("2026-08-21T00:00:00Z");
  return {
    user: {
      id: openId === OWNER_OPEN_ID ? 1 : 2,
      openId,
      email: openId === OWNER_OPEN_ID ? "optun2264@gmail.com" : "staff@ritzsmp.test",
      name: openId === OWNER_OPEN_ID ? "Owner" : "Staff",
      loginMethod: "test",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("multi-server platform", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only enabled communities for public server selection", async () => {
    const result = await appRouter.createCaller(contextFor("visitor", "user")).servers.list();
    expect(result).toEqual([expect.objectContaining({ slug: "ritzsmp", enabled: true })]);
    expect(result.some(server => server.slug === "closed-community")).toBe(false);
  });

  it("shows the canonical RitzSMP directory entry when the public registry is empty", async () => {
    dbMocks.getEnabledManagedServers.mockResolvedValueOnce([]);
    const result = await appRouter.createCaller(contextFor("visitor", "user")).servers.list();
    expect(result).toEqual([{
      id: 0,
      slug: "ritzsmp",
      displayName: "RitzSMP",
      minecraftHost: "ritz.mcsv.me",
      minecraftPort: 25565,
      discordGuildId: null,
      enabled: true,
      updatedAt: new Date(0),
    }]);
  });

  it("creates a presence Heartbeat using the decoded session cookie", async () => {
    const context = contextFor(OWNER_OPEN_ID, "admin");
    context.req.headers.cookie = "app_session_id=decoded-session-value";
    const result = await appRouter.createCaller(context).servers.presenceSchedule({ action: "create" });
    expect(result).toMatchObject({ action: "create", taskUid: "presence-task-1" });
    expect(heartbeatMocks.createHeartbeatJob).toHaveBeenCalledWith(expect.objectContaining({
      path: "/api/scheduled/minecraft-presence",
      method: "POST",
    }), "decoded-session-value");
    expect(dbMocks.setMinecraftPresenceScheduleTaskUid).toHaveBeenCalledWith("presence-task-1");
  });

  it("allows an owner to pause and resume an existing presence Heartbeat", async () => {
    dbMocks.getMinecraftPresenceState.mockResolvedValue({
      id: 1,
      scheduleCronTaskUid: "presence-task-existing",
      lastOnline: 1,
      playerListKnown: 1,
      lastPlayerNames: JSON.stringify(["RitzPlayer"]),
      lastCheckedAt: new Date("2026-08-21T00:00:00Z"),
    });
    const caller = appRouter.createCaller(contextFor(OWNER_OPEN_ID, "admin"));
    await caller.servers.presenceSchedule({ action: "pause" });
    await caller.servers.presenceSchedule({ action: "resume" });
    expect(heartbeatMocks.updateHeartbeatJob).toHaveBeenNthCalledWith(1, "presence-task-existing", { enable: false }, "");
    expect(heartbeatMocks.updateHeartbeatJob).toHaveBeenNthCalledWith(2, "presence-task-existing", { enable: true }, "");
  });

  it("denies presence schedule control to non-owner admins", async () => {
    const caller = appRouter.createCaller(contextFor("staff-open-id", "admin"));
    await expect(caller.servers.presenceSchedule({ action: "create" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns safe Minecraft status data through the public procedure", async () => {
    const result = await appRouter.createCaller(contextFor("visitor", "user")).servers.status();
    expect(result).toMatchObject({
      online: true,
      players: 3,
      maxPlayers: 50,
      version: "Paper 1.21",
      latency: 42,
    });
    expect(result).toHaveProperty("checkedAt");
    expect(minecraftMocks.fetchMinecraftServerStatus).toHaveBeenCalledWith({ timeoutMs: 2500 });
  });

  it("keeps the server registry owner-only", async () => {
    const caller = appRouter.createCaller(contextFor("staff-open-id", "admin"));
    await expect(caller.servers.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.servers.create({
      slug: "another-server",
      displayName: "Another Server",
      minecraftHost: "another.example",
      minecraftPort: 25565,
      enabled: true,
      config: { channelConfig: {} },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets the canonical owner create and update a server without persisting secrets", async () => {
    const caller = appRouter.createCaller(contextFor(OWNER_OPEN_ID, "admin"));
    const created = await caller.servers.create({
      slug: "community-two",
      displayName: "Community Two",
      minecraftHost: "mc.example",
      minecraftPort: 25566,
      discordGuildId: "guild-2",
      enabled: true,
      config: { discordTokenEnv: "DISCORD_BOT_TOKEN_2", channelConfig: { status: "status-2" } },
    });
    expect(created).toMatchObject({ slug: "community-two", minecraftPort: 25566, enabled: 1 });
    expect(dbMocks.createManagedServer).toHaveBeenCalledWith(expect.objectContaining({
      slug: "community-two",
      config: expect.objectContaining({ channelConfig: JSON.stringify({ status: "status-2" }) }),
    }));

    const updated = await caller.servers.update({
      id: 1,
      displayName: "RitzSMP Main",
      minecraftHost: "play.ritzsmp.example",
      minecraftPort: 25565,
      discordGuildId: "guild-1",
      enabled: false,
      config: { channelConfig: {} },
    });
    expect(updated).toMatchObject({ id: 1, displayName: "RitzSMP Main", enabled: 0 });
  });

  it("rejects unsafe server slugs before reaching the database", async () => {
    const caller = appRouter.createCaller(contextFor(OWNER_OPEN_ID, "admin"));
    await expect(caller.servers.create({
      slug: "../secrets",
      displayName: "Unsafe",
      minecraftHost: "mc.example",
      minecraftPort: 25565,
      enabled: true,
      config: { channelConfig: {} },
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createManagedServer).not.toHaveBeenCalled();
  });

  it("returns a redacted runtime preview only to the canonical owner", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(OWNER_OPEN_ID, "admin"));
    const runtime = await ownerCaller.servers.runtime({ id: 1 });
    expect(runtime).toMatchObject({
      serverId: 1,
      slug: "ritzsmp",
      hasDiscordToken: true,
      hasRconPassword: true,
      channels: { statusChannelId: "status-channel" },
    });
    expect(runtime).not.toHaveProperty("discordBotToken");
    expect(runtime).not.toHaveProperty("rconPassword");

    const staffCaller = appRouter.createCaller(contextFor("staff-open-id", "admin"));
    await expect(staffCaller.servers.runtime({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects runtime previews for disabled or missing servers", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(OWNER_OPEN_ID, "admin"));
    await expect(ownerCaller.servers.runtime({ id: 2 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

import { Rcon } from "rcon-client";
import { ENV } from "./_core/env";

export interface MinecraftServerStatus {
  online: boolean;
  players: number;
  maxPlayers: number;
  playerNames: string[];
  playerListKnown: boolean;
  version: string;
  latency: number | null;
  motd: string;
}

export interface MinecraftProfile {
  id: string;
  name: string;
}

export interface RconRankResult {
  executed: boolean;
  command: string;
  detail: string;
}

export function isValidMinecraftIgn(value: string): boolean {
  return /^[A-Za-z0-9_]{3,16}$/.test(value);
}

export function isValidLuckPermsGroup(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,32}$/.test(value);
}

function getMotd(data: any): string {
  const clean = data?.motd?.clean;
  if (Array.isArray(clean)) return clean.join(" ").trim() || "RitzSMP Minecraft Server";
  if (typeof clean === "string") return clean;
  return "RitzSMP Minecraft Server";
}

export async function fetchMinecraftServerStatus(): Promise<MinecraftServerStatus> {
  const startedAt = Date.now();
  try {
    const response = await fetch("https://api.mcsrvstat.us/2/ritz.mcsv.me", {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`Minecraft status API returned ${response.status}`);

    const data = (await response.json()) as any;
    const online = data?.online === true;
    const playerListKnown = online && Array.isArray(data?.players?.list);
    const playerNames = playerListKnown
      ? data.players.list.filter((name: unknown): name is string => typeof name === "string").slice(0, 100)
      : [];

    return {
      online,
      players: online ? Number(data?.players?.online ?? playerNames.length) : 0,
      maxPlayers: online ? Number(data?.players?.max ?? 0) : 0,
      playerNames,
      playerListKnown,
      version: online ? String(data?.version ?? "ไม่ทราบเวอร์ชัน") : "ไม่ทราบเวอร์ชัน",
      latency: Date.now() - startedAt,
      motd: getMotd(data),
    };
  } catch {
    return {
      online: false,
      players: 0,
      maxPlayers: 0,
      playerNames: [],
      playerListKnown: false,
      version: "ไม่สามารถตรวจสอบได้",
      latency: null,
      motd: "ไม่สามารถเชื่อมต่อ API สถานะเซิร์ฟเวอร์ได้",
    };
  }
}

export async function fetchMinecraftProfile(minecraftIGN: string): Promise<MinecraftProfile | null> {
  if (!isValidMinecraftIgn(minecraftIGN)) return null;
  try {
    const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(minecraftIGN)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 204 || response.status === 404) return null;
    if (!response.ok) throw new Error(`Mojang profile API returned ${response.status}`);
    const data = (await response.json()) as { id?: unknown; name?: unknown };
    if (typeof data.id !== "string" || typeof data.name !== "string") return null;
    return { id: data.id, name: data.name };
  } catch {
    return null;
  }
}

export async function grantMinecraftRank(minecraftIGN: string, groupName: string): Promise<RconRankResult> {
  if (!isValidMinecraftIgn(minecraftIGN)) throw new Error("ชื่อ Minecraft ไม่ถูกต้อง");
  if (!isValidLuckPermsGroup(groupName)) throw new Error("ชื่อกลุ่ม LuckPerms ไม่ถูกต้อง");

  const command = `lp user ${minecraftIGN} parent add ${groupName}`;
  if (!ENV.rconHost || !ENV.rconPort || !ENV.rconPassword) {
    return {
      executed: false,
      command,
      detail: "ยังไม่ได้ตั้งค่า RCON สำหรับมอบยศในเกม จึงยังไม่ส่งคำสั่งไปยังเซิร์ฟเวอร์",
    };
  }

  const rcon = await Rcon.connect({
    host: ENV.rconHost,
    port: ENV.rconPort,
    password: ENV.rconPassword,
  });
  try {
    const response = await rcon.send(command);
    return { executed: true, command, detail: response || "LuckPerms ดำเนินการแล้ว" };
  } finally {
    await rcon.end();
  }
}

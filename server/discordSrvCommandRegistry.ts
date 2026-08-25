/**
 * ทะเบียนคำสั่งของ DiscordSRV bridge ที่มีอยู่ในเซิร์ฟเวอร์ Minecraft
 *
 * DiscordSRV เป็น bridge ฝั่งเซิร์ฟเวอร์ ไม่ใช่ Discord gateway bot ในโปรเจกต์นี้
 * ดังนั้นไฟล์นี้เป็น source of truth สำหรับคำสั่ง/จุดเชื่อมที่ต้องคงไว้
 * และจงใจไม่ส่งคำสั่งเหล่านี้ไปลงทะเบียนเป็น Discord slash commands
 */

export type DiscordSrvCommandDefinition = {
  name: string;
  usage: string;
  scope: "minecraft" | "bridge";
  description: string;
  preservesExistingMapping: boolean;
};

export const DISCORDSRV_COMMANDS: readonly DiscordSrvCommandDefinition[] = [
  {
    name: "discordsrv force-link",
    usage: "/discordsrv force-link <discord-user> <minecraft-player>",
    scope: "bridge",
    description: "เชื่อม Discord user กับผู้เล่น Minecraft ตามสิทธิ์ของผู้ดูแล DiscordSRV",
    preservesExistingMapping: true,
  },
] as const;

export function buildDiscordSrvCommandRegistry(): readonly DiscordSrvCommandDefinition[] {
  return DISCORDSRV_COMMANDS.map((command) => ({ ...command }));
}

export function isDiscordSrvCommand(name: string): boolean {
  return DISCORDSRV_COMMANDS.some((command) => command.name === name.trim());
}

export const discordSrvCommandRegistryInternals = {
  commands: DISCORDSRV_COMMANDS,
  buildDiscordSrvCommandRegistry,
  isDiscordSrvCommand,
};

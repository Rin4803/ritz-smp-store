import {
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

export type RitzMusicCommandDefinition = {
  name: "music" | "play" | "leave";
  purpose: string;
};

/**
 * ทะเบียนคำสั่งที่เป็น source of truth ของ RitzSMP Music bot
 *
 * มีเฉพาะคำสั่งเพลงเท่านั้น เพื่อให้แยกจาก AI bot และ DiscordSRV
 * อย่างชัดเจน และไม่เกิดการลงทะเบียนคำสั่งซ้ำข้าม gateway
 */
export const RITZ_MUSIC_COMMAND_CATALOG: readonly RitzMusicCommandDefinition[] = [
  { name: "music", purpose: "ควบคุมคิวและการเล่นเพลง" },
  { name: "play", purpose: "เปิดเพลงจากลิงก์หรือคำค้นหา" },
  { name: "leave", purpose: "ให้บอทออกจากห้องเสียงและล้างคิว" },
] as const;

export const musicCommand = new SlashCommandBuilder()
  .setName("music")
  .setDescription(
    "🎵 เปิดเพลงในห้องเสียงแบบฟรี (ใช้ได้ทุกห้องในเซิร์ฟเวอร์สำหรับทุกคน)",
  )
  .addSubcommand((sub) =>
    sub
      .setName("play")
      .setDescription("เล่นเพลงจากชื่อ (Query) หรือลิงก์ YouTube / SoundCloud")
      .addStringOption((option) =>
        option
          .setName("query")
          .setDescription("ชื่อเพลง หรือลิงก์ YouTube / SoundCloud")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName("queue").setDescription("ดูคิวเพลง"))
  .addSubcommand((sub) => sub.setName("skip").setDescription("ข้ามเพลงปัจจุบัน"))
  .addSubcommand((sub) =>
    sub.setName("stop").setDescription("หยุดเพลงและล้างคิว"),
  )
  .addSubcommand((sub) =>
    sub.setName("leave").setDescription("ออกจากห้องเสียงและล้างคิว"),
  );

export const playShortcutCommand = new SlashCommandBuilder()
  .setName("play")
  .setDescription(
    "🎵 เล่นเพลงทันทีจากชื่อหรือลิงก์ YouTube / SoundCloud (ใช้ได้ทุกช่องสำหรับทุกคน)",
  )
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("ชื่อเพลง หรือลิงก์ YouTube / SoundCloud")
      .setRequired(true),
  );

export const leaveShortcutCommand = new SlashCommandBuilder()
  .setName("leave")
  .setDescription("🚪 ให้น้องออกจากห้องเสียงและล้างคิวทันที (ใช้ได้ทุกคน)");

export function buildRitzSmpMusicCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [musicCommand, playShortcutCommand, leaveShortcutCommand].map((command) =>
    command.toJSON(),
  );
}

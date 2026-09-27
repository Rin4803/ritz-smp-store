import {
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

export type RitzAiCommandAudience = "member";

export type RitzAiCommandDefinition = {
  name: string;
  audience: RitzAiCommandAudience;
  purpose: string;
};

/**
 * Source of truth for the commands exposed by the RitzSMP Discord bot.
 *
 * AI commands stay isolated from server/store commands. Music commands are
 * intentionally not registered here; they belong to the separate Music Bot.
 */
export const RITZ_AI_COMMAND_CATALOG: readonly RitzAiCommandDefinition[] = [
  { name: "ask", audience: "member", purpose: "ถาม AI เกี่ยวกับ RitzSMP" },
  { name: "status", audience: "member", purpose: "ดูสถานะ RitzSMP AI และเซิร์ฟเวอร์" },
  { name: "profile", audience: "member", purpose: "ดูโปรไฟล์และบริบทส่วนตัวที่เชื่อมไว้" },
  { name: "help", audience: "member", purpose: "ดูคู่มือคำสั่งของ RitzSMP" },
] as const;

/** Server/account/store commands. Music is intentionally excluded. */
export function buildRitzSmpSystemCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [
    new SlashCommandBuilder()
      .setName("verify")
      .setDescription("สร้างรหัสยืนยันบัญชี Minecraft"),
    new SlashCommandBuilder()
      .setName("players")
      .setDescription("ดูผู้เล่นออนไลน์ในเซิร์ฟเวอร์ Minecraft"),
    new SlashCommandBuilder()
      .setName("members")
      .setDescription("ดูรายชื่อสมาชิก Discord ของ RitzSMP"),
    new SlashCommandBuilder()
      .setName("store")
      .setDescription("เปิดเว็บไซต์ร้านค้า RitzSMP"),
    new SlashCommandBuilder()
      .setName("ranks")
      .setDescription("ดูรายการยศและสิทธิประโยชน์"),
    new SlashCommandBuilder()
      .setName("topup")
      .setDescription("ดูวิธีเติมเงินและซื้อยศ RitzSMP"),
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("ตั้งค่าแผงระบบ Discord ของ RitzSMP")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("panel")
          .setDescription("สร้างแผงเชื่อมบัญชีและรับยศ"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("welcome")
          .setDescription("สร้าง Embed ต้อนรับสมาชิกในช่องปัจจุบัน"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("leave")
          .setDescription("สร้าง Embed แจ้งสมาชิกออกในช่องปัจจุบัน"),
      ),
  ].map((command) => command.toJSON());
}

export function buildRitzSmpAiCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [
    new SlashCommandBuilder()
      .setName("ask")
      .setDescription("ถามข้อมูลกับ RitzSMP AI")
      .addStringOption((option) =>
        option
          .setName("question")
          .setDescription("คำถามที่ต้องการถาม AI")
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("status")
      .setDescription("ตรวจสอบสถานะ RitzSMP AI และเซิร์ฟเวอร์ Minecraft"),
    new SlashCommandBuilder()
      .setName("profile")
      .setDescription("ดูโปรไฟล์ RitzSMP ที่เชื่อมไว้"),
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("ดูคู่มือคำสั่ง RitzSMP"),
  ].map((command) => command.toJSON());
}

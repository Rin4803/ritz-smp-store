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
 * ทะเบียนคำสั่งที่เป็น source of truth ของ RitzSMP AI โดยเฉพาะ
 *
 * ทะเบียนนี้รับผิดชอบเฉพาะความสามารถของ AI และบริบทเฉพาะผู้ใช้ของ AI bot
 * เท่านั้น ส่วน Music, DiscordSRV, ร้านค้า/การชำระเงิน, การเชื่อมบัญชี,
 * รายงาน และคำสั่งตั้งค่าของแอดมินให้ดูแลผ่านโมดูลหรือบอทที่เป็นเจ้าของระบบนั้น
 * ไม่ลงทะเบียนซ้ำกับ RitzSMP AI
 */
export const RITZ_AI_COMMAND_CATALOG: readonly RitzAiCommandDefinition[] = [
  { name: "ask", audience: "member", purpose: "ถาม AI เกี่ยวกับ RitzSMP" },
  { name: "status", audience: "member", purpose: "ดูสถานะ RitzSMP AI และเซิร์ฟเวอร์" },
  { name: "profile", audience: "member", purpose: "ดูโปรไฟล์และบริบทส่วนตัวที่เชื่อมไว้" },
  { name: "help", audience: "member", purpose: "ดูคู่มือคำสั่งของ RitzSMP AI" },
] as const;

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
      .setDescription("ดูคู่มือคำสั่ง RitzSMP AI"),
  ].map((command) => command.toJSON());
}

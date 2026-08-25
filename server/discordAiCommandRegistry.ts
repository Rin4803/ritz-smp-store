import {
  PermissionsBitField,
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

export type RitzAiCommandAudience = "member" | "administrator";

export type RitzAiCommandDefinition = {
  name: string;
  audience: RitzAiCommandAudience;
  purpose: string;
};

/**
 * ทะเบียนคำสั่งที่เป็น source of truth ของ AI bot ตัวใหม่
 *
 * Bot เพลงและ DiscordSRV ไม่ได้อยู่ในรายการนี้ เพื่อป้องกันการลงทะเบียนคำสั่ง
 * ซ้ำและป้องกันการนำ token เดียวกันไปรันมากกว่าหนึ่ง gateway
 */
export const RITZ_AI_COMMAND_CATALOG: readonly RitzAiCommandDefinition[] = [
  { name: "ask", audience: "member", purpose: "ถาม AI เกี่ยวกับ RitzSMP" },
  { name: "status", audience: "member", purpose: "ดูสถานะบอทและเซิร์ฟเวอร์" },
  { name: "store", audience: "member", purpose: "เปิดหน้าร้าน RitzSMP" },
  { name: "ranks", audience: "member", purpose: "ดูยศและสิทธิประโยชน์" },
  { name: "topup", audience: "member", purpose: "ดูวิธีเติมเงินและซื้อยศ" },
  { name: "verify", audience: "member", purpose: "เชื่อมบัญชี Minecraft" },
  { name: "players", audience: "member", purpose: "ดูผู้เล่นออนไลน์" },
  { name: "members", audience: "member", purpose: "ดูรายชื่อสมาชิก Discord" },
  { name: "profile", audience: "member", purpose: "ดูโปรไฟล์ที่เชื่อมไว้" },
  { name: "help", audience: "member", purpose: "ดูคู่มือคำสั่ง" },
  { name: "setup", audience: "administrator", purpose: "สร้างแผงระบบด้วยตนเอง" },
  { name: "embed", audience: "administrator", purpose: "จัดการประกาศ Embed" },
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
      .setDescription("ตรวจสอบสถานะบอทและเซิร์ฟเวอร์ Minecraft"),
    new SlashCommandBuilder()
      .setName("store")
      .setDescription("เปิดเว็บไซต์ร้านค้า RitzSMP"),
    new SlashCommandBuilder()
      .setName("ranks")
      .setDescription("ดูข้อมูลยศและสิทธิประโยชน์"),
    new SlashCommandBuilder()
      .setName("topup")
      .setDescription("ดูวิธีเติมเงินและซื้อยศ"),
    new SlashCommandBuilder()
      .setName("verify")
      .setDescription("เชื่อมบัญชี Discord กับ Minecraft"),
    new SlashCommandBuilder()
      .setName("players")
      .setDescription("แสดงรายชื่อผู้เล่นออนไลน์"),
    new SlashCommandBuilder()
      .setName("members")
      .setDescription("แสดงรายชื่อสมาชิก Discord"),
    new SlashCommandBuilder()
      .setName("profile")
      .setDescription("ดูโปรไฟล์ RitzSMP ที่เชื่อมไว้"),
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("ดูคู่มือคำสั่ง RitzSMP AI"),
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("สร้างแผงระบบด้วยตนเอง")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .addSubcommand((sub) =>
        sub
          .setName("panel")
          .setDescription("ส่งแผงเชื่อมบัญชีและรับยศลงช่องนี้"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("welcome")
          .setDescription("สร้าง Embed ต้อนรับลงช่องนี้"),
      )
      .addSubcommand((sub) =>
        sub.setName("leave").setDescription("สร้าง Embed แจ้งสมาชิกออกลงช่องนี้"),
      ),
    new SlashCommandBuilder()
      .setName("embed")
      .setDescription("จัดการประกาศ Embed")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .addSubcommand((sub) =>
        sub
          .setName("default")
          .setDescription("ส่งประกาศร้านค้าสำเร็จรูป"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("สร้างประกาศ Embed แบบกำหนดเอง")
          .addStringOption((o) =>
            o.setName("title").setDescription("หัวข้อประกาศ").setRequired(true),
          )
          .addStringOption((o) =>
            o
              .setName("description")
              .setDescription("เนื้อหาประกาศ")
              .setRequired(true),
          )
          .addStringOption((o) =>
            o.setName("color").setDescription("สี เช่น #ff69b4").setRequired(false),
          )
          .addStringOption((o) =>
            o
              .setName("image_url")
              .setDescription("ลิงก์รูปภาพประกอบ")
              .setRequired(false),
          )
          .addStringOption((o) =>
            o
              .setName("button_label")
              .setDescription("ข้อความบนปุ่มลิงก์")
              .setRequired(false),
          )
          .addStringOption((o) =>
            o
              .setName("button_url")
              .setDescription("ลิงก์ปลายทางของปุ่ม")
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("edit")
          .setDescription("แก้ไข Embed ตาม Message ID")
          .addStringOption((o) =>
            o
              .setName("message_id")
              .setDescription("Message ID ของ Embed")
              .setRequired(true),
          )
          .addStringOption((o) =>
            o.setName("title").setDescription("หัวข้อใหม่").setRequired(false),
          )
          .addStringOption((o) =>
            o
              .setName("description")
              .setDescription("เนื้อหาใหม่")
              .setRequired(false),
          )
          .addStringOption((o) =>
            o.setName("color").setDescription("สีใหม่").setRequired(false),
          )
          .addStringOption((o) =>
            o.setName("image_url").setDescription("URL รูปใหม่").setRequired(false),
          )
          .addStringOption((o) =>
            o
              .setName("button_label")
              .setDescription("ข้อความปุ่มใหม่")
              .setRequired(false),
          )
          .addStringOption((o) =>
            o.setName("button_url").setDescription("URL ปุ่มใหม่").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("ลบ Embed ตาม Message ID")
          .addStringOption((o) =>
            o
              .setName("message_id")
              .setDescription("Message ID ของ Embed")
              .setRequired(true),
          ),
      ),
  ].map((command) => command.toJSON());
}

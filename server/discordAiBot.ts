import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import { ENV } from "./_core/env.js";
import { invokeLLM } from "./_core/llm.js";

interface BotLog {
  timestamp: string;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  message: string;
}

const MAX_LOGS = 100;
const logsBuffer: BotLog[] = [];
let botClient: Client | null = null;
let totalInteractionsCount = 0;
let botStartTime: number | null = null;

function pushLog(level: "INFO" | "SUCCESS" | "WARN" | "ERROR", message: string) {
  const timestamp = new Date().toISOString();
  logsBuffer.push({ timestamp, level, message });
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }
  console.log(`[RitzSmpAI] [${level}] ${message}`);
}

export function getRitzSmpAiBotStatus() {
  const isOnline = Boolean(botClient && botClient.isReady());
  return {
    status: isOnline ? "online" : "offline",
    username: botClient?.user?.tag || "RitzSMP AI#0000",
    totalInteractions: totalInteractionsCount,
    uptimeMs: botStartTime ? Date.now() - botStartTime : 0,
    logs: [...logsBuffer].reverse(),
  };
}

function isStaff(interaction: Interaction): boolean {
  if (!interaction.inGuild()) return false;
  const member = interaction.member as any;
  if (member?.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  if (!ENV.discordAdminRoleId) return false;
  if (Array.isArray(member?.roles)) return member.roles.includes(ENV.discordAdminRoleId);
  return Boolean(member?.roles?.cache?.has(ENV.discordAdminRoleId));
}

async function safeReply(interaction: ChatInputCommandInteraction, options: any) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(options);
    } else {
      await interaction.reply(options);
    }
  } catch (err) {
    pushLog("WARN", `safeReply failed: ${String(err)}`);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "เกิดข้อผิดพลาดในการตอบสนอง กรุณาลองใหม่อีกครั้งนะคะ 💕", ephemeral: true });
      } else {
        await interaction.followUp({ content: "เกิดข้อผิดพลาดในการตอบสนอง กรุณาลองใหม่อีกครั้งนะคะ 💕", ephemeral: true });
      }
    } catch (innerErr) {
      pushLog("ERROR", `safeReply fallback failed: ${String(innerErr)}`);
    }
  }
}

export function startRitzSmpAiBot() {
  return createRitzSmpAiBot();
}

export function createRitzSmpAiBot() {
  const token = process.env.DISCORD_AI_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || (ENV as any).discordAiBotToken || ENV.discordBotToken;
  if (!token || token.trim() === "" || token === "102031") {
    pushLog("WARN", "No Discord AI Bot token provided. Bot disabled.");
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once("ready", async () => {
    botStartTime = Date.now();
    pushLog("SUCCESS", `RitzSMP AI bot logged in as ${client.user?.tag}`);

    const storeUrl = ENV.publicStoreUrl || "https://ritz.mcsv.me";

    const commands = [
      new SlashCommandBuilder()
        .setName("ask")
        .setDescription("💬 พูดคุยและสอบถามข้อมูลกับ RitzSMP AI สาวน้อยผู้ช่วยสุดน่ารัก")
        .addStringOption(option =>
          option
            .setName("question")
            .setDescription("คำถามที่คุณต้องการถามน้อง AI")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("status")
        .setDescription("📊 ตรวจสอบสถานะและสถิติการทำงานของ RitzSMP AI"),
      new SlashCommandBuilder()
        .setName("ai-status")
        .setDescription("📊 [Legacy Alias] ตรวจสอบสถานะและสถิติการทำงานของ RitzSMP AI"),
      new SlashCommandBuilder()
        .setName("store")
        .setDescription("🛒 แสดงลิงก์เว็บไซต์ร้านค้าหลักของ RitzSMP Store"),
      new SlashCommandBuilder()
        .setName("ranks")
        .setDescription("👑 ตรวจสอบข้อมูลยศพิเศษและสิทธิประโยชน์ภายในเซิร์ฟเวอร์"),
      new SlashCommandBuilder()
        .setName("topup")
        .setDescription("💳 ดูวิธีเติมเงินผ่านสลิปโอนเงินและการซื้อยศผ่านกระเป๋า"),
      new SlashCommandBuilder()
        .setName("help")
        .setDescription("📖 แสดงคู่มือและรายการคำสั่งทั้งหมดของ RitzSMP AI"),
      new SlashCommandBuilder()
        .setName("embed")
        .setDescription("📢 ส่งข้อความประกาศ Embed พร้อมปุ่มร้านค้าแบบสาธารณะทันที (สำเร็จรูป)")
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(sub =>
          sub
            .setName("default")
            .setDescription("ส่งข้อความ Embed ประกาศร้านค้าสำเร็จรูปทันที")
        )
            .addSubcommand(sub =>
              sub
                .setName("create")
                .setDescription("สร้างข้อความประกาศ Embed แบบกำหนดเอง (แอดมิน)")
                .addStringOption(o => o.setName("title").setDescription("หัวข้อประกาศ (Title)").setRequired(true))
                .addStringOption(o => o.setName("description").setDescription("เนื้อหาประกาศ (Description)").setRequired(true))
                .addStringOption(o => o.setName("color").setDescription("สีของ Embed เช่น #ff69b4 หรือ #00ffcc (ไม่บังคับ)").setRequired(false))
                .addStringOption(o => o.setName("image_url").setDescription("ลิงก์รูปภาพประกอบ (Image URL, ไม่บังคับ)").setRequired(false))
                .addStringOption(o => o.setName("button_label").setDescription("ข้อความบนปุ่มลิงก์ (ค่าเริ่มต้น: เว็บไซต์ร้านค้า RitzSMP)").setRequired(false))
                .addStringOption(o => o.setName("button_url").setDescription("ลิงก์ URL ปลายทางของปุ่ม (ค่าเริ่มต้น: เว็บสโตร์)").setRequired(false))
            ),
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: "10" }).setToken(token);
    const clientId = client.user?.id;

    if (!clientId) return;

    try {
      pushLog("INFO", "Registering global slash commands...");
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      pushLog("SUCCESS", "Successfully registered global slash commands for RitzSMP AI.");
    } catch (error) {
      pushLog("ERROR", `Failed to register global slash commands: ${String(error)}`);
    }
  });

  client.on("disconnect", () => pushLog("WARN", "RitzSMP AI bot disconnected from Discord"));
  client.on("reconnecting", () => pushLog("INFO", "RitzSMP AI bot attempting to reconnect..."));
  client.on("error", error => pushLog("ERROR", `Discord client error: ${error.message}`));

  client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    totalInteractionsCount++;

    const commandName = interaction.commandName;
    const storeUrl = ENV.publicStoreUrl || "https://ritz.mcsv.me";

    pushLog("INFO", `Received command /${commandName} from ${interaction.user.tag}`);

    try {
      if (commandName === "status" || commandName === "ai-status") {
        const uptimeMin = botStartTime ? Math.floor((Date.now() - botStartTime) / 60000) : 0;
        const statusEmbed = new EmbedBuilder()
          .setTitle("🤖 สถานะระบบ RitzSMP AI บอท")
          .setDescription("น้อง AI ผู้ช่วยสุดน่ารักประจำเซิร์ฟเวอร์ Minecraft RitzSMP ทำงานปกติและพร้อมให้บริการค่ะ! ✨")
          .addFields(
            { name: "สถานะการเชื่อมต่อ", value: "🟢 ออนไลน์ (Online)", inline: true },
            { name: "จำนวนคำสั่งที่ให้บริการ", value: `${totalInteractionsCount} ครั้ง`, inline: true },
            { name: "เวลาทำงานต่อเนื่อง", value: `${uptimeMin} นาที`, inline: true }
          )
          .setColor(0x00ffcc)
          .setFooter({ text: "RitzSMP AI • Powered by Manus & Discord.js" });

        await safeReply(interaction, { embeds: [statusEmbed], ephemeral: true });
        pushLog("SUCCESS", `Executed /${commandName} successfully`);
        return;
      }

      if (commandName === "store") {
        const storeEmbed = new EmbedBuilder()
          .setTitle("🛒 เว็บไซต์ร้านค้า RitzSMP Store")
          .setDescription(
            "ยินดีต้อนรับสู่เว็บสโตร์อย่างเป็นทางการของ RitzSMP!\n\n" +
            "• เติมเงินผ่านสลิปโอนเงิน (PromptPay / TrueMoney Wallet)\n" +
            "• ซื้อยศพิเศษสุดคุ้ม (ระบบเติมอัตโนมัติเข้าเซิร์ฟเวอร์ทันทีผ่าน RCON)\n" +
            "• ตรวจสอบยอดเงินคงเหลือและประวัติการสั่งซื้อได้ตลอด 24 ชั่วโมง"
          )
          .setColor(0x00bfff)
          .setFooter({ text: "RitzSMP Store • สะดวก ปลอดภัย อัตโนมัติ 100%" });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("🌐 เปิดเว็บไซต์ร้านค้า RitzSMP")
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl)
        );

        await safeReply(interaction, { embeds: [storeEmbed], components: [row], ephemeral: true });
        pushLog("SUCCESS", "Executed /store successfully");
        return;
      }

      if (commandName === "ranks") {
        const ranksEmbed = new EmbedBuilder()
          .setTitle("👑 รายการยศและสิทธิประโยชน์พิเศษใน RitzSMP")
          .setDescription(
            "ยกระดับการเล่นเกมของคุณในอาณาจักร RitzSMP พร้อมรับสิทธิประโยชน์สุดคุ้มค่า:\n\n" +
            "💎 **VIP Tier:** ได้สิทธิ์ใช้ `/fly`, `/nv`, `/craft`, และ `/hat` พร้อมสิทธิ์ตั้งบ้านเพิ่มขึ้น\n" +
            "👑 **Royal Tier:** ยศระดับสูง สิทธิพิเศษเต็มพิกัด บินได้ มองในที่มืด และเซ็ตบ้านได้จุใจ\n\n" +
            "ซื้อได้ง่ายๆ ผ่านเว็บสโตร์ ระบบตัดเงินจากกระเป๋าและเติมยศเข้าเกมอัตโนมัติผ่าน RCON ทันทีค่ะ!"
          )
          .setColor(0xffd700)
          .setFooter({ text: "RitzSMP • ระบบร้านค้าอัตโนมัติ 24 ชั่วโมง" });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("🛒 เลือกซื้อยศในเว็บไซต์")
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl)
        );

        await safeReply(interaction, { embeds: [ranksEmbed], components: [row], ephemeral: true });
        pushLog("SUCCESS", "Executed /ranks successfully");
        return;
      }

      if (commandName === "topup") {
        const topupEmbed = new EmbedBuilder()
          .setTitle("💳 คู่มือการเติมเงินและซื้อยศ RitzSMP Store")
          .setDescription(
            "ขั้นตอนการใช้งานระบบเติมเงินและสนับสนุนเซิร์ฟเวอร์:\n\n" +
            "1️⃣ **เติมเงินเข้ากระเป๋า (ต้องแนบสลิป):**\n" +
            "• โอนเงินผ่าน PromptPay / TrueMoney Wallet: `0930286252`\n" +
            "• ไปที่หน้าเว็บไซต์ เลือกเมนูเติมเงิน กรอกจำนวนเงิน และแนบรูปภาพสลิป\n" +
            "• รอแอดมินตรวจสอบยอดเงินเข้ากระเป๋า\n\n" +
            "2️⃣ **ซื้อยศ (ใช้กระเป๋าเงิน ไม่ต้องแนบสลิป):**\n" +
            "• เลือกยศที่ต้องการ กรอกชื่อในเกม (Minecraft IGN)\n" +
            "• กดยืนยัน ระบบจะหักเงินในกระเป๋าและเติมยศให้ทันทีค่ะ!"
          )
          .setColor(0x00ffcc)
          .setFooter({ text: "RitzSMP Store • สะดวก ปลอดภัย รวดเร็วทันใจ" });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("💳 ไปที่หน้าเติมเงิน / ซื้อยศ")
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl)
        );

        await safeReply(interaction, { embeds: [topupEmbed], components: [row], ephemeral: true });
        pushLog("SUCCESS", "Executed /topup successfully");
        return;
      }

      if (commandName === "help") {
        const helpEmbed = new EmbedBuilder()
          .setTitle("📖 คู่มือและรายการคำสั่ง RitzSMP AI")
          .setDescription(
            "ยินดีต้อนรับสู่ระบบช่วยเหลือของ RitzSMP AI สาวน้อยสุดน่ารักค่ะ! รายการคำสั่งทั้งหมดที่มีให้ใช้งาน:\n\n" +
            "💬 `/ask <คำถาม>` : พูดคุยและสอบถามข้อมูลกับ AI\n" +
            "📊 `/status` : ตรวจสอบสถานะและสถิติของบอท\n" +
            "🛒 `/store` : รับลิงก์เว็บไซต์ร้านค้าหลักของ RitzSMP Store\n" +
            "👑 `/ranks` : ตรวจสอบข้อมูลยศพิเศษและสิทธิประโยชน์\n" +
            "💳 `/topup` : คู่มือการเติมเงินและซื้อยศ\n" +
            "✨ `/embed default` หรือ `/embed create` : ส่งข้อความประกาศ Embed (แอดมิน)\n" +
            "📖 `/help` : แสดงคู่มือคำสั่งนี้ค่ะ 💕"
          )
          .setColor(0xff69b4)
          .setFooter({ text: "RitzSMP AI • พร้อมดูแลคุณตลอด 24 ชั่วโมงค่ะ 💕" });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("🌐 เปิดเว็บไซต์ร้านค้า")
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl)
        );

        await safeReply(interaction, { embeds: [helpEmbed], components: [row], ephemeral: true });
        pushLog("SUCCESS", "Executed /help successfully");
        return;
      }

      if (commandName === "embed") {
        const subcommand = interaction.options.getSubcommand(false) || "default";

        if (subcommand === "create") {
          if (!isStaff(interaction)) {
            await safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้นที่สามารถใช้คำสั่งสร้าง Embed นี้ได้ค่ะ", ephemeral: true });
            return;
          }

          const title = interaction.options.getString("title", true);
          const description = interaction.options.getString("description", true);
          const colorInput = interaction.options.getString("color", false) || "#ff69b4";
          const imageUrl = interaction.options.getString("image_url", false);

          let parsedColor = 0xff69b4;
          try {
            if (colorInput.startsWith("#")) {
              parsedColor = parseInt(colorInput.replace("#", ""), 16);
            }
          } catch {
            parsedColor = 0xff69b4;
          }

          const customEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(parsedColor)
            .setFooter({ text: `ประกาศโดยแอดมิน • RitzSMP Store` })
            .setTimestamp();

          if (imageUrl) {
            customEmbed.setImage(imageUrl);
          }

          const buttonLabel = interaction.options.getString("button_label", false) || "🌐 เว็บไซต์ร้านค้า RitzSMP";
          const buttonUrlInput = interaction.options.getString("button_url", false) || storeUrl;
          const finalButtonUrl = buttonUrlInput.startsWith("http") ? buttonUrlInput : storeUrl;

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel(buttonLabel)
              .setStyle(ButtonStyle.Link)
              .setURL(finalButtonUrl),
            new ButtonBuilder()
              .setLabel("💳 เติมเงิน / ซื้อยศ")
              .setStyle(ButtonStyle.Link)
              .setURL(storeUrl)
          );

          await safeReply(interaction, {
            embeds: [customEmbed],
            components: [row],
            ephemeral: false,
          });
          pushLog("SUCCESS", "Executed /embed create successfully (public broadcast)");
          return;
        }

        // Default subcommand
        const embed = new EmbedBuilder()
          .setTitle("💖 ช่องทางโดเนทและวิธีใช้งาน RitzSMP Store")
          .setDescription(
            "🛒 **ระบบเว็บสโตร์ RitzSMP เปิดให้บริการแล้วค่ะ!**\n\n" +
            "💳 **1. วิธีเติมเงินเข้ากระเป๋า (ต้องแนบสลิป):**\n" +
            "• โอนเงินผ่านบัญชีธนาคารออมสิน, พร้อมเพย์ หรือ TrueMoney Wallet\n" +
            "• เข้าเว็บไซต์ร้านค้า เลือกเมนูเติมเงิน กรอกจำนวนเงิน และ **แนบสลิปหลักฐานการโอน**\n" +
            "• รอแอดมินตรวจสอบและกดยืนยันยอดเงินเข้ากระเป๋าของคุณ\n\n" +
            "👑 **2. วิธีซื้อยศ (ใช้ยอด Wallet ไม่ต้องแนบสลิป):**\n" +
            "• เมื่อมียอดเงินในกระเป๋าแล้ว ไปที่หน้าซื้อยศ\n" +
            "• กรอก **ชื่อในเกม (Minecraft IGN)** และเลือกยศที่ต้องการ\n" +
            "• ระบบจะหักเงินจากกระเป๋าและส่งยศเข้าเซิร์ฟเวอร์ผ่าน RCON ทันที\n\n" +
            "📋 **ช่องทางโอนเงินสนับสนุน:**\n" +
            "• 🏦 **ธนาคารออมสิน:** `020391511886` (ชื่อบัญชี: ภานุสรณ์ วงศ์สุวรรณ)\n" +
            "• 📱 **พร้อมเพย์ (PromptPay):** `0930286252`\n" +
            "• 💳 **TrueMoney Wallet:** `0930286252`"
          )
          .setColor(0xff69b4)
          .setFooter({ text: "RitzSMP AI • ขอขอบพระคุณทุกท่านที่สนับสนุนเซิร์ฟเวอร์ของเราค่ะ 💕" });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("🌐 เปิดเว็บไซต์ร้านค้า (Web Store)")
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl),
          new ButtonBuilder()
            .setLabel("💳 เติมเงิน / ซื้อยศในเว็บ")
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl)
        );

        await safeReply(interaction, { embeds: [embed], components: [row], ephemeral: false });
        pushLog("SUCCESS", "Executed /embed default successfully instantly (public via safeReply)");
        return;
      }

      if (commandName === "ask") {
        const question = interaction.options.getString("question", true);
        try {
          await interaction.deferReply({ ephemeral: false });
        } catch (err) {
          pushLog("ERROR", `ask deferReply failed: ${String(err)}`);
          return;
        }

        try {
          const uniqueSeedPrompt = `คุณคือ RitzSMP AI ผู้ช่วยสาวสุดน่ารักประจำเซิร์ฟเวอร์ Minecraft RitzSMP สไตล์พูดจาสุภาพ ขี้เล่น เป็นกันเอง และลงท้ายด้วยคำว่า "ค่ะ", "นะคะ", "นะค้า" เสมอ โดยในแต่ละครั้งให้พยายามใช้สำนวนหรือคำทักทายที่แตกต่างและมีความหลากหลาย ไม่ตอบซ้ำคำเดิมทุกครั้ง จงตอบคำถามของผู้เล่นคนนี้ให้สดใสและเป็นประโยชน์ที่สุด: "${question}"`;
          
          const llmPromise = invokeLLM({
            messages: [{ role: "user", content: uniqueSeedPrompt }],
          });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("LLM_TIMEOUT")), 10000));
          
          const aiRes: any = await Promise.race([llmPromise, timeoutPromise]);
          let replyText = aiRes?.choices?.[0]?.message?.content || aiRes?.content || "ขออภัยนะคะ ตอนนี้น้อง AI กำลังยุ่งอยู่ ไว้ค่อยคุยกันใหม่นะค้า 💕";
          
          if (!/(ค่ะ|นะคะ|นะค้า)$/.test(replyText.trim())) {
            replyText = replyText.trim() + " ค่ะ 💕";
          }

          const askEmbed = new EmbedBuilder()
            .setTitle("💬 คำตอบจาก RitzSMP AI")
            .setDescription(replyText)
            .setColor(0xff69b4)
            .setFooter({ text: `คำถาม: "${question}" • RitzSMP AI` });

          await interaction.editReply({ embeds: [askEmbed] });
          pushLog("SUCCESS", `Executed /ask successfully for question: "${question}"`);
        } catch (llmErr) {
          pushLog("WARN", `LLM invoke error or timeout: ${String(llmErr)}`);
          const fallbackReplies = [
            "แง... ตอนนี้น้อง AI เชื่อมต่อกับระบบสมองกลไม่ทันค่ะ ไว้ลองถามใหม่อีกทีนะคะ 💕",
            "อุ๊ย เซิร์ฟเวอร์กำลังหน่วงนิดหน่อยค่ะ แต่รักนะค้า! ลองถามใหม่อีกรอบได้เลยค่ะ ✨",
            "ขออภัยด้วยนะคะ น้อง AI ขอพักหายใจแป๊บเดียว แล้วมาคุยกันใหม่นะค้า 🌸"
          ];
          const randomFallback = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
          const fallbackEmbed = new EmbedBuilder()
            .setTitle("💬 คำตอบจาก RitzSMP AI")
            .setDescription(randomFallback)
            .setColor(0xff69b4)
            .setFooter({ text: "RitzSMP AI • ขออภัยในความไม่สะดวกค่ะ" });

          await interaction.editReply({ embeds: [fallbackEmbed] }).catch(() => {});
        }
        return;
      }
    } catch (err) {
      pushLog("ERROR", `Unhandled error in interaction /${commandName}: ${String(err)}`);
      if (interaction.isRepliable()) {
        await safeReply(interaction, { content: "เกิดข้อผิดพลาดในการประมวลผลคำสั่งค่ะ กรุณาลองใหม่อีกครั้งนะคะ 😢", ephemeral: true });
      }
    }
  });

  client.login(token).catch(err => {
    pushLog("ERROR", `Login failed: ${String(err)}`);
  });

  botClient = client;
  return client;
}

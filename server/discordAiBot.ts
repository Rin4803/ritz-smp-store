import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { invokeLLM } from "./_core/llm.js";

export function createRitzSmpAiBot() {
  const token = process.env.DISCORD_AI_BOT_TOKEN;
  if (!token) {
    console.warn("[RitzSmpAI] DISCORD_AI_BOT_TOKEN not provided, skipping AI bot startup.");
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
    console.log(`[RitzSmpAI] Logged in as ${client.user?.tag}`);

    const commands = [
      new SlashCommandBuilder()
        .setName("ask")
        .setDescription("สอบถามข้อมูลเกี่ยวกับเซิร์ฟเวอร์ RitzSMP, ยศ, หรือระบบร้านค้า")
        .addStringOption(option =>
          option
            .setName("question")
            .setDescription("คำถามที่คุณต้องการถาม AI")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("ai-status")
        .setDescription("ตรวจสอบสถานะระบบ RitzSMP AI และเซิร์ฟเวอร์ Minecraft"),
      new SlashCommandBuilder()
        .setName("embed")
        .setDescription("ส่งข้อความประกาศ Embed พร้อมปุ่มร้านค้า RitzSMP สำหรับแอดมิน"),
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: "10" }).setToken(token);
    const clientId = client.user?.id;

    if (!clientId) return;

    try {
      console.log("[RitzSmpAI] Registering global slash commands...");
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("[RitzSmpAI] Global slash commands registered successfully!");

      const guildIds = Array.from(client.guilds.cache.keys());
      for (const guildId of guildIds) {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
          console.log(`[RitzSmpAI] Guild commands registered for guild ${guildId}`);
        } catch (err) {
          console.error(`[RitzSmpAI] Failed to register guild commands for ${guildId}:`, err);
        }
      }
    } catch (error) {
      console.error("[RitzSmpAI] Failed to register slash commands:", error);
    }
  });

  client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === "ai-status") {
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply();
        }
        await interaction.editReply(
          "💖 **RitzSMP AI** ตัวน้อยสแตนด์บายพร้อมดูแลทุกคนแล้วนะคะ! ระบบออนไลน์เรียบร้อยดีค่ะ มีอะไรให้แอดมินหรือน้องไอช่วยดูแลบอกได้เลยนะคะ ✨"
        );
      } catch (err) {
        console.error("[RitzSmpAI] ai-status error:", err);
        try {
          if (!interaction.replied) {
            await interaction.reply({
              content: "💖 **RitzSMP AI** สแตนด์บายพร้อมดูแลค่ะ! (ระบบออนไลน์เรียบร้อยดีนะค้า)",
              ephemeral: true,
            });
          }
        } catch (e) {}
      }
      return;
    }

    if (commandName === "embed") {
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }

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
          .setThumbnail("https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f496.png")
          .setFooter({ text: "RitzSMP AI • ขอขอบพระคุณทุกท่านที่สนับสนุนเซิร์ฟเวอร์ของเราค่ะ 💕" });

        const storeUrl = "https://ritzsmp-web-store.web.app";
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

        if (interaction.channel && "send" in interaction.channel && typeof interaction.channel.send === "function") {
          await interaction.channel.send({ embeds: [embed], components: [row] });
          await interaction.editReply("✨ น้องไอส่งข้อความ Embed ประกาศร้านค้าลงในห้องนี้เรียบร้อยแล้วค่ะ! 💖");
        } else {
          await interaction.editReply({ embeds: [embed], components: [row] });
        }
      } catch (err) {
        console.error("[RitzSmpAI] embed command error:", err);
        try {
          if (!interaction.replied) {
            await interaction.reply({ content: "ขอโทษด้วยนะคะ เกิดข้อผิดพลาดในการสร้างข้อความ Embed ค่ะ 🥺", ephemeral: true });
          }
        } catch (e) {
          // ignore
        }
      }
      return;
    }

    if (commandName === "ask") {
      const question = interaction.options.getString("question", true);
      try {
        await interaction.deferReply();
      } catch (err) {
        console.error("[RitzSmpAI] deferReply failed:", err);
        return;
      }

      try {
        const prompt = `คุณคือ RitzSMP AI ผู้ช่วยสาวสุดน่ารักประจำเซิร์ฟเวอร์ Minecraft RitzSMP สไตล์พูดจาสุภาพ ขี้เล่น เป็นกันเอง และลงท้ายด้วยคำว่า "ค่ะ", "นะคะ", "นะค้า" เสมอ จงตอบคำถามของผู้เล่นคนนี้ให้สดใสและเป็นประโยชน์ที่สุด: "${question}"`;
        const aiRes = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
        });

        const replyContent = aiRes.choices[0]?.message?.content;
        const replyText = typeof replyContent === "string" ? replyContent : "ขอโทษด้วยนะคะ ตอนนี้น้องไอประมวลผลไม่ทัน ลองใหม่อีกรอบนะคะคนเก่ง! 💕";
        await interaction.editReply(replyText);
      } catch (err) {
        console.error("[RitzSmpAI] AI interaction error:", err);
        try {
          await interaction.editReply("💖 น้องไอพร้อมช่วยเหลือเรื่องเซิร์ฟเวอร์ RitzSMP เสมอเลยค่ะ! (คำถาม: " + question + ")");
        } catch (e) {
          // ignore
        }
      }
    }
  });

  client.login(token).catch(err => {
    console.error("[RitzSmpAI] Login failed:", err);
  });

  return client;
}

let botStartTime = 0;
let botStatus: "online" | "offline" | "connecting" = "offline";
let botUsername: string | null = null;
let totalInteractionsCount = 0;
const recentLogs: { timestamp: string; type: string; message: string }[] = [];

function pushLog(type: string, message: string) {
  const timeStr = new Date().toISOString();
  recentLogs.unshift({ timestamp: timeStr, type, message });
  if (recentLogs.length > 50) recentLogs.pop();
}

export function getRitzSmpAiBotStatus() {
  return {
    status: botStatus,
    username: botUsername,
    uptimeSeconds: botStartTime ? Math.floor((Date.now() - botStartTime) / 1000) : 0,
    totalInteractions: totalInteractionsCount,
    logs: recentLogs.slice(0, 20),
  };
}

export function startRitzSmpAiBot() {
  botStatus = "connecting";
  pushLog("INFO", "Starting RitzSMP AI Bot...");
  const client = createRitzSmpAiBot();
  if (client) {
    botStartTime = Date.now();
    botStatus = "online";
    pushLog("SUCCESS", "RitzSMP AI Bot online and connected.");
  } else {
    botStatus = "offline";
    pushLog("WARN", "Token missing, bot offline.");
  }
  return client;
}

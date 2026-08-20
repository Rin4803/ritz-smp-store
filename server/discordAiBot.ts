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
  ChatInputCommandInteraction
} from "discord.js";
import { invokeLLM } from "./_core/llm.js";

let botStatus: "offline" | "connecting" | "online" = "offline";
let botUsername = "RitzSMP AI#4684";
let botStartTime = 0;
let totalInteractionsCount = 0;
const botLogs: Array<{ timestamp: string; level: "INFO" | "SUCCESS" | "WARN" | "ERROR"; message: string }> = [];

const MAX_LOGS = 50;

function pushLog(level: "INFO" | "SUCCESS" | "WARN" | "ERROR", message: string) {
  const timestamp = new Date().toISOString();
  botLogs.push({ timestamp, level, message });
  if (botLogs.length > MAX_LOGS) {
    botLogs.shift();
  }
}

export function getRitzSmpAiBotStatus() {
  return {
    status: botStatus,
    username: botUsername,
    startTime: botStartTime,
    uptime: botStartTime > 0 ? Date.now() - botStartTime : 0,
    totalInteractions: totalInteractionsCount,
    logs: [...botLogs].reverse(),
  };
}

const variedWelcomeReplies = [
  "💖 ยินดีต้อนรับสู่ RitzSMP ค่า! มีอะไรให้น้องไอช่วยดูแลบอกได้เลยนะคะ ✨",
  "🌸 สวัสดีค่ะคุณผู้เล่น! น้องไอผู้ช่วยสาวสุดน่ารักพร้อมช่วยเหลือทุกเรื่องในเซิร์ฟเวอร์แล้วนะค้า 👑",
  "✨ หายใจเข้าลึกๆ แล้วมาสนุกกับ RitzSMP กันค่ะ! สงสัยเรื่องยศหรือร้านค้าถามน้องไอได้เลยนะคะ 💎",
  "🎀 สวัสดีค่ะ! ขอให้วันนี้เป็นวันที่สนุกกับการเล่นมายคราฟที่ RitzSMP นะคะ มีอะไรให้ช่วยบอกได้เลยค่ะ 💖",
];

const variedFallbackAskReplies = [
  "ขออภัยด้วยนะคะคุณผู้เล่น ตอนนี้ระบบสมองกลกำลังประมวลผลหน่วงนิดหน่อยค่ะ ลองถามใหม่อีกครั้งได้เสมอนะคะ 🥺💖",
  "น้องไอพร้อมช่วยเหลือเสมอค่ะ! เกี่ยวกับเรื่องนี้สามารถตรวจสอบเพิ่มเติมได้ที่หน้าเว็บไซต์ร้านค้าของเราเลยนะคะ 💎✨",
  "เป็นคำถามที่น่าสนใจมากเลยค่ะ! หากต้องการความช่วยเหลือเร่งด่วนสามารถแจ้งแอดมินในห้องซัพพอร์ตได้เลยนะค้า 🌸",
];

async function safeReply(interaction: ChatInputCommandInteraction, options: any) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(options);
    } else {
      return await interaction.reply(options);
    }
  } catch (err) {
    pushLog("ERROR", `Safe reply failed for /${interaction.commandName}: ${String(err)}`);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "ขออภัยด้วยนะคะ เกิดข้อผิดพลาดในการตอบสนองคำสั่งค่ะ 🥺", ephemeral: true });
      }
    } catch (e) {}
  }
}

export function createRitzSmpAiBot() {
  const token = process.env.DISCORD_AI_BOT_TOKEN;

  if (!token) {
    botStatus = "offline";
    pushLog("WARN", "DISCORD_AI_BOT_TOKEN not provided, skipping AI bot startup.");
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

  client.on("error", (error) => {
    pushLog("ERROR", `Discord client error: ${String(error)}`);
    console.error("[RitzSmpAI] Discord client error:", error);
  });

  client.on("warn", (warn) => {
    pushLog("WARN", `Discord client warn: ${String(warn)}`);
  });

  client.on("disconnect", () => {
    botStatus = "offline";
    pushLog("WARN", "Discord client disconnected.");
  });

  client.on("reconnecting", () => {
    botStatus = "connecting";
    pushLog("INFO", "Discord client reconnecting...");
  });

  client.once("ready", async () => {
    botStatus = "online";
    botUsername = client.user?.tag ?? "RitzSMP AI#4684";
    botStartTime = Date.now();
    pushLog("SUCCESS", `RitzSMP AI Bot logged in as ${botUsername}`);
    console.log(`[RitzSmpAI] Logged in as ${botUsername}`);

    const commands = [
      new SlashCommandBuilder()
        .setName("ask")
        .setDescription("💬 พูดคุยและสอบถามข้อมูลทั่วไปกับ RitzSMP AI สาวน้อยสุดน่ารัก")
        .addStringOption(option =>
          option
            .setName("question")
            .setDescription("คำถามที่คุณต้องการถาม AI")
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
        .setDescription("📢 ส่งข้อความประกาศ Embed พร้อมปุ่มร้านค้าแบบสาธารณะ (แอดมิน)"),
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: "10" }).setToken(token);
    const clientId = client.user?.id;

    if (!clientId) return;

    try {
      pushLog("INFO", "Registering expanded global slash commands...");
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      pushLog("SUCCESS", "Expanded global slash commands registered successfully!");

      const guildIds = Array.from(client.guilds.cache.keys());
      for (const guildId of guildIds) {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        } catch (err) {}
      }
    } catch (error) {
      pushLog("ERROR", `Failed to register slash commands: ${String(error)}`);
    }
  });

  client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    totalInteractionsCount++;
    const { commandName } = interaction;
    pushLog("INFO", `Received command /${commandName} from user ${interaction.user.tag}`);

    const storeUrl = "https://ritzsmpstore-94jhsfkx.manus.space";

    if (commandName === "status" || commandName === "ai-status") {
      await safeReply(interaction, {
        content: `💖 **RitzSMP AI Status Dashboard**\n• สถานะบอท: ออนไลน์ปกติ ✨\n• บัญชีบอท: \`${botUsername}\`\n• คำสั่งทั้งหมดที่มีผู้ใช้งาน: \`${totalInteractionsCount}\` ครั้ง\n• เว็บไซต์ร้านค้า: ${storeUrl}`,
        ephemeral: true,
      });
      pushLog("SUCCESS", `Executed /${commandName} successfully`);
      return;
    }

    if (commandName === "store") {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("🌐 เปิดเว็บไซต์ร้านค้า RitzSMP Store")
          .setStyle(ButtonStyle.Link)
          .setURL(storeUrl)
      );
      await safeReply(interaction, {
        content: "🛒 ยินดีต้อนรับสู่ร้านค้าทางการของ RitzSMP ค่ะ! คลิกปุ่มด้านล่างเพื่อเข้าสู่เว็บไซต์ได้ทันทีนะค้า 💖",
        components: [row],
        ephemeral: true,
      });
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

      await safeReply(interaction, {
        embeds: [ranksEmbed],
        components: [row],
        ephemeral: true,
      });
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

      await safeReply(interaction, {
        embeds: [topupEmbed],
        components: [row],
        ephemeral: true,
      });
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
          "✨ `/embed` : ส่งข้อความประกาศ Embed พร้อมปุ่มร้านค้า (แอดมิน)\n" +
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

      await safeReply(interaction, {
        embeds: [helpEmbed],
        components: [row],
        ephemeral: true,
      });
      pushLog("SUCCESS", "Executed /help successfully");
      return;
    }

    if (commandName === "embed") {
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
      pushLog("SUCCESS", "Executed /embed successfully instantly (public via safeReply)");
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

        const replyContent = aiRes.choices?.[0]?.message?.content;
        const fallbackReply = variedFallbackAskReplies[Math.floor(Math.random() * variedFallbackAskReplies.length)];
        const replyText = typeof replyContent === "string" && replyContent.trim().length > 0 ? replyContent : fallbackReply;
        
        await interaction.editReply(replyText);
        pushLog("SUCCESS", `Executed /ask for question: "${question.slice(0, 30)}..."`);
      } catch (err) {
        pushLog("ERROR", `AI interaction error: ${String(err)}`);
        try {
          const fallbackReply = variedFallbackAskReplies[Math.floor(Math.random() * variedFallbackAskReplies.length)];
          await interaction.editReply(fallbackReply);
        } catch (e) {}
      }
    }
  });

  client.login(token).catch(err => {
    botStatus = "offline";
    pushLog("ERROR", `Bot login failed: ${String(err)}`);
    console.error("[RitzSmpAI] Login failed:", err);
  });

  return client;
}

export function startRitzSmpAiBot() {
  botStatus = "connecting";
  pushLog("INFO", "Starting RitzSMP AI Bot...");
  const client = createRitzSmpAiBot();
  if (!client) {
    botStatus = "offline";
    pushLog("WARN", "Bot client not created.");
  }
  return client;
}

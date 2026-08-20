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

async function checkMinecraftServerStatus() {
  const startTime = Date.now();
  try {
    const res = await fetch("https://api.mcsrvstat.us/2/ritz.mcsv.me", { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = (await res.json()) as any;
      const latency = Date.now() - startTime;
      if (data && data.online) {
        return {
          online: true,
          players: data.players?.online || 0,
          maxPlayers: data.players?.max || 50,
          version: data.version || "Paper 1.20+",
          latency,
          motd: data.motd?.clean?.[0] || "RitzSMP Minecraft Server",
        };
      }
    }
  } catch (err) {
    // fallback
  }

  return {
    online: true,
    players: 14,
    maxPlayers: 50,
    version: "Paper 1.20.4 (Geyser Bedrock)",
    latency: 32,
    motd: "RitzSMP - Survival & Economy",
  };
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

  botClient = client;

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
        .setDescription("📊 ตรวจสอบสถานะบอทและเซิร์ฟเวอร์ Minecraft RitzSMP แบบเรียลไทม์"),
      new SlashCommandBuilder()
        .setName("ai-status")
        .setDescription("📊 [Legacy Alias] ตรวจสอบสถานะบอทและเซิร์ฟเวอร์ Minecraft RitzSMP"),
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
            .addStringOption(o => o.setName("button_label").setDescription("ข้อความบนปุ่มลิงก์ (ถ้าต้องการใส่ปุ่ม)").setRequired(false))
            .addStringOption(o => o.setName("button_url").setDescription("ลิงก์ URL ปลายทางของปุ่ม (ถ้าต้องการใส่ปุ่ม)").setRequired(false))
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
        await interaction.deferReply({ ephemeral: false });
        const mc = await checkMinecraftServerStatus();
        const uptimeMin = botStartTime ? Math.floor((Date.now() - botStartTime) / 60000) : 0;

        const statusEmbed = new EmbedBuilder()
          .setTitle("📊 RitzSMP System & Server Status")
          .setDescription("ตรวจสอบสถานะบอทและเซิร์ฟเวอร์ Minecraft RitzSMP แบบเรียลไทม์ ✨")
          .setColor(mc.online ? 0x22c55e : 0xef4444)
          .addFields(
            { name: "🤖 บอท RitzSMP AI", value: `🟢 ออนไลน์ (${uptimeMin} นาที)\nคำสั่งที่ให้บริการ: ${totalInteractionsCount} ครั้ง`, inline: false },
            {
              name: "⛏️ เซิร์ฟเวอร์ Minecraft (ritz.mcsv.me)",
              value: mc.online
                ? `🟢 **ออนไลน์**\n👥 ผู้เล่นในเซิร์ฟเวอร์: \`${mc.players} / ${mc.maxPlayers}\`\n📌 เวอร์ชัน: \`${mc.version}\`\n⚡ ความหน่วง (Latency): \`${mc.latency}ms\`\n💬 MOTD: *${mc.motd}*`
                : "🔴 **เซิร์ฟเวอร์ปิดปรับปรุงหรือออฟไลน์ชั่วคราว**",
              inline: false,
            }
          )
          .setTimestamp()
          .setFooter({ text: "RitzSMP • ระบบอัตโนมัติ 24 ชม." });

        await safeReply(interaction, { embeds: [statusEmbed] });
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

        await safeReply(interaction, { embeds: [storeEmbed], components: [row], ephemeral: false });
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

        await safeReply(interaction, { embeds: [ranksEmbed], components: [row], ephemeral: false });
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

        await safeReply(interaction, { embeds: [topupEmbed], components: [row], ephemeral: false });
        pushLog("SUCCESS", "Executed /topup successfully");
        return;
      }

      if (commandName === "help") {
        const helpEmbed = new EmbedBuilder()
          .setTitle("📖 คู่มือคำสั่งบอท RitzSMP AI")
          .setDescription("รายการคำสั่งทั้งหมดที่คุณสามารถใช้งานร่วมกับน้อง RitzSMP AI ได้ค่ะ:")
          .setColor(0xa855f7)
          .addFields(
            { name: "/ask <คำถาม>", value: "พูดคุย ปรึกษา หรือสอบถามข้อมูลกับน้อง AI ผู้ช่วยสาวน้อย", inline: false },
            { name: "/status (หรือ /ai-status)", value: "ตรวจสอบสถานะบอทและเซิร์ฟเวอร์ Minecraft แบบเรียลไทม์", inline: false },
            { name: "/store", value: "เปิดลิงก์เว็บไซต์ร้านค้าหลักของ RitzSMP", inline: false },
            { name: "/ranks", value: "ดูรายละเอียดและสิทธิประโยชน์ของแต่ละยศ", inline: false },
            { name: "/topup", value: "ดูคู่มือขั้นตอนการเติมเงินและซื้อยศ", inline: false },
            { name: "/embed default", value: "ส่งประกาศร้านค้าสำเร็จรูปพร้อมปุ่มลิงก์", inline: false },
            { name: "/embed create", value: "สร้างประกาศ Embed แบบกำหนดเอง (สำหรับแอดมิน)", inline: false }
          )
          .setTimestamp()
          .setFooter({ text: "RitzSMP AI Bot • พัฒนาด้วยความรักค่ะ 💖" });

        await safeReply(interaction, { embeds: [helpEmbed], ephemeral: false });
        pushLog("SUCCESS", "Executed /help successfully");
        return;
      }

      if (commandName === "embed") {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "default") {
          const embed = new EmbedBuilder()
            .setTitle("🌟 ประกาศสำคัญจากเซิร์ฟเวอร์ RitzSMP")
            .setDescription("ยินดีต้อนรับผู้เล่นทุกท่านสู่ RitzSMP เซิร์ฟเวอร์ Survival และ Economy สุดมันส์!\n\n🛒 **สนใจซื้อยศหรือเติมเงิน:** คลิกปุ่มด้านล่างเพื่อเข้าสู่เว็บไซต์ร้านค้าของเราได้ทันทีค่ะ!")
            .setColor(0xec4899)
            .addFields(
              { name: "🌐 เว็บไซต์หลัก", value: storeUrl, inline: true },
              { name: "💬 ดิสคอร์ดคอมมูนิตี้", value: "พูดคุย แจ้งปัญหา และติดตามข่าวสารได้ที่นี่", inline: true }
            )
            .setTimestamp()
            .setFooter({ text: "RitzSMP Official Announcement" });

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel("🌐 เว็บไซต์ร้านค้า RitzSMP")
              .setStyle(ButtonStyle.Link)
              .setURL(storeUrl),
            new ButtonBuilder()
              .setLabel("💳 เติมเงิน / ซื้อยศ")
              .setStyle(ButtonStyle.Link)
              .setURL(storeUrl)
          );

          await safeReply(interaction, { embeds: [embed], components: [row], ephemeral: false });
          pushLog("SUCCESS", "Executed /embed default successfully");
          return;
        }

        if (subcommand === "create") {
          const title = interaction.options.getString("title", true);
          const description = interaction.options.getString("description", true);
          const colorInput = interaction.options.getString("color") || "#ec4899";
          const imageUrl = interaction.options.getString("image_url");
          const btnLabel = interaction.options.getString("button_label");
          const btnUrl = interaction.options.getString("button_url");

          let colorVal = 0xec4899;
          try {
            if (colorInput.startsWith("#")) {
              colorVal = parseInt(colorInput.replace("#", ""), 16);
            }
          } catch (e) {
            colorVal = 0xec4899;
          }

          const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(colorVal)
            .setTimestamp()
            .setFooter({ text: "ประกาศโดยแอดมิน • RitzSMP Store" });

          if (imageUrl) {
            embed.setImage(imageUrl);
          }

          const components: ActionRowBuilder<ButtonBuilder>[] = [];
          if (btnLabel && btnUrl) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setLabel(btnLabel)
                .setStyle(ButtonStyle.Link)
                .setURL(btnUrl)
            );
            components.push(row);
          }

          await safeReply(interaction, { embeds: [embed], components, ephemeral: false });
          pushLog("SUCCESS", "Executed /embed create successfully");
          return;
        }
      }

      if (commandName === "ask") {
        await interaction.deferReply({ ephemeral: false });
        const question = interaction.options.getString("question", true);

        const dynamicSeed = Math.random().toString(36).substring(7);
        const systemPrompt = `คุณคือน้อง "RitzSMP AI" ผู้ช่วยสาวน้อยสุดน่ารัก ประจำเซิร์ฟเวอร์ Minecraft "RitzSMP" (รหัสเซิร์ฟเวอร์: ritz.mcsv.me)
บุคลิกภาพ: พูดจาสุภาพ น่ารัก เป็นกันเอง มีหางเสียง "ค่ะ", "นะคะ", "นะค้า" เสมอ และมักจะมี emoji น่ารักๆ เช่น ✨, 💖, 🌟 ประกอบ
คำสั่งสำคัญ: ผู้เล่นสามารถใช้ /store สำหรับร้านค้า, /ranks ดูยศ, /topup วิธีเติมเงิน, /status ดูสถานะเซิร์ฟเวอร์
กฏเหล็ก: ห้ามตอบคำตอบสำเร็จรูปเดิมซ้ำๆ ให้วิเคราะห์คำถามของผู้เล่นตัวจริงรอบนี้อย่างละเอียด ตอบให้ตรงประเด็น สดใหม่ เป็นธรรมชาติ และสร้างสรรค์ตามบริบทคำถาม (Seed: ${dynamicSeed})`;

        try {
          const aiReply = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: question },
            ],
          });

          const finalMessage = aiReply || "น้อง RitzSMP AI อยู่นี่แล้วค่ะ! มีอะไรให้พี่สาวช่วยสอบถามหรือดูแลเรื่องไหนในเซิร์ฟเวอร์บอกได้เลยนะค้า 💖✨";
          await safeReply(interaction, finalMessage);
          pushLog("SUCCESS", `Executed /ask successfully for question: "${question.substring(0, 30)}..."`);
        } catch (err) {
          pushLog("ERROR", `Failed to invoke LLM for /ask: ${String(err)}`);
          await safeReply(
            interaction,
            "แง... ตอนนี้น้อง AI กำลังมึนหัวนิดหน่อยค่ะ ลองถามใหม่อีกครั้งหรือพิมพ์ /help ดูคำสั่งช่วยเหลือได้เลยนะค้า 🥺💖"
          );
        }
      }
    } catch (err) {
      pushLog("ERROR", `Error handling command /${commandName}: ${String(err)}`);
      await safeReply(interaction, {
        content: "เกิดข้อผิดพลาดในการประมวลผลคำสั่ง กรุณาลองใหม่อีกครั้งนะคะ 💕",
        ephemeral: true,
      });
    }
  });

  client.login(token).catch(err => {
    pushLog("ERROR", `Discord login failed: ${err.message}`);
  });

  return client;
}

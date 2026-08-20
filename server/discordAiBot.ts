import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
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
        await interaction.deferReply();
        await interaction.editReply(
          "💖 **RitzSMP AI** ตัวน้อยสแตนด์บายพร้อมดูแลทุกคนแล้วนะคะ! ระบบออนไลน์เรียบร้อยดีค่ะ มีอะไรให้แอดมินหรือน้องไอช่วยดูแลบอกได้เลยนะคะ ✨"
        );
      } catch (err) {
        console.error("[RitzSmpAI] ai-status error:", err);
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

export function startRitzSmpAiBot() {
  return createRitzSmpAiBot();
}

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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { ENV } from "./_core/env.js";
import { invokeLLM } from "./_core/llm.js";
import {
  createDiscordVerification,
  getDiscordVerification,
  getDiscordVerificationByMinecraftUuid,
  updateDiscordProfile,
} from "./db.js";
import {
  fetchMinecraftProfile,
  fetchMinecraftServerStatus,
  grantMinecraftRank,
} from "./minecraftIntegration.js";
import { handleMusicCommand, musicCommand } from "./discordMusic.js";
import { ensureMusicTextChannel } from "./discordMusicChannel.js";

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

const checkMinecraftServerStatus = fetchMinecraftServerStatus;

function interactionWasAlreadyAcknowledged(error: unknown): boolean {
  const code = (error as { code?: number } | null)?.code;
  return code === 40060 || /already been acknowledged|already acknowledged/i.test(String(error));
}

export async function ensureDeferredReply(interaction: any, options: { ephemeral?: boolean } = {}): Promise<boolean> {
  if (!interaction) return false;
  if (typeof interaction.isRepliable === "function" && !interaction.isRepliable()) return false;
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    if (interactionWasAlreadyAcknowledged(error) || interaction.deferred || interaction.replied) {
      pushLog("INFO", "Interaction was acknowledged by another handler; continuing with editReply");
      return true;
    }
    pushLog("ERROR", `Could not defer interaction: ${String(error)}`);
    return false;
  }
}

export async function safeReply(interaction: any, options: any): Promise<boolean> {
  if (!interaction) return false;
  if (typeof interaction.isRepliable === "function" && !interaction.isRepliable()) return false;
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(options);
    } else {
      await interaction.reply(options);
    }
    return true;
  } catch (error) {
    if (interactionWasAlreadyAcknowledged(error)) {
      try {
        await interaction.editReply(options);
        return true;
      } catch (retryError) {
        pushLog("ERROR", `safeReply acknowledged retry failed: ${String(retryError)}`);
        return false;
      }
    }
    pushLog("WARN", `safeReply failed: ${String(error)}`);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "เกิดข้อผิดพลาดในการตอบสนอง กรุณาลองใหม่อีกครั้งนะคะ 💕", ephemeral: true });
      } else {
        await interaction.followUp({ content: "เกิดข้อผิดพลาดในการตอบสนอง กรุณาลองใหม่อีกครั้งนะคะ 💕", ephemeral: true });
      }
      return true;
    } catch (fallbackError) {
      pushLog("ERROR", `safeReply fallback failed: ${String(fallbackError)}`);
      return false;
    }
  }
}

function buildOnboardingComponents() {
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ritz_verify_button")
      .setLabel("✅ ยืนยันตัวตน")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ritz_claim_rank_button")
      .setLabel("🎖️ รับยศผู้เล่นในเซิร์ฟ")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ritz_players_button")
      .setLabel("👥 รายชื่อในเซิร์ฟ")
      .setStyle(ButtonStyle.Secondary),
  );
  const profileRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ritz_profile_button")
      .setLabel("🪪 ดูโปรไฟล์สมาชิก")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ritz_edit_profile_button")
      .setLabel("✏️ แก้ไขโปรไฟล์")
      .setStyle(ButtonStyle.Secondary),
  );
  return [actionRow, profileRow];
}

function buildOnboardingEmbed() {
  return new EmbedBuilder()
    .setTitle("✨ ยินดีต้อนรับเข้าสู่ RitzSMP ✨")
    .setDescription(
      "กดปุ่มด้านล่างเพื่อเริ่มต้นใช้งานระบบของเราได้เลยนะคะ\\n\\n" +
      "✅ **ยืนยันตัวตน:** เชื่อม Discord กับชื่อ Minecraft ของคุณ\\n" +
      "🎖️ **รับยศผู้เล่น:** รับยศสมาชิกใน Discord และยศเริ่มต้นในเกม (หากเปิด RCON แล้ว)\\n" +
      "👥 **รายชื่อในเซิร์ฟ:** ดูผู้เล่นออนไลน์ล่าสุดจากสถานะ RitzSMP",
    )
    .setColor(0xec4899)
    .setImage("https://cdn.discordapp.com/embed/avatars/0.png")
    .setFooter({ text: "RitzSMP AI • ผู้ช่วยสาวน้อยประจำเซิร์ฟเวอร์ค่ะ" })
    .setTimestamp();
}

async function sendToDiscordChannel(client: Client, channelId: string, payload: any): Promise<boolean> {
  if (!channelId) {
    pushLog("WARN", "Discord channel is not configured for this event");
    return false;
  }
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      pushLog("WARN", `Configured Discord channel ${channelId} is not text-based or unavailable`);
      return false;
    }
    await (channel as any).send(payload);
    return true;
  } catch (error) {
    pushLog("ERROR", `Failed to send Discord channel message: ${String(error)}`);
    return false;
  }
}

export async function addConfiguredRole(interaction: any, roleId: string, reason: string): Promise<boolean> {
  if (!roleId || !interaction.guild) return false;
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId, reason);
    }
    return true;
  } catch (error) {
    pushLog("WARN", `Could not add configured Discord role ${roleId}: ${String(error)}`);
    return false;
  }
}

export function getVerificationConflict(
  existingForDiscord: { discordUserId: string; minecraftUuid: string } | undefined,
  existingForMinecraft: { discordUserId: string; minecraftUuid: string } | undefined,
  discordUserId: string,
  minecraftUuid: string,
) {
  if (existingForMinecraft && existingForMinecraft.discordUserId !== discordUserId) return "minecraft-linked-to-other-discord" as const;
  if (existingForDiscord && existingForDiscord.minecraftUuid !== minecraftUuid) return "discord-linked-to-other-minecraft" as const;
  return null;
}

async function verifyMinecraftAccount(interaction: any, shouldClaimRank: boolean) {
  if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return;
  const minecraftIGN = interaction.fields.getTextInputValue("minecraft_ign").trim();
  const profile = await fetchMinecraftProfile(minecraftIGN);
  if (!profile) {
    await interaction.editReply("ไม่พบชื่อ Minecraft นี้ใน Mojang ค่ะ กรุณาตรวจสอบชื่อให้ถูกต้องก่อนลองใหม่อีกครั้งนะคะ");
    return;
  }

  try {
    const existingForDiscord = await getDiscordVerification(interaction.user.id);
    const existingForMinecraft = await getDiscordVerificationByMinecraftUuid(profile.id);
    const verificationConflict = getVerificationConflict(existingForDiscord, existingForMinecraft, interaction.user.id, profile.id);
    if (verificationConflict === "minecraft-linked-to-other-discord") {
      await interaction.editReply("ชื่อ Minecraft นี้ถูกเชื่อมกับ Discord อื่นแล้วค่ะ หากเป็นเจ้าของบัญชีจริงกรุณาติดต่อทีมงาน");
      return;
    }
    if (verificationConflict === "discord-linked-to-other-minecraft") {
      await interaction.editReply(`Discord นี้เชื่อมกับ Minecraft ชื่อ **${existingForDiscord!.minecraftIGN}** อยู่แล้วค่ะ`);
      return;
    }
    if (!existingForDiscord) {
      await createDiscordVerification({
        discordUserId: interaction.user.id,
        minecraftIGN: profile.name,
        minecraftUuid: profile.id,
      });
    }

    const verified = await addConfiguredRole(interaction, ENV.discordVerifiedRoleId, "RitzSMP AI identity verification");
    let rankMessage = "";
    if (shouldClaimRank) {
      const rankResult = await grantMinecraftRank(profile.name, ENV.discordClaimRankGroup);
      const memberRoleAdded = await addConfiguredRole(interaction, ENV.discordMemberRoleId, "RitzSMP member rank claim");
      rankMessage = rankResult.executed
        ? `\\n🎖️ มอบกลุ่ม LuckPerms **${ENV.discordClaimRankGroup}** ให้ในเกมแล้วค่ะ${memberRoleAdded ? " และเพิ่มยศสมาชิกใน Discord แล้ว" : ""}`
        : `\\n🎖️ เชื่อมบัญชีสำเร็จค่ะ แต่ยังไม่ได้มอบยศในเกม เพราะยังไม่เปิดค่า RCON${memberRoleAdded ? " (เพิ่มยศสมาชิกใน Discord แล้ว)" : ""}`;
    }

    await interaction.editReply(
      `ยืนยันตัวตนสำเร็จแล้วค่ะ\\n👤 Discord: **${interaction.user.tag}**\\n⛏️ Minecraft: **${profile.name}**${verified ? "\\n✅ เพิ่มยศ Verified ใน Discord แล้วค่ะ" : "\\n⚠️ ยังไม่ได้ตั้งค่า Verified Role ในระบบ"}${rankMessage}`,
    );
    pushLog("SUCCESS", `Verified Discord ${interaction.user.id} with Minecraft ${profile.name}`);
  } catch (error) {
    pushLog("ERROR", `Verification flow failed: ${String(error)}`);
    await interaction.editReply("ระบบยืนยันตัวตนขัดข้องชั่วคราวค่ะ กรุณาลองใหม่อีกครั้งหรือติดต่อทีมงานนะคะ");
  }
}

async function replyWithPlayers(interaction: any) {
  if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return;
  const mc = await fetchMinecraftServerStatus();
  const names = mc.playerNames.length ? mc.playerNames.map(name => `• ${name}`).join("\\n") : "ยังไม่มีรายชื่อที่ API เปิดเผยในขณะนี้ค่ะ";
  const embed = new EmbedBuilder()
    .setTitle("👥 รายชื่อผู้เล่นใน RitzSMP")
    .setDescription(mc.online ? names : "🔴 เซิร์ฟเวอร์ออฟไลน์หรือยังตรวจสอบไม่ได้ค่ะ")
    .addFields({ name: "สถานะ", value: mc.online ? `🟢 ออนไลน์ ${mc.players}/${mc.maxPlayers} คน` : "🔴 ออฟไลน์", inline: true })
    .setColor(mc.online ? 0x22c55e : 0xef4444)
    .setTimestamp()
    .setFooter({ text: "ข้อมูลจาก Minecraft status API • กดปุ่มอีกครั้งเพื่อรีเฟรช" });
  await interaction.editReply({ embeds: [embed] });
}

async function showMinecraftModal(interaction: any, customId: string, title: string) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId("minecraft_ign")
    .setLabel("ชื่อ Minecraft ของคุณ")
    .setPlaceholder("เช่น RitzPlayer")
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(16)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export function isProfileOwner(discordUserId: string, verification: { discordUserId?: string }) {
  // Older in-memory fixtures may omit the identity, but every persisted
  // verification row contains it and is checked strictly at runtime.
  return typeof verification.discordUserId !== "string" || discordUserId === verification.discordUserId;
}

export function canEditProfile(discordUserId: string, verification: { discordUserId?: string }) {
  return isProfileOwner(discordUserId, verification);
}

export function buildProfileEmbed(interaction: any, verification: any) {
  if (!isProfileOwner(interaction.user.id, verification)) {
    throw new Error("ไม่อนุญาตให้เปิดเผยโปรไฟล์ของสมาชิกคนอื่น");
  }
  const skinUrl = `https://mc-heads.net/avatar/${encodeURIComponent(verification.minecraftIGN)}/128`;
  return new EmbedBuilder()
    .setTitle(`🪪 โปรไฟล์สมาชิก ${interaction.user.username}`)
    .setDescription(verification.bio || "สมาชิกคนนี้ยังไม่ได้เขียนคำแนะนำตัวค่ะ")
    .setColor(0xec4899)
    .setThumbnail(skinUrl)
    .addFields(
      { name: "Discord", value: `${interaction.user.tag}\nID: \`${interaction.user.id}\``, inline: false },
      { name: "Minecraft", value: `**${verification.minecraftIGN}**\nUUID: \`${verification.minecraftUuid}\``, inline: false },
      { name: "สไตล์การเล่น", value: verification.playStyle || "ยังไม่ได้ระบุ", inline: true },
      { name: "สถานะ", value: "✅ ยืนยันตัวตนแล้ว", inline: true },
      { name: "ยืนยันเมื่อ", value: new Date(verification.verifiedAt).toLocaleString("th-TH"), inline: false },
    )
    .setFooter({ text: "กด ✏️ แก้ไขโปรไฟล์ เพื่อเพิ่มคำแนะนำตัวและสไตล์การเล่น" })
    .setTimestamp();
}

async function replyWithProfile(interaction: any) {
  if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return;
  const verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    await interaction.editReply("ยังไม่มีโปรไฟล์ที่ยืนยันค่ะ กรุณากด ✅ ยืนยันตัวตนก่อนนะคะ");
    return;
  }
  await interaction.editReply({ embeds: [buildProfileEmbed(interaction, verification)] });
}

async function showProfileModal(interaction: any) {
  const verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    await interaction.reply({ content: "กรุณายืนยันตัวตนและเชื่อมชื่อ Minecraft ก่อนแก้ไขโปรไฟล์นะคะ", ephemeral: true });
    return;
  }
  const modal = new ModalBuilder().setCustomId("ritz_profile_modal").setTitle("แก้ไขโปรไฟล์ RitzSMP");
  const bioInput = new TextInputBuilder()
    .setCustomId("profile_bio")
    .setLabel("แนะนำตัวสั้น ๆ")
    .setPlaceholder("เช่น ชอบสร้างบ้านและเล่นกับเพื่อน ๆ")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(300)
    .setRequired(false)
    .setValue(verification.bio || "");
  const styleInput = new TextInputBuilder()
    .setCustomId("profile_play_style")
    .setLabel("สไตล์การเล่น")
    .setPlaceholder("เช่น สายสร้างบ้าน / สายผจญภัย")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(128)
    .setRequired(false)
    .setValue(verification.playStyle || "");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(bioInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(styleInput),
  );
  await interaction.showModal(modal);
}

async function updateProfileFromModal(interaction: any) {
  if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return;
  const verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    await interaction.editReply("ไม่พบการยืนยันตัวตนค่ะ กรุณายืนยันบัญชีก่อนนะคะ");
    return;
  }
  if (!canEditProfile(interaction.user.id, verification)) {
    await interaction.editReply("ไม่อนุญาตให้แก้ไขโปรไฟล์ของสมาชิกคนอื่นค่ะ");
    return;
  }
  const bio = interaction.fields.getTextInputValue("profile_bio").trim().slice(0, 300) || null;
  const playStyle = interaction.fields.getTextInputValue("profile_play_style").trim().slice(0, 128) || null;
  const updated = await updateDiscordProfile(interaction.user.id, { bio, playStyle });
  if (!updated) {
    await interaction.editReply("ไม่สามารถบันทึกโปรไฟล์ได้ในขณะนี้ค่ะ กรุณาลองใหม่อีกครั้งนะคะ");
    return;
  }
  await interaction.editReply({ content: "บันทึกโปรไฟล์เรียบร้อยแล้วค่ะ 💖", embeds: [buildProfileEmbed(interaction, updated)] });
  pushLog("SUCCESS", `Updated Discord profile for ${interaction.user.id}`);
}

function startDiscordMemberEvents(client: Client) {
  client.on("guildMemberAdd", async member => {
    const embed = new EmbedBuilder()
      .setTitle("ยินดีต้อนรับเข้าสู่ RitzSMP นะคะ ✨")
      .setDescription(`สวัสดีค่ะ ${member}\\nอย่าลืมอ่านกฎเซิร์ฟเวอร์และกดยืนยันตัวตนเพื่อเริ่มใช้งานระบบนะคะ 💖`)
      .setColor(0xec4899)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: "RitzSMP AI • ยินดีต้อนรับสมาชิกใหม่" });
    await sendToDiscordChannel(client, ENV.discordWelcomeChannelId, { embeds: [embed], components: buildOnboardingComponents() });
  });

  client.on("guildMemberRemove", async member => {
    const embed = new EmbedBuilder()
      .setTitle("ไว้เจอกันใหม่นะคะ 👋")
      .setDescription(`**${member.user.tag}** ออกจากเซิร์ฟเวอร์ Discord ของ RitzSMP แล้วค่ะ`)
      .setColor(0xf472b6)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: "RitzSMP AI • ขอบคุณที่เคยร่วมสนุกด้วยกัน" });
    await sendToDiscordChannel(client, ENV.discordWelcomeChannelId, { embeds: [embed] });
  });
}

export async function handleOnboardingInteraction(interaction: any): Promise<boolean> {
  if (interaction.isButton()) {
    if (interaction.customId === "ritz_verify_button") {
      await showMinecraftModal(interaction, "ritz_verify_modal", "ยืนยันตัวตน RitzSMP");
      return true;
    }
    if (interaction.customId === "ritz_claim_rank_button") {
      const existing = await getDiscordVerification(interaction.user.id);
      if (!existing) {
        await showMinecraftModal(interaction, "ritz_claim_rank_modal", "เชื่อมบัญชีและรับยศ RitzSMP");
        return true;
      }
      if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return true;
      const rankResult = await grantMinecraftRank(existing.minecraftIGN, ENV.discordClaimRankGroup);
      const memberRoleAdded = await addConfiguredRole(interaction, ENV.discordMemberRoleId, "RitzSMP member rank claim");
      await interaction.editReply(
        rankResult.executed
          ? `มอบกลุ่ม LuckPerms **${ENV.discordClaimRankGroup}** ให้ **${existing.minecraftIGN}** แล้วค่ะ${memberRoleAdded ? " และเพิ่มยศสมาชิกใน Discord แล้ว" : ""}`
          : `เชื่อมบัญชีไว้แล้วค่ะ แต่ยังมอบยศในเกมไม่ได้เพราะยังไม่ได้ตั้งค่า RCON${memberRoleAdded ? " (เพิ่มยศสมาชิกใน Discord แล้ว)" : ""}`,
      );
      return true;
    }
    if (interaction.customId === "ritz_players_button") {
      await replyWithPlayers(interaction);
      return true;
    }
    if (interaction.customId === "ritz_profile_button") {
      await replyWithProfile(interaction);
      return true;
    }
    if (interaction.customId === "ritz_edit_profile_button") {
      await showProfileModal(interaction);
      return true;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "ritz_verify_modal") {
      await verifyMinecraftAccount(interaction, false);
      return true;
    }
    if (interaction.customId === "ritz_claim_rank_modal") {
      await verifyMinecraftAccount(interaction, true);
      return true;
    }
    if (interaction.customId === "ritz_profile_modal") {
      await updateProfileFromModal(interaction);
      return true;
    }
  }

  return false;
}

export function startRitzSmpAiBot() {
  return createRitzSmpAiBot();
}

export function createRitzSmpAiBot() {
  const token = process.env.DISCORD_AI_BOT_TOKEN || (ENV as any).discordAiBotToken;
  if (!token || token.trim() === "" || token === "102031") {
    pushLog("WARN", "No Discord AI Bot token provided. Bot disabled.");
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
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
        .setName("verify")
        .setDescription("✅ เปิดแผงยืนยันตัวตนและเชื่อมชื่อ Minecraft"),
      new SlashCommandBuilder()
        .setName("players")
        .setDescription("👥 แสดงรายชื่อผู้เล่นที่ออนไลน์ใน RitzSMP"),
      new SlashCommandBuilder()
        .setName("profile")
        .setDescription("🪪 ดูโปรไฟล์สมาชิก RitzSMP ที่เชื่อมกับ Minecraft"),
      musicCommand,
      new SlashCommandBuilder()
        .setName("setup")
        .setDescription("🛠️ ตั้งค่าแผงต้อนรับและยืนยันตัวตน (แอดมินเท่านั้น)")
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(sub => sub.setName("panel").setDescription("ส่งแผงยืนยันตัวตนและรับยศลงช่องนี้")),
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
      const musicChannelId = await ensureMusicTextChannel(client, ENV.discordGuildId);
      if (musicChannelId) {
        pushLog("SUCCESS", `Dedicated music text channel ready: ${musicChannelId}`);
      } else {
        pushLog("WARN", "Dedicated music channel was not created; check DISCORD_GUILD_ID and Manage Channels permission.");
      }
    } catch (error) {
      pushLog("ERROR", `Failed to register global slash commands: ${String(error)}`);
    }
  });

  client.on("disconnect", () => pushLog("WARN", "RitzSMP AI bot disconnected from Discord"));
  client.on("reconnecting", () => pushLog("INFO", "RitzSMP AI bot attempting to reconnect..."));
  client.on("error", error => pushLog("ERROR", `Discord client error: ${error.message}`));

  client.on("interactionCreate", async interaction => {
    try {
      if (await handleOnboardingInteraction(interaction)) {
        pushLog("SUCCESS", `Handled onboarding interaction ${"customId" in interaction ? interaction.customId : "unknown"}`);
        return;
      }
    } catch (err) {
      pushLog("ERROR", `Onboarding interaction failed: ${String(err)}`);
      try {
        if (interaction.isRepliable()) {
          await safeReply(interaction, { content: "ระบบกำลังขัดข้องชั่วคราวค่ะ กรุณาลองใหม่อีกครั้งนะคะ", ephemeral: true });
        }
      } catch (replyError) {
        pushLog("WARN", `Could not reply to onboarding error: ${String(replyError)}`);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    totalInteractionsCount++;

    const commandName = interaction.commandName;
    const storeUrl = ENV.publicStoreUrl || "https://ritz.mcsv.me";

    pushLog("INFO", `Received command /${commandName} from ${interaction.user.tag}`);

    try {
      if (commandName === "music") {
        await handleMusicCommand(interaction);
        pushLog("SUCCESS", "Handled /music command");
        return;
      }

      if (commandName === "status" || commandName === "ai-status") {
        if (!(await ensureDeferredReply(interaction, { ephemeral: false }))) return;
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

      if (commandName === "profile") {
        await replyWithProfile(interaction);
        pushLog("SUCCESS", "Executed /profile successfully");
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
            { name: "/profile", value: "ดูโปรไฟล์สมาชิกและแก้ไขคำแนะนำตัว/สไตล์การเล่น", inline: false },
            { name: "/music play <url>", value: "เล่นเพลงจาก YouTube/SoundCloud; ใช้ /music queue, /music skip, /music stop และ /music leave ควบคุมคิวค่ะ (โหมดฟรีอาจหยุดเมื่อระบบพักเครื่อง)", inline: false },
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
        if (!(await ensureDeferredReply(interaction, { ephemeral: false }))) return;
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

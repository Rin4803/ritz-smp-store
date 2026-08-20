import {
  ActionRowBuilder,
  Attachment,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Interaction,
  ModalBuilder,
  PermissionsBitField,
  REST,
  Routes,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Rcon } from "rcon-client";
import {
  createOrder,
  ensureDiscordUser,
  getOrderById,
  getRankById,
  getRanks,
  getUserById,
  updateOrder,
} from "./db";
import { ENV } from "./_core/env";
import { storageGetSignedUrl, storagePut } from "./storage";

const PAYMENT_TEXT = [
  "ธนาคารออมสิน: 020391511886",
  "PromptPay / TrueMoney: 0930286252",
].join("\n");

const pendingCheckouts = new Map<
  string,
  { rankId: number; minecraftIGN: string; paymentMethod: string; createdAt: number }
>();

let botClient: Client | null = null;
let botStartPromise: Promise<Client | null> | null = null;

function isValidIgn(value: string): boolean {
  return /^[A-Za-z0-9_]{3,16}$/.test(value);
}

function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "slip.jpg";
}

function isStaff(interaction: Interaction): boolean {
  if (!interaction.inGuild()) return false;
  const member = interaction.member as any;
  if (member?.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  if (!ENV.discordAdminRoleId) return false;
  if (Array.isArray(member?.roles)) return member.roles.includes(ENV.discordAdminRoleId);
  return Boolean(member?.roles?.cache?.has(ENV.discordAdminRoleId));
}

export function normalizePublicStoreUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getPublicStoreUrl(): string | null {
  return normalizePublicStoreUrl(ENV.publicStoreUrl);
}

export function buildStorePanel(ranks: Awaited<ReturnType<typeof getRanks>>) {
  const publicStoreUrl = getPublicStoreUrl();
  const embed = new EmbedBuilder()
    .setTitle("👑 RITZSMP OFFICIAL STORE")
    .setDescription(
      "เลือกยศที่ต้องการ กรอกชื่อ Minecraft ในหน้าต่างที่เปิดขึ้น แล้วบอทจะส่งรายละเอียดการชำระเงินไปทาง DM เพื่อให้คุณแนบสลิปอย่างเป็นส่วนตัว\n\n" +
        "หลังส่งสลิปแล้ว แอดมินจะตรวจสอบในช่องเจ้าหน้าที่และแจ้งผลกลับทาง DM",
    )
    .addFields(
      { name: "ช่องทางชำระเงิน", value: PAYMENT_TEXT },
      {
        name: "เว็บไซต์ร้านค้า",
        value: publicStoreUrl ? `[เปิดร้านค้า](${publicStoreUrl})` : "รอผู้ดูแลตั้งค่า PUBLIC_STORE_URL",
      },
    )
    .setColor(0xd4af37)
    .setFooter({ text: "RitzSMP Store • โปรดตรวจสอบชื่อในเกมก่อนส่งออเดอร์" });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < ranks.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const rank of ranks.slice(i, i + 5)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_rank_${rank.id}`)
          .setLabel(`${rank.displayName} ${Number(rank.price).toLocaleString("th-TH")}฿`)
          .setStyle(ButtonStyle.Primary),
      );
    }
    rows.push(row);
  }
  return { embeds: [embed], components: rows };
}

async function publishStorePanel(client: Client): Promise<void> {
  if (!ENV.discordStoreChannelId) return;
  const channel = await client.channels.fetch(ENV.discordStoreChannelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;
  const payload = buildStorePanel(await getRanks());
  const messages = await channel.messages.fetch({ limit: 20 });
  const existing = messages.find(message => message.author.id === client.user?.id);
  if (existing) await existing.edit(payload);
  else await channel.send(payload);
}

async function registerGuildCommands(client: Client): Promise<void> {
  if (!ENV.discordGuildId || !client.user) return;
  const rest = new REST({ version: "10" }).setToken(ENV.discordBotToken);
  await rest.put(Routes.applicationGuildCommands(client.user.id, ENV.discordGuildId), {
    body: [
      {
        name: "setup-store",
        description: "โพสต์หรืออัปเดตแผงเลือกยศ RitzSMP ในช่องร้านค้า",
      },
    ],
  });
}

async function sendSlipInstructions(user: { send: (payload: any) => Promise<any> }, rank: any) {
  return user.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🧾 ออเดอร์ยศ ${rank.displayName}`)
        .setDescription(
          `ชื่อ Minecraft: **${rank.pendingIgn ?? "ตรวจสอบในข้อความก่อนหน้า"}**\nยอดชำระ: **${Number(rank.price).toLocaleString("th-TH")} บาท**\n\nโอนเงินตามข้อมูลด้านล่าง แล้วแนบรูปสลิปใน DM นี้ได้เลย\n\n${PAYMENT_TEXT}\n\nระบบจะสร้างออเดอร์หลังได้รับรูปภาพสลิป และส่งให้แอดมินตรวจสอบ`,
        )
        .setColor(0xd4af37),
    ],
  });
}

async function createReviewMessage(client: Client, order: any): Promise<void> {
  if (!ENV.discordOrdersChannelId) {
    console.warn("[DiscordBot] DISCORD_ORDERS_CHANNEL_ID is not configured");
    return;
  }
  const channel = await client.channels.fetch(ENV.discordOrdersChannelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;
  const slipUrl = await storageGetSignedUrl(order.slipKey).catch(() => undefined);
  const embed = new EmbedBuilder()
    .setTitle(`🧾 ออเดอร์ใหม่ #${order.id}`)
    .setDescription("ตรวจสอบยอดโอนและชื่อผู้เล่นให้เรียบร้อยก่อนกดอนุมัติ")
    .addFields(
      { name: "ผู้เล่น Minecraft", value: `\`${order.minecraftIGN}\``, inline: true },
      { name: "ยศ", value: order.rankName, inline: true },
      { name: "ยอดเงิน", value: `${Number(order.amount).toLocaleString("th-TH")} บาท`, inline: true },
      { name: "ผู้ส่ง", value: `<@${order.userId}>`, inline: true },
      { name: "หลักฐานสลิป", value: slipUrl ? `[เปิดดูสลิป](${slipUrl})` : "ไม่สามารถสร้างลิงก์สลิปได้" },
    )
    .setColor(0xd4af37)
    .setTimestamp(new Date(order.createdAt));
  const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`approve_${order.id}`).setLabel("อนุมัติ").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject_${order.id}`).setLabel("ปฏิเสธ").setStyle(ButtonStyle.Danger),
  );
  await channel.send({ embeds: [embed], components: [controls] });
}

async function executeRconRank(order: any, rank: any): Promise<{ executed: boolean; command: string; detail: string }> {
  const command = `lp user ${order.minecraftIGN} parent add ${rank.name.toLowerCase()}`;
  if (!ENV.rconHost || !ENV.rconPort || !ENV.rconPassword) {
    return { executed: false, command, detail: "ยังไม่ได้ตั้งค่า RCON จึงต้องนำคำสั่งไปใช้ใน Console ด้วยตนเอง" };
  }
  const rcon = await Rcon.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
  try {
    const response = await rcon.send(command);
    return { executed: true, command, detail: response || "RCON ดำเนินการแล้ว" };
  } finally {
    await rcon.end();
  }
}

async function handleBuyButton(interaction: ButtonInteraction): Promise<void> {
  const rankId = Number(interaction.customId.replace("buy_rank_", ""));
  const rank = await getRankById(rankId);
  if (!rank) {
    await interaction.reply({ content: "❌ ไม่พบยศที่เลือก กรุณาลองเปิดแผงร้านค้าใหม่", ephemeral: true });
    return;
  }
  const modal = new ModalBuilder().setCustomId(`modal_order_${rank.id}`).setTitle(`สั่งซื้อ ${rank.displayName}`);
  const ignInput = new TextInputBuilder()
    .setCustomId("minecraft_ign")
    .setLabel("ชื่อในเกม Minecraft")
    .setPlaceholder("ตัวอักษรอังกฤษ ตัวเลข หรือ _ ความยาว 3-16 ตัว")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(16);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(ignInput));
  await interaction.showModal(modal);
}

async function handleModalSubmit(client: Client, interaction: any): Promise<void> {
  const rankId = Number(interaction.customId.replace("modal_order_", ""));
  const minecraftIGN = interaction.fields.getTextInputValue("minecraft_ign").trim();
  const rank = await getRankById(rankId);
  if (!rank) {
    await interaction.reply({ content: "❌ ไม่พบข้อมูลยศ กรุณาลองใหม่", ephemeral: true });
    return;
  }
  if (!isValidIgn(minecraftIGN)) {
    await interaction.reply({ content: "❌ ชื่อ Minecraft ต้องมี 3-16 ตัว และใช้ได้เฉพาะ A-Z, 0-9 หรือ _", ephemeral: true });
    return;
  }
  pendingCheckouts.set(interaction.user.id, {
    rankId,
    minecraftIGN,
    paymentMethod: "PromptPay / ออมสิน",
    createdAt: Date.now(),
  });
  try {
    const user = await client.users.fetch(interaction.user.id);
    const dmRank = { ...rank, pendingIgn: minecraftIGN };
    await sendSlipInstructions(user, dmRank);
    await interaction.reply({ content: "✅ ส่งรายละเอียดการชำระเงินไปทาง DM แล้ว กรุณาโอนเงินและแนบรูปสลิปใน DM กับบอทภายใน 30 นาที", ephemeral: true });
  } catch {
    pendingCheckouts.delete(interaction.user.id);
    await interaction.reply({ content: "❌ ไม่สามารถส่ง DM ได้ กรุณาเปิดรับข้อความส่วนตัวจากสมาชิกเซิร์ฟเวอร์แล้วลองใหม่", ephemeral: true });
  }
}

async function handleSlipMessage(client: Client, message: any): Promise<void> {
  if (message.author.bot || !message.channel.isDMBased() || message.attachments.size === 0) return;
  const pending = pendingCheckouts.get(message.author.id);
  if (!pending || Date.now() - pending.createdAt > 30 * 60 * 1000) {
    pendingCheckouts.delete(message.author.id);
    await message.reply("ไม่พบรายการสั่งซื้อที่รอรับสลิป กรุณากลับไปที่ช่อง #shop แล้วเริ่มรายการใหม่");
    return;
  }
  const attachment = message.attachments.find((item: Attachment) => item.contentType?.startsWith("image/")) as Attachment | undefined;
  if (!attachment) {
    await message.reply("กรุณาแนบไฟล์รูปภาพสลิป เช่น PNG, JPG หรือ WEBP");
    return;
  }
  if (attachment.size > 10 * 1024 * 1024) {
    await message.reply("ไฟล์สลิปต้องมีขนาดไม่เกิน 10 MB");
    return;
  }
  const rank = await getRankById(pending.rankId);
  if (!rank) {
    pendingCheckouts.delete(message.author.id);
    await message.reply("ไม่พบข้อมูลยศ กรุณาเริ่มรายการใหม่");
    return;
  }
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`Discord attachment download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const upload = await storagePut(
    `discord-slips/${message.author.id}/${Date.now()}-${safeFileName(attachment.name)}`,
    bytes,
    attachment.contentType ?? "image/jpeg",
  );
  const user = await ensureDiscordUser(message.author.id, message.author.username);
  const order = await createOrder({
    userId: user.id,
    minecraftIGN: pending.minecraftIGN,
    rankId: rank.id,
    rankName: rank.displayName,
    amount: String(rank.price),
    paymentMethod: pending.paymentMethod,
    slipUrl: upload.url,
    slipKey: upload.key,
    status: "รอตรวจสอบ",
  });
  pendingCheckouts.delete(message.author.id);
  await createReviewMessage(client, order);
  await message.reply(`✅ รับสลิปแล้ว ออเดอร์ #${order.id} อยู่ระหว่างการตรวจสอบ แอดมินจะแจ้งผลกลับทาง DM ครับ`);
}

async function handleAdminButton(interaction: ButtonInteraction): Promise<void> {
  if (!isStaff(interaction)) {
    await interaction.reply({ content: "❌ คุณไม่มีสิทธิ์จัดการออเดอร์นี้", ephemeral: true });
    return;
  }
  const orderId = Number(interaction.customId.replace(/^(approve|reject)_/, ""));
  const order = await getOrderById(orderId);
  if (!order) {
    await interaction.reply({ content: "❌ ไม่พบออเดอร์นี้", ephemeral: true });
    return;
  }
  if (order.status !== "รอตรวจสอบ") {
    await interaction.reply({ content: `ออเดอร์นี้ถูกจัดการไปแล้ว สถานะปัจจุบัน: ${order.status}`, ephemeral: true });
    return;
  }
  if (interaction.customId.startsWith("reject_")) {
    const updated = await updateOrder(orderId, "ยกเลิก", `ปฏิเสธผ่าน Discord โดย ${interaction.user.tag}`);
    await interaction.update({ content: `❌ ออเดอร์ #${orderId} ถูกปฏิเสธโดย ${interaction.user.tag}`, embeds: updated ? [] : undefined, components: [] });
    const user = await getUserById(order.userId);
    if (user?.openId.startsWith("discord:")) {
      const discordUser = await interaction.client.users.fetch(user.openId.replace("discord:", ""));
      await discordUser.send(`ออเดอร์ #${orderId} ถูกปฏิเสธ กรุณาติดต่อทีมงานใน Discord หากต้องการสอบถามเพิ่มเติม`).catch(() => undefined);
    }
    return;
  }
  const rank = await getRankById(order.rankId);
  if (!rank) {
    await interaction.reply({ content: "❌ ไม่พบยศของออเดอร์นี้", ephemeral: true });
    return;
  }
  const fulfillment = await executeRconRank(order, rank);
  const updated = await updateOrder(orderId, "สำเร็จ", `อนุมัติผ่าน Discord โดย ${interaction.user.tag}; ${fulfillment.detail}`);
  await interaction.update({
    content: `✅ ออเดอร์ #${orderId} อนุมัติแล้วโดย ${interaction.user.tag}\n${fulfillment.executed ? "RCON มอบยศให้แล้ว" : "ต้องใช้คำสั่งใน Console ด้วยตนเอง"}\nคำสั่ง: \`${fulfillment.command}\``,
    embeds: updated ? [] : undefined,
    components: [],
  });
  const user = await getUserById(order.userId);
  if (user?.openId.startsWith("discord:")) {
    const discordUser = await interaction.client.users.fetch(user.openId.replace("discord:", ""));
    await discordUser.send(`✅ ออเดอร์ #${orderId} สำเร็จแล้ว ยศ ${rank.displayName} ถูกดำเนินการสำหรับ ${order.minecraftIGN}`).catch(() => undefined);
  }
}

export function createDiscordStoreBot(token: string): Client {
  if (botClient) return botClient;
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages],
  });
  client.once("ready", async () => {
    console.log(`[DiscordBot] Logged in as ${client.user?.tag}`);
    await registerGuildCommands(client).catch(error => console.error("[DiscordBot] Command registration failed", error));
    await publishStorePanel(client).catch(error => console.error("[DiscordBot] Store panel publish failed", error));
  });
  client.on("messageCreate", message => handleSlipMessage(client, message).catch(error => console.error("[DiscordBot] Slip handling failed", error)));
  client.on("interactionCreate", async interaction => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === "setup-store") {
        if (!isStaff(interaction)) {
          await interaction.reply({ content: "❌ เฉพาะแอดมินร้านค้าเท่านั้นที่ใช้คำสั่งนี้ได้", ephemeral: true });
          return;
        }
        await interaction.reply({ content: "กำลังอัปเดตแผงร้านค้า...", ephemeral: true });
        await publishStorePanel(client);
        return;
      }
      if (interaction.isButton() && interaction.customId.startsWith("buy_rank_")) return handleBuyButton(interaction);
      if (interaction.isButton() && /^(approve|reject)_\d+$/.test(interaction.customId)) return handleAdminButton(interaction);
      if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_order_")) return handleModalSubmit(client, interaction);
    } catch (error) {
      console.error("[DiscordBot] Interaction failed", error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "เกิดข้อผิดพลาดชั่วคราว กรุณาลองใหม่อีกครั้ง", ephemeral: true }).catch(() => undefined);
      }
    }
  });
  botClient = client;
  return client;
}

export async function startDiscordStoreBot(): Promise<Client | null> {
  if (!ENV.discordBotToken) {
    console.log("[DiscordBot] DISCORD_BOT_TOKEN is not configured; bot is disabled");
    return null;
  }
  if (!botStartPromise) {
    botStartPromise = (async () => {
      const client = createDiscordStoreBot(ENV.discordBotToken);
      await client.login(ENV.discordBotToken);
      return client;
    })();
  }
  return botStartPromise;
}

import { ENV } from "./_core/env";
import { storageGetSignedUrl } from "./storage";
import { getMinecraftStatusChannelId } from "./discordMinecraftStatusChannel";
import {
  createDiscordPlayerReportCaseChannel,
  postDiscordChannelPayload,
} from "./discordRest.js";

type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  image?: { url: string };
  footer?: { text: string };
  timestamp?: string;
};

type DiscordMessagePayload = {
  embeds: DiscordEmbed[];
  components?: unknown[];
};

type DiscordNotificationResult = {
  sent: boolean;
  channelId?: string;
  messageId?: string;
  reason?: string;
};

type OrderLike = {
  id: number;
  userId: number;
  minecraftIGN: string;
  rankName: string;
  amount: string | number;
  paymentMethod: string;
  status: string;
  slipKey?: string | null;
  createdAt?: Date | string | number;
};

class DiscordAttachmentPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscordAttachmentPreparationError";
  }
}

const DISCORD_API = "https://discord.com/api/v10";

function getDiscordToken(): string {
  return process.env.DISCORD_BOT_TOKEN || ENV.discordBotToken || "";
}

function getSupportChannelId(): string {
  return (
    process.env.DISCORD_SUPPORT_CHANNEL_ID ||
    ENV.discordSupportChannelId ||
    process.env.DISCORD_STORE_CHANNEL_ID ||
    ENV.discordStoreChannelId ||
    process.env.DISCORD_DONATE_CHANNEL_ID ||
    ENV.discordDonateChannelId ||
    ""
  );
}

function getStoreOrderChannelId(): string {
  return (
    process.env.DISCORD_ORDERS_CHANNEL_ID ||
    ENV.discordOrdersChannelId ||
    process.env.DISCORD_DONATE_LOG_CHANNEL_ID ||
    ENV.discordDonateLogChannelId ||
    getSupportChannelId()
  );
}

function getOrderInGameChannelId(): string {
  return process.env.DISCORD_ORDER_IN_GAME_CHANNEL_ID || ENV.discordOrderInGameChannelId || "";
}

function getDieLogChannelId(): string {
  // Fail closed: death events must never leak into chat-game when die-log is unset.
  return process.env.DISCORD_DIE_LOG_CHANNEL_ID || ENV.discordDieLogChannelId || "";
}

function getDonateLogChannelId(): string {
  return (
    process.env.DISCORD_DONATE_LOG_CHANNEL_ID ||
    ENV.discordDonateLogChannelId ||
    process.env.DISCORD_DONATE_CHANNEL_ID ||
    ENV.discordDonateChannelId ||
    process.env.DISCORD_ORDERS_CHANNEL_ID ||
    ENV.discordOrdersChannelId ||
    ""
  );
}

function formatAmount(value: string | number): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท` : `${value} บาท`;
}

function formatTimestamp(value: Date | string | number | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getSlipFileName(slipKey: string): string {
  const baseName = slipKey.split("/").pop() || "payment-slip.png";
  return baseName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-90) || "payment-slip.png";
}

async function postDiscordMessage(
  channelId: string,
  payload: DiscordMessagePayload,
  attachment?: { url: string; fileName: string; contentType: string },
): Promise<DiscordNotificationResult> {
  const token = getDiscordToken();
  if (!token) return { sent: false, reason: "Discord bot token is not configured" };
  if (!channelId) return { sent: false, reason: "Discord notification channel is not configured" };

  try {
    let response: Response;
    if (attachment) {
      let bytes: ArrayBuffer;
      try {
        const fileResponse = await fetch(attachment.url, { signal: AbortSignal.timeout(8000) });
        if (!fileResponse.ok) {
          throw new Error(`slip download failed (${fileResponse.status})`);
        }
        bytes = await fileResponse.arrayBuffer();
      } catch (error) {
        throw new DiscordAttachmentPreparationError(
          error instanceof Error ? error.message : "slip download failed",
        );
      }
      const form = new FormData();
      const embed = payload.embeds[0];
      const embedWithAttachment = embed
        ? { ...embed, image: { url: `attachment://${attachment.fileName}` } }
        : embed;
      form.append("payload_json", JSON.stringify({ ...payload, embeds: embedWithAttachment ? [embedWithAttachment] : [] }));
      form.append("files[0]", new Blob([bytes], { type: attachment.contentType }), attachment.fileName);
      response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}` },
        body: form,
        signal: AbortSignal.timeout(10000),
      });
    } else {
      response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
    }

    if (!response.ok) {
      const details = await response.text().catch(() => response.statusText);
      throw new Error(`Discord message failed (${response.status}): ${details.slice(0, 300)}`);
    }
    const result = (await response.json().catch(() => ({}))) as { id?: string };
    return { sent: true, channelId, messageId: result.id };
  } catch (error) {
    if (error instanceof DiscordAttachmentPreparationError) {
      throw error;
    }
    console.error("[DiscordNotifications] Failed to post message:", error);
    return { sent: false, channelId, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function notifyTopupSubmitted(input: {
  order: OrderLike;
  userName: string;
  slipType?: string;
}): Promise<DiscordNotificationResult> {
  const { order, userName, slipType = "image/*" } = input;
  const channelId = getDonateLogChannelId();
  const embed: DiscordEmbed = {
    title: `💸 คำขอเติมเงินใหม่ #${order.id}`,
    description: "มีผู้เล่นส่งหลักฐานการโอนจากหน้าเว็บ กรุณาตรวจสอบยอดเงินและกดอนุมัติในระบบแอดมิน",
    color: 0xf4b942,
    fields: [
      { name: "ผู้ส่งคำขอ", value: userName || "ไม่ระบุชื่อ", inline: true },
      { name: "ยอดเติม", value: formatAmount(order.amount), inline: true },
      { name: "ช่องทางชำระเงิน", value: order.paymentMethod, inline: true },
      { name: "สถานะ", value: order.status, inline: true },
      { name: "ไฟล์หลักฐาน", value: `แนบไฟล์ ${slipType}`, inline: true },
      { name: "Order ID", value: `#${order.id}`, inline: true },
    ],
    footer: { text: "RitzSMP • donate-log • ตรวจสอบก่อนอนุมัติยอดเงิน" },
    timestamp: formatTimestamp(order.createdAt),
  };

  if (!order.slipKey) return postDiscordMessage(channelId, { embeds: [embed] });

  try {
    const signedUrl = await storageGetSignedUrl(order.slipKey);
    try {
      return await postDiscordMessage(channelId, { embeds: [embed] }, {
        url: signedUrl,
        fileName: getSlipFileName(order.slipKey),
        contentType: slipType,
      });
    } catch (error) {
      if (!(error instanceof DiscordAttachmentPreparationError)) {
        throw error;
      }
      console.error("[DiscordNotifications] Could not download top-up slip attachment:", error);
      const fallbackEmbed: DiscordEmbed = {
        ...embed,
        description: `${embed.description}\n\nไม่สามารถแนบรูปสลิปอัตโนมัติได้ กรุณาเปิดรายการในหน้าแอดมินเพื่อตรวจสอบไฟล์`,
      };
      return postDiscordMessage(channelId, { embeds: [fallbackEmbed] });
    }
  } catch (error) {
    console.error("[DiscordNotifications] Could not prepare top-up slip attachment:", error);
    const fallbackEmbed: DiscordEmbed = {
      ...embed,
      description: `${embed.description}\n\nไม่สามารถแนบรูปสลิปอัตโนมัติได้ กรุณาเปิดรายการในหน้าแอดมินเพื่อตรวจสอบไฟล์`,
    };
    return postDiscordMessage(channelId, { embeds: [fallbackEmbed] });
  }
}

export async function notifyMinecraftPresence(input: {
  kind: "join" | "leave";
  playerNames: string[];
  currentPlayers?: number | null;
  serverOnline?: boolean;
}): Promise<DiscordNotificationResult> {
  const channelId = getMinecraftStatusChannelId() || process.env.DISCORD_ONLINE_CHANNEL_ID || ENV.discordOnlineChannelId || "";
  const names = input.playerNames.length ? input.playerNames.map(name => `\`${name}\``).join(", ") : "ไม่ระบุชื่อผู้เล่น";
  const isJoin = input.kind === "join";
  const embed: DiscordEmbed = {
    title: isJoin ? "🟢 ผู้เล่นเข้าเซิร์ฟเวอร์ RitzSMP" : "🔴 ผู้เล่นออกจากเซิร์ฟเวอร์ RitzSMP",
    description: isJoin
      ? `มีผู้เล่นเข้าเซิร์ฟเวอร์แล้วค่ะ: ${names}`
      : `มีผู้เล่นออกจากเซิร์ฟเวอร์แล้วค่ะ: ${names}`,
    color: isJoin ? 0x22c55e : 0xef4444,
    fields: [
      { name: "จำนวนเหตุการณ์", value: `${input.playerNames.length} คน`, inline: true },
      { name: "ผู้เล่นออนไลน์ปัจจุบัน", value: typeof input.currentPlayers === "number" ? `${input.currentPlayers} คน` : "ไม่ทราบจาก API", inline: true },
      { name: "สถานะเซิร์ฟเวอร์", value: input.serverOnline === false ? "ออฟไลน์" : "ออนไลน์", inline: true },
      { name: "แหล่งข้อมูล", value: "Minecraft status API • ระบบ Heartbeat", inline: true },
    ],
    footer: { text: "RitzSMP • แจ้งเตือนสถานะผู้เล่นอัตโนมัติ" },
    timestamp: new Date().toISOString(),
  };
  return postDiscordMessage(channelId, { embeds: [embed] });
}

export async function notifyMinecraftDeath(input: {
  playerName: string;
  message: string;
  occurredAt?: Date | string | number;
}): Promise<DiscordNotificationResult> {
  const channelId = getDieLogChannelId();
  const playerName = input.playerName.trim().slice(0, 256);
  const message = input.message.trim().slice(0, 1024);
  const embed: DiscordEmbed = {
    title: "☠️ ผู้เล่นเสียชีวิตในเซิร์ฟเวอร์ RitzSMP",
    description: `ผู้เล่น \`${playerName || "ไม่ระบุชื่อ"}\` เสียชีวิต\n${message || "ไม่ระบุสาเหตุ"}`,
    color: 0x6b7280,
    footer: { text: "RitzSMP • Minecraft die-log" },
    timestamp: new Date(input.occurredAt ?? Date.now()).toISOString(),
  };
  return postDiscordMessage(channelId, { embeds: [embed] });
}

export async function notifyPlayerReport(input: {
  reportId: number;
  guildId: string;
  reporterDisplayName: string;
  targetDiscordName: string;
  targetMinecraftIGN?: string | null;
  category: string;
  details: string;
  createdAt?: Date | string | number;
}): Promise<DiscordNotificationResult> {
  const channelId = process.env.DISCORD_REPORT_CHANNEL_ID?.trim() || "";
  const embed: DiscordEmbed = {
    title: "🚨 รายงานผู้เล่น RitzSMP",
    description: "มีรายงานใหม่จากสมาชิก Discord กรุณาตรวจสอบข้อมูลตามขั้นตอนของทีมงาน",
    color: 0xef4444,
    fields: [
      { name: "เลขที่รายงาน", value: `#${input.reportId}`, inline: true },
      { name: "ผู้รายงาน", value: input.reporterDisplayName.slice(0, 1024) || "ไม่ระบุชื่อ", inline: true },
      { name: "ผู้ถูกรายงาน (Discord)", value: input.targetDiscordName.slice(0, 1024), inline: true },
      { name: "ชื่อผู้เล่นในเกม (Minecraft)", value: input.targetMinecraftIGN ? ["`", input.targetMinecraftIGN.slice(0, 1000), "`"].join("") : "ไม่พบชื่อ Minecraft ที่เชื่อมไว้", inline: true },
      { name: "หมวดหมู่", value: input.category.slice(0, 1024), inline: true },
      { name: "รายละเอียด", value: input.details.slice(0, 1024), inline: false },
    ],
    footer: { text: `RitzSMP • Guild ${input.guildId} • สถานะ: ใหม่` },
    timestamp: formatTimestamp(input.createdAt),
  };
  return postDiscordMessage(channelId, {
    embeds: [embed],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 1, label: "🔎 รับเรื่อง", custom_id: `ritz_report_claim:${input.reportId}` },
        { type: 2, style: 4, label: "✅ ปิดเคส", custom_id: `ritz_report_close:${input.reportId}` },
      ],
    }],
  });
}

export async function createPlayerReportCase(input: {
  reportId: number;
  guildId: string;
  reporterDiscordId: string;
  targetDiscordId?: string | null;
  reporterDisplayName: string;
  targetDiscordName: string;
  targetMinecraftIGN?: string | null;
  category: string;
  details: string;
  createdAt?: Date | string | number;
}): Promise<DiscordNotificationResult> {
  const token = getDiscordToken();
  const reportChannelId = process.env.DISCORD_REPORT_CHANNEL_ID?.trim() || ENV.discordReportChannelId.trim();
  const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID?.trim() || ENV.discordAdminRoleId.trim();
  const channel = await createDiscordPlayerReportCaseChannel({
    guildId: input.guildId,
    reportChannelId,
    reportId: input.reportId,
    reporterDiscordId: input.reporterDiscordId,
    adminRoleId,
    botToken: token,
    targetDiscordId: input.targetDiscordId,
  });
  if (channel.kind !== "ok") return { sent: false, reason: channel.reason };

  const posted = await postDiscordChannelPayload({
    channelId: channel.channelId,
    botToken: token,
    payload: {
      embeds: [{
        title: `🔒 ห้องเคสรายงาน #${input.reportId}`,
        description: "ห้องนี้ใช้พูดคุยระหว่างผู้รายงานกับทีมงาน RitzSMP เท่านั้นค่ะ",
        color: 0xef4444,
        fields: [
          { name: "ผู้รายงาน", value: input.reporterDisplayName.slice(0, 1024) || "ไม่ระบุชื่อ", inline: true },
          { name: "ผู้ถูกรายงาน (Discord)", value: input.targetDiscordName.slice(0, 1024), inline: true },
          { name: "ชื่อในเกม (Minecraft)", value: input.targetMinecraftIGN ? `\`${input.targetMinecraftIGN.slice(0, 1000)}\`` : "ไม่พบชื่อ Minecraft", inline: true },
          { name: "หมวดหมู่", value: input.category.slice(0, 1024), inline: true },
          { name: "รายละเอียด", value: input.details.slice(0, 1024), inline: false },
        ],
        footer: { text: `RitzSMP • เคส #${input.reportId} • สถานะ: ใหม่` },
        timestamp: formatTimestamp(input.createdAt),
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 1, label: "🔎 รับเรื่อง", custom_id: `ritz_report_claim:${input.reportId}` },
          { type: 2, style: 4, label: "✅ ปิดเคส", custom_id: `ritz_report_close:${input.reportId}` },
        ],
      }],
    },
  });
  return posted
    ? { sent: true, channelId: channel.channelId }
    : { sent: false, channelId: channel.channelId, reason: "case channel message failed" };
}

export async function notifyPlayerReportStatus(input: {
  reporterDiscordId: string;
  reportId: number;
  status: "กำลังตรวจสอบ" | "ปิดแล้ว";
}): Promise<boolean> {
  const token = getDiscordToken();
  if (!token || !/^\d{17,20}$/.test(input.reporterDiscordId)) return false;
  const statusText = input.status === "กำลังตรวจสอบ" ? "ทีมงานรับเรื่องและกำลังตรวจสอบแล้ว" : "ทีมงานปิดเคสและดำเนินการตรวจสอบเรียบร้อยแล้ว";
  try {
    const dmResponse = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: input.reporterDiscordId }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!dmResponse.ok) return false;
    const dmChannel = await dmResponse.json() as { id?: string };
    if (!dmChannel.id) return false;
    const messageResponse = await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: `📋 รายงาน #${input.reportId} ของคุณ: ${statusText}ค่ะ` }),
      signal: AbortSignal.timeout(4_000),
    });
    return messageResponse.ok;
  } catch {
    return false;
  }
}

export async function notifyPurchaseCompleted(input: {
  order: OrderLike;
  userName: string;
  rconExecuted?: boolean;
}): Promise<DiscordNotificationResult> {
  const { order, userName, rconExecuted = false } = input;
  const channelId = getStoreOrderChannelId();
  const embed: DiscordEmbed = {
    title: "🎉 มีผู้สนับสนุน RitzSMP ใหม่ค่ะ!",
    description: "ขอบพระคุณสำหรับการสนับสนุนเซิร์ฟเวอร์ RitzSMP ขอให้สนุกกับสิทธิพิเศษในเกมนะคะ",
    color: 0xd4af37,
    fields: [
      { name: "ผู้สนับสนุน", value: userName || "ผู้เล่น RitzSMP", inline: true },
      { name: "Minecraft IGN", value: `\`${order.minecraftIGN}\``, inline: true },
      { name: "รายการ", value: order.rankName, inline: true },
      { name: "ยอดสนับสนุน", value: formatAmount(order.amount), inline: true },
      { name: "การส่งยศเข้าเกม", value: rconExecuted ? "✅ RCON สำเร็จ" : "⏳ รอตรวจสอบ/ดำเนินการ", inline: true },
      { name: "เลขที่รายการ", value: `#${order.id}`, inline: true },
    ],
    footer: { text: "RitzSMP Supporters • ขอบคุณที่ร่วมสนับสนุนเซิร์ฟเวอร์ค่ะ" },
    timestamp: formatTimestamp(order.createdAt),
  };
  return postDiscordMessage(channelId, { embeds: [embed] });
}

function formatGamePrice(value: string | number): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
}

export async function notifyAuctionHouseEvent(input: {
  kind: "listed" | "sold";
  seller: string;
  buyer?: string;
  item: string;
  amount: number;
  price: string | number;
  isBid?: boolean;
  occurredAt?: Date | string | number;
}): Promise<DiscordNotificationResult> {
  const listed = input.kind === "listed";
  const eventTitle = listed ? "📦 มีผู้เล่นลงขายสินค้าใน AuctionHouse" : "✅ มีการซื้อสินค้าใน AuctionHouse";
  const fields: DiscordEmbedField[] = [
    { name: "ผู้ลงขาย", value: input.seller.slice(0, 100), inline: true },
    { name: "ไอเทม", value: input.item.slice(0, 1024), inline: true },
    { name: "จำนวน", value: String(input.amount), inline: true },
    { name: "ราคา", value: `${formatGamePrice(input.price)} เงินในเกม`, inline: true },
    { name: "ประเภท", value: input.isBid ? "ประมูล (BID)" : "ขายขาด", inline: true },
  ];
  if (!listed) fields.splice(1, 0, { name: "ผู้ซื้อ", value: (input.buyer || "ไม่ระบุ").slice(0, 100), inline: true });

  return postDiscordMessage(getOrderInGameChannelId(), {
    embeds: [{
      title: eventTitle,
      description: listed
        ? "มีรายการใหม่ถูกลงขายในตลาดกลางของเซิร์ฟเวอร์ค่ะ"
        : "รายการในตลาดกลางถูกซื้อสำเร็จแล้วค่ะ",
      color: listed ? 0x8b5cf6 : 0x22c55e,
      fields,
      footer: { text: "RitzSMP AuctionHouse • แจ้งเตือนจากธุรกรรมจริง" },
      timestamp: formatTimestamp(input.occurredAt),
    }],
  });
}

export async function postDiscordReportPanel(channelId: string): Promise<DiscordNotificationResult> {
  return postDiscordMessage(channelId, {
    embeds: [{
      title: "🚨 ระบบรายงานผู้เล่น RitzSMP",
      description: "กดปุ่มเริ่มรายงานเพื่อเลือกผู้เล่นและหมวดหมู่ จากนั้นกรอกรายละเอียดเพิ่มเติม ทีมงานจะได้รับแจ้งเตือนใน Discord ค่ะ",
      color: 0xef4444,
      footer: { text: "RitzSMP • กรุณารายงานตามข้อเท็จจริง" },
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 1, label: "เริ่มรายงาน", custom_id: "ritz_report_button" },
        { type: 2, style: 2, label: "ยกเลิก", custom_id: "ritz_report_cancel" },
      ],
    }],
  });
}

export async function postDiscordSetupSystemPanel(
  channelId: string,
  kind: "welcome" | "leave",
): Promise<DiscordNotificationResult> {
  const isWelcome = kind === "welcome";
  return postDiscordMessage(channelId, {
    embeds: [{
      title: isWelcome ? "👋 ระบบต้อนรับสมาชิกใหม่ RitzSMP" : "ไว้เจอกันใหม่นะคะ 👋",
      description: isWelcome
        ? "ช่องนี้ใช้สำหรับข้อความต้อนรับสมาชิกใหม่ค่ะ กดปุ่มด้านล่างเพื่อเชื่อมบัญชีและเริ่มใช้งานระบบได้เลยนะคะ 💖"
        : "ช่องนี้ใช้สำหรับแจ้งเตือนเมื่อสมาชิกออกจากเซิร์ฟเวอร์ RitzSMP ค่ะ",
      color: isWelcome ? 0xec4899 : 0xf472b6,
      footer: { text: isWelcome ? "RitzSMP AI • แผงต้อนรับที่แอดมินสั่งสร้าง" : "RitzSMP AI • แผงสมาชิกออกที่แอดมินสั่งสร้าง" },
      timestamp: new Date().toISOString(),
    }],
    ...(isWelcome ? {
      components: [{
        type: 1,
        components: [
          { type: 2, style: 1, label: "🔗 เชื่อมบัญชี Minecraft", custom_id: "ritz_verify_button" },
          { type: 2, style: 2, label: "❌ ยกเลิกรหัส / เปลี่ยนบัญชี", custom_id: "ritz_cancel_verify_button" },
          { type: 2, style: 4, label: "🔓 ยกเลิกการเชื่อมต่อ", custom_id: "ritz_unlink_button" },
          { type: 2, style: 2, label: "📝 รายงานผู้เล่น", custom_id: "ritz_report_button" },
        ],
      }],
    } : {}),
  });
}

export const discordNotificationInternals = {
  getSupportChannelId,
  getStoreOrderChannelId,
  getOrderInGameChannelId,
  notifyAuctionHouseEvent,
  getDieLogChannelId,
  getDonateLogChannelId,
  formatAmount,
  postDiscordMessage,
  notifyMinecraftPresence,
};

export async function notifyPlayerReportCaseStatus(input: {
  caseChannelId?: string | null;
  reportId: number;
  status: "กำลังตรวจสอบ" | "ปิดแล้ว";
  handledByDisplayName: string;
}): Promise<boolean> {
  if (!input.caseChannelId) return false;
  return postDiscordChannelPayload({
    channelId: input.caseChannelId,
    botToken: getDiscordToken(),
    payload: {
      embeds: [{
        title: input.status === "ปิดแล้ว" ? "✅ ปิดเคสรายงานแล้ว" : "🔎 รับเคสรายงานแล้ว",
        description: input.status === "ปิดแล้ว"
          ? "ทีมงานดำเนินการกับรายงานนี้เสร็จแล้ว หากมีข้อมูลเพิ่มเติมสามารถแจ้งในห้องนี้ได้ค่ะ"
          : "ทีมงานรับเรื่องแล้ว กำลังตรวจสอบข้อมูลเพิ่มเติมค่ะ",
        color: input.status === "ปิดแล้ว" ? 0x22c55e : 0xf59e0b,
        fields: [
          { name: "เลขที่รายงาน", value: `#${input.reportId}`, inline: true },
          { name: "ผู้ดำเนินการ", value: input.handledByDisplayName.slice(0, 1024) || "Staff", inline: true },
        ],
        footer: { text: `RitzSMP • สถานะปัจจุบัน: ${input.status}` },
        timestamp: new Date().toISOString(),
      }],
    },
  });
}

import { ENV } from "./_core/env";
import { storageGetSignedUrl } from "./storage";
import { getMinecraftStatusChannelId } from "./discordMinecraftStatusChannel";

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

const DISCORD_API = "https://discord.com/api/v10";

function getDiscordToken(): string {
  return process.env.DISCORD_AI_BOT_TOKEN || ENV.discordAiBotToken || "";
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
      const fileResponse = await fetch(attachment.url, { signal: AbortSignal.timeout(8000) });
      if (!fileResponse.ok) {
        throw new Error(`slip download failed (${fileResponse.status})`);
      }
      const bytes = await fileResponse.arrayBuffer();
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
    return await postDiscordMessage(channelId, { embeds: [embed] }, {
      url: signedUrl,
      fileName: getSlipFileName(order.slipKey),
      contentType: slipType,
    });
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
      { name: "แหล่งข้อมูล", value: "Minecraft status API • ระบบ Heartbeat", inline: true },
    ],
    footer: { text: "RitzSMP • แจ้งเตือนสถานะผู้เล่นอัตโนมัติ" },
    timestamp: new Date().toISOString(),
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
      { name: "ผู้ถูกรายงาน", value: input.targetDiscordName.slice(0, 1024), inline: true },
      { name: "Minecraft IGN", value: input.targetMinecraftIGN ? ["`", input.targetMinecraftIGN.slice(0, 1000), "`"].join("") : "ไม่พบข้อมูลที่เชื่อม", inline: true },
      { name: "หมวดหมู่", value: input.category.slice(0, 1024), inline: true },
      { name: "รายละเอียด", value: input.details.slice(0, 1024), inline: false },
    ],
    footer: { text: `RitzSMP • Guild ${input.guildId} • สถานะ: ใหม่` },
    timestamp: formatTimestamp(input.createdAt),
  };
  return postDiscordMessage(channelId, { embeds: [embed] });
}

export async function notifyPurchaseCompleted(input: {
  order: OrderLike;
  userName: string;
  rconExecuted?: boolean;
}): Promise<DiscordNotificationResult> {
  const { order, userName, rconExecuted = false } = input;
  const channelId = getSupportChannelId();
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

export const discordNotificationInternals = {
  getSupportChannelId,
  getDonateLogChannelId,
  formatAmount,
  postDiscordMessage,
  notifyMinecraftPresence,
};

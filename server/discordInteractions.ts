import { createPublicKey, verify as verifySignature } from "node:crypto";
import type { RequestHandler } from "express";
import { ENV } from "./_core/env.js";
import {
  cancelDiscordVerificationCode,
  createPlayerReport,
  getDiscordVerification,
  getLatestPlayerReportByReporter,
  getLinkedDiscordVerifications,
  getMinecraftPresenceState,
  getPlayerReportById,
  unlinkDiscordVerification,
  updatePlayerReportCaseChannel,
  updatePlayerReportOnce,
  updatePlayerReportStatus,
} from "./db.js";
import {
  announceMinecraftPlayerReport,
  fetchMinecraftServerStatus,
  getMinecraftDiscordVerificationCode,
  isValidMinecraftIgn,
  type MinecraftServerStatus,
} from "./minecraftIntegration.js";
import {
  createPlayerReportCase,
  notifyPlayerReportCaseClosingCountdown,
  notifyPlayerReportCaseStatus,
  notifyPlayerReportStatus,
  postDiscordReportPanel,
  postDiscordSetupSystemPanel,
  removePlayerReportCase,
} from "./discordNotifications.js";
import {
  buildDiscordMembersMessage,
  editDiscordOriginalInteractionResponse,
  fetchDiscordGuildMembers,
} from "./discordRest.js";

const DISCORD_PUBLIC_KEY_DER_PREFIX = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);

const DISCORD_INTERACTION_PING = 1;
const DISCORD_INTERACTION_APPLICATION_COMMAND = 2;
const DISCORD_RESPONSE_PONG = 1;
const DISCORD_RESPONSE_CHANNEL_MESSAGE = 4;
const DISCORD_RESPONSE_DEFERRED_CHANNEL_MESSAGE = 5;
const EPHEMERAL_MESSAGE_FLAG = 1 << 6;

// Production forwards direct API routes to Express. Keep this separate from
// tRPC so Discord's signed raw body never reaches the JSON-RPC parser.
export const RITZSMP_DISCORD_INTERACTION_ENDPOINT_PATH =
  "/api/discord/interactions";

type DiscordInteractionPayload = {
  type?: number;
  application_id?: string;
  token?: string;
  guild_id?: string;
  data?: {
    name?: string;
    custom_id?: string;
    values?: string[];
    options?: Array<{ name?: string; type?: number; options?: Array<{ name?: string }> }>;

    components?: Array<{ components?: Array<{ custom_id?: string; value?: string }> }>;
  };
  channel_id?: string;
  member?: {
    user?: {
      id?: string;
      username?: string;
    };
    permissions?: string;
  };
  user?: {
    id?: string;
    username?: string;
  };
};

export type RitzSmpInteractionAction =
  | "verification-code"
  | "cancel-code"
  | "unlink"
  | "profile"
  | "minecraft-players"
  | "discord-members"
  | "report-open"
  | "report-cancel"
  | "report-target"
  | "report-category"
  | "report-submit"
  | "report-claim"
  | "report-close"
  | "report-edit-open"
  | "report-edit-category"
  | "report-edit-submit"
  | "setup-panel"
  | "setup-welcome"
  | "setup-leave"
  | "unsupported";

export function identifyRitzSmpInteractionAction(
  interaction: DiscordInteractionPayload,
): RitzSmpInteractionAction {
  const customId = interaction.data?.custom_id;
  const commandName = interaction.data?.name?.toLowerCase();

  if (
    customId === "ritz_verify_button" ||
    (interaction.type === DISCORD_INTERACTION_APPLICATION_COMMAND &&
      commandName === "verify")
  ) {
    return "verification-code";
  }
  if (customId === "ritz_cancel_verify_button") return "cancel-code";
  if (customId === "ritz_unlink_button") return "unlink";
  if (customId === "ritz_profile_button") return "profile";
  if (customId === "ritz_players_button") return "minecraft-players";
  if (customId === "ritz_discord_members_button") return "discord-members";
  if (customId === "ritz_report_button") return "report-open";
  if (customId === "ritz_report_cancel") return "report-cancel";
  if (customId === "ritz_report_target") return "report-target";
  if (customId?.startsWith("ritz_report_category:")) return "report-category";
  if (customId?.startsWith("ritz_report_modal:")) return "report-submit";
  if (customId?.startsWith("ritz_report_claim:")) return "report-claim";
  if (customId?.startsWith("ritz_report_close:")) return "report-close";
  if (customId?.startsWith("ritz_report_edit:")) return "report-edit-open";
  if (customId?.startsWith("ritz_report_edit_category:")) return "report-edit-category";
  if (customId?.startsWith("ritz_report_edit_modal:")) return "report-edit-submit";
  if (interaction.type === DISCORD_INTERACTION_APPLICATION_COMMAND && commandName === "setup") {
    const subcommand = interaction.data?.options?.[0]?.name?.toLowerCase();
    if (subcommand === "panel") return "setup-panel";
    if (subcommand === "welcome") return "setup-welcome";
    if (subcommand === "leave") return "setup-leave";
  }
  return "unsupported";
}

export function buildVerificationCodeMessage(
  code: string,
  isExisting: boolean,
): string {
  return [
    "## 🔗 รหัสยืนยันตัวตน Minecraft",
    `รหัสของคุณคือ: **\`${code}\`**`,
    "",
    "1. เข้าเกม Minecraft ที่ `ritz.mcsv.me`",
    `2. พิมพ์ \`/verify ${code}\` ในแชตเกม`,
    "3. ระบบจะเชื่อมบัญชีทันทีค่ะ",
    "",
    isExisting
      ? "นี่คือรหัสที่รอการยืนยันอยู่เดิม ใช้รหัสนี้ในเกมได้เลย"
      : "รหัสนี้สร้างจาก Minecraft โดยตรง และใช้ได้จนกว่าจะยืนยันสำเร็จ",
    "ห้ามแชร์รหัสนี้กับผู้อื่น",
  ].join("\n");
}

export function buildOwnDiscordProfileMessage(
  verification:
    | {
        minecraftIGN: string;
        verifiedAt?: Date | string | number | null;
      }
    | undefined,
): string {
  if (!verification) {
    return [
      "## 🪪 บัญชีของคุณ",
      "ยังไม่มีบัญชี Minecraft ที่เชื่อมอยู่ค่ะ",
      "กดปุ่มเชื่อมบัญชีเพื่อรับรหัส แล้วพิมพ์ `/verify <รหัส>` ในเกม",
    ].join("\n");
  }

  const verifiedDate = verification.verifiedAt
    ? new Date(verification.verifiedAt)
    : null;
  const verifiedAt =
    verifiedDate && !Number.isNaN(verifiedDate.getTime())
      ? verifiedDate.toLocaleString("th-TH")
      : "บันทึกไว้แล้ว";

  return [
    "## 🪪 บัญชีของคุณ",
    "สถานะ: ✅ เชื่อมบัญชี Minecraft แล้ว",
    `Minecraft: **${verification.minecraftIGN}**`,
    `ยืนยันเมื่อ: ${verifiedAt}`,
    "ข้อมูลนี้แสดงเฉพาะผู้กดปุ่ม และไม่แสดง UUID ของ Minecraft",
  ].join("\n");
}

export function buildMinecraftPlayersMessage(
  status: MinecraftServerStatus,
): string {
  const players = Number.isFinite(status.players)
    ? Math.max(0, Math.floor(status.players))
    : 0;
  const maxPlayers = Number.isFinite(status.maxPlayers)
    ? Math.max(0, Math.floor(status.maxPlayers))
    : 0;

  if (!status.online) {
    return [
      "## 👥 ผู้เล่น Minecraft ออนไลน์",
      "🔴 ตรวจสอบเซิร์ฟเวอร์ไม่สำเร็จหรือเซิร์ฟเวอร์ออฟไลน์",
      "จำนวนผู้เล่น: **0 คน**",
      "กดปุ่มอีกครั้งเพื่อรีเฟรชสถานะได้ค่ะ",
    ].join("\n");
  }

  const playerList = status.playerListKnown
    ? status.playerNames
        .filter((name) => typeof name === "string" && name.trim())
        .slice(0, 100)
        .map((name) => `• ${name.trim().slice(0, 32)}`)
        .join("\n")
    : "";
  const description =
    players === 0
      ? "🟢 เซิร์ฟเวอร์ออนไลน์ แต่ตอนนี้ยังไม่มีผู้เล่นอยู่ในเซิร์ฟเวอร์"
      : playerList ||
        "🟢 เซิร์ฟเวอร์ออนไลน์ แต่ API ยังไม่เปิดเผยรายชื่อผู้เล่นในขณะนี้ค่ะ";

  return [
    "## 👥 ผู้เล่น Minecraft ออนไลน์",
    description,
    `สถานะ: 🟢 ออนไลน์ **${players}/${maxPlayers} คน**`,
    "ข้อมูลจาก Minecraft status API • กดปุ่มอีกครั้งเพื่อรีเฟรช",
  ].join("\n");
}

function normalizeHex(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]+$/.test(normalized) ? normalized : null;
}

export function isUsableDiscordApplicationPublicKey(
  publicKey: string | undefined,
): boolean {
  const publicKeyHex = normalizeHex(publicKey);
  if (!publicKeyHex || publicKeyHex.length !== 64) return false;
  try {
    createPublicKey({
      key: Buffer.concat([
        DISCORD_PUBLIC_KEY_DER_PREFIX,
        Buffer.from(publicKeyHex, "hex"),
      ]),
      format: "der",
      type: "spki",
    });
    return true;
  } catch {
    return false;
  }
}

export function verifyDiscordInteractionSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  publicKey: string | undefined,
): boolean {
  const signature = normalizeHex(signatureHeader);
  const publicKeyHex = normalizeHex(publicKey);
  if (
    !signature ||
    !publicKeyHex ||
    !isUsableDiscordApplicationPublicKey(publicKey) ||
    !timestampHeader ||
    signature.length !== 128 ||
    publicKeyHex.length !== 64
  ) {
    return false;
  }

  try {
    const key = createPublicKey({
      key: Buffer.concat([
        DISCORD_PUBLIC_KEY_DER_PREFIX,
        Buffer.from(publicKeyHex, "hex"),
      ]),
      format: "der",
      type: "spki",
    });
    return verifySignature(
      null,
      Buffer.concat([Buffer.from(timestampHeader, "utf8"), rawBody]),
      key,
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

function isDiscordAdministrator(interaction: DiscordInteractionPayload): boolean {
  const permissions = interaction.member?.permissions;
  if (typeof permissions !== "string" || !/^[0-9]+$/.test(permissions)) return false;
  let modulo16 = 0;
  for (const digit of permissions) modulo16 = (modulo16 * 10 + Number(digit)) % 16;
  return (modulo16 & 8) === 8;
}
function getDiscordUserId(interaction: DiscordInteractionPayload): string | null {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  return typeof userId === "string" && userId.trim() ? userId : null;
}

function isConfiguredGuildInteraction(
  interaction: DiscordInteractionPayload,
): boolean {
  return Boolean(
    ENV.discordGuildId && interaction.guild_id === ENV.discordGuildId,
  );
}

function ephemeralResponse(content: string): {
  type: number;
  data: { content: string; flags: number; components?: unknown[] };
} {
  return {
    type: DISCORD_RESPONSE_CHANNEL_MESSAGE,
    data: {
      content,
      flags: EPHEMERAL_MESSAGE_FLAG,
    },
  };
}

export function deferredEphemeralResponse() {
  return {
    type: DISCORD_RESPONSE_DEFERRED_CHANNEL_MESSAGE,
    data: {
      flags: EPHEMERAL_MESSAGE_FLAG,
    },
  };
}

export async function finishDeferredMinecraftPlayersInteraction(
  interaction: DiscordInteractionPayload,
  dependencies: {
    fetchStatus?: typeof fetchMinecraftServerStatus;
    editResponse?: typeof editDiscordOriginalInteractionResponse;
  } = {},
): Promise<void> {
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;
  if (!applicationId || !interactionToken) return;

  const fetchStatus = dependencies.fetchStatus ?? fetchMinecraftServerStatus;
  const editResponse =
    dependencies.editResponse ?? editDiscordOriginalInteractionResponse;
  const status = await fetchStatus({ timeoutMs: 2_200 });
  await editResponse({
    applicationId,
    interactionToken,
    content: buildMinecraftPlayersMessage(status),
  });
}

export async function finishDeferredReportStatusInteraction(
  interaction: DiscordInteractionPayload,
  input: {
    reportId: number;
    status: "กำลังตรวจสอบ" | "ปิดแล้ว";
    handledByDiscordId: string;
    handledByDisplayName: string;
  },
  dependencies: {
    updateStatus?: typeof updatePlayerReportStatus;
    notifyReporter?: typeof notifyPlayerReportStatus;
    notifyCase?: typeof notifyPlayerReportCaseStatus;
    notifyClosingCountdown?: typeof notifyPlayerReportCaseClosingCountdown;
    deleteCase?: typeof removePlayerReportCase;
    editResponse?: typeof editDiscordOriginalInteractionResponse;
  } = {},
): Promise<void> {
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;
  if (!applicationId || !interactionToken) return;

  const updateStatus = dependencies.updateStatus ?? updatePlayerReportStatus;
  const notifyReporter = dependencies.notifyReporter ?? notifyPlayerReportStatus;
  const notifyCase = dependencies.notifyCase ?? notifyPlayerReportCaseStatus;
  const notifyClosingCountdown =
    dependencies.notifyClosingCountdown ?? notifyPlayerReportCaseClosingCountdown;
  const deleteCase = dependencies.deleteCase ?? removePlayerReportCase;
  const editResponse = dependencies.editResponse ?? editDiscordOriginalInteractionResponse;
  const isClaim = input.status === "กำลังตรวจสอบ";

  try {
    const report = await updateStatus({
      id: input.reportId,
      status: input.status,
      handledByDiscordId: input.handledByDiscordId,
      handledByDisplayName: input.handledByDisplayName,
    });
    if (!report) {
      await editResponse({
        applicationId,
        interactionToken,
        content: "รายงานนี้อาจถูกดำเนินการไปแล้ว หรือยังไม่อยู่ในสถานะที่เปลี่ยนได้ค่ะ",
      });
      return;
    }

    if (!isClaim) {
      const notified = await notifyReporter({
        reporterDiscordId: report.reporterDiscordId,
        reportId: report.id,
        status: report.status as "กำลังตรวจสอบ" | "ปิดแล้ว",
      });
      await notifyClosingCountdown({
        caseChannelId: report.caseChannelId,
        reportId: report.id,
      });
      const deletion = await deleteCase({
        guildId: report.guildId,
        caseChannelId: report.caseChannelId,
        caseCategoryId: report.caseCategoryId,
      });
      const roomText = deletion.caseChannelDeleted
        ? deletion.caseCategoryDeleted
          ? " ลบห้องเคสและห้องรวบรวมเคสที่ว่างแล้ว"
          : " ลบห้องเคสนี้แล้ว"
        : " ปิดสถานะเคสแล้ว แต่ยังลบห้องเคสไม่สำเร็จ กรุณาตรวจสิทธิ์ Manage Channels ของบอท";
      await editResponse({
        applicationId,
        interactionToken,
        content: `ปิดรายงาน #${report.id} แล้วค่ะ${notified ? " และแจ้งผู้รายงานทาง DM แล้ว" : " แต่ไม่สามารถส่ง DM แจ้งผู้รายงานได้"}${roomText}`,
      });
      return;
    }

    const [notified] = await Promise.all([
      notifyReporter({
        reporterDiscordId: report.reporterDiscordId,
        reportId: report.id,
        status: report.status as "กำลังตรวจสอบ" | "ปิดแล้ว",
      }),
      notifyCase({
        caseChannelId: report.caseChannelId,
        reportId: report.id,
        status: report.status as "กำลังตรวจสอบ" | "ปิดแล้ว",
        handledByDisplayName: report.handledByDisplayName ?? input.handledByDisplayName,
      }),
    ]);

    await editResponse({
      applicationId,
      interactionToken,
      content: `รับรายงาน #${report.id} แล้วค่ะ${notified ? " และแจ้งผู้รายงานทาง DM แล้ว" : " แต่ไม่สามารถส่ง DM แจ้งผู้รายงานได้"} ห้องเคสของรายงานนี้ยังคงอยู่จนกว่าจะปิดเคส`,
    });
  } catch {
    await editResponse({
      applicationId,
      interactionToken,
      content: "ไม่สามารถดำเนินการกับรายงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ",
    });
  }
}

const REPORT_CATEGORIES = [
  "โกงหรือใช้โปรแกรมช่วยเล่น",
  "ทำร้ายหรือก่อกวนผู้เล่น",
  "แชตไม่เหมาะสม/สแปม",
  "ใช้บั๊กหรือช่องโหว่",
  "ชื่อหรือสกินไม่เหมาะสม",
  "อื่น ๆ",
] as const;

// Discord limits component custom_id/value fields to 100 characters. Keep
// transport identifiers short and stable; Thai labels remain user-facing and
// are mapped back to the canonical values before validation/storage.
const REPORT_CATEGORY_IDS = ["cat_1", "cat_2", "cat_3", "cat_4", "cat_5", "cat_6"] as const;
const REPORT_CATEGORY_BY_ID: Record<(typeof REPORT_CATEGORY_IDS)[number], (typeof REPORT_CATEGORIES)[number]> = Object.fromEntries(
  REPORT_CATEGORY_IDS.map((id, index) => [id, REPORT_CATEGORIES[index]]),
) as Record<(typeof REPORT_CATEGORY_IDS)[number], (typeof REPORT_CATEGORIES)[number]>;
const REPORT_CATEGORY_PRESENTATION: Record<(typeof REPORT_CATEGORIES)[number], { emoji: string; description: string }> = {
  "โกงหรือใช้โปรแกรมช่วยเล่น": { emoji: "🛡️", description: "พบการโกงหรือใช้โปรแกรมช่วยเล่น" },
  "ทำร้ายหรือก่อกวนผู้เล่น": { emoji: "⚔️", description: "รบกวนหรือทำให้ผู้เล่นอื่นเดือดร้อน" },
  "แชตไม่เหมาะสม/สแปม": { emoji: "💬", description: "ข้อความไม่เหมาะสมหรือส่งข้อความซ้ำ" },
  "ใช้บั๊กหรือช่องโหว่": { emoji: "🐛", description: "ใช้บั๊กหรือช่องโหว่ของเซิร์ฟเวอร์" },
  "ชื่อหรือสกินไม่เหมาะสม": { emoji: "🎭", description: "ชื่อหรือสกินไม่เหมาะสม" },
  "อื่น ๆ": { emoji: "📌", description: "เรื่องอื่นที่ต้องการแจ้งทีมงาน" },
};
function reportCategoryOption(category: (typeof REPORT_CATEGORIES)[number], isDefault = false) {
  const presentation = REPORT_CATEGORY_PRESENTATION[category];
  return {
    label: category.slice(0, 100),
    emoji: { name: presentation.emoji },
    value: reportCategoryId(category) ?? "cat_6",
    description: presentation.description.slice(0, 100),
    ...(isDefault ? { default: true } : {}),
  };
}
function reportCategoryId(category: string): (typeof REPORT_CATEGORY_IDS)[number] | null {
  const index = REPORT_CATEGORIES.indexOf(category as (typeof REPORT_CATEGORIES)[number]);
  return index >= 0 ? REPORT_CATEGORY_IDS[index] : null;
}

function reportCategoryFromId(id: string): (typeof REPORT_CATEGORIES)[number] | null {
  return Object.prototype.hasOwnProperty.call(REPORT_CATEGORY_BY_ID, id)
    ? REPORT_CATEGORY_BY_ID[id as (typeof REPORT_CATEGORY_IDS)[number]]
    : null;
}

const REPORT_COOLDOWN_DEFAULT_MS = 0;

export function validatePlayerReportInput(input: { category: string; details: string }): boolean {
  return REPORT_CATEGORIES.includes(input.category as (typeof REPORT_CATEGORIES)[number]) && input.details.trim().length >= 1 && input.details.trim().length <= 1000;
}
export function getPlayerReportCooldownRemainingMs(createdAt: Date | string | number | undefined, now = Date.now(), cooldownMs = reportCooldownMs()): number {
  if (!createdAt || cooldownMs <= 0) return 0;
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, cooldownMs - Math.max(0, now - timestamp));
}

function reportCooldownMs(): number {
  const seconds = Number(process.env.DISCORD_REPORT_COOLDOWN_SECONDS ?? "0");
  return Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds * 1000) : REPORT_COOLDOWN_DEFAULT_MS;
}
function getInteractionDisplayName(interaction: DiscordInteractionPayload): string {
  return (interaction.member?.user?.username ?? interaction.user?.username ?? "สมาชิก Discord").trim().slice(0, 128);
}
function modalFieldValues(interaction: DiscordInteractionPayload): Record<string, string> {
  const values: Record<string, string> = {};
  for (const row of interaction.data?.components ?? []) {
    for (const component of row.components ?? []) {
      if (component.custom_id && typeof component.value === "string") values[component.custom_id] = component.value.trim();
    }
  }
  return values;
}
function reportModalResponse(customId: string, title: string, defaults?: { category?: string; details?: string }) {
  return {
    type: 9,
    data: {
      custom_id: customId,
      title,
      components: [
        {
          type: 1,
          components: [{ type: 4, custom_id: "category", label: "หมวดหมู่", style: 1, required: true, min_length: 1, max_length: 64, value: defaults?.category ?? REPORT_CATEGORIES[0] }],
        },
        {
          type: 1,
          components: [{ type: 4, custom_id: "details", label: "รายละเอียด", style: 2, required: true, min_length: 1, max_length: 1000, value: defaults?.details ?? "" }],
        },
      ],
    },
  };
}

export function buildReportEditCategoryResponse(reportId: number, currentCategory: string) {
  const currentId = reportCategoryId(currentCategory);
  return {
    type: DISCORD_RESPONSE_CHANNEL_MESSAGE,
    data: {
      content: "เลือกหมวดหมู่ใหม่ของรายงาน แล้วกรอกรายละเอียดเพิ่มเติมได้เลยค่ะ",
      flags: EPHEMERAL_MESSAGE_FLAG,
      components: [
        {
          type: 1,
          components: [{
            type: 3,
            custom_id: `ritz_report_edit_category:${reportId}`,
            placeholder: "เลือกหมวดหมู่รายงาน",
            min_values: 1,
            max_values: 1,
            options: REPORT_CATEGORIES.map((category) => reportCategoryOption(category, reportCategoryId(category) === currentId)),
          }],
        },
        { type: 1, components: [{ type: 2, style: 2, label: "ยกเลิก", custom_id: "ritz_report_cancel" }] },
      ],
    },
  };
}

export function buildReportEditDetailsModalResponse(reportId: number, category: string, details: string) {
  const categoryId = reportCategoryId(category);
  return reportDetailsModalResponse(
    `ritz_report_edit_modal:${reportId}:${categoryId ?? "cat_6"}`,
    "แก้ไขรายงานผู้เล่น",
    details,
  );
}
export function buildReportCategoryResponse(targetId: string) {
  return {
    type: DISCORD_RESPONSE_CHANNEL_MESSAGE,
    data: {
      content: "เลือกหมวดหมู่ของรายงาน แล้วกรอกรายละเอียดเพิ่มเติมได้เลยค่ะ",
      flags: EPHEMERAL_MESSAGE_FLAG,
      components: [
        {
          type: 1,
          components: [{
            type: 3,
            custom_id: `ritz_report_category:${targetId}`,
            placeholder: "เลือกหมวดหมู่รายงาน",
            min_values: 1,
            max_values: 1,
            options: REPORT_CATEGORIES.map((category) => reportCategoryOption(category)),
          }],
        },
        { type: 1, components: [{ type: 2, style: 2, label: "ยกเลิก", custom_id: "ritz_report_cancel" }] },
      ],
    },
  };
}

export function buildPlayerReportDetailsModalResponse(targetId: string, category: string) {
  const categoryId = reportCategoryId(category);
  return reportDetailsModalResponse(
    `ritz_report_modal:${targetId}:${categoryId ?? "cat_6"}`,
    "รายงานผู้เล่น RitzSMP",
  );
}

function reportDetailsModalResponse(customId: string, title: string, details?: string) {
  return {
    type: 9,
    data: {
      custom_id: customId,
      title,
      components: [{
        type: 1,
        components: [{ type: 4, custom_id: "details", label: "รายละเอียด", style: 2, required: true, min_length: 1, max_length: 1000, ...(details !== undefined ? { value: details } : {}) }],
      }],
    },
  };
}

type ReportTargetOption = {
  minecraftIGN: string;
  discordUserId?: string;
};

function parseCachedPresenceNames(
  presence: Awaited<ReturnType<typeof getMinecraftPresenceState>>,
): string[] {
  if (!presence?.lastOnline || !presence.playerListKnown || !presence.lastPlayerNames) return [];
  try {
    const names = JSON.parse(presence.lastPlayerNames);
    return Array.isArray(names)
      ? names.filter((name): name is string => typeof name === "string" && isValidMinecraftIgn(name.trim()))
      : [];
  } catch {
    return [];
  }
}

function buildReportTargetResponse(
  verifications: Awaited<ReturnType<typeof getLinkedDiscordVerifications>>,
  presence?: Awaited<ReturnType<typeof getMinecraftPresenceState>>,
) {
  const linkedByIgn = new Map(verifications.map((verification) => [verification.minecraftIGN.toLowerCase(), verification]));
  const targets: ReportTargetOption[] = verifications.map((verification) => ({
    minecraftIGN: verification.minecraftIGN,
    discordUserId: verification.discordUserId,
  }));
  for (const minecraftIGN of parseCachedPresenceNames(presence)) {
    if (!linkedByIgn.has(minecraftIGN.toLowerCase())) targets.push({ minecraftIGN });
  }

  const options = targets.slice(0, 25).map((target) => ({
    label: target.discordUserId
      ? `${target.minecraftIGN} • Discord เชื่อมแล้ว`.slice(0, 100)
      : `${target.minecraftIGN} • ยังไม่เชื่อม Discord`.slice(0, 100),
    value: target.discordUserId ?? `mc:${encodeURIComponent(target.minecraftIGN)}`,
    description: target.discordUserId
      ? "เลือกผู้เล่นที่เชื่อมบัญชีแล้ว"
      : "ผู้เล่นออนไลน์ใน Minecraft ที่ยังไม่ได้เชื่อม Discord",
  }));
  return {
    type: DISCORD_RESPONSE_CHANNEL_MESSAGE,
    data: {
      content: "เลือกผู้เล่นที่ต้องการรายงานได้เลยค่ะ ระบบรวมผู้เล่น Minecraft ที่ออนไลน์ พร้อมแสดงสถานะบัญชี Discord เมื่อมีการเชื่อมแล้ว",
      flags: EPHEMERAL_MESSAGE_FLAG,
      components: [
        { type: 1, components: [{ type: 3, custom_id: "ritz_report_target", placeholder: "เลือกผู้เล่น", min_values: 1, max_values: 1, options }] },
        { type: 1, components: [{ type: 2, style: 2, label: "ยกเลิก", custom_id: "ritz_report_cancel" }] },
      ],
    },
  };
}
function reportEditButton(reportId: number) {
  return [{ type: 1, components: [{ type: 2, style: 2, label: "แก้ไขรายงาน (ได้อีก 1 ครั้ง)", custom_id: `ritz_report_edit:${reportId}` }] }];
}

/**
 * Completes a deferred report submit only after the case room has been created
 * and its ID is durable in the database. The case room is intentionally the
 * only authoritative destination for the full report; the panel channel is
 * used solely to start a report.
 */
export async function finishDeferredPlayerReportSubmitInteraction(
  interaction: DiscordInteractionPayload,
  report: Awaited<ReturnType<typeof createPlayerReport>>,
  dependencies: {
    createCase?: typeof createPlayerReportCase;
    updateCaseChannel?: typeof updatePlayerReportCaseChannel;
    announceMinecraft?: typeof announceMinecraftPlayerReport;
    editResponse?: typeof editDiscordOriginalInteractionResponse;
  } = {},
): Promise<void> {
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;
  if (!applicationId || !interactionToken) return;

  const createCase = dependencies.createCase ?? createPlayerReportCase;
  const updateCaseChannel =
    dependencies.updateCaseChannel ?? updatePlayerReportCaseChannel;
  const announceMinecraft =
    dependencies.announceMinecraft ?? announceMinecraftPlayerReport;
  const editResponse =
    dependencies.editResponse ?? editDiscordOriginalInteractionResponse;

  try {
    const caseResult = await createCase({
      reportId: report.id,
      guildId: report.guildId,
      reporterDiscordId: report.reporterDiscordId,
      targetDiscordId: report.targetDiscordId,
      reporterDisplayName: report.reporterDisplayName,
      targetDiscordName: report.targetDiscordName,
      targetMinecraftIGN: report.targetMinecraftIGN,
      category: report.category,
      details: report.details,
      createdAt: report.createdAt,
    });

    // Save a created channel even when its first message failed. This leaves a
    // durable audit trail and prevents a later retry from silently creating a
    // second case room for the same report.
    if (caseResult.channelId) {
      await updateCaseChannel({
        id: report.id,
        caseChannelId: caseResult.channelId,
      });
    }

    if (!caseResult.sent || !caseResult.channelId) {
      console.error(
        `[DiscordInteractions] Player report #${report.id} case room was not completed: ${caseResult.reason ?? "unknown reason"}`,
      );
      await editResponse({
        applicationId,
        interactionToken,
        content: `บันทึกรายงาน #${report.id} แล้ว แต่ยังสร้างห้องเคสไม่สำเร็จค่ะ ทีมงานได้รับข้อมูลในระบบแล้ว โปรดลองแจ้งทีมงานอีกครั้งก่อนส่งรายงานใหม่`,
        components: reportEditButton(report.id),
      });
      return;
    }

    await editResponse({
      applicationId,
      interactionToken,
      content: `ส่งรายงาน #${report.id} และสร้างห้องเคสแยกเรียบร้อยแล้วค่ะ ทีมงานจะตรวจสอบข้อมูลในห้องเคสของรายงานนี้`,
      components: reportEditButton(report.id),
    });

    // The case room is durable before the in-game notice is attempted. A
    // notification failure must not turn a successfully created case into a
    // failed report or cause a shared-channel duplicate.
    try {
      await announceMinecraft({
        reportId: report.id,
        targetName: report.targetMinecraftIGN ?? report.targetDiscordName,
      });
    } catch (error) {
      console.error(
        `[DiscordInteractions] Minecraft announcement for player report #${report.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } catch (error) {
    console.error(
      `[DiscordInteractions] Player report #${report.id} case room failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    await editResponse({
      applicationId,
      interactionToken,
      content: `บันทึกรายงาน #${report.id} แล้ว แต่ไม่สามารถสร้างห้องเคสได้ในขณะนี้ค่ะ กรุณาแจ้งทีมงานก่อนส่งรายงานใหม่`,
      components: reportEditButton(report.id),
    });
  }
}

export async function finishDeferredReportOpenInteraction(
  interaction: DiscordInteractionPayload,
  dependencies: {
    getLinked?: typeof getLinkedDiscordVerifications;
    getPresence?: typeof getMinecraftPresenceState;
    fetchStatus?: typeof fetchMinecraftServerStatus;
    editResponse?: typeof editDiscordOriginalInteractionResponse;
  } = {},
): Promise<void> {
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;
  if (!applicationId || !interactionToken) return;

  const getLinked = dependencies.getLinked ?? getLinkedDiscordVerifications;
  const getPresence = dependencies.getPresence ?? getMinecraftPresenceState;
  const fetchStatus = dependencies.fetchStatus ?? fetchMinecraftServerStatus;
  const editResponse =
    dependencies.editResponse ?? editDiscordOriginalInteractionResponse;
  const [linked, presence, liveStatus] = await Promise.all([
    getLinked(),
    getPresence(),
    fetchStatus({ timeoutMs: 2_200 }),
  ]);
  const livePresence = liveStatus.online && liveStatus.playerListKnown && liveStatus.playerNames.length > 0
    ? {
        id: 0,
        lastOnline: 1,
        playerListKnown: 1,
        lastPlayerNames: JSON.stringify(liveStatus.playerNames),
        lastCheckedAt: new Date(),
        scheduleCronTaskUid: null,
      } as Awaited<ReturnType<typeof getMinecraftPresenceState>>
    : presence;
  const response = linked.length || parseCachedPresenceNames(livePresence).length
    ? buildReportTargetResponse(linked, livePresence)
    : ephemeralResponse("ยังไม่พบผู้เล่น Minecraft ออนไลน์หรือบัญชีที่เชื่อมกับ Discord ให้เลือกค่ะ");
  await editResponse({
    applicationId,
    interactionToken,
    content: response.data.content,
    components: response.data.components,
  });
}

export const handleRitzSmpDiscordInteraction: RequestHandler = async (
  req,
  res,
) => {
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(String(req.body ?? ""), "utf8");
  const isValid = verifyDiscordInteractionSignature(
    rawBody,
    req.header("X-Signature-Ed25519") ?? undefined,
    req.header("X-Signature-Timestamp") ?? undefined,
    ENV.discordAiPublicKey,
  );

  if (!isValid) {
    return res.status(401).json({ error: "Invalid Discord request signature" });
  }

  let interaction: DiscordInteractionPayload;
  try {
    interaction = JSON.parse(rawBody.toString("utf8")) as DiscordInteractionPayload;
  } catch {
    return res.status(400).json({ error: "Invalid interaction payload" });
  }

  if (interaction.type === DISCORD_INTERACTION_PING) {
    return res.status(200).json({ type: DISCORD_RESPONSE_PONG });
  }

  const userId = getDiscordUserId(interaction);
  if (!userId) {
    return res.status(400).json({ error: "Interaction user is missing" });
  }

  try {
    const action = identifyRitzSmpInteractionAction(interaction);
    switch (action) {
      case "verification-code": {
        const codeResult = await getMinecraftDiscordVerificationCode(userId);
        if (codeResult.kind === "linked") {
          return res.status(200).json(
            ephemeralResponse(
              "บัญชี Discord นี้เชื่อมกับ Minecraft อยู่แล้วค่ะ หากต้องการยกเลิกการเชื่อมต่อ โปรดใช้ปุ่มยกเลิกการเชื่อมต่อ",
            ),
          );
        }
        return res.status(200).json(
          ephemeralResponse(
            buildVerificationCodeMessage(
              codeResult.code,
              codeResult.kind === "pending",
            ),
          ),
        );
      }
      case "cancel-code": {
        const cancelled = await cancelDiscordVerificationCode(userId);
        return res.status(200).json(
          ephemeralResponse(
            cancelled
              ? "ยกเลิกรหัสยืนยันที่ยังไม่ใช้เรียบร้อยแล้วค่ะ กดปุ่มเชื่อมบัญชีเพื่อสร้างรหัสใหม่ได้เลย"
              : "ไม่พบรหัสยืนยันที่กำลังรอใช้อยู่ค่ะ",
          ),
        );
      }
      case "unlink": {
        const unlinked = await unlinkDiscordVerification(userId);
        return res.status(200).json(
          ephemeralResponse(
            unlinked
              ? "ยกเลิกการเชื่อมต่อบัญชีเรียบร้อยแล้วค่ะ"
              : "ไม่พบบัญชี Minecraft ที่เชื่อมต่ออยู่ค่ะ",
          ),
        );
      }
      case "profile": {
        const verification = await getDiscordVerification(userId);
        return res.status(200).json(
          ephemeralResponse(buildOwnDiscordProfileMessage(verification)),
        );
      }
      case "minecraft-players": {
        // A deferred response acknowledges the button immediately. The status
        // lookup and webhook edit happen after Discord has accepted the ACK.
        if (!interaction.application_id || !interaction.token) {
          return res.status(200).json(
            ephemeralResponse(
              "ไม่สามารถรีเฟรชสถานะ Minecraft ได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ",
            ),
          );
        }

        // Send the ACK first, then keep this async request alive while the
        // autoscale runtime completes the webhook edit. Returning before the
        // promise settles can terminate the instance before PATCH is sent.
        res.status(200).json(deferredEphemeralResponse());
        try {
          await finishDeferredMinecraftPlayersInteraction(interaction);
        } catch {
          // Keep interaction tokens and upstream error details out of logs.
          console.error(
            "[DiscordInteractions] Minecraft players response could not be completed",
          );
        }
        return;
      }
      case "discord-members": {
        if (!isConfiguredGuildInteraction(interaction)) {
          return res.status(200).json(
            ephemeralResponse(
              "ปุ่มนี้ใช้ได้เฉพาะภายใน Discord RitzSMP ที่ตั้งค่าไว้ค่ะ",
            ),
          );
        }
        const result = await fetchDiscordGuildMembers({
          guildId: ENV.discordGuildId,
          botToken: ENV.discordAiBotToken,
        });
        return res.status(200).json(
          ephemeralResponse(
            result.kind === "ok"
              ? buildDiscordMembersMessage(result.members)
              : "ยังไม่สามารถดึงรายชื่อสมาชิกผ่าน Discord API ได้ในขณะนี้ค่ะ โปรดดูรายชื่อจากแถบสมาชิกของ Discord แล้วลองกดปุ่มใหม่ภายหลัง",
          ),
        );
      }
      case "report-open": {
        if (!isConfiguredGuildInteraction(interaction)) return res.status(200).json(ephemeralResponse("ระบบรายงานใช้ได้เฉพาะใน Discord RitzSMP ที่ตั้งค่าไว้ค่ะ"));
        if (!interaction.application_id || !interaction.token) {
          return res.status(200).json(ephemeralResponse("ไม่สามารถเปิดเมนูรายงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ"));
        }
        res.status(200).json(deferredEphemeralResponse());
        try {
          await finishDeferredReportOpenInteraction(interaction);
        } catch {
          console.error("[DiscordInteractions] Player report target menu could not be completed");
        }
        return;
      }
      case "report-cancel": {
        return res.status(200).json(ephemeralResponse("ยกเลิกการรายงานแล้วค่ะ หากต้องการรายงานใหม่ให้กดปุ่มรายงานอีกครั้ง"));
      }
      case "report-target": {
        if (!isConfiguredGuildInteraction(interaction)) return res.status(200).json(ephemeralResponse("ระบบรายงานใช้ได้เฉพาะใน Discord RitzSMP ที่ตั้งค่าไว้ค่ะ"));
        const targetId = interaction.data?.values?.[0]?.trim();
        // The value came from the signed report panel. Avoid a second database
        // lookup here so Discord receives the next menu before its deadline;
        // report-submit performs the authoritative linked-account check.
        if (!targetId) return res.status(200).json(ephemeralResponse("ไม่พบผู้เล่นที่เลือกค่ะ กรุณาเปิดเมนูรายงานใหม่แล้วลองอีกครั้ง"));
        return res.status(200).json(buildReportCategoryResponse(targetId));
      }
      case "report-category": {
        if (!isConfiguredGuildInteraction(interaction)) return res.status(200).json(ephemeralResponse("ระบบรายงานใช้ได้เฉพาะใน Discord RitzSMP ที่ตั้งค่าไว้ค่ะ"));
        const customId = interaction.data?.custom_id ?? "";
        const targetId = customId.slice("ritz_report_category:".length).trim();
        const categoryId = interaction.data?.values?.[0] ?? "";
        const category = reportCategoryFromId(categoryId);
        // A category select must be acknowledged within Discord's interaction
        // deadline. The target came from the signed panel response, while the
        // authoritative linked-account check remains in report-submit.
        if (!targetId || !category) {
          return res.status(200).json(ephemeralResponse("ไม่พบผู้เล่นหรือหมวดหมู่ที่เลือกค่ะ กรุณาเปิดเมนูรายงานใหม่แล้วลองอีกครั้ง"));
        }
        return res.status(200).json(buildPlayerReportDetailsModalResponse(targetId, category));
      }
      case "report-submit": {
        if (!isConfiguredGuildInteraction(interaction)) return res.status(200).json(ephemeralResponse("ระบบรายงานใช้ได้เฉพาะใน Discord RitzSMP ที่ตั้งค่าไว้ค่ะ"));
        const customId = interaction.data?.custom_id ?? "";
        const [, targetId, categoryId] = customId.split(":");
        const linked = targetId?.startsWith("mc:")
          ? undefined
          : (await getLinkedDiscordVerifications()).find((item) => item.discordUserId === targetId);
        const targetMinecraftIGN = linked?.minecraftIGN ?? (targetId?.startsWith("mc:") ? decodeURIComponent(targetId.slice(3)) : "");
        const fields = modalFieldValues(interaction);
        const category = categoryId ? reportCategoryFromId(categoryId) : null;
        const details = fields.details ?? "";
        if ((!linked && !isValidMinecraftIgn(targetMinecraftIGN)) || !category) {
          return res.status(200).json(ephemeralResponse("ข้อมูลรายงานไม่ครบถ้วนค่ะ กรุณาเลือกผู้เล่น หมวดหมู่ และใส่รายละเอียดอย่างน้อย 1 ตัวอักษร"));
        }
        if (!validatePlayerReportInput({ category, details })) {
          return res.status(200).json(ephemeralResponse("ข้อมูลรายงานไม่ครบถ้วนค่ะ กรุณาเลือกหมวดหมู่และใส่รายละเอียดอย่างน้อย 1 ตัวอักษร"));
        }
        const latest = await getLatestPlayerReportByReporter(userId);
        const cooldown = reportCooldownMs();
        const elapsed = latest ? Date.now() - new Date(latest.createdAt).getTime() : Number.POSITIVE_INFINITY;
        const remainingMs = getPlayerReportCooldownRemainingMs(latest?.createdAt, Date.now(), cooldown);
        if (remainingMs > 0) {
          const remaining = Math.ceil(remainingMs / 60000);
          return res.status(200).json(ephemeralResponse(`คุณเพิ่งส่งรายงานไปค่ะ กรุณารออีกประมาณ ${remaining} นาทีจึงจะส่งรายงานใหม่ได้`));
        }
        if (!interaction.application_id || !interaction.token) {
          return res.status(200).json(ephemeralResponse("ไม่สามารถส่งรายงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ"));
        }

        // Acknowledge before any DB or Discord REST work. This process remains
        // alive until the deferred original response is edited below.
        res.status(200).json(deferredEphemeralResponse());
        try {
          const report = await createPlayerReport({
            guildId: interaction.guild_id ?? ENV.discordGuildId,
            reporterDiscordId: userId,
            reporterDisplayName: getInteractionDisplayName(interaction),
            targetDiscordId: linked?.discordUserId ?? null,
            // Linked targets are rendered as a Discord mention; unlinked online
            // targets remain explicitly Minecraft-only instead of inventing an ID.
            targetDiscordName: linked ? `<@${linked.discordUserId}>` : "ยังไม่เชื่อม Discord",
            targetMinecraftIGN,
            category,
            details,
          });
          await finishDeferredPlayerReportSubmitInteraction(interaction, report);
        } catch (error) {
          console.error(
            `[DiscordInteractions] Player report submit failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          try {
            await editDiscordOriginalInteractionResponse({
              applicationId: interaction.application_id,
              interactionToken: interaction.token,
              content: "ไม่สามารถบันทึกรายงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ",
            });
          } catch (editError) {
            console.error(
              `[DiscordInteractions] Player report submit failure response could not be edited: ${editError instanceof Error ? editError.message : String(editError)}`,
            );
          }
        }
        return;
      }
      case "report-edit-open": {
        const reportId = Number((interaction.data?.custom_id ?? "").slice("ritz_report_edit:".length));
        const report = Number.isInteger(reportId) ? await getPlayerReportById(reportId) : undefined;
        if (!report || report.reporterDiscordId !== userId) return res.status(200).json(ephemeralResponse("ไม่พบรายงานของคุณค่ะ หรือรายงานนี้ไม่สามารถแก้ไขจากบัญชีนี้ได้"));
        if (report.editCount >= 1) return res.status(200).json(ephemeralResponse("รายงานนี้ถูกแก้ไขไปแล้วหนึ่งครั้ง จึงไม่สามารถแก้ไขซ้ำได้ค่ะ"));
        return res.status(200).json(buildReportEditCategoryResponse(report.id, report.category));
      }
      case "report-edit-category": {
        const customId = interaction.data?.custom_id ?? "";
        const reportId = Number(customId.slice("ritz_report_edit_category:".length));
        const category = reportCategoryFromId(interaction.data?.values?.[0] ?? "");
        const report = Number.isInteger(reportId) ? await getPlayerReportById(reportId) : undefined;
        if (!report || report.reporterDiscordId !== userId || report.editCount >= 1 || !category) {
          return res.status(200).json(ephemeralResponse("ไม่พบรายงานนี้ หรือรายงานนี้ไม่สามารถแก้ไขได้แล้วค่ะ"));
        }
        return res.status(200).json(buildReportEditDetailsModalResponse(report.id, category, report.details));
      }
      case "report-claim":
      case "report-close": {
        if (!isConfiguredGuildInteraction(interaction) || !isDiscordAdministrator(interaction)) {
          return res.status(200).json(ephemeralResponse("ปุ่มจัดการรายงานใช้ได้เฉพาะ Staff/ผู้ดูแลระบบเท่านั้นค่ะ"));
        }
        const prefix = action === "report-claim" ? "ritz_report_claim:" : "ritz_report_close:";
        const reportId = Number((interaction.data?.custom_id ?? "").slice(prefix.length));
        if (!Number.isInteger(reportId) || reportId <= 0) {
          return res.status(200).json(ephemeralResponse("ไม่พบเลขที่รายงานค่ะ กรุณาลองใหม่อีกครั้ง"));
        }
        if (!interaction.application_id || !interaction.token) {
          return res.status(200).json(ephemeralResponse("ไม่สามารถดำเนินการกับรายงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ"));
        }
        // Acknowledge first. Database writes, DM delivery and the case-channel
        // status post can exceed Discord's initial interaction deadline.
        res.status(200).json(deferredEphemeralResponse());
        await finishDeferredReportStatusInteraction(interaction, {
          reportId,
          status: action === "report-claim" ? "กำลังตรวจสอบ" : "ปิดแล้ว",
          handledByDiscordId: userId,
          handledByDisplayName: getInteractionDisplayName(interaction),
        });
        return;
      }
      case "setup-panel":
      case "setup-welcome":
      case "setup-leave": {
        if (!isConfiguredGuildInteraction(interaction) || !isDiscordAdministrator(interaction)) {
          return res.status(200).json(ephemeralResponse("คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบใน Discord RitzSMP เท่านั้นค่ะ"));
        }
        if (action === "setup-panel") {
          if (!ENV.discordReportChannelId) {
            return res.status(200).json(ephemeralResponse("ยังไม่ได้ตั้งค่าช่องรายงานในระบบค่ะ กรุณาตรวจสอบการตั้งค่า Discord"));
          }
          const posted = await postDiscordReportPanel(ENV.discordReportChannelId);
          return res.status(200).json(ephemeralResponse(
            posted.sent
              ? "สร้างแผงรายงานพร้อมปุ่มเริ่มรายงานและยกเลิกในช่องรายงานเรียบร้อยแล้วค่ะ"
              : "ไม่สามารถสร้างแผงรายงานได้ในขณะนี้ กรุณาตรวจสอบสิทธิ์บอทในช่องรายงานค่ะ",
          ));
        }
        const channelId = interaction.channel_id?.trim();
        if (!channelId) return res.status(200).json(ephemeralResponse("ไม่พบช่อง Discord ที่ใช้สร้างแผงค่ะ กรุณาลองใช้คำสั่งในช่องข้อความอีกครั้ง"));
        const kind = action === "setup-welcome" ? "welcome" : "leave";
        const posted = await postDiscordSetupSystemPanel(channelId, kind);
        return res.status(200).json(ephemeralResponse(
          posted.sent
            ? `สร้าง Embed ${kind === "welcome" ? "ต้อนรับสมาชิก" : "แจ้งสมาชิกออก"} ลงในช่องนี้เรียบร้อยแล้วค่ะ`
            : "ไม่สามารถสร้าง Embed ได้ในขณะนี้ กรุณาตรวจสอบสิทธิ์บอทในช่องนี้ค่ะ",
        ));
      }
      case "report-edit-submit": {
        const [, reportIdRaw, categoryId] = (interaction.data?.custom_id ?? "").split(":");
        const reportId = Number(reportIdRaw);
        const fields = modalFieldValues(interaction);
        const category = reportCategoryFromId(categoryId ?? "") ?? fields.category ?? "";
        const details = fields.details ?? "";
        if (!Number.isInteger(reportId) || !validatePlayerReportInput({ category, details })) return res.status(200).json(ephemeralResponse("ข้อมูลแก้ไขไม่ครบถ้วนค่ะ กรุณาตรวจสอบหมวดหมู่และรายละเอียด"));
        const updated = await updatePlayerReportOnce({ id: reportId, reporterDiscordId: userId, category, details });
        return res.status(200).json(ephemeralResponse(updated ? `แก้ไขรายงาน #${reportId} สำเร็จแล้วค่ะ การแก้ไขครั้งนี้ถูกใช้เรียบร้อย` : "รายงานนี้ไม่พบหรือถูกแก้ไขไปแล้วค่ะ"));
      }
      default:
        return res.status(200).json(
          ephemeralResponse(
            "ปุ่มนี้ยังไม่ได้รองรับผ่าน HTTP Interaction ค่ะ โปรดลองใช้คำสั่งหรือปุ่มที่ระบุไว้ในแผงนี้แทน",
          ),
        );
    }
  } catch (error) {
    console.error(
      "[DiscordInteractions] Failed to process interaction:",
      error instanceof Error ? error.message : String(error),
    );
    if (res.headersSent) return;
    return res.status(200).json(
      ephemeralResponse(
        "ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ",
      ),
    );
  }
};

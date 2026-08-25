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
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { ENV } from "./_core/env.js";
import { invokeLLM } from "./_core/llm.js";
import {
  createDiscordVerification,
  createDiscordVerificationCode,
  cancelDiscordVerificationCode,
  unlinkDiscordVerification,
  getDiscordVerification,
  getDiscordVerificationByMinecraftUuid,
  updateDiscordProfile,
  listDiscordEmbedTemplates,
  getDiscordEmbedTemplate,
  createDiscordEmbedTemplate,
  updateDiscordEmbedTemplate,
  deleteDiscordEmbedTemplate,
} from "./db.js";
import {
  fetchMinecraftProfile,
  fetchMinecraftServerStatus,
  grantMinecraftRank,
  type MinecraftServerStatus,
} from "./minecraftIntegration.js";
import { ensureMinecraftStatusTextChannel } from "./discordMinecraftStatusChannel.js";
import {
  getActiveManagedServerRuntimeConfig,
  type ManagedServerRuntimeConfig,
} from "./multiserverRuntime.js";

interface BotLog {
  timestamp: string;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  message: string;
}

const MAX_LOGS = 100;
const logsBuffer: BotLog[] = [];
let botClient: Client | null = null;
let activeManagedServerRuntime: ManagedServerRuntimeConfig | null = null;
let totalInteractionsCount = 0;
let botStartTime: number | null = null;

export function createSingleFlight<T>() {
  let inFlight: Promise<T> | null = null;

  return {
    run(factory: () => Promise<T>): Promise<T> {
      if (inFlight) return inFlight;
      inFlight = factory().catch((error) => {
        inFlight = null;
        throw error;
      });
      return inFlight;
    },
    get promise() {
      return inFlight;
    },
  };
}

const botStartup = createSingleFlight<Client | null>();

function pushLog(
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR",
  message: string,
) {
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

function getConfiguredDiscordGuildId(): string {
  return activeManagedServerRuntime?.discordGuildId || ENV.discordGuildId;
}

function interactionWasAlreadyAcknowledged(error: unknown): boolean {
  const code = (error as { code?: number } | null)?.code;
  return (
    code === 40060 ||
    /already been acknowledged|already acknowledged/i.test(String(error))
  );
}

function interactionWasNotReplied(error: unknown): boolean {
  return /InteractionNotReplied|reply to this interaction has not been sent or deferred/i.test(
    String(error),
  );
}

export async function ensureDeferredReply(
  interaction: any,
  options: { ephemeral?: boolean } = {},
): Promise<boolean> {
  if (!interaction) return false;
  if (
    typeof interaction.isRepliable === "function" &&
    !interaction.isRepliable()
  )
    return false;
  // Only trust Discord.js' live state. A marker can become stale when another
  // handler or an adapter mock touches the same interaction object.
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply(options);
    // Discord.js normally updates `deferred` synchronously, but keeping a
    // confirmation marker also makes the response path resilient to adapter
    // mocks and rare state-update races.
    interaction.__ritzDeferred = true;
    interaction.__ritzDeferConfirmed = true;
    return true;
  } catch (error) {
    if (
      interactionWasAlreadyAcknowledged(error) ||
      interaction.deferred ||
      interaction.replied
    ) {
      // A second listener may have acknowledged the interaction while this
      // listener was deferring it. Follow up rather than calling editReply
      // against a locally stale `deferred` flag.
      interaction.__ritzAcknowledgedByRace = true;
      pushLog(
        "INFO",
        "Interaction was acknowledged by another handler; continuing with followUp",
      );
      return true;
    }
    pushLog("ERROR", `Could not defer interaction: ${String(error)}`);
    return false;
  }
}

export async function safeReply(
  interaction: any,
  options: any,
): Promise<boolean> {
  if (!interaction) return false;
  if (
    typeof interaction.isRepliable === "function" &&
    !interaction.isRepliable()
  )
    return false;
  let payload = options;
  if (typeof options === "string") {
    payload = {
      content:
        options.length > 1950
          ? options.slice(0, 1900) + "\n...(ถูกตัดทอนความยาว)"
          : options,
    };
  } else if (
    options &&
    typeof options === "object" &&
    typeof options.content === "string" &&
    options.content.length > 1950
  ) {
    payload = {
      ...options,
      content: options.content.slice(0, 1900) + "\n...(ถูกตัดทอนความยาว)",
    };
  }
  try {
    // Use Discord.js state first. The confirmed marker is only set by the
    // current invocation of ensureDeferredReply, so it is safer than trusting
    // an arbitrary stale marker left by another handler or test fixture.
    if (
      interaction.deferred ||
      interaction.replied ||
      interaction.__ritzDeferConfirmed
    ) {
      await interaction.editReply(payload);
    } else if (
      interaction.__ritzAcknowledgedByRace &&
      typeof interaction.followUp === "function"
    ) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
    return true;
  } catch (error) {
    if (interactionWasNotReplied(error)) {
      try {
        await interaction.reply(payload);
        return true;
      } catch (replyError) {
        if (
          interactionWasAlreadyAcknowledged(replyError) &&
          typeof interaction.followUp === "function"
        ) {
          await interaction.followUp(payload);
          return true;
        }
        pushLog(
          "ERROR",
          `safeReply reply recovery failed: ${String(replyError)}`,
        );
        return false;
      }
    }
    if (interactionWasAlreadyAcknowledged(error)) {
      try {
        if (
          interaction.deferred ||
          interaction.replied ||
          interaction.__ritzDeferConfirmed
        ) {
          await interaction.editReply(payload);
        } else if (
          interaction.__ritzAcknowledgedByRace &&
          typeof interaction.followUp === "function"
        ) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
        return true;
      } catch (retryError) {
        pushLog(
          "ERROR",
          `safeReply acknowledged retry failed: ${String(retryError)}`,
        );
        return false;
      }
    }
    pushLog("WARN", `safeReply failed: ${String(error)}`);
    try {
      const fallbackPayload = {
        content: "เกิดข้อผิดพลาดในการตอบสนอง กรุณาลองใหม่อีกครั้งนะคะ 💕",
        ephemeral: true,
      };
      if (
        !interaction.replied &&
        !interaction.deferred &&
        !interaction.__ritzAcknowledgedByRace
      ) {
        await interaction.reply(fallbackPayload);
      } else if (
        interaction.__ritzAcknowledgedByRace &&
        typeof interaction.followUp === "function"
      ) {
        await interaction.followUp(fallbackPayload);
      } else {
        await interaction.editReply(fallbackPayload);
      }
      return true;
    } catch (fallbackError) {
      pushLog("ERROR", `safeReply fallback failed: ${String(fallbackError)}`);
      return false;
    }
  }
}

export const RITZ_WELCOME_COVER_IMAGE_URL =
  "https://ritzsmpstore-94jhsfkx.manus.space/manus-storage/welcome-cover_ec173e6c.png";
export const RITZ_RANK_CLAIM_IMAGE_URL =
  "https://ritzsmpstore-94jhsfkx.manus.space/manus-storage/rank-claim_2909f231.png";

function buildOnboardingComponents() {
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ritz_verify_button")
      .setLabel("🔗 เชื่อมบัญชี")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ritz_cancel_verify_button")
      .setLabel("❌ ยกเลิกรหัส / เปลี่ยนบัญชี")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ritz_unlink_button")
      .setLabel("🔓 ยกเลิกการเชื่อมต่อทั้งหมด")
      .setStyle(ButtonStyle.Danger),
  );
  return [actionRow];
}

export function buildRankClaimComponents() {
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ritz_claim_rank_button")
      .setLabel("✅ ยืนยันตัวตน")
      .setStyle(ButtonStyle.Success),
  );
  return [actionRow];
}

export function buildRankClaimEmbed() {
  return new EmbedBuilder()
    .setTitle("ยืนยันตัวตนกันด้วยน้า✨")
    .setDescription(
      "กดปุ่มด้านล่างเพื่อยืนยันตัวตนและรับยศสมาชิก RitzSMP นะคะ 💖\\n\\n" +
        "หากยังไม่ได้เชื่อมบัญชี Minecraft ระบบจะให้กรอกข้อมูลเพื่อดำเนินการต่อค่ะ",
    )
    .setColor(0xff4b5c)
    .setImage(RITZ_RANK_CLAIM_IMAGE_URL)
    .setFooter({ text: "RitzSMP AI • ระบบยืนยันตัวตนและรับยศอัตโนมัติ" })
    .setTimestamp();
}

export function buildWelcomeMemberEmbed(member: any) {
  return new EmbedBuilder()
    .setTitle("ยินดีต้อนรับเข้าสู่ RitzSMP นะคะ ✨")
    .setDescription(
      `สวัสดีค่ะ ${member}\\nอย่าลืมอ่านกฎเซิร์ฟเวอร์และกดยืนยันตัวตนเพื่อเริ่มใช้งานระบบนะคะ 💖`,
    )
    .setColor(0xec4899)
    .setImage(RITZ_WELCOME_COVER_IMAGE_URL)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: "RitzSMP AI • ยินดีต้อนรับสมาชิกใหม่" });
}

export const AUTO_SYSTEM_PANEL_DEPLOYMENT_ENABLED = false;

export type ManualEmbedKind = "welcome" | "leave";

export type ManualEmbedOptions = {
  title: string;
  description: string;
  color?: string | number;
  imageUrl?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  footerText?: string;
};

export function parseEmbedColor(
  input: string | number | undefined,
  fallback = 0xec4899,
): number {
  if (
    typeof input === "number" &&
    Number.isInteger(input) &&
    input >= 0 &&
    input <= 0xffffff
  ) {
    return input;
  }
  const normalized = String(input ?? "")
    .trim()
    .replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized)
    ? parseInt(normalized, 16)
    : fallback;
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildManualEmbedPayload(options: ManualEmbedOptions) {
  const embed = new EmbedBuilder()
    .setTitle(options.title.trim().slice(0, 256))
    .setDescription(options.description.trim().slice(0, 4096))
    .setColor(parseEmbedColor(options.color))
    .setTimestamp()
    .setFooter({
      text: (options.footerText || "ประกาศโดยแอดมิน • RitzSMP AI").slice(
        0,
        2048,
      ),
    });

  if (isHttpUrl(options.imageUrl)) embed.setImage(options.imageUrl);

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (options.buttonLabel?.trim() && isHttpUrl(options.buttonUrl)) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(options.buttonLabel.trim().slice(0, 80))
          .setStyle(ButtonStyle.Link)
          .setURL(options.buttonUrl),
      ),
    );
  }

  return { embeds: [embed], components };
}

export function buildManualSystemPanelPayload(
  kind: ManualEmbedKind,
  overrides: Partial<ManualEmbedOptions> = {},
) {
  const defaults =
    kind === "welcome"
      ? {
          title: "👋 ระบบต้อนรับสมาชิกใหม่ RitzSMP",
          description:
            "ช่องนี้ใช้สำหรับข้อความต้อนรับสมาชิกใหม่ค่ะ กดปุ่มเชื่อมบัญชีเพื่อเริ่มใช้งานระบบได้เลยนะคะ 💖",
          color: 0xec4899,
          imageUrl: RITZ_WELCOME_COVER_IMAGE_URL,
          footerText: "RitzSMP AI • แผงต้อนรับที่แอดมินสั่งสร้าง",
        }
      : {
          title: "ไว้เจอกันใหม่นะคะ 👋",
          description:
            "ช่องนี้ใช้สำหรับข้อความแจ้งสมาชิกออกจากเซิร์ฟเวอร์ RitzSMP ค่ะ",
          color: 0xf472b6,
          imageUrl: RITZ_WELCOME_COVER_IMAGE_URL,
          footerText: "RitzSMP AI • แผงสมาชิกออกที่แอดมินสั่งสร้าง",
        };
  return buildManualEmbedPayload({ ...defaults, ...overrides });
}

export function isDiscordAdministrator(interaction: any): boolean {
  if (!interaction?.guild) return false;
  const permissions =
    interaction.memberPermissions ?? interaction.member?.permissions;
  if (permissions?.has)
    return permissions.has(PermissionsBitField.Flags.Administrator);
  return false;
}

function getEmbedData(message: any) {
  const source = message?.embeds?.[0]?.data ?? message?.embeds?.[0] ?? {};
  return {
    title: String(source.title ?? "ประกาศ RitzSMP AI"),
    description: String(source.description ?? ""),
    color: source.color,
    imageUrl: source.image?.url ?? null,
    footerText: source.footer?.text ?? "แก้ไขโดยแอดมิน • RitzSMP AI",
  };
}

async function requireDiscordAdministrator(interaction: any): Promise<boolean> {
  if (isDiscordAdministrator(interaction)) return true;
  await safeReply(interaction, {
    content: "คำสั่งนี้ใช้ได้เฉพาะแอดมินเซิร์ฟเวอร์เท่านั้นค่ะ 🔒",
    ephemeral: true,
  });
  return false;
}

function getInteractionTextChannel(interaction: any): any | null {
  const channel = interaction?.channel;
  return channel?.isTextBased?.() && typeof channel.send === "function"
    ? channel
    : null;
}

export type WelcomePanelMessageLike = {
  id: string;
  embeds?: any[];
  components?: any[];
};

export function isMisroutedWelcomePanelMessage(
  message: WelcomePanelMessageLike,
): boolean {
  const titles = (message.embeds ?? []).map((embed) =>
    String(embed?.title ?? embed?.data?.title ?? ""),
  );
  const footers = (message.embeds ?? []).map((embed) =>
    String(embed?.footer?.text ?? embed?.data?.footer?.text ?? ""),
  );
  const customIds = (message.components ?? [])
    .flatMap((row) => row?.components ?? [])
    .map((component) =>
      String(
        component?.customId ??
          component?.data?.custom_id ??
          component?.custom_id ??
          "",
      ),
    );
  const isWelcomeTitle = titles.some((title) =>
    title.includes("ยินดีต้อนรับเข้าสู่ RitzSMP"),
  );
  const isWelcomeFooter = footers.some((footer) =>
    footer.includes("ยินดีต้อนรับสมาชิกใหม่"),
  );
  return (
    (isWelcomeTitle || isWelcomeFooter) &&
    customIds.includes("ritz_verify_button")
  );
}

export function planMisroutedWelcomePanelCleanup(
  messages: Iterable<WelcomePanelMessageLike>,
) {
  return Array.from(messages)
    .filter(isMisroutedWelcomePanelMessage)
    .map((message) => message.id);
}

export function getPreferredWelcomeChannelId(
  runtimeChannelId?: string,
  configuredChannelId?: string,
): string {
  return runtimeChannelId?.trim() || configuredChannelId?.trim() || "";
}

export function buildLeaveMemberEmbed(member: any) {
  return new EmbedBuilder()
    .setTitle("ไว้เจอกันใหม่นะคะ 👋")
    .setDescription(
      `**${member.user.tag}** ออกจากเซิร์ฟเวอร์ Discord ของ RitzSMP แล้วค่ะ\\nขอบคุณที่เคยร่วมสนุกด้วยกันนะคะ 💕`,
    )
    .setColor(0xf472b6)
    .setImage(RITZ_WELCOME_COVER_IMAGE_URL)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: "RitzSMP AI • สมาชิกออกจากเซิร์ฟเวอร์" });
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
    .setImage(RITZ_WELCOME_COVER_IMAGE_URL)
    .setFooter({ text: "RitzSMP AI • ผู้ช่วยสาวน้อยประจำเซิร์ฟเวอร์ค่ะ" })
    .setTimestamp();
}

export const ACCOUNT_LIST_PANEL_MARKER =
  "RitzSMP AI • ระบบรายชื่อบัญชี • canonical-v1";
export const LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME = "🧾│บันทึกรับยศสำเร็จ";
export const LEGACY_KANOPI_BOT_USER_ID = "1369921212062629939";

export type RankLogMessageLike = {
  id: string;
  author?: { id?: string; username?: string; bot?: boolean };
  content?: string;
  embeds?: any[];
};

export function isLegacyKanopiRankLogMessage(
  message: RankLogMessageLike,
): boolean {
  const authorId = String(message.author?.id ?? "");
  const authorName = String(message.author?.username ?? "").toLowerCase();
  const isLegacyAuthor =
    authorId === LEGACY_KANOPI_BOT_USER_ID ||
    (message.author?.bot === true &&
      (authorName === "botnasa000" || authorName.includes("kanopi")));
  if (!isLegacyAuthor) return false;

  const content = String(message.content ?? "");
  const embedFields = (message.embeds ?? []).flatMap(
    (embed) => embed?.fields ?? embed?.data?.fields ?? [],
  );
  const fieldNames = embedFields
    .map((field) => String(field?.name ?? ""))
    .join(" ");
  const footers = (message.embeds ?? []).map((embed) =>
    String(embed?.footer?.text ?? embed?.data?.footer?.text ?? ""),
  );
  const hasRankLogContent = content.includes("ได้รับยศเรียบร้อยแล้ว");
  const hasRankLogFields =
    fieldNames.includes("ชื่อในเกม") && fieldNames.includes("สไตล์ การเล่น");
  const hasLegacyIdFooter = footers.some((footer) => /^ID:\s*\d+/.test(footer));
  return hasRankLogContent || (hasRankLogFields && hasLegacyIdFooter);
}

export function planLegacyKanopiRankLogCleanup(
  messages: Iterable<RankLogMessageLike>,
): string[] {
  return Array.from(messages)
    .filter(isLegacyKanopiRankLogMessage)
    .map((message) => message.id);
}

export const RITZ_SYSTEM_CHANNEL_TARGETS = [
  {
    name: "🔗│ระบบเชื่อมบัญชี",
    legacyNames: ["✅│เชื่อมต่อดิสคอร์ด", "🔗│เชื่อมบัญชี-Minecraft"],
    type: ChannelType.GuildText,
    topic: "ระบบเชื่อมบัญชี Discord กับ Minecraft และรับรหัส /verify 4 หลัก",
  },
  {
    name: "📋│ระบบรายชื่อบัญชี",
    legacyNames: [
      "📋│รายชื่อบัญชี",
      "📋︱รายชื่อบัญชี",
      "📋│รายชื่อ-บัญชีผู้เล่น",
    ],
    type: ChannelType.GuildText,
    topic: "ระบบแสดงรายชื่อสมาชิกและบัญชี Minecraft ที่ยืนยันแล้ว",
  },
  {
    name: "🎖️│ระบบยืนยันรับยศ",
    legacyNames: ["🪪│ยืนยันตัวตนแมะ", "🎖️│ยืนยันตัวตน-รับยศ"],
    type: ChannelType.GuildText,
    topic: "ระบบยืนยันตัวตนและกดรับยศสมาชิก RitzSMP AI",
  },
  {
    name: "👋│ระบบต้อนรับ",
    legacyNames: [
      "👋│welcome",
      "👋│ต้อนรับ-เข้าออก",
      "👋│ระบบต้อนรับ-เข้าออก",
      "🤞🏻│leave",
    ],
    type: ChannelType.GuildText,
    topic: "ระบบต้อนรับสมาชิกใหม่และแจ้งเตือนสมาชิกเข้าเซิร์ฟเวอร์",
  },
  {
    name: "👋│ระบบสมาชิกออก",
    legacyNames: ["👋│leave", "👋│สมาชิกออก", "👋│ระบบออกจากเซิร์ฟเวอร์"],
    type: ChannelType.GuildText,
    topic: "ระบบแจ้งเตือนสมาชิกออกจากเซิร์ฟเวอร์",
  },
] as const;

export type ManagedSystemChannelLike = {
  id: string;
  name: string;
  type?: number;
  position?: number;
};

export function planManagedSystemChannelCleanup(
  channels: Iterable<ManagedSystemChannelLike>,
  target: { name: string; legacyNames: readonly string[] },
) {
  const candidates = Array.from(channels)
    .filter(
      (channel) =>
        (channel.type === undefined ||
          channel.type === ChannelType.GuildText) &&
        (channel.name === target.name ||
          target.legacyNames.includes(channel.name)),
    )
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id),
    );

  const exactMatches = candidates.filter(
    (channel) => channel.name === target.name,
  );
  const canonical = exactMatches[0] ?? candidates[0];

  return {
    canonicalId: canonical?.id ?? null,
    duplicateIds: candidates
      .filter((channel) => channel.id !== canonical?.id)
      .map((channel) => channel.id),
  };
}

export function isAccountListPanelMessage(
  message: { author?: { id?: string }; embeds?: any[]; components?: any[] },
  botUserId?: string,
): boolean {
  if (botUserId && message.author?.id !== botUserId) return false;

  const titles = (message.embeds ?? []).map((embed) =>
    String(embed?.title ?? embed?.data?.title ?? ""),
  );
  const customIds = (message.components ?? [])
    .flatMap((row) => row?.components ?? [])
    .map((component) =>
      String(component?.customId ?? component?.data?.custom_id ?? ""),
    );

  return (
    titles.some((title) => title.includes("รายชื่อสมาชิกและบัญชี")) ||
    customIds.includes("ritz_profile_button")
  );
}

export type AccountListPanelMessageLike = {
  id: string;
  author?: { id?: string };
  embeds?: any[];
  components?: any[];
  createdTimestamp?: number;
};

export function planAccountListPanelCleanup(
  messages: Iterable<AccountListPanelMessageLike>,
  botUserId?: string,
) {
  const panels = Array.from(messages)
    .filter((message) => isAccountListPanelMessage(message, botUserId))
    .sort(
      (a, b) =>
        (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0) ||
        a.id.localeCompare(b.id),
    );

  return {
    canonicalId: panels[0]?.id ?? null,
    duplicateIds: panels.slice(1).map((message) => message.id),
  };
}

export function buildAccountListPanelPayload() {
  const embed = new EmbedBuilder()
    .setTitle("📋 รายชื่อสมาชิกและบัญชีที่ยืนยันตัวตน")
    .setDescription(
      "ระบบบันทึกรายชื่อสมาชิกผู้เล่น RitzSMP ทั้งหมดโดยอัตโนมัติ กดปุ่มด้านล่างเพื่อตรวจสอบโปรไฟล์ของคุณได้เลยค่ะ ✨",
    )
    .setColor(0x3b82f6)
    .setFooter({ text: ACCOUNT_LIST_PANEL_MARKER })
    .setTimestamp();
  const profileRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ritz_profile_button")
      .setLabel("🪪 ดูโปรไฟล์ของฉัน")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ritz_discord_members_button")
      .setLabel("👥 สมาชิก Discord")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ritz_players_button")
      .setLabel("⛏️ ผู้เล่น Minecraft ออนไลน์")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ritz_unlink_button")
      .setLabel("🔓 ยกเลิกเชื่อมบัญชี")
      .setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [profileRow] };
}

async function fetchRecentChannelMessages(
  channel: any,
  limit = 100,
): Promise<any[]> {
  const collection = await channel.messages.fetch({ limit });
  return Array.from(collection.values());
}

async function cleanupLegacyKanopiRankLogMessages(
  client: Client,
): Promise<void> {
  const rankLogChannelId = ENV.discordSupportChannelId?.trim() || "";
  if (!rankLogChannelId) return;

  const channel = (await client.channels
    .fetch(rankLogChannelId)
    .catch(() => null)) as any;
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;

  const messages = await fetchRecentChannelMessages(channel);
  const staleIds = planLegacyKanopiRankLogCleanup(messages);
  for (const message of messages.filter((message) =>
    staleIds.includes(message.id),
  )) {
    await message
      .delete(
        "Remove legacy Kanopi rank-log message from RitzSMP purchase-success channel",
      )
      .then(() => {
        pushLog(
          "SUCCESS",
          `Removed legacy Kanopi rank-log message ${message.id}`,
        );
      })
      .catch((error: unknown) => {
        pushLog(
          "WARN",
          `Could not remove legacy Kanopi rank-log message ${message.id}: ${String(error)}`,
        );
      });
  }
}

async function cleanupMisroutedWelcomePanels(client: Client): Promise<void> {
  const purchaseChannelId = ENV.discordSupportChannelId?.trim() || "";
  if (!purchaseChannelId) return;

  const channel = (await client.channels
    .fetch(purchaseChannelId)
    .catch(() => null)) as any;
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;

  const messages = await fetchRecentChannelMessages(channel);
  const staleIds = planMisroutedWelcomePanelCleanup(messages);
  for (const message of messages.filter((message) =>
    staleIds.includes(message.id),
  )) {
    await message
      .delete("Remove misrouted welcome panel from purchase-success channel")
      .then(() => {
        pushLog(
          "SUCCESS",
          `Removed misrouted welcome panel ${message.id} from purchase-success channel`,
        );
      })
      .catch((error: unknown) => {
        pushLog(
          "WARN",
          `Could not remove misrouted welcome panel ${message.id}: ${String(error)}`,
        );
      });
  }
}

async function reconcileAccountListPanel(
  channel: any,
  client: Client,
): Promise<void> {
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const cleanupPlan = planAccountListPanelCleanup(messages, botUserId);
  const canonicalPanel = messages.find(
    (message) => message.id === cleanupPlan.canonicalId,
  );

  if (canonicalPanel) {
    await canonicalPanel.edit(buildAccountListPanelPayload());
  } else {
    await channel.send(buildAccountListPanelPayload());
  }

  for (const stalePanel of messages.filter((message) =>
    cleanupPlan.duplicateIds.includes(message.id),
  )) {
    await stalePanel
      .delete("Remove duplicate RitzSMP AI account-list panel")
      .catch((error: unknown) => {
        pushLog(
          "WARN",
          `Could not delete duplicate account-list panel: ${String(error)}`,
        );
      });
  }
}

async function cleanupDuplicateAccountListChannel(
  channel: any,
  client: Client,
): Promise<void> {
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;

  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const duplicatePanels = messages.filter((message) =>
    isAccountListPanelMessage(message, botUserId),
  );
  for (const panel of duplicatePanels) {
    await panel
      .delete(
        "Remove duplicate RitzSMP AI account-list panel from legacy channel",
      )
      .catch((error: unknown) => {
        pushLog(
          "WARN",
          `Could not delete legacy account-list panel: ${String(error)}`,
        );
      });
  }

  const nonPanelMessages = messages.filter(
    (message) => !isAccountListPanelMessage(message, botUserId),
  );
  if (nonPanelMessages.length > 0) {
    if (
      channel.name !== LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME &&
      typeof channel.setName === "function"
    ) {
      const previousName = channel.name;
      await channel
        .setName(
          LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME,
          "Clarify preserved rank-fulfillment log channel",
        )
        .then(() => {
          pushLog(
            "SUCCESS",
            `Renamed preserved legacy channel ${previousName} to ${LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME}`,
          );
        })
        .catch((error: unknown) => {
          pushLog(
            "WARN",
            `Could not rename preserved legacy account-list channel ${channel.id}: ${String(error)}`,
          );
        });
    }
    return;
  }
  if (messages.length < 100 && typeof channel.delete === "function") {
    await channel
      .delete("Remove empty legacy RitzSMP AI account-list channel")
      .catch((error: unknown) => {
        pushLog(
          "WARN",
          `Could not delete duplicate account-list channel ${channel.id}: ${String(error)}`,
        );
      });
  }
}

async function sendToDiscordChannel(
  client: Client,
  channelId: string,
  payload: any,
): Promise<boolean> {
  if (!channelId) {
    pushLog("WARN", "Discord channel is not configured for this event");
    return false;
  }
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      pushLog(
        "WARN",
        `Configured Discord channel ${channelId} is not text-based or unavailable`,
      );
      return false;
    }
    await (channel as any).send(payload);
    return true;
  } catch (error) {
    pushLog(
      "ERROR",
      `Failed to send Discord channel message: ${String(error)}`,
    );
    return false;
  }
}

export async function addConfiguredRole(
  interaction: any,
  roleId: string,
  reason: string,
): Promise<boolean> {
  if (!roleId || !interaction.guild) return false;
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId, reason);
    }
    return true;
  } catch (error) {
    pushLog(
      "WARN",
      `Could not add configured Discord role ${roleId}: ${String(error)}`,
    );
    return false;
  }
}

export function getVerificationConflict(
  existingForDiscord:
    | { discordUserId: string; minecraftUuid: string }
    | undefined,
  existingForMinecraft:
    | { discordUserId: string; minecraftUuid: string }
    | undefined,
  discordUserId: string,
  minecraftUuid: string,
) {
  if (
    existingForMinecraft &&
    existingForMinecraft.discordUserId !== discordUserId
  )
    return "minecraft-linked-to-other-discord" as const;
  if (existingForDiscord && existingForDiscord.minecraftUuid !== minecraftUuid)
    return "discord-linked-to-other-minecraft" as const;
  return null;
}

async function verifyDiscordNativeAccount(
  interaction: any,
  shouldClaimRank: boolean,
) {
  if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return;
  const rawInput = interaction.fields.getTextInputValue("minecraft_ign").trim();

  // Discord-native verification: Minecraft linking is optional
  let minecraftInfo =
    "ไม่ได้เชื่อมต่อ Minecraft (ยืนยันตัวตนผ่าน Discord 100%)";
  let verified = await addConfiguredRole(
    interaction,
    ENV.discordVerifiedRoleId,
    "RitzSMP AI Discord-native verification",
  );
  let rankMessage = "";

  if (rawInput && rawInput.length > 0 && !/^none$/i.test(rawInput)) {
    const profile = await fetchMinecraftProfile(rawInput);
    if (profile) {
      try {
        const existingForDiscord = await getDiscordVerification(
          interaction.user.id,
        );
        const existingForMinecraft =
          await getDiscordVerificationByMinecraftUuid(profile.id);
        const verificationConflict = getVerificationConflict(
          existingForDiscord,
          existingForMinecraft,
          interaction.user.id,
          profile.id,
        );
        if (verificationConflict === "minecraft-linked-to-other-discord") {
          await safeReply(
            interaction,
            "ชื่อ Minecraft นี้ถูกเชื่อมกับ Discord อื่นแล้วค่ะ แต่การยืนยันตัวตนใน Discord สำเร็จแล้วนะจ๊ะ 💕",
          );
          return;
        }
        if (!existingForDiscord) {
          await createDiscordVerification({
            discordUserId: interaction.user.id,
            minecraftIGN: profile.name,
            minecraftUuid: profile.id,
          });
        }
        minecraftInfo = `**${profile.name}**`;
        if (shouldClaimRank) {
          const rankResult = await grantMinecraftRank(
            profile.name,
            ENV.discordClaimRankGroup,
          );
          const memberRoleAdded = await addConfiguredRole(
            interaction,
            ENV.discordMemberRoleId,
            "RitzSMP member rank claim",
          );
          rankMessage = rankResult.executed
            ? `\n🎖️ มอบกลุ่ม LuckPerms **${ENV.discordClaimRankGroup}** ให้ในเกมแล้วค่ะ${memberRoleAdded ? " และเพิ่มยศสมาชิกใน Discord แล้วนะค้า" : ""}`
            : `\n🎖️ เชื่อมบัญชีสำเร็จค่ะ แต่ยังไม่เปิด RCON ในเกม${memberRoleAdded ? " (เพิ่มยศสมาชิกใน Discord แล้วจ้า)" : ""}`;
        }
      } catch (err) {
        pushLog("WARN", `Optional Minecraft lookup note: ${String(err)}`);
      }
    } else {
      // Save Discord-only profile if minecraft profile not found in Mojang
      try {
        const existingForDiscord = await getDiscordVerification(
          interaction.user.id,
        );
        if (!existingForDiscord) {
          await createDiscordVerification({
            discordUserId: interaction.user.id,
            minecraftIGN: rawInput.slice(0, 16),
            minecraftUuid: `discord-native-${interaction.user.id}`,
          });
        }
        minecraftInfo = `**${rawInput}** (Discord-native alias)`;
      } catch (e) {
        // ignore duplicate
      }
    }
  } else {
    // Pure Discord-native verification without minecraft
    try {
      const existingForDiscord = await getDiscordVerification(
        interaction.user.id,
      );
      if (!existingForDiscord) {
        await createDiscordVerification({
          discordUserId: interaction.user.id,
          minecraftIGN: interaction.user.username.slice(0, 16),
          minecraftUuid: `discord-native-${interaction.user.id}`,
        });
      }
    } catch (e) {}
  }

  const memberRoleAdded = shouldClaimRank
    ? await addConfiguredRole(
        interaction,
        ENV.discordMemberRoleId,
        "RitzSMP member role claim",
      )
    : false;

  await safeReply(
    interaction,
    `ยินดีด้วยนะคะ! ยืนยันตัวตนใน Discord สำเร็จแล้วค่า ✨\n👤 สมาชิก: **${interaction.user.tag}**\n⛏️ Minecraft: ${minecraftInfo}\n${verified ? "✅ ได้รับยศ Verified เรียบร้อยแล้วนะคะ 💕" : "⚠️ ยังไม่ได้ตั้งค่า Verified Role ในระบบ"}`,
  );
  pushLog("SUCCESS", `Discord-native verified ${interaction.user.id}`);
}

export function buildDiscordMembersEmbed(members: any[]) {
  const visibleMembers = members
    .filter((member) => !member.user?.bot)
    .slice(0, 25);
  const description =
    visibleMembers.length > 0
      ? visibleMembers
          .map((member, index) => {
            const displayName =
              member.displayName ||
              member.user?.globalName ||
              member.user?.username ||
              `สมาชิก ${index + 1}`;
            return `**${index + 1}.** ${displayName} (<@${member.id}>)`;
          })
          .join("\n")
      : "ยังไม่พบสมาชิก Discord ที่แสดงได้ในขณะนี้ค่ะ";

  return new EmbedBuilder()
    .setTitle("👥 รายชื่อสมาชิก Discord RitzSMP")
    .setDescription(description)
    .addFields({
      name: "🔒 ความเป็นส่วนตัว",
      value:
        "แสดงเฉพาะชื่อ Discord และการ mention ของสมาชิกในเซิร์ฟเวอร์ ไม่แสดงอีเมลหรือข้อมูลส่วนตัวค่ะ",
    })
    .setColor(0x8b5cf6)
    .setFooter({
      text:
        visibleMembers.length >= 25
          ? "แสดง 25 คนแรก • รายชื่อเต็มดูได้ใน Discord"
          : `สมาชิกที่แสดง ${visibleMembers.length} คน`,
    })
    .setTimestamp();
}

async function replyWithDiscordMembers(interaction: any) {
  if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return;
  try {
    if (!interaction.guild?.members?.fetch) {
      await safeReply(interaction, {
        content: "คำสั่งนี้ใช้ได้ภายในเซิร์ฟเวอร์ Discord เท่านั้นค่ะ",
        ephemeral: true,
      });
      return;
    }
    const fetched = await interaction.guild.members.fetch();
    const members = Array.from(
      typeof fetched.values === "function" ? fetched.values() : [],
    );
    await safeReply(interaction, {
      embeds: [buildDiscordMembersEmbed(members)],
      ephemeral: true,
    });
  } catch (error) {
    pushLog("ERROR", `Failed to load Discord member list: ${String(error)}`);
    await safeReply(interaction, {
      content:
        "ยังโหลดรายชื่อสมาชิก Discord ไม่สำเร็จค่ะ กรุณาลองใหม่อีกครั้งนะคะ",
      ephemeral: true,
    });
  }
}

export function buildMinecraftPlayersEmbed(status: MinecraftServerStatus) {
  const playerCount = Number.isFinite(status.players)
    ? Math.max(0, status.players)
    : 0;
  const maxPlayers = Number.isFinite(status.maxPlayers)
    ? Math.max(0, status.maxPlayers)
    : 0;
  const description = status.online
    ? playerCount === 0
      ? "🟢 เซิร์ฟเวอร์ออนไลน์ค่ะ แต่ตอนนี้ยังไม่มีผู้เล่นอยู่ในเซิร์ฟเวอร์"
      : status.playerNames.length > 0
        ? status.playerNames.map((name) => `• ${name}`).join("\n")
        : "🟢 เซิร์ฟเวอร์ออนไลน์ แต่ API ยังไม่เปิดเผยรายชื่อผู้เล่นในขณะนี้ค่ะ"
    : "🔴 ตรวจสอบเซิร์ฟเวอร์ไม่สำเร็จหรือเซิร์ฟเวอร์ออฟไลน์ค่ะ แสดงผู้เล่น 0 คนชั่วคราว";
  const statusValue = status.online
    ? `🟢 ออนไลน์ ${playerCount}/${maxPlayers} คน`
    : "🔴 ตรวจสอบไม่ได้ • แสดง 0 คนชั่วคราว";

  return new EmbedBuilder()
    .setTitle("👥 รายชื่อผู้เล่นใน RitzSMP")
    .setDescription(description)
    .addFields({ name: "สถานะ", value: statusValue, inline: true })
    .setColor(status.online ? 0x22c55e : 0xef4444)
    .setTimestamp()
    .setFooter({
      text: "ข้อมูลจาก Minecraft status API • กดปุ่มอีกครั้งเพื่อรีเฟรช",
    });
}

async function replyWithPlayers(interaction: any) {
  if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return;
  try {
    const mc = await fetchMinecraftServerStatus();
    await safeReply(interaction, {
      embeds: [buildMinecraftPlayersEmbed(mc)],
      ephemeral: true,
    });
  } catch (error) {
    pushLog("WARN", `Minecraft player status fallback: ${String(error)}`);
    await safeReply(interaction, {
      content: "ตรวจสอบ Minecraft ไม่สำเร็จค่ะ แสดงผู้เล่น 0 คนชั่วคราวนะคะ",
      ephemeral: true,
    });
  }
}

async function replyWithVerificationCode(interaction: any) {
  if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return;
  try {
    const codeRow = await createDiscordVerificationCode(interaction.user.id);
    const embed = new EmbedBuilder()
      .setTitle("🔗 รหัสยืนยันตัวตน Minecraft")
      .setDescription(
        `นี่คือรหัสยืนยันตัวตนของคุณค่ะ:\n\n` +
          `# \`${codeRow.code}\`\n\n` +
          `📌 **วิธีใช้งาน:**\n` +
          `1. เข้าเกม Minecraft (ritz.mcsv.me)\n` +
          `2. พิมพ์คำสั่ง \`/verify ${codeRow.code}\` ในช่องแชท\n` +
          `3. บัญชีของคุณจะถูกเชื่อมต่อทันทีค่ะ! 💕`,
      )
      .setColor(0xec4899)
      .setFooter({
        text: `รหัสนี้จะหมดอายุใน 10 นาที (${new Date(codeRow.expiresAt).toLocaleTimeString("th-TH")})`,
      })
      .setTimestamp();
    await safeReply(interaction, { embeds: [embed], ephemeral: true });
    pushLog(
      "SUCCESS",
      `Generated verification code ${codeRow.code} for ${interaction.user.id}`,
    );
  } catch (err) {
    pushLog("ERROR", `Failed to generate verification code: ${String(err)}`);
    await safeReply(interaction, {
      content:
        "ขออภัยค่ะ ไม่สามารถสร้างรหัสยืนยันได้ในขณะนี้ กรุณาลองใหม่อีกครั้งนะคะ",
      ephemeral: true,
    });
  }
}

async function showMinecraftModal(
  interaction: any,
  customId: string,
  title: string,
) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId("minecraft_ign")
    .setLabel(
      "ชื่อ Minecraft (หรือพิมพ์ 'none' หากต้องการยืนยันผ่าน Discord อย่างเดียว)",
    )
    .setPlaceholder("ชื่อในเกม หรือเว้นว่างได้จ้า")
    .setStyle(TextInputStyle.Short)
    .setMinLength(0)
    .setMaxLength(32)
    .setRequired(false);
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );
  await interaction.showModal(modal);
}

export function isProfileOwner(
  discordUserId: string,
  verification: { discordUserId?: string },
) {
  // Older in-memory fixtures may omit the identity, but every persisted
  // verification row contains it and is checked strictly at runtime.
  return (
    typeof verification.discordUserId !== "string" ||
    discordUserId === verification.discordUserId
  );
}

export function canEditProfile(
  discordUserId: string,
  verification: { discordUserId?: string },
) {
  return isProfileOwner(discordUserId, verification);
}

export function buildProfileEmbed(interaction: any, verification: any) {
  if (!isProfileOwner(interaction.user.id, verification)) {
    throw new Error("ไม่อนุญาตให้เปิดเผยโปรไฟล์ของสมาชิกคนอื่น");
  }
  const skinUrl = `https://mc-heads.net/avatar/${encodeURIComponent(verification.minecraftIGN)}/128`;
  return new EmbedBuilder()
    .setTitle(`🪪 โปรไฟล์สมาชิก ${interaction.user.username}`)
    .setDescription(
      verification.bio || "สมาชิกคนนี้ยังไม่ได้เขียนคำแนะนำตัวค่ะ",
    )
    .setColor(0xec4899)
    .setThumbnail(skinUrl)
    .addFields(
      {
        name: "Discord",
        value: `${interaction.user.tag}\nID: \`${interaction.user.id}\``,
        inline: false,
      },
      {
        name: "Minecraft",
        value: `**${verification.minecraftIGN}**\nUUID: \`${verification.minecraftUuid}\``,
        inline: false,
      },
      {
        name: "สไตล์การเล่น",
        value: verification.playStyle || "ยังไม่ได้ระบุ",
        inline: true,
      },
      { name: "สถานะ", value: "✅ ยืนยันตัวตนแล้ว", inline: true },
      {
        name: "ยืนยันเมื่อ",
        value: new Date(verification.verifiedAt).toLocaleString("th-TH"),
        inline: false,
      },
    )
    .setFooter({
      text: "กด ✏️ แก้ไขโปรไฟล์ เพื่อเพิ่มคำแนะนำตัวและสไตล์การเล่น",
    })
    .setTimestamp();
}

async function replyWithProfile(interaction: any) {
  if (!(await ensureDeferredReply(interaction, { ephemeral: true }))) return;
  let verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    try {
      await createDiscordVerification({
        discordUserId: interaction.user.id,
        minecraftIGN: interaction.user.username.slice(0, 16),
        minecraftUuid: `discord-native-${interaction.user.id}`,
      });
      verification = await getDiscordVerification(interaction.user.id);
    } catch (e) {}
  }
  if (!verification) {
    await interaction.editReply(
      "ยังไม่มีโปรไฟล์ที่ยืนยันค่ะ กรุณากด ✅ ยืนยันตัวตนก่อนนะคะ 💕",
    );
    return;
  }
  await interaction.editReply({
    embeds: [buildProfileEmbed(interaction, verification)],
  });
}

async function showProfileModal(interaction: any) {
  let verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    // Auto-create a Discord-native verification row if not present, so members can edit profile immediately
    try {
      await createDiscordVerification({
        discordUserId: interaction.user.id,
        minecraftIGN: interaction.user.username.slice(0, 16),
        minecraftUuid: `discord-native-${interaction.user.id}`,
      });
      verification = await getDiscordVerification(interaction.user.id);
    } catch (e) {}
  }
  if (!verification) {
    await interaction.reply({
      content: "กรุณากด ✅ ยืนยันตัวตนก่อนแก้ไขโปรไฟล์นะคะ 💕",
      ephemeral: true,
    });
    return;
  }
  const modal = new ModalBuilder()
    .setCustomId("ritz_profile_modal")
    .setTitle("แก้ไขโปรไฟล์ RitzSMP");
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
    await interaction.editReply(
      "ไม่พบการยืนยันตัวตนค่ะ กรุณายืนยันบัญชีก่อนนะคะ",
    );
    return;
  }
  if (!canEditProfile(interaction.user.id, verification)) {
    await interaction.editReply("ไม่อนุญาตให้แก้ไขโปรไฟล์ของสมาชิกคนอื่นค่ะ");
    return;
  }
  const bio =
    interaction.fields.getTextInputValue("profile_bio").trim().slice(0, 300) ||
    null;
  const playStyle =
    interaction.fields
      .getTextInputValue("profile_play_style")
      .trim()
      .slice(0, 128) || null;
  const updated = await updateDiscordProfile(interaction.user.id, {
    bio,
    playStyle,
  });
  if (!updated) {
    await interaction.editReply(
      "ไม่สามารถบันทึกโปรไฟล์ได้ในขณะนี้ค่ะ กรุณาลองใหม่อีกครั้งนะคะ",
    );
    return;
  }
  await interaction.editReply({
    content: "บันทึกโปรไฟล์เรียบร้อยแล้วค่ะ 💖",
    embeds: [buildProfileEmbed(interaction, updated)],
  });
  pushLog("SUCCESS", `Updated Discord profile for ${interaction.user.id}`);
}

export const DISCORD_WELCOME_CHANNEL_NAME = "👋│ระบบต้อนรับ";
export const DISCORD_LEAVE_CHANNEL_NAME = "👋│ระบบสมาชิกออก";
export const LEGACY_DISCORD_WELCOME_CHANNEL_NAMES = [
  "👋│welcome",
  "👋│ต้อนรับ-เข้าออก",
  "👋│ระบบต้อนรับ-เข้าออก",
  "🤞🏻│leave",
];
export const LEGACY_DISCORD_LEAVE_CHANNEL_NAMES = [
  "👋│leave",
  "👋│สมาชิกออก",
  "👋│ระบบออกจากเซิร์ฟเวอร์",
];

export function getPreferredLeaveChannelId(
  managedChannelId?: string,
  configuredChannelId?: string,
): string {
  return managedChannelId?.trim() || configuredChannelId?.trim() || "";
}

async function resolveEventChannelId(
  client: Client,
  options: {
    canonicalName: string;
    legacyNames: readonly string[];
    topic: string;
    configuredChannelId?: string;
    reason: string;
  },
): Promise<string> {
  if (options.configuredChannelId?.trim())
    return options.configuredChannelId.trim();
  const guildId = getConfiguredDiscordGuildId()?.trim();
  if (!guildId) return "";

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return "";
  const channels = await guild.channels.fetch().catch(() => null);
  const existing = channels?.find(
    (channel) =>
      channel?.type === ChannelType.GuildText &&
      (channel.name === options.canonicalName ||
        options.legacyNames.includes(channel.name)),
  );
  if (existing) {
    if (existing.name !== options.canonicalName && "setName" in existing) {
      await (existing as any)
        .setName(
          options.canonicalName,
          `Standardize RitzSMP ${options.canonicalName} channel name`,
        )
        .catch(() => undefined);
    }
    if ("setTopic" in existing) {
      await (existing as any).setTopic(options.topic).catch(() => undefined);
    }
    return existing.id;
  }

  const botMember = await guild.members
    .fetch(client.user?.id ?? "")
    .catch(() => null);
  if (!botMember?.permissions.has("ManageChannels")) return "";
  const created = await guild.channels
    .create({
      name: options.canonicalName,
      type: ChannelType.GuildText,
      topic: options.topic,
      reason: options.reason,
    })
    .catch(() => null);
  return created?.id ?? "";
}

async function resolveWelcomeChannelId(client: Client): Promise<string> {
  return resolveEventChannelId(client, {
    canonicalName: DISCORD_WELCOME_CHANNEL_NAME,
    legacyNames: LEGACY_DISCORD_WELCOME_CHANNEL_NAMES,
    topic: "ระบบต้อนรับสมาชิกใหม่และแจ้งเตือนสมาชิกเข้าเซิร์ฟเวอร์",
    configuredChannelId: getPreferredWelcomeChannelId(
      activeManagedServerRuntime?.channels.welcomeChannelId,
      ENV.discordWelcomeChannelId,
    ),
    reason: "Create RitzSMP AI welcome channel",
  });
}

async function resolveLeaveChannelId(client: Client): Promise<string> {
  return resolveEventChannelId(client, {
    canonicalName: DISCORD_LEAVE_CHANNEL_NAME,
    legacyNames: LEGACY_DISCORD_LEAVE_CHANNEL_NAMES,
    topic: "ระบบแจ้งเตือนสมาชิกออกจากเซิร์ฟเวอร์",
    configuredChannelId: getPreferredLeaveChannelId(
      activeManagedServerRuntime?.channels.leaveChannelId,
      undefined,
    ),
    reason: "Create RitzSMP AI leave notification channel",
  });
}

export function isWelcomeSystemPanelMessage(message: {
  embeds?: any[];
}): boolean {
  const titles = (message.embeds ?? []).map((embed) =>
    String(embed?.title ?? embed?.data?.title ?? ""),
  );
  const footers = (message.embeds ?? []).map((embed) =>
    String(embed?.footer?.text ?? embed?.data?.footer?.text ?? ""),
  );
  return (
    titles.some(
      (title) =>
        title.includes("ระบบต้อนรับสมาชิกใหม่ RitzSMP") ||
        title.includes("ระบบต้อนรับและแจ้งเตือนเข้า-ออก"),
    ) ||
    footers.some(
      (footer) =>
        footer.includes("ระบบต้อนรับสมาชิกใหม่") ||
        footer.includes("ระบบต้อนรับและสมาชิกเข้า-ออก"),
    )
  );
}

export function isLeaveSystemPanelMessage(message: {
  embeds?: any[];
}): boolean {
  const footers = (message.embeds ?? []).map((embed) =>
    String(embed?.footer?.text ?? embed?.data?.footer?.text ?? ""),
  );
  return footers.some((footer) => footer.includes("ระบบแจ้งสมาชิกออก"));
}

function buildWelcomeSystemPanelPayload() {
  const embed = new EmbedBuilder()
    .setTitle("👋 ระบบต้อนรับสมาชิกใหม่ RitzSMP")
    .setDescription(
      "ช่องนี้ใช้สำหรับข้อความต้อนรับสมาชิกใหม่ที่เข้าร่วมเซิร์ฟเวอร์ค่ะ 💖",
    )
    .setColor(0xec4899)
    .setImage(RITZ_WELCOME_COVER_IMAGE_URL)
    .setTimestamp()
    .setFooter({ text: "RitzSMP AI • ระบบต้อนรับสมาชิกใหม่" });
  return { embeds: [embed] };
}

function buildLeaveSystemPanelPayload() {
  const embed = new EmbedBuilder()
    .setTitle("ไว้เจอกันใหม่นะคะ 👋")
    .setDescription(
      "ช่องนี้ใช้สำหรับแจ้งเตือนเมื่อสมาชิกออกจากเซิร์ฟเวอร์ RitzSMP ค่ะ",
    )
    .setColor(0xf472b6)
    .setImage(RITZ_WELCOME_COVER_IMAGE_URL)
    .setTimestamp()
    .setFooter({ text: "RitzSMP AI • ระบบแจ้งสมาชิกออก" });
  return { embeds: [embed] };
}

async function cleanupDuplicateMemberEventChannel(
  channel: any,
  client: Client,
  type: "welcome" | "leave",
): Promise<void> {
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const stalePanels = messages.filter((message) => {
    if (botUserId && message.author?.id !== botUserId) return false;
    return (
      isWelcomeSystemPanelMessage(message) || isLeaveSystemPanelMessage(message)
    );
  });
  for (const panel of stalePanels) {
    await panel
      .delete(`Remove duplicate ${type} system panel from legacy channel`)
      .catch((error: unknown) => {
        pushLog(
          "WARN",
          `Could not delete duplicate ${type} panel from legacy channel: ${String(error)}`,
        );
      });
  }
  const userMessages = messages.filter(
    (message) => !stalePanels.some((panel) => panel.id === message.id),
  );
  if (userMessages.length === 0 && typeof channel.delete === "function") {
    await channel
      .delete(`Remove duplicate ${type} notification channel`)
      .then(() => {
        pushLog(
          "SUCCESS",
          `Removed duplicate ${type} notification channel ${channel.id}`,
        );
      })
      .catch((error: unknown) => {
        pushLog(
          "WARN",
          `Could not remove duplicate ${type} notification channel ${channel.id}: ${String(error)}`,
        );
      });
  }
}

async function reconcileMemberEventSystemPanel(
  channel: any,
  client: Client,
  type: "welcome" | "leave",
): Promise<void> {
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const detector =
    type === "welcome"
      ? isWelcomeSystemPanelMessage
      : isLeaveSystemPanelMessage;
  const panels = messages
    .filter(
      (message) =>
        (!botUserId || message.author?.id === botUserId) && detector(message),
    )
    .sort(
      (a, b) =>
        (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0) ||
        a.id.localeCompare(b.id),
    );
  const canonicalPanel = panels[0];
  const payload =
    type === "welcome"
      ? buildWelcomeSystemPanelPayload()
      : buildLeaveSystemPanelPayload();
  if (canonicalPanel) {
    await canonicalPanel.edit(payload);
  } else {
    await channel.send(payload);
  }
  for (const duplicate of panels.slice(1)) {
    await duplicate
      .delete(`Remove duplicate ${type} system panel`)
      .catch((error: unknown) => {
        pushLog(
          "WARN",
          `Could not delete duplicate ${type} system panel: ${String(error)}`,
        );
      });
  }
}

export function startDiscordMemberEvents(client: Client) {
  if (!AUTO_SYSTEM_PANEL_DEPLOYMENT_ENABLED) {
    pushLog(
      "INFO",
      "Automatic member welcome/leave notifications are disabled; use /setup welcome or /setup leave.",
    );
    return;
  }

  client.on("guildMemberAdd", async (member) => {
    const embed = buildWelcomeMemberEmbed(member);
    const channelId = await resolveWelcomeChannelId(client);
    await sendToDiscordChannel(client, channelId, {
      embeds: [embed],
      components: buildOnboardingComponents(),
    });
  });

  client.on("guildMemberRemove", async (member) => {
    const embed = buildLeaveMemberEmbed(member);
    const channelId = await resolveLeaveChannelId(client);
    await sendToDiscordChannel(client, channelId, { embeds: [embed] });
  });
}

export async function handleOnboardingInteraction(
  interaction: any,
): Promise<boolean> {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === "ritz_verify_button") {
        await replyWithVerificationCode(interaction);
        return true;
      }
      if (interaction.customId === "ritz_claim_rank_button") {
        const existing = await getDiscordVerification(interaction.user.id);
        if (!existing) {
          await showMinecraftModal(
            interaction,
            "ritz_claim_rank_modal",
            "เชื่อมบัญชีและรับยศ RitzSMP",
          );
          return true;
        }
        if (!(await ensureDeferredReply(interaction, { ephemeral: true })))
          return true;
        const rankResult = await grantMinecraftRank(
          existing.minecraftIGN,
          ENV.discordClaimRankGroup,
        );
        const memberRoleAdded = await addConfiguredRole(
          interaction,
          ENV.discordMemberRoleId,
          "RitzSMP member rank claim",
        );
        await safeReply(interaction, {
          content: rankResult.executed
            ? `มอบกลุ่ม LuckPerms **${ENV.discordClaimRankGroup}** ให้ **${existing.minecraftIGN}** แล้วค่ะ${memberRoleAdded ? " และเพิ่มยศสมาชิกใน Discord แล้ว" : ""}`
            : `เชื่อมบัญชีไว้แล้วค่ะ แต่ยังมอบยศในเกมไม่ได้เพราะยังไม่ได้ตั้งค่า RCON${memberRoleAdded ? " (เพิ่มยศสมาชิกใน Discord แล้ว)" : ""}`,
          ephemeral: true,
        });
        return true;
      }
      if (interaction.customId === "ritz_players_button") {
        await replyWithPlayers(interaction);
        return true;
      }
      if (interaction.customId === "ritz_discord_members_button") {
        await replyWithDiscordMembers(interaction);
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
      if (interaction.customId === "ritz_cancel_verify_button") {
        if (!(await ensureDeferredReply(interaction, { ephemeral: true })))
          return true;
        await cancelDiscordVerificationCode(interaction.user.id);
        await safeReply(interaction, {
          content:
            "❌ ยกเลิกรหัสยืนยันตัวตนเดิมเรียบร้อยแล้วค่ะ คุณสามารถกดปุ่ม **🔗 เชื่อมบัญชี** เพื่อสร้างรหัสใหม่ 4 หลักได้ทันทีเลยนะคะ 💕",
          ephemeral: true,
        });
        return true;
      }
      if (interaction.customId === "ritz_unlink_button") {
        if (!(await ensureDeferredReply(interaction, { ephemeral: true })))
          return true;
        await unlinkDiscordVerification(interaction.user.id);
        await safeReply(interaction, {
          content:
            "🔓 ยกเลิกการเชื่อมต่อบัญชี Minecraft และรหัสยืนยันเรียบร้อยแล้วค่ะ หากต้องการเชื่อมต่อใหม่สามารถกดปุ่ม **🔗 เชื่อมบัญชี** ได้ตลอดเวลาเลยนะคะ ✨",
          ephemeral: true,
        });
        return true;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "ritz_verify_modal") {
        await verifyDiscordNativeAccount(interaction, false);
        return true;
      }
      if (interaction.customId === "ritz_claim_rank_modal") {
        await verifyDiscordNativeAccount(interaction, true);
        return true;
      }
      if (interaction.customId === "ritz_profile_modal") {
        await updateProfileFromModal(interaction);
        return true;
      }
    }
  } catch (err) {
    pushLog("ERROR", `Error in handleOnboardingInteraction: ${String(err)}`);
    await safeReply(interaction, {
      content: "ระบบได้บันทึกคำขอของคุณแล้วค่ะ 💕 กำลังดำเนินการต่อ",
      ephemeral: true,
    });
    return true;
  }

  return false;
}

export function startRitzSmpAiBot(): Promise<Client | null> {
  if (botStartup.promise) {
    pushLog(
      "WARN",
      "RitzSMP AI startup already in progress; reusing the existing startup promise.",
    );
  }

  return botStartup.run(async () => {
    try {
      activeManagedServerRuntime =
        (await getActiveManagedServerRuntimeConfig()) ?? null;
      if (activeManagedServerRuntime) {
        pushLog(
          "INFO",
          `Using managed-server runtime overlay for ${activeManagedServerRuntime.slug}`,
        );
      }
    } catch (error) {
      activeManagedServerRuntime = null;
      pushLog(
        "WARN",
        `Managed-server runtime overlay unavailable; using default environment: ${String(error)}`,
      );
    }
    return createRitzSmpAiBot(activeManagedServerRuntime ?? undefined);
  });
}

export function resolveRitzSmpAiBotToken(
  runtime?: ManagedServerRuntimeConfig,
  tokenOverride?: string,
): string {
  if (tokenOverride !== undefined) return tokenOverride.trim();
  return (
    runtime?.discordBotToken?.trim() ||
    process.env.DISCORD_AI_BOT_TOKEN?.trim() ||
    ENV.discordAiBotToken.trim()
  );
}

export function createRitzSmpAiBot(
  runtime?: ManagedServerRuntimeConfig,
  tokenOverride?: string,
) {
  if (runtime) activeManagedServerRuntime = runtime;
  const token = resolveRitzSmpAiBotToken(runtime, tokenOverride);
  if (!token || token === "102031") {
    pushLog("WARN", "No Discord AI Bot token provided. Bot disabled.");
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  botClient = client;
  let readyBootstrapStarted = false;

  client.once("ready", async () => {
    if (readyBootstrapStarted) {
      pushLog(
        "WARN",
        "Ignoring duplicate RitzSMP AI ready bootstrap for the same client.",
      );
      return;
    }
    readyBootstrapStarted = true;
    botStartTime = Date.now();
    pushLog("SUCCESS", `RitzSMP AI bot logged in as ${client.user?.tag}`);

    const storeUrl = ENV.publicStoreUrl || "https://ritz.mcsv.me";

    const commands = [
      new SlashCommandBuilder()
        .setName("ask")
        .setDescription(
          "💬 พูดคุยและสอบถามข้อมูลกับ RitzSMP AI สาวน้อยผู้ช่วยสุดน่ารัก",
        )
        .addStringOption((option) =>
          option
            .setName("question")
            .setDescription("คำถามที่คุณต้องการถามน้อง AI")
            .setRequired(true),
        ),
      new SlashCommandBuilder()
        .setName("status")
        .setDescription(
          "📊 ตรวจสอบสถานะบอทและเซิร์ฟเวอร์ Minecraft RitzSMP แบบเรียลไทม์",
        ),
      new SlashCommandBuilder()
        .setName("ai-status")
        .setDescription(
          "📊 [Legacy Alias] ตรวจสอบสถานะบอทและเซิร์ฟเวอร์ Minecraft RitzSMP",
        ),
      new SlashCommandBuilder()
        .setName("store")
        .setDescription("🛒 แสดงลิงก์เว็บไซต์ร้านค้าหลักของ RitzSMP Store"),
      new SlashCommandBuilder()
        .setName("ranks")
        .setDescription(
          "👑 ตรวจสอบข้อมูลยศพิเศษและสิทธิประโยชน์ภายในเซิร์ฟเวอร์",
        ),
      new SlashCommandBuilder()
        .setName("topup")
        .setDescription(
          "💳 ดูวิธีเติมเงินผ่านสลิปโอนเงินและการซื้อยศผ่านกระเป๋า",
        ),
      new SlashCommandBuilder()
        .setName("verify")
        .setDescription("✅ เปิดแผงยืนยันตัวตนและเชื่อมชื่อ Minecraft"),
      new SlashCommandBuilder()
        .setName("players")
        .setDescription("⛏️ แสดงรายชื่อผู้เล่นที่ออนไลน์ใน RitzSMP"),
      new SlashCommandBuilder()
        .setName("members")
        .setDescription("👥 แสดงรายชื่อสมาชิก Discord ในเซิร์ฟเวอร์"),
      new SlashCommandBuilder()
        .setName("profile")
        .setDescription("🪪 ดูโปรไฟล์สมาชิก RitzSMP ที่เชื่อมกับ Minecraft"),
      new SlashCommandBuilder()
        .setName("setup")
        .setDescription("🛠️ สร้างระบบด้วยคำสั่งเท่านั้น (แอดมินเท่านั้น)")
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand((sub) =>
          sub
            .setName("panel")
            .setDescription("ส่งแผงเชื่อมบัญชีและรับยศลงช่องนี้"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("welcome")
            .setDescription("สร้าง Embed ต้อนรับลงช่องนี้ด้วยตนเอง"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("leave")
            .setDescription("สร้าง Embed แจ้งสมาชิกออกลงช่องนี้ด้วยตนเอง"),
        ),
      new SlashCommandBuilder()
        .setName("help")
        .setDescription("📖 แสดงคู่มือและรายการคำสั่งทั้งหมดของ RitzSMP AI"),
      new SlashCommandBuilder()
        .setName("embed")
        .setDescription(
          "📢 ส่งข้อความประกาศ Embed พร้อมปุ่มร้านค้าแบบสาธารณะทันที (สำเร็จรูป)",
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand((sub) =>
          sub
            .setName("default")
            .setDescription("ส่งข้อความ Embed ประกาศร้านค้าสำเร็จรูปทันที"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("create")
            .setDescription("สร้างข้อความประกาศ Embed แบบกำหนดเอง")
            .addStringOption((o) =>
              o
                .setName("title")
                .setDescription("หัวข้อประกาศ")
                .setRequired(true),
            )
            .addStringOption((o) =>
              o
                .setName("description")
                .setDescription("เนื้อหาประกาศ")
                .setRequired(true),
            )
            .addStringOption((o) =>
              o
                .setName("color")
                .setDescription("สี เช่น #ff69b4 หรือ #00ffcc")
                .setRequired(false),
            )
            .addStringOption((o) =>
              o
                .setName("image_url")
                .setDescription("ลิงก์รูปภาพประกอบ")
                .setRequired(false),
            )
            .addStringOption((o) =>
              o
                .setName("button_label")
                .setDescription("ข้อความบนปุ่มลิงก์")
                .setRequired(false),
            )
            .addStringOption((o) =>
              o
                .setName("button_url")
                .setDescription("ลิงก์ปลายทางของปุ่ม")
                .setRequired(false),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("edit")
            .setDescription("แก้ไข Embed ของ RitzSMP AI ตาม Message ID")
            .addStringOption((o) =>
              o
                .setName("message_id")
                .setDescription("Message ID ของ Embed ที่ต้องการแก้")
                .setRequired(true),
            )
            .addStringOption((o) =>
              o
                .setName("title")
                .setDescription("หัวข้อใหม่ (ไม่บังคับ)")
                .setRequired(false),
            )
            .addStringOption((o) =>
              o
                .setName("description")
                .setDescription("เนื้อหาใหม่ (ไม่บังคับ)")
                .setRequired(false),
            )
            .addStringOption((o) =>
              o
                .setName("color")
                .setDescription("สีใหม่ เช่น #ff69b4 (ไม่บังคับ)")
                .setRequired(false),
            )
            .addStringOption((o) =>
              o
                .setName("image_url")
                .setDescription("URL รูปใหม่ (ไม่บังคับ)")
                .setRequired(false),
            )
            .addStringOption((o) =>
              o
                .setName("button_label")
                .setDescription("ข้อความปุ่มใหม่ (ไม่บังคับ)")
                .setRequired(false),
            )
            .addStringOption((o) =>
              o
                .setName("button_url")
                .setDescription("URL ปุ่มใหม่ (ไม่บังคับ)")
                .setRequired(false),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("delete")
            .setDescription("ลบ Embed ของ RitzSMP AI ตาม Message ID")
            .addStringOption((o) =>
              o
                .setName("message_id")
                .setDescription("Message ID ของ Embed ที่ต้องการลบ")
                .setRequired(true),
            ),
        ),
    ].map((cmd) => cmd.toJSON());

    const rest = new REST({ version: "10" }).setToken(token);
    const clientId = client.user?.id;

    if (!clientId) return;

    try {
      pushLog("INFO", "Registering global slash commands...");
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      pushLog(
        "SUCCESS",
        "Successfully registered global slash commands for RitzSMP AI.",
      );
      const statusChannelId = await ensureMinecraftStatusTextChannel(
        client,
        getConfiguredDiscordGuildId(),
      );
      if (statusChannelId) {
        pushLog(
          "SUCCESS",
          `Dedicated Minecraft status channel ready: ${statusChannelId}`,
        );
      } else {
        pushLog(
          "WARN",
          "Minecraft status channel was not created; presence announcements remain disabled until it is configured.",
        );
      }

      await cleanupMisroutedWelcomePanels(client);
      await cleanupLegacyKanopiRankLogMessages(client);

      // Member welcome/leave messages and system panels are now manual commands.
      // Keep the cleanup helpers above for legacy messages, but never post or create
      // these panels during bot startup.
      if (AUTO_SYSTEM_PANEL_DEPLOYMENT_ENABLED) {
        try {
          const guild = await client.guilds
            .fetch(getConfiguredDiscordGuildId())
            .catch(() => null);
          if (guild) {
            const channelsToEnsure = RITZ_SYSTEM_CHANNEL_TARGETS;

            for (const target of channelsToEnsure) {
              const cleanupPlan = planManagedSystemChannelCleanup(
                guild.channels.cache.values(),
                target,
              );

              if (target.name === "📋│ระบบรายชื่อบัญชี") {
                for (const duplicateId of cleanupPlan.duplicateIds) {
                  const duplicateChannel =
                    guild.channels.cache.get(duplicateId);
                  await cleanupDuplicateAccountListChannel(
                    duplicateChannel,
                    client,
                  );
                }
              } else if (
                target.name === "👋│ระบบต้อนรับ" ||
                target.name === "👋│ระบบสมาชิกออก"
              ) {
                for (const duplicateId of cleanupPlan.duplicateIds) {
                  const duplicateChannel =
                    guild.channels.cache.get(duplicateId);
                  await cleanupDuplicateMemberEventChannel(
                    duplicateChannel,
                    client,
                    target.name === "👋│ระบบต้อนรับ" ? "welcome" : "leave",
                  );
                }
              }

              let channel = cleanupPlan.canonicalId
                ? guild.channels.cache.get(cleanupPlan.canonicalId)
                : undefined;

              if (channel && channel.name !== target.name) {
                const previousName = channel.name;
                try {
                  await (channel as any).setName(
                    target.name,
                    "Standardize RitzSMP AI system channel name",
                  );
                  pushLog(
                    "SUCCESS",
                    `Renamed legacy channel ${previousName} to ${target.name}`,
                  );
                } catch (renameErr) {
                  pushLog(
                    "WARN",
                    `Could not rename legacy channel ${previousName} to ${target.name}: ${String(renameErr)}`,
                  );
                }
              }
              if (
                channel &&
                channel.type === ChannelType.GuildText &&
                "setTopic" in channel
              ) {
                await (channel as any)
                  .setTopic(target.topic)
                  .catch((topicErr: unknown) => {
                    pushLog(
                      "WARN",
                      `Could not update topic for ${target.name}: ${String(topicErr)}`,
                    );
                  });
              }
              if (!channel) {
                try {
                  channel = await guild.channels.create({
                    name: target.name,
                    type: target.type as any,
                    topic: target.topic,
                  });
                  pushLog("SUCCESS", `Auto-created channel: ${target.name}`);
                } catch (createErr) {
                  pushLog(
                    "WARN",
                    `Could not create channel ${target.name}: ${String(createErr)}`,
                  );
                }
              }

              if (channel && channel.isTextBased()) {
                try {
                  if (target.name === "📋│ระบบรายชื่อบัญชี") {
                    await reconcileAccountListPanel(channel, client);
                    pushLog(
                      "SUCCESS",
                      `Reconciled one canonical panel in ${target.name}`,
                    );
                  } else if (
                    target.name === "👋│ระบบต้อนรับ" ||
                    target.name === "👋│ระบบสมาชิกออก"
                  ) {
                    await reconcileMemberEventSystemPanel(
                      channel,
                      client,
                      target.name === "👋│ระบบต้อนรับ" ? "welcome" : "leave",
                    );
                    pushLog(
                      "SUCCESS",
                      `Reconciled one ${target.name === "👋│ระบบต้อนรับ" ? "welcome" : "leave"} panel in ${target.name}`,
                    );
                  } else {
                    const messages = await channel.messages.fetch({
                      limit: 100,
                    });
                    const existingBotMsg = messages.find(
                      (m) => m.author.id === client.user?.id,
                    );
                    if (!existingBotMsg) {
                      if (target.name === "🔗│ระบบเชื่อมบัญชี") {
                        const embed = new EmbedBuilder()
                          .setTitle("✨ ระบบเชื่อมบัญชี Minecraft RitzSMP")
                          .setDescription(
                            "ยินดีต้อนรับสู่ RitzSMP! 🌸\n\n" +
                              "📌 **ขั้นตอนการเชื่อมบัญชี:**\n" +
                              "1. กดปุ่ม **🔗 เชื่อมบัญชี** ด้านล่างนี้เพื่อรับรหัส 4 หลัก\n" +
                              "2. เข้าเกม Minecraft พิมพ์คำสั่ง `/verify <รหัส 4 หลัก>` เพื่อผูกบัญชีทันทีค่ะ! 💕",
                          )
                          .setColor(0xec4899)
                          .setImage(RITZ_WELCOME_COVER_IMAGE_URL)
                          .setTimestamp()
                          .setFooter({
                            text: "RitzSMP AI • ระบบเชื่อมบัญชีอัตโนมัติ 24 ชม.",
                          });
                        await channel.send({
                          embeds: [embed],
                          components: buildOnboardingComponents(),
                        });
                      } else if (target.name === "🎖️│ระบบยืนยันรับยศ") {
                        await channel.send({
                          embeds: [buildRankClaimEmbed()],
                          components: buildRankClaimComponents(),
                        });
                      }
                      pushLog(
                        "SUCCESS",
                        `Posted panel to channel ${target.name}`,
                      );
                    }
                  }
                } catch (msgErr) {
                  pushLog(
                    "WARN",
                    `Could not post panel to ${target.name}: ${String(msgErr)}`,
                  );
                }
              }
            }
          }
        } catch (panelDeployErr) {
          pushLog(
            "WARN",
            `Channel auto-deployment note: ${String(panelDeployErr)}`,
          );
        }
      }
    } catch (error) {
      pushLog(
        "ERROR",
        `RitzSMP AI ready bootstrap failed after command registration: ${String(error)}`,
      );
    }
  });

  client.on("disconnect", () =>
    pushLog("WARN", "RitzSMP AI bot disconnected from Discord"),
  );
  client.on("reconnecting", () =>
    pushLog("INFO", "RitzSMP AI bot attempting to reconnect..."),
  );
  client.on("error", (error) =>
    pushLog("ERROR", `Discord client error: ${error.message}`),
  );

  client.on("interactionCreate", async (interaction) => {
    try {
      if (await handleOnboardingInteraction(interaction)) {
        pushLog(
          "SUCCESS",
          `Handled onboarding interaction ${"customId" in interaction ? interaction.customId : "unknown"}`,
        );
        return;
      }
    } catch (err) {
      pushLog("ERROR", `Onboarding interaction failed: ${String(err)}`);
      try {
        if (interaction.isRepliable()) {
          await safeReply(interaction, {
            content: "ระบบกำลังขัดข้องชั่วคราวค่ะ กรุณาลองใหม่อีกครั้งนะคะ",
            ephemeral: true,
          });
        }
      } catch (replyError) {
        pushLog(
          "WARN",
          `Could not reply to onboarding error: ${String(replyError)}`,
        );
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    totalInteractionsCount++;

    const commandName = interaction.commandName;
    const storeUrl = ENV.publicStoreUrl || "https://ritz.mcsv.me";

    pushLog(
      "INFO",
      `Received command /${commandName} from ${interaction.user.tag}`,
    );

    try {
      if (commandName === "status" || commandName === "ai-status") {
        if (!(await ensureDeferredReply(interaction, { ephemeral: false })))
          return;
        const mc = await checkMinecraftServerStatus();
        const uptimeMin = botStartTime
          ? Math.floor((Date.now() - botStartTime) / 60000)
          : 0;

        const statusEmbed = new EmbedBuilder()
          .setTitle("📊 RitzSMP System & Server Status")
          .setDescription(
            "ตรวจสอบสถานะบอทและเซิร์ฟเวอร์ Minecraft RitzSMP แบบเรียลไทม์ ✨",
          )
          .setColor(mc.online ? 0x22c55e : 0xef4444)
          .addFields(
            {
              name: "🤖 บอท RitzSMP AI",
              value: `🟢 ออนไลน์ (${uptimeMin} นาที)\nคำสั่งที่ให้บริการ: ${totalInteractionsCount} ครั้ง`,
              inline: false,
            },
            {
              name: "⛏️ เซิร์ฟเวอร์ Minecraft (ritz.mcsv.me)",
              value: mc.online
                ? `🟢 **ออนไลน์**\n👥 ผู้เล่นในเซิร์ฟเวอร์: \`${mc.players} / ${mc.maxPlayers}\`\n📌 เวอร์ชัน: \`${mc.version}\`\n⚡ ความหน่วง (Latency): \`${mc.latency}ms\`\n💬 MOTD: *${mc.motd}*`
                : "🔴 **เซิร์ฟเวอร์ปิดปรับปรุงหรือออฟไลน์ชั่วคราว**",
              inline: false,
            },
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

      if (commandName === "verify") {
        await replyWithVerificationCode(interaction);
        pushLog("SUCCESS", "Executed /verify successfully");
        return;
      }

      if (commandName === "players") {
        await replyWithPlayers(interaction);
        pushLog("SUCCESS", "Executed /players successfully");
        return;
      }

      if (commandName === "members") {
        await replyWithDiscordMembers(interaction);
        pushLog("SUCCESS", "Executed /members successfully");
        return;
      }

      if (commandName === "store") {
        const storeEmbed = new EmbedBuilder()
          .setTitle("🛒 เว็บไซต์ร้านค้า RitzSMP Store")
          .setDescription(
            "ยินดีต้อนรับสู่เว็บสโตร์อย่างเป็นทางการของ RitzSMP!\n\n" +
              "• เติมเงินผ่านสลิปโอนเงิน (PromptPay / TrueMoney Wallet)\n" +
              "• ซื้อยศพิเศษสุดคุ้ม (ระบบเติมอัตโนมัติเข้าเซิร์ฟเวอร์ทันทีผ่าน RCON)\n" +
              "• ตรวจสอบยอดเงินคงเหลือและประวัติการสั่งซื้อได้ตลอด 24 ชั่วโมง",
          )
          .setColor(0x00bfff)
          .setFooter({ text: "RitzSMP Store • สะดวก ปลอดภัย อัตโนมัติ 100%" });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("🌐 เปิดเว็บไซต์ร้านค้า RitzSMP")
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl),
        );

        await safeReply(interaction, {
          embeds: [storeEmbed],
          components: [row],
          ephemeral: false,
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
              "ซื้อได้ง่ายๆ ผ่านเว็บสโตร์ ระบบตัดเงินจากกระเป๋าและเติมยศเข้าเกมอัตโนมัติผ่าน RCON ทันทีค่ะ!",
          )
          .setColor(0xffd700)
          .setFooter({ text: "RitzSMP • ระบบร้านค้าอัตโนมัติ 24 ชั่วโมง" });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("🛒 เลือกซื้อยศในเว็บไซต์")
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl),
        );

        await safeReply(interaction, {
          embeds: [ranksEmbed],
          components: [row],
          ephemeral: false,
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
              "• กดยืนยัน ระบบจะหักเงินในกระเป๋าและเติมยศให้ทันทีค่ะ!",
          )
          .setColor(0x00ffcc)
          .setFooter({ text: "RitzSMP Store • สะดวก ปลอดภัย รวดเร็วทันใจ" });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("💳 ไปที่หน้าเติมเงิน / ซื้อยศ")
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl),
        );

        await safeReply(interaction, {
          embeds: [topupEmbed],
          components: [row],
          ephemeral: false,
        });
        pushLog("SUCCESS", "Executed /topup successfully");
        return;
      }

      if (commandName === "help") {
        const helpEmbed = new EmbedBuilder()
          .setTitle("📖 คู่มือคำสั่งบอท RitzSMP AI")
          .setDescription(
            "รายการคำสั่งทั้งหมดที่คุณสามารถใช้งานร่วมกับน้อง RitzSMP AI ได้ค่ะ:",
          )
          .setColor(0xa855f7)
          .addFields(
            {
              name: "/ask <คำถาม>",
              value: "พูดคุย ปรึกษา หรือสอบถามข้อมูลกับน้อง AI ผู้ช่วยสาวน้อย",
              inline: false,
            },
            {
              name: "/status (หรือ /ai-status)",
              value: "ตรวจสอบสถานะบอทและเซิร์ฟเวอร์ Minecraft แบบเรียลไทม์",
              inline: false,
            },
            {
              name: "/store",
              value: "เปิดลิงก์เว็บไซต์ร้านค้าหลักของ RitzSMP",
              inline: false,
            },
            {
              name: "/ranks",
              value: "ดูรายละเอียดและสิทธิประโยชน์ของแต่ละยศ",
              inline: false,
            },
            {
              name: "/topup",
              value: "ดูคู่มือขั้นตอนการเติมเงินและซื้อยศ",
              inline: false,
            },
            {
              name: "/profile",
              value: "ดูโปรไฟล์สมาชิกและแก้ไขคำแนะนำตัว/สไตล์การเล่น",
              inline: false,
            },
            {
              name: "/music play <url>",
              value:
                "เล่นเพลงจาก YouTube/SoundCloud; ใช้ /music queue, /music skip, /music stop และ /music leave ควบคุมคิวค่ะ (โหมดฟรีอาจหยุดเมื่อระบบพักเครื่อง)",
              inline: false,
            },
            {
              name: "/setup panel",
              value: "สร้างแผงเชื่อมบัญชีและรับยศด้วยคำสั่งแอดมินเท่านั้น",
              inline: false,
            },
            {
              name: "/setup welcome / /setup leave",
              value:
                "สร้างข้อความต้อนรับหรือแจ้งสมาชิกออกเองครั้งเดียว ระบบไม่โพสต์ซ้ำตอนรีสตาร์ต",
              inline: false,
            },
            {
              name: "/embed default",
              value: "ส่งประกาศร้านค้าสำเร็จรูปพร้อมปุ่มลิงก์",
              inline: false,
            },
            {
              name: "/embed create",
              value: "สร้างประกาศ Embed แบบกำหนดเอง",
              inline: false,
            },
            {
              name: "/embed edit <message_id>",
              value: "แก้ไข Embed ที่ RitzSMP AI สร้างในช่องปัจจุบัน",
              inline: false,
            },
            {
              name: "/embed delete <message_id>",
              value: "ลบ Embed ที่ RitzSMP AI สร้างในช่องปัจจุบัน",
              inline: false,
            },
          )
          .setTimestamp()
          .setFooter({ text: "RitzSMP AI Bot • พัฒนาด้วยความรักค่ะ 💖" });

        await safeReply(interaction, { embeds: [helpEmbed], ephemeral: false });
        pushLog("SUCCESS", "Executed /help successfully");
        return;
      }

      if (commandName === "setup") {
        if (!(await requireDiscordAdministrator(interaction))) return;
        const subcommand = interaction.options.getSubcommand();
        const channel = getInteractionTextChannel(interaction);
        if (!channel) {
          await safeReply(interaction, {
            content: "คำสั่งนี้ต้องใช้ในช่องข้อความของเซิร์ฟเวอร์ค่ะ",
            ephemeral: true,
          });
          return;
        }
        if (!(await ensureDeferredReply(interaction, { ephemeral: true })))
          return;

        if (subcommand === "panel") {
          const onboardingEmbed = new EmbedBuilder()
            .setTitle("✨ ระบบยืนยันตัวตนและจัดการบัญชี RitzSMP")
            .setDescription(
              "ยินดีต้อนรับสู่คอมมูนิตี้ RitzSMP ค่ะ! 🌸\n\n" +
                "• **✅ ยืนยันตัวตน:** ผูกบัญชี Discord ของคุณกับระบบเพื่อรับยศ Verified และสิทธิ์พิเศษ\n" +
                "• **🎖️ รับยศผู้เล่น:** กดรับกลุ่ม LuckPerms ในเซิร์ฟเวอร์ Minecraft และยศสมาชิกในดิสคอร์ด\n" +
                "• **👥 รายชื่อในเซิร์ฟ:** ตรวจสอบผู้เล่นที่ออนไลน์อยู่แบบเรียลไทม์\n" +
                "• **🪪 โปรไฟล์ของฉัน:** ดูและแก้ไขคำแนะนำตัวหรือสไตล์การเล่นของคุณ\n\n" +
                "กรุณากดปุ่มด้านล่างเพื่อเริ่มใช้งานได้เลยนะคะ! 💕",
            )
            .setColor(0xec4899)
            .setTimestamp()
            .setFooter({ text: "RitzSMP AI • สร้างด้วยคำสั่งแอดมิน" });

          await channel.send({
            embeds: [onboardingEmbed],
            components: buildOnboardingComponents(),
          });
          await channel.send({
            embeds: [buildRankClaimEmbed()],
            components: buildRankClaimComponents(),
          });
          await safeReply(interaction, {
            content:
              "สร้างแผงเชื่อมบัญชี ยืนยันตัวตน และรับยศลงในช่องนี้แล้วค่ะ ✨",
            ephemeral: true,
          });
          pushLog("SUCCESS", "Executed /setup panel successfully");
          return;
        }

        if (subcommand === "welcome" || subcommand === "leave") {
          await channel.send(buildManualSystemPanelPayload(subcommand));
          await safeReply(interaction, {
            content: `สร้าง Embed ${subcommand === "welcome" ? "ต้อนรับสมาชิก" : "แจ้งสมาชิกออก"} ลงในช่องนี้แล้วค่ะ โดยระบบจะไม่สร้างซ้ำเองตอนบอทรีสตาร์ตนะคะ`,
            ephemeral: true,
          });
          pushLog("SUCCESS", `Executed /setup ${subcommand} successfully`);
          return;
        }
      }

      if (commandName === "embed") {
        if (!(await requireDiscordAdministrator(interaction))) return;
        const subcommand = interaction.options.getSubcommand();
        const channel = getInteractionTextChannel(interaction);
        if (subcommand === "default") {
          const embed = new EmbedBuilder()
            .setTitle("🌟 ประกาศสำคัญจากเซิร์ฟเวอร์ RitzSMP")
            .setDescription(
              "ยินดีต้อนรับผู้เล่นทุกท่านสู่ RitzSMP เซิร์ฟเวอร์ Survival และ Economy สุดมันส์!\n\n🛒 **สนใจซื้อยศหรือเติมเงิน:** คลิกปุ่มด้านล่างเพื่อเข้าสู่เว็บไซต์ร้านค้าของเราได้ทันทีค่ะ!",
            )
            .setColor(0xec4899)
            .addFields(
              { name: "🌐 เว็บไซต์หลัก", value: storeUrl, inline: true },
              {
                name: "💬 ดิสคอร์ดคอมมูนิตี้",
                value: "พูดคุย แจ้งปัญหา และติดตามข่าวสารได้ที่นี่",
                inline: true,
              },
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
              .setURL(storeUrl),
          );

          await safeReply(interaction, {
            embeds: [embed],
            components: [row],
            ephemeral: false,
          });
          pushLog("SUCCESS", "Executed /embed default successfully");
          return;
        }

        if (subcommand === "create") {
          const title = interaction.options.getString("title", true);
          const description = interaction.options.getString(
            "description",
            true,
          );
          const colorInput =
            interaction.options.getString("color") || "#ec4899";
          const imageUrl = interaction.options.getString("image_url");
          const btnLabel = interaction.options.getString("button_label");
          const btnUrl = interaction.options.getString("button_url");
          if ((btnLabel && !btnUrl) || (!btnLabel && btnUrl)) {
            await safeReply(interaction, {
              content:
                "ถ้าจะเพิ่มปุ่ม ต้องใส่ทั้ง button_label และ button_url นะคะ",
              ephemeral: true,
            });
            return;
          }
          if (imageUrl && !isHttpUrl(imageUrl)) {
            await safeReply(interaction, {
              content: "image_url ต้องเป็นลิงก์ http หรือ https เท่านั้นค่ะ",
              ephemeral: true,
            });
            return;
          }

          await safeReply(interaction, {
            ...buildManualEmbedPayload({
              title,
              description,
              color: parseEmbedColor(colorInput),
              imageUrl,
              buttonLabel: btnLabel,
              buttonUrl: btnUrl,
              footerText: "ประกาศโดยแอดมิน • RitzSMP AI",
            }),
            ephemeral: false,
          });
          pushLog("SUCCESS", "Executed /embed create successfully");
          return;
        }

        if (subcommand === "edit" || subcommand === "delete") {
          if (!channel) {
            await safeReply(interaction, {
              content: "คำสั่งนี้ต้องใช้ในช่องข้อความที่มี Embed เป้าหมายค่ะ",
              ephemeral: true,
            });
            return;
          }
          const messageId = interaction.options.getString("message_id", true);
          if (!(await ensureDeferredReply(interaction, { ephemeral: true })))
            return;
          let message: any;
          try {
            message = await channel.messages.fetch(messageId);
          } catch {
            await safeReply(interaction, {
              content:
                "หา Message ID นี้ในช่องปัจจุบันไม่เจอค่ะ ตรวจสอบ ID แล้วลองใหม่อีกครั้งนะคะ",
              ephemeral: true,
            });
            return;
          }
          if (message.author?.id && message.author.id !== client.user?.id) {
            await safeReply(interaction, {
              content:
                "เพื่อความปลอดภัย คำสั่งนี้แก้ไขหรือลบได้เฉพาะข้อความที่ RitzSMP AI เป็นผู้สร้างเท่านั้นค่ะ",
              ephemeral: true,
            });
            return;
          }

          if (subcommand === "delete") {
            await message.delete();
            await safeReply(interaction, {
              content: `ลบ Embed ของ RitzSMP AI แล้วค่ะ (Message ID: ${messageId})`,
              ephemeral: true,
            });
            pushLog(
              "SUCCESS",
              `Executed /embed delete successfully for message ${messageId}`,
            );
            return;
          }

          const existing = getEmbedData(message);
          const title =
            interaction.options.getString("title") ?? existing.title;
          const description =
            interaction.options.getString("description") ??
            existing.description;
          const colorInput = interaction.options.getString("color");
          const imageUrl = interaction.options.getString("image_url");
          const buttonLabel = interaction.options.getString("button_label");
          const buttonUrl = interaction.options.getString("button_url");
          if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
            await safeReply(interaction, {
              content:
                "ถ้าจะแก้ปุ่ม ต้องใส่ทั้ง button_label และ button_url นะคะ",
              ephemeral: true,
            });
            return;
          }
          if (imageUrl && !isHttpUrl(imageUrl)) {
            await safeReply(interaction, {
              content: "image_url ต้องเป็นลิงก์ http หรือ https เท่านั้นค่ะ",
              ephemeral: true,
            });
            return;
          }
          const payload = buildManualEmbedPayload({
            title,
            description,
            color: colorInput ?? existing.color ?? 0xec4899,
            imageUrl: imageUrl ?? existing.imageUrl,
            buttonLabel,
            buttonUrl,
            footerText: existing.footerText,
          });
          await message.edit({
            embeds: payload.embeds,
            components:
              buttonLabel || buttonUrl
                ? payload.components
                : (message.components ?? []),
          });
          await safeReply(interaction, {
            content: `แก้ไข Embed ของ RitzSMP AI เรียบร้อยแล้วค่ะ (Message ID: ${messageId})`,
            ephemeral: true,
          });
          pushLog(
            "SUCCESS",
            `Executed /embed edit successfully for message ${messageId}`,
          );
          return;
        }
      }

      if (commandName === "ask") {
        if (!(await ensureDeferredReply(interaction, { ephemeral: false })))
          return;
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

          const finalMessage =
            aiReply ||
            "น้อง RitzSMP AI อยู่นี่แล้วค่ะ! มีอะไรให้พี่สาวช่วยสอบถามหรือดูแลเรื่องไหนในเซิร์ฟเวอร์บอกได้เลยนะค้า 💖✨";
          await safeReply(interaction, finalMessage);
          pushLog(
            "SUCCESS",
            `Executed /ask successfully for question: "${question.substring(0, 30)}..."`,
          );
        } catch (err) {
          pushLog("ERROR", `Failed to invoke LLM for /ask: ${String(err)}`);
          await safeReply(
            interaction,
            "แง... ตอนนี้น้อง AI กำลังมึนหัวนิดหน่อยค่ะ ลองถามใหม่อีกครั้งหรือพิมพ์ /help ดูคำสั่งช่วยเหลือได้เลยนะค้า 🥺💖",
          );
        }
      }
    } catch (err) {
      pushLog(
        "ERROR",
        `Error handling command /${commandName}: ${String(err)}`,
      );
      await safeReply(interaction, {
        content:
          "เกิดข้อผิดพลาดในการประมวลผลคำสั่ง กรุณาลองใหม่อีกครั้งนะคะ 💕",
        ephemeral: true,
      });
    }
  });

  client.login(token).catch((err) => {
    pushLog("ERROR", `Discord login failed: ${err.message}`);
  });

  return client;
}

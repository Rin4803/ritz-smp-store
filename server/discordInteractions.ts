import { createPublicKey, verify as verifySignature } from "node:crypto";
import type { RequestHandler } from "express";
import { ENV } from "./_core/env.js";
import {
  cancelDiscordVerificationCode,
  getDiscordVerification,
  unlinkDiscordVerification,
} from "./db.js";
import {
  fetchMinecraftServerStatus,
  getMinecraftDiscordVerificationCode,
  type MinecraftServerStatus,
} from "./minecraftIntegration.js";
import {
  buildDiscordMembersMessage,
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
const EPHEMERAL_MESSAGE_FLAG = 1 << 6;

// Production forwards direct API routes to Express. Keep this separate from
// tRPC so Discord's signed raw body never reaches the JSON-RPC parser.
export const RITZSMP_DISCORD_INTERACTION_ENDPOINT_PATH =
  "/api/discord/interactions";

type DiscordInteractionPayload = {
  type?: number;
  guild_id?: string;
  data?: {
    name?: string;
    custom_id?: string;
  };
  member?: {
    user?: {
      id?: string;
      username?: string;
    };
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

function ephemeralResponse(content: string) {
  return {
    type: DISCORD_RESPONSE_CHANNEL_MESSAGE,
    data: {
      content,
      flags: EPHEMERAL_MESSAGE_FLAG,
    },
  };
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
    switch (identifyRitzSmpInteractionAction(interaction)) {
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
        const status = await fetchMinecraftServerStatus();
        return res.status(200).json(
          ephemeralResponse(buildMinecraftPlayersMessage(status)),
        );
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
    return res.status(200).json(
      ephemeralResponse(
        "ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ",
      ),
    );
  }
};

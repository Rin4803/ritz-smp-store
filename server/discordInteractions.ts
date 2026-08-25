import { createPublicKey, verify as verifySignature } from "node:crypto";
import type { RequestHandler } from "express";
import { ENV } from "./_core/env.js";
import {
  cancelDiscordVerificationCode,
  unlinkDiscordVerification,
} from "./db.js";
import { getMinecraftDiscordVerificationCode } from "./minecraftIntegration.js";

const DISCORD_PUBLIC_KEY_DER_PREFIX = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);

const DISCORD_INTERACTION_PING = 1;
const DISCORD_INTERACTION_APPLICATION_COMMAND = 2;
const DISCORD_INTERACTION_MESSAGE_COMPONENT = 3;
const DISCORD_RESPONSE_PONG = 1;
const DISCORD_RESPONSE_CHANNEL_MESSAGE = 4;
const EPHEMERAL_MESSAGE_FLAG = 1 << 6;

// Production forwards direct API routes to Express. Keep this separate from
// tRPC so Discord's signed raw body never reaches the JSON-RPC parser.
export const RITZSMP_DISCORD_INTERACTION_ENDPOINT_PATH =
  "/api/discord/interactions";

type DiscordInteractionPayload = {
  type?: number;
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
      default:
        return res.status(200).json(
          ephemeralResponse(
            "ปุ่มนี้ยังต้องใช้ AI bot บน runtime ต่อเนื่องค่ะ ส่วนปุ่มเชื่อมบัญชีและยกเลิกรหัสใช้งานได้จากหน้านี้แล้ว",
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

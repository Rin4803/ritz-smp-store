import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";

const PASSWORD_KEY_LENGTH = 64;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type LocalSessionPayload = { userId: number; exp: number; kind: "local" };

function secret() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET is required for local authentication");
  return ENV.cookieSecret;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, stored] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !stored) return false;
  const derived = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const expected = Buffer.from(stored, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(input: string) {
  return createHmac("sha256", secret()).update(input).digest("base64url");
}

export function createLocalSession(userId: number) {
  const payload: LocalSessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    kind: "local",
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyLocalSession(token: string | undefined): LocalSessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(decode(encoded)) as LocalSessionPayload;
    if (payload.kind !== "local" || !Number.isInteger(payload.userId) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getLocalSessionToken(req: Request) {
  const cookies = req.headers.cookie?.split(";").map(part => part.trim()) ?? [];
  const cookie = cookies.find(part => part.startsWith(`${COOKIE_NAME}=`));
  return cookie?.slice(COOKIE_NAME.length + 1);
}

export const LOCAL_SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

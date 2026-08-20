import type { Request, Response } from "express";
import {
  getMinecraftPresenceState,
  saveMinecraftPresenceState,
} from "./db";
import {
  fetchMinecraftServerStatus,
  type MinecraftServerStatus,
} from "./minecraftIntegration";
import { notifyMinecraftPresence } from "./discordNotifications";
import { sdk } from "./_core/sdk";

export type PresenceComparable = {
  online: boolean;
  playerListKnown: boolean;
  playerNames: string[];
};

export type PresenceTransition = {
  initialized: boolean;
  joined: string[];
  left: string[];
};

function normalizeNames(names: string[]): Map<string, string> {
  const normalized = new Map<string, string>();
  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!normalized.has(key)) normalized.set(key, name);
  }
  return normalized;
}

function difference(current: Map<string, string>, previous: Map<string, string>): string[] {
  return Array.from(current.entries())
    .filter(([key]) => !previous.has(key))
    .map(([, name]) => name)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Computes safe transitions from two status snapshots. A status response without
 * a player list is never treated as evidence that everybody left or joined.
 */
export function diffMinecraftPresence(
  previous: PresenceComparable | null,
  current: PresenceComparable,
): PresenceTransition {
  if (!previous) return { initialized: true, joined: [], left: [] };

  const previousNames = normalizeNames(previous.playerNames);
  const currentNames = normalizeNames(current.playerNames);
  const listComparisonAvailable = previous.playerListKnown && current.playerListKnown;

  if (!current.online) {
    return {
      initialized: false,
      joined: [],
      left: previous.online && previous.playerListKnown ? Array.from(previousNames.values()).sort() : [],
    };
  }

  if (!current.playerListKnown) {
    return { initialized: false, joined: [], left: [] };
  }

  if (!previous.online) {
    return {
      initialized: false,
      joined: Array.from(currentNames.values()).sort(),
      left: [],
    };
  }

  if (!listComparisonAvailable) {
    return { initialized: false, joined: [], left: [] };
  }

  return {
    initialized: false,
    joined: difference(currentNames, previousNames),
    left: difference(previousNames, currentNames),
  };
}

function parseStoredNames(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string") : [];
  } catch {
    return [];
  }
}

function comparableStatus(status: MinecraftServerStatus): PresenceComparable {
  return {
    online: status.online,
    playerListKnown: status.playerListKnown,
    playerNames: status.playerNames,
  };
}

export async function runMinecraftPresenceMonitor() {
  const currentStatus = await fetchMinecraftServerStatus();
  const previousState = await getMinecraftPresenceState();
  const previous = previousState
    ? {
        online: Boolean(previousState.lastOnline),
        playerListKnown: Boolean(previousState.playerListKnown),
        playerNames: parseStoredNames(previousState.lastPlayerNames),
      }
    : null;
  const transition = diffMinecraftPresence(previous, comparableStatus(currentStatus));

  if (transition.joined.length) {
    const result = await notifyMinecraftPresence({ kind: "join", playerNames: transition.joined });
    if (!result.sent) throw new Error(`Minecraft join announcement failed: ${result.reason ?? "unknown error"}`);
  }
  if (transition.left.length) {
    const result = await notifyMinecraftPresence({ kind: "leave", playerNames: transition.left });
    if (!result.sent) throw new Error(`Minecraft leave announcement failed: ${result.reason ?? "unknown error"}`);
  }

  await saveMinecraftPresenceState({
    lastOnline: currentStatus.online,
    playerListKnown: currentStatus.playerListKnown,
    lastPlayerNames: currentStatus.playerNames,
    lastCheckedAt: new Date(),
  });

  return {
    initialized: transition.initialized,
    online: currentStatus.online,
    players: currentStatus.players,
    joined: transition.joined,
    left: transition.left,
    checkedAt: new Date().toISOString(),
  };
}

export async function handleMinecraftPresenceScheduled(req: Request, res: Response) {
  const timestamp = new Date().toISOString();
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    taskUid = user.taskUid;
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const state = await getMinecraftPresenceState();
    if (!state || state.scheduleCronTaskUid !== user.taskUid) {
      return res.json({ ok: true, skipped: "orphan" });
    }

    const result = await runMinecraftPresenceMonitor();
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl, taskUid },
      timestamp,
    });
  }
}

export const minecraftPresenceInternals = {
  normalizeNames,
  parseStoredNames,
};

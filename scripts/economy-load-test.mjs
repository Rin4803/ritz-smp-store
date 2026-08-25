#!/usr/bin/env node
import { runEconomyLoadTest, DEFAULTS } from "./economyLoadModel.mjs";

function readNumber(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value)) throw new Error(`${flag} ต้องเป็นตัวเลข`);
  return value;
}

try {
  const result = await runEconomyLoadTest({
    users: readNumber("--users", DEFAULTS.users),
    initialBalance: readNumber("--initial-balance", DEFAULTS.initialBalance),
    topupAmount: readNumber("--topup", DEFAULTS.topupAmount),
    rankPrice: readNumber("--rank-price", DEFAULTS.rankPrice),
    purchaseAttempts: readNumber("--purchase-attempts", DEFAULTS.purchaseAttempts),
    rconLatencyMs: readNumber("--rcon-latency-ms", DEFAULTS.rconLatencyMs),
    rconFailureEvery: readNumber("--rcon-failure-every", DEFAULTS.rconFailureEvery),
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

const DEFAULTS = {
  users: 100,
  initialBalance: 39,
  topupAmount: 100,
  rankPrice: 39,
  purchaseAttempts: 3,
  rconLatencyMs: 2,
  rconFailureEvery: 0,
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.max(0, index)];
}

class WalletLedgerSimulator {
  constructor(initialBalanceCents) {
    this.initialBalanceCents = initialBalanceCents;
    this.balances = new Map();
    this.transactions = [];
    this.references = new Map();
    this.locks = new Map();
    this.duplicateReplays = 0;
  }

  seedUser(userId) {
    this.balances.set(userId, this.initialBalanceCents);
  }

  async withUserLock(userId, operation) {
    const previous = this.locks.get(userId) ?? Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    this.locks.set(userId, previous.then(() => current));
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async apply({ userId, amountCents, type, referenceKey }) {
    return this.withUserLock(userId, async () => {
      const existing = this.references.get(referenceKey);
      if (existing) {
        if (existing.userId !== userId || existing.amountCents !== amountCents || existing.type !== type) {
          throw new Error("referenceKey ถูกใช้กับรายการกระเป๋าเงินคนละรายการ");
        }
        this.duplicateReplays += 1;
        return { userId, newBalanceCents: this.balances.get(userId) ?? 0, alreadyApplied: true };
      }

      const currentBalance = this.balances.get(userId) ?? 0;
      const nextBalance = currentBalance + amountCents;
      if (nextBalance < 0) throw new Error("ยอดเงินในบัญชีไม่พอสำหรับการทำรายการ");

      this.balances.set(userId, nextBalance);
      const transaction = { userId, amountCents, type, referenceKey };
      this.transactions.push(transaction);
      this.references.set(referenceKey, transaction);
      return { userId, newBalanceCents: nextBalance, alreadyApplied: false };
    });
  }

  getBalance(userId) {
    return this.balances.get(userId) ?? 0;
  }
}

class RconLoadStub {
  constructor({ latencyMs, failureEvery }) {
    this.latencyMs = latencyMs;
    this.failureEvery = failureEvery;
    this.attempts = 0;
    this.succeeded = 0;
    this.failed = 0;
    this.active = 0;
    this.maxConcurrent = 0;
  }

  async fulfill() {
    this.attempts += 1;
    this.active += 1;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.active);
    try {
      await sleep(this.latencyMs);
      if (this.failureEvery > 0 && this.attempts % this.failureEvery === 0) {
        this.failed += 1;
        throw new Error("simulated RCON failure");
      }
      this.succeeded += 1;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      this.active -= 1;
    }
  }
}

function operationDelay(userNumber, operationNumber) {
  // Deterministic jitter creates repeatable ordering pressure without random test data.
  return (userNumber * 7 + operationNumber * 11) % 5;
}

async function timedOperation(operation, metrics) {
  const started = performance.now();
  const result = await operation();
  metrics.latencies.push(performance.now() - started);
  return result;
}

export async function runEconomyLoadTest(input = {}) {
  const options = { ...DEFAULTS, ...input };
  for (const [key, value] of Object.entries(options)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid load-test option: ${key}`);
  }
  if (options.users === 0) throw new Error("users must be greater than zero");
  if (options.rankPrice === 0) throw new Error("rankPrice must be greater than zero");
  if (!Number.isInteger(options.users) || !Number.isInteger(options.purchaseAttempts)) {
    throw new Error("users and purchaseAttempts must be integers");
  }

  const toCents = amount => Math.round(amount * 100);
  const initialBalanceCents = toCents(options.initialBalance);
  const topupAmountCents = toCents(options.topupAmount);
  const rankPriceCents = toCents(options.rankPrice);
  const wallet = new WalletLedgerSimulator(initialBalanceCents);
  const rcon = new RconLoadStub({ latencyMs: options.rconLatencyMs, failureEvery: options.rconFailureEvery });
  const metrics = {
    latencies: [],
    topupRequests: 0,
    topupsApplied: 0,
    topupAlreadyApplied: 0,
    purchaseAttempts: 0,
    purchasesSucceeded: 0,
    purchasesRejectedInsufficientFunds: 0,
    rconFailures: 0,
    errors: [],
  };

  const users = Array.from({ length: options.users }, (_, index) => index + 1);
  for (const userId of users) wallet.seedUser(userId);

  const tasks = [];
  for (const userId of users) {
    const userNumber = userId - 1;
    const topupReference = `loadtest:user:${userId}:topup:1`;
    const topup = async () => {
      metrics.topupRequests += 1;
      const result = await wallet.apply({ userId, amountCents: topupAmountCents, type: "topup", referenceKey: topupReference });
      if (result.alreadyApplied) metrics.topupAlreadyApplied += 1;
      else metrics.topupsApplied += 1;
      return result;
    };

    // Two concurrent approval/retry calls must credit exactly once.
    tasks.push((async () => { await sleep(operationDelay(userNumber, 0)); return timedOperation(topup, metrics); })());
    tasks.push((async () => { await sleep(operationDelay(userNumber, 1)); return timedOperation(topup, metrics); })());

    for (let attempt = 1; attempt <= options.purchaseAttempts; attempt += 1) {
      const purchaseReference = `loadtest:user:${userId}:purchase:${attempt}`;
      tasks.push((async () => {
        await sleep(operationDelay(userNumber, attempt + 1));
        metrics.purchaseAttempts += 1;
        try {
          const result = await timedOperation(
            () => wallet.apply({ userId, amountCents: -rankPriceCents, type: "purchase", referenceKey: purchaseReference }),
            metrics,
          );
          metrics.purchasesSucceeded += 1;
          const rconResult = await rcon.fulfill();
          if (!rconResult.ok) metrics.rconFailures += 1;
          return { result, rconResult };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message === "ยอดเงินในบัญชีไม่พอสำหรับการทำรายการ") {
            metrics.purchasesRejectedInsufficientFunds += 1;
            return { rejected: true, reason: message };
          }
          metrics.errors.push(message);
          throw error;
        }
      })());
    }
  }

  const settled = await Promise.allSettled(tasks);
  for (const result of settled) {
    if (result.status === "rejected") metrics.errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }

  const ledgerByUser = new Map();
  for (const transaction of wallet.transactions) {
    const current = ledgerByUser.get(transaction.userId) ?? 0;
    ledgerByUser.set(transaction.userId, current + transaction.amountCents);
  }

  const negativeBalances = users.filter(userId => wallet.getBalance(userId) < 0);
  const ledgerMismatches = users.filter(userId => {
    const expected = initialBalanceCents + (ledgerByUser.get(userId) ?? 0);
    return expected !== wallet.getBalance(userId);
  });
  const uniqueReferenceCount = new Set(wallet.transactions.map(transaction => transaction.referenceKey)).size;
  const invariantViolations = [];
  if (negativeBalances.length > 0) invariantViolations.push(`negative balances: ${negativeBalances.length}`);
  if (ledgerMismatches.length > 0) invariantViolations.push(`ledger mismatches: ${ledgerMismatches.length}`);
  if (uniqueReferenceCount !== wallet.transactions.length) invariantViolations.push("duplicate ledger references");
  if (metrics.topupsApplied !== options.users) invariantViolations.push(`topups applied ${metrics.topupsApplied}/${options.users}`);
  if (metrics.topupAlreadyApplied !== options.users) invariantViolations.push(`idempotent replays ${metrics.topupAlreadyApplied}/${options.users}`);
  if (metrics.purchasesSucceeded + metrics.purchasesRejectedInsufficientFunds !== metrics.purchaseAttempts) {
    invariantViolations.push("purchase accounting mismatch");
  }
  if (rcon.attempts !== metrics.purchasesSucceeded) invariantViolations.push("RCON attempt mismatch");
  if (rcon.failed > 0) invariantViolations.push(`RCON failures: ${rcon.failed}`);
  if (metrics.errors.length > 0) invariantViolations.push(`unexpected errors: ${metrics.errors.length}`);

  const latencies = metrics.latencies;
  return {
    ok: invariantViolations.length === 0,
    config: {
      users: options.users,
      initialBalance: options.initialBalance,
      topupAmount: options.topupAmount,
      rankPrice: options.rankPrice,
      purchaseAttempts: options.purchaseAttempts,
      rconLatencyMs: options.rconLatencyMs,
    },
    metrics: {
      totalOperations: tasks.length,
      topupRequests: metrics.topupRequests,
      topupsApplied: metrics.topupsApplied,
      topupAlreadyApplied: metrics.topupAlreadyApplied,
      purchaseAttempts: metrics.purchaseAttempts,
      purchasesSucceeded: metrics.purchasesSucceeded,
      purchasesRejectedInsufficientFunds: metrics.purchasesRejectedInsufficientFunds,
      rconAttempts: rcon.attempts,
      rconSucceeded: rcon.succeeded,
      rconFailures: metrics.rconFailures,
      rconMaxConcurrent: rcon.maxConcurrent,
      ledgerEntries: wallet.transactions.length,
      uniqueLedgerReferences: uniqueReferenceCount,
      finalBalanceTotal: users.reduce((total, userId) => total + wallet.getBalance(userId), 0) / 100,
      latencyMs: {
        p50: Number(percentile(latencies, 0.50).toFixed(3)),
        p95: Number(percentile(latencies, 0.95).toFixed(3)),
        p99: Number(percentile(latencies, 0.99).toFixed(3)),
        max: Number(Math.max(...latencies, 0).toFixed(3)),
      },
    },
    invariants: {
      negativeBalances: negativeBalances.length,
      ledgerMismatches: ledgerMismatches.length,
      invariantViolations,
    },
  };
}

export { DEFAULTS };

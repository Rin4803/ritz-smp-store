import { describe, expect, it } from "vitest";
import { runEconomyLoadTest } from "../scripts/economyLoadModel.mjs";

describe("Economy concurrency load-test model", () => {
  it("keeps balances and ledger entries consistent under concurrent approvals and purchases", async () => {
    const report = await runEconomyLoadTest({
      users: 64,
      initialBalance: 39,
      topupAmount: 100,
      rankPrice: 39,
      purchaseAttempts: 3,
      rconLatencyMs: 0,
    });

    expect(report.ok).toBe(true);
    expect(report.invariants.negativeBalances).toBe(0);
    expect(report.invariants.ledgerMismatches).toBe(0);
    expect(report.metrics.topupsApplied).toBe(64);
    expect(report.metrics.topupAlreadyApplied).toBe(64);
    expect(report.metrics.uniqueLedgerReferences).toBe(report.metrics.ledgerEntries);
    expect(report.metrics.rconAttempts).toBe(report.metrics.purchasesSucceeded);
  });

  it("reports RCON instability while preserving the wallet accounting result", async () => {
    const report = await runEconomyLoadTest({
      users: 20,
      initialBalance: 39,
      topupAmount: 100,
      rankPrice: 39,
      purchaseAttempts: 2,
      rconLatencyMs: 0,
      rconFailureEvery: 2,
    });

    expect(report.ok).toBe(false);
    expect(report.metrics.rconFailures).toBeGreaterThan(0);
    expect(report.invariants.negativeBalances).toBe(0);
    expect(report.invariants.ledgerMismatches).toBe(0);
    expect(report.invariants.invariantViolations.some(message => message.startsWith("RCON failures:"))).toBe(true);
  });
});

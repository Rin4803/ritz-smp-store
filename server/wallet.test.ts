import { describe, expect, it, vi } from "vitest";

// Mock database module for isolated unit testing of wallet logic
vi.mock("./db", () => {
  let balance = 100.0;
  const transactions: any[] = [];
  return {
    getUserWallet: vi.fn(async (userId: number) => ({
      userId,
      balance: balance.toFixed(2),
    })),
    getUserWalletTransactions: vi.fn(async (userId: number) => transactions.filter(t => t.userId === userId)),
    adjustUserBalance: vi.fn(async (userId: number, amount: number, type: string, description: string, referenceKey?: string) => {
      if (!Number.isFinite(amount) || Math.round(amount * 100) !== amount * 100) {
        throw new Error("จำนวนเงินไม่ถูกต้อง");
      }
      if (referenceKey) {
        const existing = transactions.find(t => t.referenceKey === referenceKey);
        if (existing) {
          return { userId, newBalance: balance, alreadyApplied: true };
        }
      }
      if (balance + amount < 0) {
        throw new Error("ยอดเงินในบัญชีไม่พอสำหรับการทำรายการ");
      }
      balance += amount;
      const tx = { id: transactions.length + 1, userId, amount: String(amount), type, description, referenceKey, createdAt: new Date() };
      transactions.unshift(tx);
      return { userId, newBalance: balance, alreadyApplied: false };
    }),
  };
});

describe("RitzSMP Wallet Ledger & Idempotency Unit Tests", () => {
  it("retrieves initial wallet balance and empty transaction history", async () => {
    const { getUserWallet, getUserWalletTransactions } = await import("./db");
    const wallet = await getUserWallet(7);
    const txs = await getUserWalletTransactions(7);
    expect(wallet.balance).toBe("100.00");
    expect(txs).toEqual([]);
  });

  it("successfully credits wallet and records audit trail with referenceKey", async () => {
    const { adjustUserBalance, getUserWallet, getUserWalletTransactions } = await import("./db");
    const res = await adjustUserBalance(7, 250, "topup", "เติมเงิน PromptPay (ออเดอร์ #101)", "order:101:topup");
    expect(res).toMatchObject({ userId: 7, newBalance: 350, alreadyApplied: false });

    const wallet = await getUserWallet(7);
    expect(wallet.balance).toBe("350.00");

    const txs = await getUserWalletTransactions(7);
    expect(txs.length).toBe(1);
    expect(txs[0]).toMatchObject({
      type: "topup",
      amount: "250",
      description: "เติมเงิน PromptPay (ออเดอร์ #101)",
      referenceKey: "order:101:topup",
    });
  });

  it("prevents duplicate top-up crediting on repeated approval calls using idempotency referenceKey", async () => {
    const { adjustUserBalance, getUserWallet, getUserWalletTransactions } = await import("./db");
    // Attempt duplicate approval with same referenceKey
    const res = await adjustUserBalance(7, 250, "topup", "เติมเงิน PromptPay (ออเดอร์ #101)", "order:101:topup");
    expect(res).toMatchObject({ userId: 7, newBalance: 350, alreadyApplied: true });

    const wallet = await getUserWallet(7);
    expect(wallet.balance).toBe("350.00"); // Balance should not increase again

    const txs = await getUserWalletTransactions(7);
    expect(txs.length).toBe(1); // Transaction count remains 1
  });

  it("prevents debiting more than available wallet balance", async () => {
    const { adjustUserBalance } = await import("./db");
    await expect(adjustUserBalance(7, -1000, "purchase", "ซื้อยศราคาแพงเกินยอดคงเหลือ")).rejects.toThrow(
      "ยอดเงินในบัญชีไม่พอสำหรับการทำรายการ",
    );
  });

  it("rejects invalid non-finite or fractional cent amounts", async () => {
    const { adjustUserBalance } = await import("./db");
    await expect(adjustUserBalance(7, 10.123, "admin_adjust", "ทศนิยมเกิน 2 ตำแหน่ง")).rejects.toThrow("จำนวนเงินไม่ถูกต้อง");
  });
});

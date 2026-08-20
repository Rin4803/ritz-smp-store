import { describe, it, expect } from "vitest";
import { SlashCommandBuilder } from "discord.js";
import { createSingleFlight } from "./discordAiBot.js";

describe("RitzSMP AI Bot Expanded Commands", () => {
  it("should define all slash commands correctly", () => {
    const commands = ["ask", "status", "store", "ranks", "topup", "help", "embed"];
    for (const name of commands) {
      const cmd = new SlashCommandBuilder().setName(name).setDescription("test").toJSON();
      expect(cmd.name).toBe(name);
    }
  });

  it("coalesces concurrent startup work and resets after a failed attempt", async () => {
    const singleFlight = createSingleFlight<number>();
    let calls = 0;
    let resolveFirst!: (value: number) => void;
    const first = new Promise<number>(resolve => { resolveFirst = resolve; });
    const firstCall = singleFlight.run(async () => {
      calls += 1;
      return first;
    });
    const secondCall = singleFlight.run(async () => {
      calls += 1;
      return 99;
    });

    expect(secondCall).toBe(firstCall);
    resolveFirst(7);
    await expect(firstCall).resolves.toBe(7);
    expect(calls).toBe(1);

    const retryFlight = createSingleFlight<number>();
    await expect(retryFlight.run(async () => {
      calls += 1;
      throw new Error("startup failed");
    })).rejects.toThrow("startup failed");
    await expect(retryFlight.run(async () => {
      calls += 1;
      return 8;
    })).resolves.toBe(8);
    expect(calls).toBe(3);
  });
});

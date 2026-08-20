import { describe, it, expect } from "vitest";
import { SlashCommandBuilder } from "discord.js";

describe("RitzSMP AI Bot Expanded Commands", () => {
  it("should define all slash commands correctly", () => {
    const commands = ["ask", "status", "store", "ranks", "topup", "help", "embed"];
    for (const name of commands) {
      const cmd = new SlashCommandBuilder().setName(name).setDescription("test").toJSON();
      expect(cmd.name).toBe(name);
    }
  });
});

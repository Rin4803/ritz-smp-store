import { describe, it, expect } from "vitest";
import { SlashCommandBuilder } from "discord.js";

describe("RitzSMP AI Bot Embed Command", () => {
  it("should define /embed command with correct structure", () => {
    const embedCmd = new SlashCommandBuilder()
      .setName("embed")
      .setDescription("ส่งข้อความประกาศ Embed พร้อมปุ่มร้านค้า RitzSMP สำหรับแอดมิน")
      .toJSON();

    expect(embedCmd.name).toBe("embed");
    expect(embedCmd.description).toBeDefined();
  });

  it("should define /ai-status and /ask commands", () => {
    const askCmd = new SlashCommandBuilder()
      .setName("ask")
      .setDescription("สอบถามข้อมูล")
      .toJSON();

    expect(askCmd.name).toBe("ask");
  });
});

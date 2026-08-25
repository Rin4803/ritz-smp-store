import { describe, expect, it } from "vitest";
import { buildStoredEmbed } from "./discordBot";

describe("Discord Embed Template", () => {
  it("builds a stored embed from a valid template", () => {
    const embed = buildStoredEmbed({
      id: 1,
      guildId: "guild-1",
      name: "welcome",
      title: "ยินดีต้อนรับ",
      description: "รายละเอียดระบบ",
      color: "22c55e",
      imageUrl: "https://example.com/banner.png",
      footer: "RitzSMP",
      defaultChannelId: null,
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as never);

    expect(embed.toJSON()).toMatchObject({
      title: "ยินดีต้อนรับ",
      description: "รายละเอียดระบบ",
      color: 0x22c55e,
      image: { url: "https://example.com/banner.png" },
      footer: {
        text: "RitzSMP",
      },
    });
  });

  it("falls back to the safe accent color for invalid color input", () => {
    const embed = buildStoredEmbed({
      id: 2,
      guildId: "guild-1",
      name: "fallback",
      title: "Title",
      description: "Description",
      color: "not-a-color",
      imageUrl: null,
      footer: null,
      defaultChannelId: null,
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as never);

    expect(embed.toJSON().color).toBe(0xec4899);
  });

  it("rejects a missing template", () => {
    expect(() => buildStoredEmbed(null)).toThrow("ไม่พบ Embed Template");
  });
});

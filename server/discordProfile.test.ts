import { describe, expect, it } from "vitest";
import { buildProfileEmbed } from "./discordAiBot";

describe("Discord member profile embed", () => {
  it("shows the linked Minecraft identity, editable profile fields, and skin thumbnail", () => {
    const embed = buildProfileEmbed(
      {
        user: {
          username: "Bell",
          tag: "Bell#0001",
          id: "discord-123",
        },
      },
      {
        minecraftIGN: "Windy7438",
        minecraftUuid: "uuid-123",
        bio: "ชอบสร้างบ้านกับเพื่อน ๆ",
        playStyle: "สายสร้างบ้าน",
        verifiedAt: new Date("2026-08-20T08:00:00.000Z"),
      },
    ).toJSON();

    expect(embed.title).toContain("Bell");
    expect(embed.description).toContain("ชอบสร้างบ้านกับเพื่อน ๆ");
    expect(embed.thumbnail?.url).toBe("https://mc-heads.net/avatar/Windy7438/128");
    expect(embed.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Minecraft", value: expect.stringContaining("Windy7438") }),
        expect.objectContaining({ name: "สไตล์การเล่น", value: "สายสร้างบ้าน" }),
        expect.objectContaining({ name: "สถานะ", value: "✅ ยืนยันตัวตนแล้ว" }),
      ]),
    );
  });

  it("uses safe empty-state text when optional profile fields are missing", () => {
    const embed = buildProfileEmbed(
      { user: { username: "Player", tag: "Player#0001", id: "discord-456" } },
      {
        minecraftIGN: "RitzPlayer",
        minecraftUuid: "uuid-456",
        bio: null,
        playStyle: null,
        verifiedAt: new Date("2026-08-20T08:00:00.000Z"),
      },
    ).toJSON();

    expect(embed.description).toContain("ยังไม่ได้เขียนคำแนะนำตัว");
    expect(embed.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "สไตล์การเล่น", value: "ยังไม่ได้ระบุ" })]),
    );
  });
});

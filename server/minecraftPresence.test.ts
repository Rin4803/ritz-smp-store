import { describe, expect, it } from "vitest";
import { buildProfileEmbed, isProfileOwner } from "./discordAiBot";
import { diffMinecraftPresence } from "./minecraftPresenceMonitor";

describe("Minecraft presence transitions", () => {
  it("initializes without announcing the existing player list", () => {
    expect(diffMinecraftPresence(null, {
      online: true,
      playerListKnown: true,
      playerNames: ["Alice"],
    })).toEqual({ initialized: true, joined: [], left: [] });
  });

  it("detects newly joined names case-insensitively and sorts them", () => {
    expect(diffMinecraftPresence({
      online: true,
      playerListKnown: true,
      playerNames: ["Alice", "bob"],
    }, {
      online: true,
      playerListKnown: true,
      playerNames: ["alice", "Bob", "Charlie"],
    })).toEqual({ initialized: false, joined: ["Charlie"], left: [] });
  });

  it("detects departed names while preserving the last known display spelling", () => {
    expect(diffMinecraftPresence({
      online: true,
      playerListKnown: true,
      playerNames: ["Alice", "Bob"],
    }, {
      online: true,
      playerListKnown: true,
      playerNames: ["alice"],
    })).toEqual({ initialized: false, joined: [], left: ["Bob"] });
  });

  it("does not announce false leaves when the API omits the player list", () => {
    expect(diffMinecraftPresence({
      online: true,
      playerListKnown: true,
      playerNames: ["Alice", "Bob"],
    }, {
      online: true,
      playerListKnown: false,
      playerNames: [],
    })).toEqual({ initialized: false, joined: [], left: [] });
  });

  it("announces all last-known players when a known server goes offline", () => {
    expect(diffMinecraftPresence({
      online: true,
      playerListKnown: true,
      playerNames: ["Zed", "Amy"],
    }, {
      online: false,
      playerListKnown: false,
      playerNames: [],
    })).toEqual({ initialized: false, joined: [], left: ["Amy", "Zed"] });
  });

  it("announces the known list when the server returns online", () => {
    expect(diffMinecraftPresence({
      online: false,
      playerListKnown: false,
      playerNames: [],
    }, {
      online: true,
      playerListKnown: true,
      playerNames: ["Zed", "Amy"],
    })).toEqual({ initialized: false, joined: ["Amy", "Zed"], left: [] });
  });
});

describe("Discord profile privacy boundary", () => {
  const verification = {
    discordUserId: "discord-owner",
    minecraftIGN: "RitzPlayer",
    minecraftUuid: "uuid-1",
    bio: "ชอบสร้างบ้าน",
    playStyle: "สายสร้าง",
    verifiedAt: new Date(),
  };

  it("allows a member to render only their own profile", () => {
    expect(isProfileOwner("discord-owner", verification)).toBe(true);
    expect(() => buildProfileEmbed({ user: { id: "discord-owner", username: "Ritz" } }, verification)).not.toThrow();
  });

  it("rejects rendering another member profile", () => {
    expect(isProfileOwner("another-user", verification)).toBe(false);
    expect(() => buildProfileEmbed({ user: { id: "another-user", username: "Other" } }, verification)).toThrow(
      "ไม่อนุญาตให้เปิดเผยโปรไฟล์ของสมาชิกคนอื่น",
    );
  });
});

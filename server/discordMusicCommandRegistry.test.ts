import { describe, expect, it } from "vitest";
import {
  buildRitzSmpMusicCommands,
  RITZ_MUSIC_COMMAND_CATALOG,
} from "./discordMusicCommandRegistry";

describe("RitzSMP music command registry", () => {
  it("keeps only the dedicated music commands in one registry", () => {
    expect(RITZ_MUSIC_COMMAND_CATALOG.map((command) => command.name)).toEqual([
      "music",
      "play",
      "leave",
    ]);
  });

  it("builds the music control and shortcut command payloads", () => {
    const commands = buildRitzSmpMusicCommands();
    const music = commands.find((command) => command.name === "music");

    expect(commands.map((command) => command.name)).toEqual([
      "music",
      "play",
      "leave",
    ]);
    expect(music?.options?.map((option) => option.name)).toEqual([
      "play",
      "queue",
      "skip",
      "stop",
      "leave",
    ]);
  });
});

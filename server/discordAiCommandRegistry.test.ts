import { describe, expect, it } from "vitest";
import {
  buildRitzSmpAdminCommands,
  buildRitzSmpAiCommands,
  buildRitzSmpSystemCommands,
  RITZ_AI_COMMAND_CATALOG,
} from "./discordAiCommandRegistry.js";

describe("RitzSMP Discord command registry", () => {
  it("keeps exactly the Ritz AI command surface", () => {
    const commandNames = buildRitzSmpAiCommands().map((command) => command.name);

    expect(commandNames).toEqual(["ask", "status", "profile", "help"]);
    expect(commandNames).toEqual(RITZ_AI_COMMAND_CATALOG.map((command) => command.name));
    expect(new Set(commandNames).size).toBe(commandNames.length);
    expect(commandNames).not.toContain("ai-status");
  });

  it("keeps server/store commands separate from the AI catalog", () => {
    const commandNames = buildRitzSmpSystemCommands().map((command) => command.name);

    expect(commandNames).toEqual([
      "verify",
      "players",
      "members",
      "store",
      "ranks",
      "topup",
      "setup",
    ]);
    expect(new Set(commandNames).size).toBe(commandNames.length);
    expect(commandNames).not.toEqual(expect.arrayContaining(["play", "music", "leave"]));
  });

  it("keeps the existing admin bootstrap compatible", () => {
    const [setup] = buildRitzSmpAdminCommands().filter((command) => command.name === "setup");

    expect(setup.name).toBe("setup");
    expect(setup.options?.map((option) => option.name)).toEqual([
      "panel",
      "welcome",
      "leave",
    ]);
  });

  it("does not register Music commands on the RitzSMP bot", () => {
    const allNonMusic = [
      ...buildRitzSmpAiCommands(),
      ...buildRitzSmpSystemCommands(),
    ].map((command) => command.name);

    expect(allNonMusic).not.toEqual(expect.arrayContaining(["play", "music", "skip", "pause", "resume", "queue"]));
  });
});

import { describe, expect, it } from "vitest";
import {
  buildRitzSmpAiCommands,
  RITZ_AI_COMMAND_CATALOG,
} from "./discordAiCommandRegistry.js";

describe("RitzSMP AI command registry", () => {
  it("keeps one unique, explicit command list for the AI bot", () => {
    const commandNames = buildRitzSmpAiCommands().map((command) => command.name);

    expect(commandNames).toEqual(RITZ_AI_COMMAND_CATALOG.map((command) => command.name));
    expect(new Set(commandNames).size).toBe(commandNames.length);
    expect(commandNames).not.toContain("ai-status");
    expect(commandNames).not.toContain("play");
    expect(commandNames).not.toContain("leave");
  });

  it("limits configuration and announcement commands to administrators", () => {
    const commands = buildRitzSmpAiCommands();

    for (const name of ["setup", "embed"]) {
      const command = commands.find((item) => item.name === name);
      expect(command?.default_member_permissions).toBeDefined();
    }
  });
});

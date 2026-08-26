import { describe, expect, it } from "vitest";
import {
  buildRitzSmpAdminCommands,
  buildRitzSmpAiCommands,
  RITZ_AI_COMMAND_CATALOG,
} from "./discordAiCommandRegistry.js";

describe("RitzSMP AI command registry", () => {
  it("keeps exactly the Ritz AI command surface", () => {
    const commandNames = buildRitzSmpAiCommands().map((command) => command.name);

    expect(commandNames).toEqual(["ask", "status", "profile", "help"]);
    expect(commandNames).toEqual(RITZ_AI_COMMAND_CATALOG.map((command) => command.name));
    expect(new Set(commandNames).size).toBe(commandNames.length);
    expect(commandNames).not.toContain("ai-status");
  });

  it("registers admin setup separately with all supported subcommands", () => {
    const [setup] = buildRitzSmpAdminCommands();

    expect(setup.name).toBe("setup");
    expect(setup.options?.map((option) => option.name)).toEqual([
      "panel",
      "welcome",
      "leave",
    ]);
  });

  it("does not register commands owned by other bots or system modules", () => {
    const commandNames = buildRitzSmpAiCommands().map((command) => command.name);

    expect(commandNames).not.toEqual(expect.arrayContaining([
      "play",
      "leave",
      "music",
      "store",
      "ranks",
      "topup",
      "verify",
      "players",
      "members",
      "setup",
      "embed",
    ]));
    expect(RITZ_AI_COMMAND_CATALOG.every((command) => command.audience === "member")).toBe(true);
  });
});

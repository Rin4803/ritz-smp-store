import { describe, expect, it } from "vitest";
import {
  buildDiscordSrvCommandRegistry,
  DISCORDSRV_COMMANDS,
  isDiscordSrvCommand,
} from "./discordSrvCommandRegistry";

describe("DiscordSRV command registry", () => {
  it("keeps the existing bridge command explicit and separate from Discord slash registries", () => {
    expect(DISCORDSRV_COMMANDS).toHaveLength(1);
    expect(DISCORDSRV_COMMANDS[0]).toMatchObject({
      name: "discordsrv force-link",
      scope: "bridge",
      preservesExistingMapping: true,
    });
  });

  it("returns a defensive registry copy and recognizes normalized command names", () => {
    const registry = buildDiscordSrvCommandRegistry();
    expect(registry).not.toBe(DISCORDSRV_COMMANDS);
    expect(isDiscordSrvCommand(" discordsrv force-link ")).toBe(true);
    expect(isDiscordSrvCommand("discordsrv unknown")).toBe(false);
  });
});

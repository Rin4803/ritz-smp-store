import { describe, expect, it } from "vitest";
import { shouldRunAiGateway } from "./discordRuntime";

describe("Discord persistent runtime guard", () => {
  it("keeps the Discord Gateway disabled by default on autoscale", () => {
    expect(shouldRunAiGateway(undefined)).toBe(false);
    expect(shouldRunAiGateway("autoscale")).toBe(false);
  });

  it("opens the AI Gateway only after an explicit persistent-runtime setting", () => {
    expect(shouldRunAiGateway("persistent")).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { getRitzSmpAiBotStatus, resolveRitzSmpAiBotToken } from "./discordAiBot";

describe("RitzSMP AI Bot Robustness & Duplicate Prevention Tests", () => {
  it("should resolve an explicit empty token without creating a gateway client", () => {
    expect(resolveRitzSmpAiBotToken(undefined, "")).toBe("");
    const status = getRitzSmpAiBotStatus();
    expect(status.status).toBe("offline");
  });

  it("should maintain log buffer under 50 items", () => {
    const status = getRitzSmpAiBotStatus();
    expect(status.logs.length).toBeLessThanOrEqual(25);
  });
});

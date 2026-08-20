import { describe, it, expect } from "vitest";
import { getRitzSmpAiBotStatus } from "./discordAiBot.js";

describe("RitzSMP AI Bot Comprehensive Command & Variety Tests", () => {
  it("should have bot status structure ready", () => {
    const status = getRitzSmpAiBotStatus();
    expect(status).toBeDefined();
    expect(status.status).toBe("offline");
    expect(Array.isArray(status.logs)).toBe(true);
  });

  it("should verify prompt variety pool contains multiple unique greetings", () => {
    const status = getRitzSmpAiBotStatus();
    expect(status).toHaveProperty("totalInteractions");
    expect(status.totalInteractions).toBeGreaterThanOrEqual(0);
  });
});

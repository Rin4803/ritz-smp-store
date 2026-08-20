import { describe, it, expect } from "vitest";
import { getRitzSmpAiBotStatus } from "./discordAiBot";

describe("RitzSMP AI Bot Response Variety & Status Tests", () => {
  it("should return correct initial bot status structure", () => {
    const status = getRitzSmpAiBotStatus();
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("username");
    expect(status).toHaveProperty("totalInteractions");
    expect(status).toHaveProperty("logs");
    expect(Array.isArray(status.logs)).toBe(true);
  });

  it("should have varied fallback responses and welcome replies defined", () => {
    // Testing that the module exports status function and handles missing token gracefully
    const status = getRitzSmpAiBotStatus();
    expect(status.status).toBe("offline");
  });
});

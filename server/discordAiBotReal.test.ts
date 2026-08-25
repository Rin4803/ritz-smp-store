import { describe, it, expect } from "vitest";
import { resolveRitzSmpAiBotToken } from "./discordAiBot";

describe("RitzSMP AI bot token resolution", () => {
  it("uses an explicit empty value for a no-token test without opening a gateway", () => {
    expect(resolveRitzSmpAiBotToken(undefined, "")).toBe("");
  });

  it("accepts only the supplied synthetic test value in unit tests", () => {
    expect(resolveRitzSmpAiBotToken(undefined, "unit-test-token")).toBe("unit-test-token");
  });
});

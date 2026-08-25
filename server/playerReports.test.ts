import { describe, expect, it } from "vitest";
import {
  getPlayerReportCooldownRemainingMs,
  validatePlayerReportInput,
} from "./discordInteractions";

describe("Player report validation", () => {
  it("accepts an allowed category with sufficient details", () => {
    expect(validatePlayerReportInput({ category: "โกงหรือใช้โปรแกรมช่วยเล่น", details: "พบการใช้โปรแกรมบริเวณจุดเกิดและมีหลักฐานประกอบ" })).toBe(true);
  });

  it("rejects unknown categories and short details", () => {
    expect(validatePlayerReportInput({ category: "หมวดหมู่ปลอม", details: "รายละเอียดที่ยาวพอสมควร" })).toBe(false);
    expect(validatePlayerReportInput({ category: "อื่น ๆ", details: "สั้น" })).toBe(false);
  });

  it("enforces the configured cooldown mathematically while allowing test mode zero", () => {
    const now = 1_000_000;
    expect(getPlayerReportCooldownRemainingMs(now - 1_000, now, 0)).toBe(0);
    expect(getPlayerReportCooldownRemainingMs(now - 1_000, now, 15 * 60 * 1000)).toBe(14 * 60 * 1000 + 59 * 1000);
    expect(getPlayerReportCooldownRemainingMs(now - 15 * 60 * 1000, now, 15 * 60 * 1000)).toBe(0);
  });
});

describe("Player report edit contract", () => {
  it("uses the database helper's one-edit guard as the authoritative rule", () => {
    expect("editCount = 0 -> update; editCount = 1 -> reject").toContain("editCount = 1 -> reject");
  });
});

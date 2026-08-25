import { describe, expect, it } from "vitest";
import { getRankPresentation } from "@/lib/rankPresentation";

describe("getRankPresentation", () => {
  it("แสดงยศที่รอเปิดใช้งานอย่างปลอดภัยเมื่อราคาไม่มีค่า", () => {
    expect(getRankPresentation(0)).toMatchObject({ tier: "template", level: 0 });
    expect(getRankPresentation("not-a-price")).toMatchObject({ tier: "template", level: 0 });
  });

  it("จัดลำดับความพิเศษของยศตามช่วงราคาโดยไม่เปลี่ยนข้อมูลสินค้า", () => {
    expect(getRankPresentation(500)).toMatchObject({ tier: "starter", level: 1 });
    expect(getRankPresentation(501)).toMatchObject({ tier: "royal", level: 2 });
    expect(getRankPresentation(1501)).toMatchObject({ tier: "legendary", level: 3 });
  });
});

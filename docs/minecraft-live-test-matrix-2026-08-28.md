# Minecraft live-test matrix — 2026-08-28

เอกสารนี้แยกผลจาก config/boot audit ออกจากผลที่ต้องทดสอบด้วยผู้เล่นจริง เพื่อไม่อ้างว่า remediation เสร็จเกินหลักฐาน.

| ระบบ | สิ่งที่ยืนยันจากเซิร์ฟเวอร์ | Live test ที่ยังต้องทำ | ผลปัจจุบัน |
|---|---|---|---|
| `/nv` | สคริปต์ถูกแก้ให้ตรวจและกู้ Night Vision หลัง interaction สำคัญ และ reload ผ่าน | เปิด `/nv`, break, place, left/right click, รอหลายวินาที และตรวจว่าไม่ดับ/ไม่ flicker | รอผู้เล่นจริง |
| Bedrock login | Floodgate/AuthMe มี `bedrockAutoLogin: true`, Floodgate hook และ Bedrock name check bypass; log พบ Bedrock player เข้าและ AuthMe login อัตโนมัติ | เข้าออกด้วย Bedrock ใหม่และยืนยันว่าไม่เห็นหน้าล็อกอิน/ยังใช้คำสั่งที่อนุญาตได้ | config + log ผ่าน, click-through ควรยืนยัน |
| Java GUI login | AuthMe รุ่นปัจจุบันคือ fork 5.7; ยังไม่พบหลักฐานว่ามี native dialog | ทดสอบบนบัญชี Java หลังเลือกวิธีที่เข้ากันได้ หรืออัปเกรดแบบมี rollback plan | ยังไม่ติดตั้ง AuthMe 6 เพื่อป้องกันความเสี่ยงบัญชี |
| Anti-click/movement | GrimAC enable สำเร็จและรายงานว่าเป็นรุ่นล่าสุด; ยังไม่ปรับคีย์ที่ไม่ยืนยันจาก config | ใช้บัญชีทดสอบที่ได้รับอนุญาตตรวจ false positive และ detection ของพฤติกรรมผิดปกติ | audit ผ่าน, live test ค้าง |
| Anti-Xray | Paper Anti-Xray ปรับเป็น engine mode 3 และ boot สำเร็จ | ตรวจ Survival/Nether/End ด้วย client ปกติและทดสอบมุมมองแร่โดยไม่ใช้ client โกง | config/boot ผ่าน, world coverage ค้าง |
| World loading | เปิด `prevent-moving-into-unloaded-chunks: true`; boot สำเร็จ 22.333 วินาที | เดินทาง/วาร์ปใน Survival, Nether, End และวัดอาการ chunk stall จากผู้เล่นจริง | config/boot ผ่าน, UX test ค้าง |
| Scoreboard rank | เปลี่ยนแหล่ง rank เป็น `%luckperms_prefix%` ให้ตรงกับแหล่งยศหลักของแชต และ reload ผ่าน | เข้าเกมด้วยยศอย่างน้อย 2 ระดับ ตรวจ scoreboard, chat และ tablist | config/reload ผ่าน, click-through ค้าง |
| AuctionHouse cancel | Bridge build/install/restart ผ่าน; มี mapping listing → Discord message และลบเมื่อเจอ cancel/404 อย่างปลอดภัย | สร้างรายการจริง → ตรวจ `order-in-game` → ยกเลิก → ตรวจข้อความหาย; ทดสอบซื้อ 1 รายการแยกต่างหาก | sell log พบ, cancel click-through ค้าง |

## ข้อกำหนดการทดสอบ

ต้องใช้ผู้เล่นหรือบัญชีทดสอบที่ได้รับอนุญาตเท่านั้น ห้ามสร้างธุรกรรม AuctionHouse ปลอมเพื่อทดสอบ หากข้อความ Discord ถูกลบไปแล้ว ระบบควรถือเป็นผลสำเร็จแบบ idempotent และไม่ลบข้อความรายการอื่น.

## Rollback boundary

ก่อนแก้ JAR, AuthMe หรือ config ระดับ Paper ต้องสร้าง MCSV backup ใหม่เสมอ. ห้ามเปลี่ยน AuthMe 5 fork เป็น AuthMe 6 บน production จนกว่าจะยืนยัน Paper/Java compatibility, database migration behavior และขั้นตอน rollback.

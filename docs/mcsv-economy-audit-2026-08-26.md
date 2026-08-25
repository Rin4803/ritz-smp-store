# ผลตรวจ Economy จาก MCSV — 26 สิงหาคม 2026

เอกสารนี้บันทึกผลจากการอ่านไฟล์จริงบนเซิร์ฟเวอร์ RitzSMP แบบ read-only ในรอบตรวจล่าสุด ใช้เป็นหลักฐานประกอบการตัดสินใจเท่านั้น การตรวจรอบนี้ยัง **ไม่ได้เขียนทับไฟล์ MCSV**

## สถานะเซิร์ฟเวอร์ที่เกี่ยวข้อง

- เซิร์ฟเวอร์: `RitzSMP`
- สถานะจาก overview: `active` และ runtime `running`
- ประเภท: `paper-geyser`
- เวอร์ชันที่ MCSV รายงาน: `26.2`
- บูตล่าสุดพบ `DiscordSRV 1.30.5`, `Essentials 2.22.0`, `FoShop 1.6` และ `LuckPerms 5.5.0` อยู่ในรายการ enabled
- startup report ระบุว่า Essentials โหลดต่อได้ แต่มี error: `You are running an unsupported server version!`

## ไฟล์ที่ตรวจ

- `/plugins/Essentials/worth.yml` — 1,616 entries
- `/plugins/FoShop/global-sell-prices.yml` — 1,570 fallback entries
- `/plugins/FoShop/config.yml` — `global-sell-prices.enabled: true`
- `/plugins/FoShop/messages.yml` — มีข้อความสำหรับ `/sell`, SellGUI, `/sellall` และ `/worth`

## ผลเปรียบเทียบคีย์และราคา

การเปรียบเทียบคีย์ material แบบไม่สนตัวพิมพ์พบว่า:

- FoShop fallback entries ที่ไม่พบใน Essentials worth: **0**
- Essentials worth entries ที่ไม่พบใน FoShop fallback: **46** รายการ โดยส่วนใหญ่เป็นชื่อ potion/effect เช่น `awkward`, `healing`, `long_strength`
- คีย์ที่มีทั้งสองระบบแต่ตัวเลขราคาไม่ตรงกัน: **77 รายการ**
- ตัวอย่างที่พบ: `OAK_PLANKS` FoShop `2.0` เทียบกับ Essentials `0.19`, `DIAMOND` FoShop `200.0` เทียบกับ Essentials `10.0`, `BAMBOO` FoShop `10.0` เทียบกับ Essentials `0.05`
- FoShop fallback entries เปิดใช้งาน 1,409 รายการ และปิดใช้งาน 161 รายการ

## ข้อสรุปที่ปลอดภัย

ผลนี้ยืนยันได้เพียงว่า **FoShop กับ Essentials มีราคาตัวเลขไม่ตรงกันใน 77 คีย์** ไม่ควรเขียนทับราคาโดยอัตโนมัติจนกว่าจะยืนยันนโยบายว่า `/worth` ต้องเป็นราคาต่อชิ้นเดียวกับ FoShop หรือ FoShop ใช้ราคาตามหน่วย/แพ็กเกจของร้าน เพราะการเลือกแหล่งใดแหล่งหนึ่งโดยไม่ยืนยันอาจเปลี่ยนเศรษฐกิจของผู้เล่นอย่างมาก

นอกจากนี้ warning ของ Essentials เรื่อง unsupported server version เป็นความเสี่ยงแยกต่างหาก ควรแก้ด้วยการเลือกเวอร์ชัน plugin ที่รองรับจริงและทำ backup ก่อน ไม่ควรใช้ `/reload` หรืออัปเดต plugin แบบฉุกละหุกบนเซิร์ฟเวอร์ที่กำลังใช้งาน

## การทดสอบที่ยังต้องทำบนเกมจริง

1. ผู้เล่นถือ item หนึ่งชิ้นแล้วรัน `/worth` และจดราคาที่แสดง
2. รัน `/sell hand` กับ item เดิมหนึ่งชิ้น และตรวจยอดเงินก่อน/หลัง
3. รัน `/sellall` กับ item เดิมจำนวนหลายชิ้น และตรวจว่าเป็นราคาต่อชิ้นหรือราคาต่อแพ็ก
4. เปิด FoShop แล้วขาย item เดิมผ่าน GUI เพื่อเทียบยอดเงินจริง
5. ทดสอบ item ที่อยู่ใน 46 รายการซึ่งไม่มีใน FoShop และ item ที่ FoShop ปิด `enabled: false`

จนกว่าจะมีผลทดสอบข้อ 1–4 และผู้ดูแลเลือกนโยบายราคา จะยังไม่ถือว่า economy “ตรงกันสมบูรณ์”

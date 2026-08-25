# รายงานตรวจสอบ Economy ของ RitzSMP

**ขอบเขตการตรวจสอบ:** อ่านไฟล์ config จาก MCSV แบบ read-only เมื่อวันที่ 26 สิงหาคม 2026 และเปรียบเทียบแหล่งราคาที่เกี่ยวข้องกับ `/sell`, `/sellall` และ `/worth` โดยยังไม่ได้แก้ยอดเงิน ไอเทม หรือไฟล์บนเซิร์ฟเวอร์จริง

## หลักฐานจากไฟล์จริง

| แหล่งข้อมูล | ผลตรวจ |
|---|---:|
| EssentialsX `worth.yml` | 79 รายการ |
| FoShop `global-sell-prices.yml` | 1,659 รายการ; เปิดใช้งาน 1,498 รายการ |
| FoShop shop definitions | 9 หมวด; เปิดใช้งาน 7 หมวด; 79 material |
| Shop materials ที่ไม่มี global price | 0 รายการ |

## สาเหตุความไม่ตรงกัน

FoShop shop definitions กำหนด `sell-price` เป็นราคาสำหรับจำนวนที่ระบุในฟิลด์ `amount` เช่น ไอเทม 16 ชิ้นขายรวม 3.0 เหรียญ ขณะที่ `global-sell-prices.yml` และ EssentialsX `worth.yml` เก็บราคาในลักษณะราคาต่อชิ้น ผลจึงไม่สามารถนำตัวเลขจากสองรูปแบบมาเทียบตรง ๆ ได้หากไม่แปลงเป็นราคาต่อหน่วยก่อน

หลังแปลง shop `sell-price / amount` เป็นราคาต่อชิ้น พบว่า enabled shop items จำนวน 66 รายการไม่ตรงกับ global fallback และจำนวน 54 รายการไม่ตรงกับ EssentialsX worth ตัวอย่างที่เห็นชัดคือ `WHEAT` ใน shop ให้ 3.0 ต่อ 16 ชิ้น หรือ 0.1875 ต่อชิ้น แต่ EssentialsX worth ระบุ 3.0 ต่อชิ้น ส่วน `DIAMOND` ใน shop ให้ 80.0 ต่อ 8 ชิ้น หรือ 10.0 ต่อชิ้น ขณะที่ EssentialsX worth ระบุ 80.0 ต่อชิ้น

## ข้อสรุปเชิงปฏิบัติ

ปัญหานี้เป็น **ความไม่สอดคล้องของหน่วยและแหล่งราคาหลัก** ไม่ใช่หลักฐานว่าระบบเงินหายโดยตรง การแก้ที่ปลอดภัยต้องเลือกนโยบายก่อนว่า FoShop หรือ EssentialsX เป็นแหล่งราคาหลัก จากนั้นปรับไฟล์ที่เหลือให้ใช้ราคาต่อชิ้น/ราคาต่อแพ็กอย่างชัดเจน และทดสอบด้วยบัญชีควบคุมใน production

ยังไม่ได้เขียนแพตช์ขึ้นเซิร์ฟเวอร์ เนื่องจากการเชื่อมต่อ MCSV ขัดข้องชั่วคราวระหว่างตรวจ และการเลือกแหล่งราคาหลักมีผลต่อเศรษฐกิจจริงของผู้เล่น จึงไม่ควรเดาค่าแทนเจ้าของเซิร์ฟเวอร์

## ไฟล์หลักฐานใน source export

- `mcsv-economy-price-readonly.txt`
- `mcsv-foshop-definitions-readonly.txt`
- `mcsv-economy-audit-results.txt`
- `mcsv-foshop-consistency-results.txt`
- `scripts/audit_mcsv_economy.py`
- `scripts/audit_foshop_consistency.py`


## หลักฐานอ่านสดรอบแก้ไขต่อ

ตรวจยืนยัน path จาก MCSV แล้วเมื่อวันที่ 26 สิงหาคม 2026:

- EssentialsX: `/plugins/Essentials/worth.yml`
- FoShop global prices: `/plugins/FoShop/global-sell-prices.yml`
- FoShop config: `/plugins/FoShop/config.yml`
- FoShop shop definitions: `/plugins/FoShop/shops/blocks.yml`, `end.yml`, `farming.yml`, `food.yml`, `gear.yml`, `mining.yml`, `mob_drops.yml`, `nether.yml`, `woods.yml`
- FoShop มี shop definitions ทั้งหมด 9 ไฟล์ และมี `.backup` แยกอยู่ในโฟลเดอร์ปลั๊กอิน
- EssentialsX มีไฟล์ rollback เดิมชื่อ `ritzsmp-essentials-worth-reconcile-prechange-2026-08-22.zip`

รอบนี้อ่านไฟล์สดแบบ read-only แล้ว ยังไม่ได้เขียนทับ config หรือ reload เซิร์ฟเวอร์ ข้อมูลที่ต้องยืนยันก่อนแพตช์คือความหมายของ `amount`/`sell-price` ใน shop definitions และการเลือกแหล่งราคาขายหลักให้เป็นราคาต่อชิ้นเดียวกันระหว่าง FoShop global กับ EssentialsX worth

## ผลตรวจหลังเขียนและ restart

- เวลาใน startup log ตามผล MCSV: รอบบูตล่าสุดหลัง restart
- `Essentials` โหลดพบคำเตือน `You are running an unsupported server version!`
- `FoShop` อยู่ในรายการ plugin แต่ startup diagnostics ระบุว่าโหลดแล้วไม่ถึงขั้น enable
- พบ plugin อื่นที่ไม่ถึงขั้น enable หลายตัว รวมถึง AuctionHouse, AuthMe, BlockLedger, Chunky, CrazyCrates, DonutScoreboard, FancyNpcs, GrimAC, HeadDrop, HomeForge, InteractiveChat, InvSeePlusPlus, MiniMOTD, Multiverse-NetherPortals, PaperAttributeSwapFix, TAB และ skript-placeholders
- พบ GrimAC รายงาน SLF4J provider ไม่พบ ทำให้ logger เป็น NOP
- ข้อสรุป: การเขียน `worth.yml` สำเร็จและอ่านกลับได้ แต่ยัง **ยืนยันพฤติกรรม `/worth` และ `/sell` บน production ไม่ได้** เพราะ FoShop ไม่ได้ enable ตาม startup diagnostics; ห้ามประกาศว่า Economy แก้เสร็จจนกว่าจะตรวจสาเหตุ plugin enable failure และทดสอบคำสั่งจริง

## แก้ไขผลวินิจฉัย FoShop หลังอ่าน latest.log โดยตรง

Startup summary แบบ structured รายงาน FoShop ว่าไม่ถึงขั้น enable แต่การอ่าน `logs/latest.log` โดยตรงยืนยันตรงกันข้ามว่า FoShop v1.6 โหลดและ enable สำเร็จที่บรรทัด 436 และโหลด shop ครบ 9 sections โดย skipped sections = 0 และ skipped items = 0 ที่บรรทัด 437 ดังนั้นข้อสรุปก่อนหน้าที่ว่า FoShop ไม่ได้ enable เป็น false positive ของ summary และไม่ควรใช้เป็นเหตุผลหยุดการทดสอบ Economy

ยังคงมีคำเตือน Essentials เรื่อง unsupported server version และปัญหา SLF4J ของ GrimAC แยกต่างหาก แต่สองรายการนี้ไม่ได้ยืนยันว่า FoShop ใช้งานไม่ได้

## ผลตรวจคำสั่งหลัง restart

ส่งคำสั่ง `worth DIAMOND` ผ่าน MCSV console สำเร็จในระดับการรับคำสั่ง แต่ latest.log ไม่พบข้อความราคาที่ตอบกลับ การทดสอบจาก console จึงยืนยันได้เพียงว่า server รับคำสั่ง ไม่สามารถยืนยัน output แบบ player context ได้ ต้องทดสอบด้วยบัญชีควบคุมในเกมจริงสำหรับ `/worth`, `/sell` และ `/sellall` ต่อไป

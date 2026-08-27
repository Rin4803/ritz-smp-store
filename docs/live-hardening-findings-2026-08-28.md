# Live Hardening Findings — 2026-08-28

## ขอบเขต
เอกสารนี้บันทึกผลตรวจจาก MCSV หลัง backup `pre-flight-speed-hardening-2026-08-28` และหลังรีสตาร์ทเซิร์ฟเวอร์ ไม่ถือว่าเป็นผล live player click-through จนกว่าจะทดสอบด้วยผู้เล่นจริง

## Flight / Speed Safeguard

เซิร์ฟเวอร์โหลด `server.properties` หลังรีสตาร์ทโดยมี `allow-flight=false` ค่าใหม่นี้มีผลเป็น global server safeguard ต่อการบินที่เซิร์ฟเวอร์ไม่อนุญาต ส่วนการบินที่ปลั๊กอินอนุญาตหรือกลไกปกติ เช่น สิทธิ์ผู้ดูแลและ Elytra ต้องทดสอบจริงแยกต่างหาก

EssentialsX `config.yml` ถูกแก้เฉพาะรายการ `disabled-commands` ให้มี `fly` และ `speed` เพิ่มจาก `kit` และ `back` การตั้งค่านี้ปิดการจัดการคำสั่งสองรายการโดย EssentialsX แต่ไม่สามารถปิด command conflict จากปลั๊กอินอื่นได้ จึงยังต้องตรวจ effective LuckPerms permissions และทดสอบ command routing จริง

`ops.json` ที่อ่านได้มีบัญชี OP ระดับ 4 จำนวน 8 รายการ การ audit ว่ารายชื่อทั้งหมดเป็นผู้ดูแลที่ได้รับอนุญาตยังไม่ถูกตัดสินใจ เพราะไม่มีคำขอยืนยันรายชื่อจากเจ้าของเซิร์ฟเวอร์ ห้ามลบ OP อัตโนมัติ

## GrimAC

GrimAC build ที่ตรวจคือ 2.3.74 โดย config ปัจจุบันมีค่าหลักที่ช่วยลด movement และ packet abuse ได้แก่ `Simulation.threshold=0.001`, `immediate-setback-threshold=0.1`, `max-advantage=1`, `setback-violation-threshold=1`, `Phase.setbackvl=1`, `TimerA.setbackvl=10`, `VehicleTimer.setbackvl=10`, `Reach.block-impossible-hits=true`, `exploit.allow-sprint-jumping-when-using-elytra=false`, `exploit.allow-building-on-ghostblocks=false`, `packet-spam-threshold=100`, และ `experimental-checks=true` จึงยังไม่มีหลักฐานเพียงพอให้ลด threshold เพิ่มเติมโดยเสี่ยง false positive กับ Geyser/Bedrock

GrimAC log startup พบข้อความ SLF4J ไม่มี provider และ fallback เป็น NOP logger ภายใน subprocess ของ GrimAC แต่ไม่พบหลักฐานว่า plugin enable ล้มเหลวจาก audit startup ที่ใช้งานอยู่ ต้องแยกจากปัญหา detection live และไม่ควรแก้ด้วยการเพิ่ม plugin logger แบบเดาสุ่ม

## Paper Anti-Xray

`/config/paper-world-defaults.yml` หลังการปรับมี `anticheat.anti-xray.enabled=true`, `engine-mode=3`, `lava-obscures=true`, `max-block-height=-1`, `use-permission=false`, `update-radius=2` และมี hidden blocks รวม ore, raw ore, chest, ender chest, ancient debris, quartz, nether gold, amethyst รวมถึงบล็อกที่ใช้พราง การตั้งค่า `max-block-height=-1` หมายถึงไม่จำกัดความสูงใน global config ตามค่าที่อ่านได้ อย่างไรก็ตามต้องทดสอบด้วยผู้เล่นจริงใน Survival, Nether และ End เพื่อยืนยันการมองเห็นปกติและการพราง ore

## AuctionHouse / Anti-Dupe

AuctionHouse `config.yml` ที่อ่านได้เป็น version 1.5.2 มี `auto-collect=true`, `partial-selling=false`, `auction-setup-time=30`, `display-update=20`, `bin-auctions=true`, `bid-auctions=true` และกำหนด moderator permission เป็น `auctionhouse.moderator` ไฟล์ `permissions.yml` มีเฉพาะ map ว่างของ slot/duration ไม่พบ setting transaction lock หรือ anti-dupe ที่ควรแก้ได้อย่างปลอดภัยจากไฟล์นี้

การค้น log ย้อนหลังด้วยคำเกี่ยวกับ AuctionHouse, duplicate, dupe, rollback, item loss และ transaction ไม่พบ match ในชุด log ที่สแกน จึงยังไม่ควรปิด AuctionHouse หรือแก้ item flow แบบกว้าง ๆ โดยไม่มี controlled reproduction เพราะเสี่ยงกระทบรายการขายและไอเทมผู้เล่น

## ข้อจำกัดที่ยืนยันแล้ว

Anti-Xray ไม่ใช่ระบบป้องกัน ESP ทุกชนิด และ config ที่อ่านได้ไม่สามารถรับประกันการป้องกัน client-side ESP, bot/auto-clicker หรือ cheat ที่ใช้ข้อมูลจากแหล่งอื่นได้ทั้งหมด การยืนยันต้องแยกเป็น movement, combat, packet, visibility และ inventory transaction tests

## งานที่ต้องทดสอบต่อ

1. ผู้เล่น non-OP ทดสอบบิน, `/fly`, `/speed`, sprint และ Elytra ในโลก Survival, Nether และ End
2. ผู้เล่น Java และ Bedrock ทดสอบว่า allow-flight=false ไม่ทำให้กลไกปกติหรือการเชื่อมต่อ Geyser เสีย
3. ทดสอบ Anti-Xray ด้วยมุมมองปกติและตรวจ ore camouflage ในทั้งสามโลก
4. ทดสอบ AuctionHouse sell, cancel, buy, reconnect และ interrupted transaction ด้วยไอเทมทดสอบที่ไม่ใช่ข้อมูลผู้เล่นจริง
5. ตรวจ LuckPerms effective permissions ผ่านวิธีที่ Security Guard อนุญาตหรือ Management UI เท่านั้น

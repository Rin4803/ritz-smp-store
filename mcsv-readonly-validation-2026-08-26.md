# หลักฐานตรวจ MCSV แบบอ่านอย่างเดียว

วันที่ตรวจ: 2026-08-26

## สถานะเซิร์ฟเวอร์

เซิร์ฟเวอร์ RitzSMP สถานะ active และ runtime running บน Minecraft Java แบบ paper-geyser. ผลตรวจไม่พบข้อมูล credential ในหลักฐานนี้. ข้อมูลที่ใช้วางแผนทดสอบคือเซิร์ฟเวอร์ทำงานอยู่และพร้อมสำหรับการตรวจระบบต่อโดยไม่ต้องสั่ง restart.

## Log ล่าสุด

จาก log ล่าสุด: บูตจบด้วย `Done`, Skript โหลด 28 scripts โดยไม่รายงาน error, Essentials พบ Vault compatibility layer, DiscordSRV ล้าง slash commands เดิมของ guild สำเร็จ และมี RCON client เชื่อมต่อแล้วปิดตามปกติ. ไม่พบ error/warn ที่ยืนยันว่า Economy, RCON หรือ DiscordSRV ล้มเหลวในช่วง log ที่อ่าน.

## Plugins

ผล `plugins_list(with_state=true)` ระบุว่า EssentialsX, FoShop, DiscordSRV, Skript, LuckPerms, PlaceholderAPI, TAB, VaultUnlocked, Geyser และ Floodgate อยู่ในสถานะ enabled จาก boot ล่าสุด. `InvSee++` ถูกระบุเป็น `not_seen_in_last_boot` จึงยังไม่ควรถือว่าใช้งานได้จนกว่าจะตรวจเฉพาะระบบนั้น.

## ขอบเขต

หลักฐานนี้เป็นการอ่านอย่างเดียว ไม่ได้ส่งคำสั่ง console, ไม่แก้ไฟล์ MCSV, ไม่เปลี่ยนยอดเงิน และไม่แก้สิทธิ์ผู้เล่น. การยืนยัน `/worth`, `/sell`, `/sellall`, การเชื่อมข้อความจริง และ Music voice ยังต้องใช้บัญชีควบคุม/การยืนยันจากผู้ดูแลใน production.

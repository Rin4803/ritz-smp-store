# คู่มือตั้งค่า DiscordSRV Bridge สำหรับ RitzSMP

เอกสารนี้แยก **งานฝั่งเว็บ** ออกจาก **งานฝั่งเซิร์ฟเวอร์ Minecraft** โดยมุ่งตรวจการส่งข้อความสองทางระหว่าง Minecraft กับ Discord และการแสดงยศ/คำนำหน้าชื่ออย่างปลอดภัย

> ผลตรวจจาก MCSV ล่าสุดพบว่าเซิร์ฟเวอร์ RitzSMP อยู่ในสถานะ `active/running` และ DiscordSRV เชื่อมต่อ WebSocket ได้สำเร็จ พร้อม hook ของ LuckPerms, Essentials และ PlaceholderAPI แต่ยังไม่ถือว่าการส่งข้อความจริงผ่านจนกว่าจะทดสอบด้วยบัญชีควบคุม

## 1. สำรองและเตรียมข้อมูล

ก่อนแก้ไฟล์ ให้สร้าง backup ของ `plugins/DiscordSRV/` และ `plugins/LuckPerms/` ใน MCSV ทุกครั้ง ห้ามคัดลอก token, webhook URL, รหัสผ่าน หรือไฟล์ environment ลง GitHub หรือส่งในแชต

ข้อมูลที่ต้องเทียบกับ Discord จริงคือชื่อห้องและ Channel ID ของห้องแชทหลัก รวมถึง Role ID ของ role ที่ต้องการ map กับกลุ่ม LuckPerms แม้ค่าเหล่านี้จะมีอยู่ใน config แล้วก็ตาม

## 2. Channel mapping ที่ตรวจพบจาก MCSV

ไฟล์หลักคือ `plugins/DiscordSRV/config.yml` โดย mapping ปัจจุบันมีค่าดังนี้

```yaml
Channels:
  global: "1539202486311592016"
  join-leave: "1530761640830832721"
  deaths: "1539202951380205618"
  advancements: "1539202862373142528"
```

`global` เป็นห้องแชทหลัก ส่วนห้องอื่นใช้แจ้งเตือนเข้า-ออก ตาย และ Advancement ตามลำดับ อย่าเพิ่ม mapping ซ้ำ เพราะอาจทำให้ข้อความซ้ำหรือส่งผิดห้อง

จาก config ปัจจุบันเปิดการส่งสองทิศทางแล้ว:

```yaml
DiscordChatChannelDiscordToMinecraft: true
DiscordChatChannelMinecraftToDiscord: true
DiscordChatChannelRequireLinkedAccount: false
```

จาก log ล่าสุด DiscordSRV เชื่อมต่อและโหลดเสร็จ แต่พบ `Console channel ID was invalid` เนื่องจาก `DiscordConsoleChannelId` ยังว่าง ข้อความนี้กระทบเฉพาะการส่ง console log ไม่ใช่หลักฐานว่า `global` chat relay ผ่านแล้ว หากไม่ต้องการส่ง console ไป Discord สามารถปล่อยว่างได้

## 3. Role และ prefix synchronization

ไฟล์ `plugins/DiscordSRV/synchronization.yml` มี mapping กลุ่ม LuckPerms กับ Discord role อยู่แล้ว ได้แก่ `owner`, `admin`, `emperor`, `celestial`, `mythic`, `overlord`, `lord`, `noble`, `elite`, `knight`, `vip+` และ `vip`

ค่าการทำงานที่ตรวจพบคือ `MinecraftIsAuthoritative: true`, `OneWay: false`, `OnLink: true`, `PrimaryGroupOnly: true` และรอบ synchronization 5 นาที หมายความว่ากลุ่มจาก Minecraft เป็นแหล่งอ้างอิงหลัก และการ link บัญชีจะกระตุ้นการ sync อีกครั้ง

ตรวจให้แน่ใจว่า Discord bot มีสิทธิ์ `Manage Roles` และ role ของบอทอยู่สูงกว่า role ที่จะมอบให้ ห้ามเพิ่ม `Administrator` เพียงเพื่อแก้ role sync หากใช้เพียงการส่งข้อความและจัดการ role

รูปแบบข้อความที่ตรวจพบใน `messages.yml` คือ Minecraft ไป Discord ใช้ `%primarygroup%` และ Discord ไป Minecraft ใช้ `%toprolecolor%%toprolealias%` ดังนั้นการเห็น prefix จริงยังต้องมีการทดสอบกับสมาชิกที่ link แล้ว

## 4. Reload และตรวจ log

หลังบันทึกให้ใช้ reload ที่ปลั๊กอินรองรับ หรือ restart เซิร์ฟเวอร์ตามขั้นตอน MCSV หาก log แจ้ง `Unknown channel`, `Missing Access`, `Forbidden` หรือ token invalid ให้หยุดและแก้เฉพาะบรรทัดที่เกี่ยวข้อง อย่ารีเซ็ต config ทั้งไฟล์

| รายการตรวจ | หลักฐานที่ควรพบ |
|---|---|
| เชื่อมต่อ Discord | DiscordSRV login/connection สำเร็จโดยไม่มี token ใน log |
| ห้องแชท | channel ที่ตั้งค่าไว้ resolve ได้ |
| Minecraft → Discord | ข้อความทดสอบปรากฏครั้งเดียวในห้อง `global` |
| Discord → Minecraft | ข้อความทดสอบปรากฏครั้งเดียวในแชทเกม |
| Role sync | สมาชิกทดสอบได้รับหรือถอด role ตามกลุ่ม โดยไม่กระทบ Owner/Admin |
| Error handling | ไม่มี `Unknown channel`, `Missing Access`, `Forbidden` หรือ token invalid |

## 5. ขั้นตอนทดสอบแบบไม่กระทบผู้เล่นอื่น

ใช้บัญชี Minecraft และ Discord ของผู้ดูแลที่ได้รับอนุญาตเท่านั้น ส่งข้อความ `ทดสอบ bridge 01` จากเกม แล้วตรวจว่าปรากฏครั้งเดียวในห้อง `global` จากนั้นส่ง `ทดสอบ bridge 02` ใน Discord แล้วตรวจว่าปรากฏครั้งเดียวในเกม

ทดสอบ role/prefix กับสมาชิกทดสอบหนึ่งคน เก็บหลักฐานก่อนและหลัง แล้วคืนกลุ่ม/role เดิมทันที ห้ามใช้คำสั่งที่เปลี่ยนยอดเงิน ยศจริง inventory หรือข้อมูลผู้เล่นอื่นในการทดสอบ bridge

## 6. ขอบเขตของเว็บสโตร์

เว็บสโตร์มี server status, server-realtime, การแจ้งเตือนธุรกรรม และ player report แยกจาก DiscordSRV โดยตรง ดังนั้น TypeScript, unit tests หรือ production build ผ่าน **ไม่ใช่หลักฐาน** ว่า bridge ส่งข้อความจริงแล้ว การยืนยัน bridge ต้องอาศัยการทดสอบใน MCSV และ Discord ตามขั้นตอนด้านบน

หากไม่พบข้อความ ให้ตรวจตามลำดับ: Channel ID และชื่อห้อง, สิทธิ์ `View Channel`/`Send Messages`, DiscordSRV connection, mapping ใน `config.yml`, ลำดับ role ของบอท และ log หลัง reload/restart อย่าเปลี่ยน token หรือแก้หลายไฟล์พร้อมกัน

## 7. สถานะส่งมอบ

- [x] ตรวจพบและบันทึก channel mapping จาก MCSV
- [x] ตรวจพบ role mapping และค่าการ sync จาก MCSV
- [x] ตรวจพบ DiscordSRV เชื่อมต่อ WebSocket และ hook หลักทำงาน
- [ ] ยืนยัน Minecraft → Discord ด้วยบัญชีควบคุม
- [ ] ยืนยัน Discord → Minecraft ด้วยบัญชีควบคุม
- [ ] ยืนยัน prefix และ role mapping กับสมาชิกทดสอบ
- [ ] ตรวจ log หลัง reload/restart และเก็บเฉพาะผลที่ไม่เปิดเผยข้อมูลลับ
- [ ] ยืนยันผล production กับผู้ดูแลก่อนถือว่า bridge พร้อมใช้งาน

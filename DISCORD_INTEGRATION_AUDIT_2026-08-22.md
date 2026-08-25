# Discord Integration Audit — 2026-08-22

## ขอบเขต

เอกสารนี้บันทึกเฉพาะข้อเท็จจริงที่ตรวจพบจาก MCSV console/log และไฟล์ DiscordSRV ที่ไม่บรรจุ token เพื่อใช้ติดตามงานเชื่อม Discord ของ RitzSMP อย่างปลอดภัย

## สถานะที่ยืนยันแล้ว

| หัวข้อ | สถานะ | หลักฐาน/ข้อสังเกต |
|---|---|---|
| DiscordSRV เริ่มทำงาน | ผ่าน | ปลั๊กอินโหลดใน Minecraft หลังรีสตาร์ทขณะไม่มีผู้เล่นออนไลน์ |
| การเข้าสู่ระบบ DiscordSRV | ผ่าน | หลังผู้ใช้รีเซ็ตและวาง Bot Token ของ `BOT CHAT` ใน `plugins/DiscordSRV/config.yml` หลัก log ยืนยันการเชื่อมต่อกับ Discord สำเร็จ |
| Discord server ที่บอทเห็น | ผ่าน | log หลังบูตยืนยันว่าบอทพบ Discord server อย่างน้อยหนึ่งแห่ง |
| เศรษฐกิจ/ยศที่ DiscordSRV hook ได้ | ผ่านเบื้องต้น | log ยืนยันการ hook กับ Vault; ต้องทดสอบ prefix/yศจริงด้วยบัญชีควบคุม |
| แจ้งเหตุการณ์ Minecraft | ตั้งค่าอยู่ | `alerts.yml` และ `messages.yml` มีโครงสร้างสำหรับเข้า–ออก, ตาย และ Advancement; ยังต้องยืนยัน channel mapping และส่งจริง |
| แชท Minecraft ↔ Discord | รอ mapping/ทดสอบ | ยังไม่มีหลักฐาน end-to-end สำหรับข้อความสองทิศทาง |
| ยศในข้อความ Discord และยศ Discord ในเกม | รอ mapping/ทดสอบ | ต้องตรวจ format/prefix และ role synchronization หลังตั้ง role mapping ที่ตั้งใจ |
| แจ้งเติมเงิน/ซื้อยศจากเว็บ | รอทดสอบเส้นทางจริง | เว็บมีโค้ดแจ้งเตือน Discord แต่ต้องแยกช่องธุรกรรมจากช่องแชทเกมและทดสอบแบบไม่สร้างธุรกรรมจริง |

## บทบาทบอทที่แนะนำ

| แอป Discord | บทบาท | Runtime ที่ต้องใช้ |
|---|---|---|
| `AI test` | คำสั่ง AI และแจ้งเตือนธุรกรรมจากเว็บ | บริการ Node.js บน VPS |
| `Music test` | คำสั่งเพลงและ voice playback | บริการ Node.js บน VPS แยก process |
| `BOT CHAT` | DiscordSRV Bridge สำหรับแชท Minecraft, prefix/yศ และเหตุการณ์เกม | ปลั๊กอิน DiscordSRV ภายใน Minecraft/MCSV |

> ห้ามใช้ Bot Token เดียวกันใน runtime พร้อมกันมากกว่าหนึ่งตัว เช่น ห้ามใช้ token ของ `Music test` ทั้งกับ music bot บน VPS และ DiscordSRV ใน Minecraft พร้อมกัน

## ลำดับงานที่เหลือ

1. ระบุและตั้งค่า channel mapping สำหรับแชทเกมและเหตุการณ์เกมใน `plugins/DiscordSRV/config.yml` โดยไม่เปิดเผย Bot Token
2. ทดสอบข้อความ Minecraft → Discord และ Discord → Minecraft ด้วยบัญชีควบคุม
3. ตั้ง/ตรวจ role mapping ที่อนุญาต และยืนยันว่าข้อความแสดง prefix/yศ Minecraft ที่ถูกต้อง
4. ตรวจ channel สำหรับแจ้งเตือนเติมเงินและซื้อยศจากเว็บ แล้วทำ smoke test ที่ไม่เปลี่ยนยอดเงินจริง
5. ทำคู่มือแยกไฟล์ MCSV/VPS/เว็บ พร้อมคำสั่งตรวจ log และข้อห้ามเรื่อง token

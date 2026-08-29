# ข้อค้นพบ AuthMeUI ทางการ — 29 สิงหาคม 2026

## แหล่งข้อมูล

1. README ของ source ทางการ: https://github.com/TejasLamba2006/AuthMeUI
2. Release 1.3.4 บน Modrinth: https://modrinth.com/plugin/authmeui/version/1.3.4

## ข้อเท็จจริงที่ยืนยันได้

README ระบุว่า AuthMeUI รองรับ Configuration Phase Mode (Pre-Join) และเปิดใช้งานด้วย `dialogs.use-configuration-phase: true` โดยผู้เล่นจะต้องยืนยันตัวตนก่อนเข้าร่วมเซิร์ฟเวอร์อย่างสมบูรณ์.

Modrinth ระบุว่า AuthMeUI 1.3.4 รองรับ Minecraft Java Edition 1.21.x และ Paper รวมถึงมีการแก้ handler ของปุ่ม forgot password ในทั้ง game phase และ configuration phase.

## ข้อจำกัดที่ยังต้องตรวจบนเซิร์ฟจริง

เอกสารทางการที่ตรวจรอบนี้ไม่ได้ยืนยันว่า AuthMeUI มี option เฉพาะสำหรับแยก Java กับ Bedrock หรือมี Floodgate bypass ในตัว ดังนั้นห้ามเปิด configuration phase แบบถาวรจนกว่าจะตรวจ source/config/plugin log และทำ live test กับทั้ง Java และ Bedrock. ค่าที่ชื่อ `configuration-phase-respect-authme-sessions`, `configuration-phase-fastlogin-compatibility` และ `configuration-phase-deferred-login-check-delay-ticks` ในไฟล์บน MCSV ต้องถือเป็นค่าที่ต้องตรวจ implementation ไม่ใช่หลักฐานว่า plugin รองรับจริง.

สถานะ `/nv` ในไฟล์บน MCSV เป็น marker ปิดระบบแล้ว และต้องล้างการอ้างอิงใน script อื่นต่อไป.

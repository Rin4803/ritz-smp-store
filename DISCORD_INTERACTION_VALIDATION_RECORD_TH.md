# บันทึกการตั้งค่า Discord Interaction Endpoint

## ข้อมูลที่ตรวจพบ

วันที่ตรวจสอบ: 25 สิงหาคม 2026

| รายการ | ค่า/สถานะ |
|---|---|
| Application ที่เลือก | `AI test` (RitzSMP AI) |
| Application ID | `1539911381069864980` |
| Interactions Endpoint ก่อนแก้ | `https://nice-example.local/api/interactions` |
| Endpoint ที่ตั้งสำเร็จ | `https://ritzsmpstore-94jhsfkx.manus.space/api/discord/interactions` |
| การยืนยันลายเซ็น | เว็บตรวจ Ed25519 ด้วย `DISCORD_AI_PUBLIC_KEY` ที่เก็บในช่องลับ |

## ขอบเขตความปลอดภัย

บันทึกนี้ไม่บันทึก Bot Token, DiscordSRV BOT CHAT token หรือค่า secret อื่นใด และการแก้ไขมีผลเฉพาะ application AI เดิมเท่านั้น ไม่กระทบ Music bot หรือ BOT CHAT/DiscordSRV bridge

## เกณฑ์การยืนยันหลังบันทึก

Discord ต้องส่ง PING ถึง endpoint และยอมรับ URL ได้ก่อน จึงจะเริ่มทดสอบปุ่มเชื่อมบัญชีจาก Discord จริง

## ผลการตั้งค่าเมื่อ 25 สิงหาคม 2026

Discord Developer Portal ปฏิเสธการบันทึก endpoint เดิมพร้อมข้อความว่า `interactions_endpoint_url: The specified interactions endpoint url could not be verified.` การตรวจ production พบว่าเส้นทางเดิมถูกส่งกลับเป็นหน้าเว็บ จึงย้าย endpoint ไปยัง prefix API ที่ production ส่งถึง Express ได้

หลังตั้ง URL ใหม่ `https://ritzsmpstore-94jhsfkx.manus.space/api/trpc/discord.interactions` แล้ว Discord ยังคงปฏิเสธด้วยข้อความเดิม การตรวจ production พบว่า tRPC รับเส้นทางดังกล่าวก่อน handler เฉพาะ จึงเปลี่ยนเป็น URL ตรง `https://ritzsmpstore-94jhsfkx.manus.space/api/discord/interactions` ที่ production ส่งถึง Express ได้แล้ว

จากนั้นจึงตั้ง URL ตรง `https://ritzsmpstore-94jhsfkx.manus.space/api/discord/interactions` ในหน้า General Information ของ application AI เดิม และ Discord Developer Portal แสดงข้อความว่า **บันทึกการแก้ไขเรียบร้อยแล้ว** เมื่อเวลา 06:22 น. (GMT+7) ซึ่งเป็นผลการยอมรับ URL หลังการตรวจ interaction endpoint ของ Discord

ได้ยืนยันเพิ่มเมื่อเวลา 06:26 น. (GMT+7) ว่าคำขอ POST ที่ไม่มีลายเซ็นไปยัง URL production ตอบ `401` แบบ JSON ตามที่ตั้งใจไว้ จึงไม่ยอมรับคำขอปลอม การเรียกดู production log ในช่วงนี้ไม่สำเร็จเพราะบริการ log รายงานว่าไม่พบ Cloud Run service จึงไม่ใช้ผลดังกล่าวเพื่อสรุปสถานะ endpoint

## ผลทดสอบปุ่มจริง

ผู้ดูแลกดปุ่ม `🔗 เชื่อมบัญชี` ในห้อง `#🔗│ระบบเชื่อมบัญชี` เมื่อวันที่ 25 สิงหาคม 2026 และ RitzSMP AI ตอบกลับเป็นข้อความเฉพาะผู้ใช้พร้อมรหัสยืนยัน Minecraft ที่มีอายุจำกัด จึงยืนยันได้ว่าปุ่มเดิมเรียก Discord Interaction endpoint ใหม่และระบบสร้างรหัสทำงานจริงแล้ว บันทึกนี้ไม่เก็บหรือพิมพ์รหัสยืนยันดังกล่าวซ้ำ

ขั้นตอนที่ยังต้องยืนยันคือผู้ทดสอบนำรหัสที่ได้รับไปใช้คำสั่ง `/verify <รหัส 4 หลัก>` ใน Minecraft ก่อนเวลาหมดอายุ แล้วตรวจว่าบัญชีเชื่อมสำเร็จ กระบวนการปุ่มและการออกโค้ดไม่ต้องพึ่ง Discord Gateway แบบค้างบน autoscale เพราะใช้ HTTP interaction endpoint ที่ Discord ตรวจสอบลายเซ็นโดยตรง

## การวิเคราะห์ผลที่ `/verify` ปฏิเสธรหัส

ผลทดสอบจริงพบว่า Minecraft ตอบว่า “รหัสไม่ถูกต้อง หรือรหัสหมดอายุแล้ว” แม้ปุ่ม Discord จะออกโค้ดสำเร็จ สาเหตุที่ยืนยันได้จากการอ่าน `/plugins/Skript/scripts/verify.sk` คือคำสั่ง `/verify` ใน Minecraft รับเฉพาะตัวแปร Skript `pending_codes::<code>` ซึ่งถูกสร้างได้จากคำสั่ง console `/getcode <Discord ID>` เท่านั้น ขณะที่ปุ่ม Discord HTTP interaction สร้างรหัสผ่าน `createDiscordVerificationCode(userId)` ของเว็บสโตร์ จึงเก็บอยู่คนละระบบและไม่มีการส่งต่อเข้าสู่ `pending_codes` ของ Skript

ดังนั้นปุ่มและลายเซ็น Discord ทำงานถูกต้อง แต่การเชื่อมบัญชีแบบครบลำดับยังไม่สำเร็จจนกว่าจะเพิ่มจุดเชื่อมที่ปลอดภัยระหว่างเว็บสโตร์กับคำสั่ง Minecraft เดิม โดยคงคำสั่ง `discordsrv force-link` และไม่แก้ DiscordSRV bridge หรือ token.

## การเชื่อม RCON และการปรับรหัสให้เป็นแหล่งเดียว

ได้ตั้งค่าการเชื่อมต่อ RCON ผ่าน secret store แล้ว และผ่านการทดสอบคำสั่ง `list` แบบอ่านอย่างเดียวสำเร็จเมื่อวันที่ 25 สิงหาคม 2026 โดยไม่แก้ไฟล์ MCSV หรือรีสตาร์ตเซิร์ฟเวอร์

ปุ่ม `🔗 เชื่อมบัญชี` ถูกปรับให้เรียก `getcode <Discord user ID>` ผ่าน RCON ซึ่งเป็นคำสั่ง Skript เดิมที่ `/verify` ใช้ จึงคืนรหัสใหม่หรือรหัสที่รอใช้อยู่จากแหล่งเดียวกัน การทดสอบ TypeScript, Vitest และ production build ผ่านแล้ว โดยยังต้องทดสอบกดปุ่มและใช้ `/verify` หลังเผยแพร่เวอร์ชันนี้ ห้ามบันทึกหรือส่งรหัสที่ได้จากการทดสอบในแชต

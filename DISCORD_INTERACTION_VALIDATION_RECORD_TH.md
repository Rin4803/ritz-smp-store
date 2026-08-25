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

ได้ยืนยันเพิ่มว่าคำขอ POST ที่ไม่มีลายเซ็นไปยัง URL production ตอบ `401` แบบ JSON ตามที่ตั้งใจไว้ จึงไม่ยอมรับคำขอปลอม การทดสอบปุ่มจริงจากห้องเชื่อมบัญชียังทำต่อไม่ได้ เพราะ Discord client ใน browser session แสดงข้อผิดพลาดการเชื่อมต่อและไม่โหลดเนื้อหาห้อง จึงยังไม่อ้างว่ากระบวนการออกโค้ดเชื่อมบัญชีสำเร็จ

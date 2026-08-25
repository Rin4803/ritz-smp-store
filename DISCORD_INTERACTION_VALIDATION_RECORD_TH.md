# บันทึกการตั้งค่า Discord Interaction Endpoint

## ข้อมูลที่ตรวจพบ

วันที่ตรวจสอบ: 25 สิงหาคม 2026

| รายการ | ค่า/สถานะ |
|---|---|
| Application ที่เลือก | `AI test` (RitzSMP AI) |
| Application ID | `1539911381069864980` |
| Interactions Endpoint ก่อนแก้ | `https://nice-example.local/api/interactions` |
| Endpoint ที่ต้องตั้ง | `https://ritzsmpstore-94jhsfkx.manus.space/api/trpc/discord.interactions` |
| การยืนยันลายเซ็น | เว็บตรวจ Ed25519 ด้วย `DISCORD_AI_PUBLIC_KEY` ที่เก็บในช่องลับ |

## ขอบเขตความปลอดภัย

บันทึกนี้ไม่บันทึก Bot Token, DiscordSRV BOT CHAT token หรือค่า secret อื่นใด และการแก้ไขมีผลเฉพาะ application AI เดิมเท่านั้น ไม่กระทบ Music bot หรือ BOT CHAT/DiscordSRV bridge

## เกณฑ์การยืนยันหลังบันทึก

Discord ต้องส่ง PING ถึง endpoint และยอมรับ URL ได้ก่อน จึงจะเริ่มทดสอบปุ่มเชื่อมบัญชีจาก Discord จริง

## ผลการตั้งค่าเมื่อ 25 สิงหาคม 2026

Discord Developer Portal ปฏิเสธการบันทึก endpoint เดิมพร้อมข้อความว่า `interactions_endpoint_url: The specified interactions endpoint url could not be verified.` การตรวจ production พบว่าเส้นทางเดิมถูกส่งกลับเป็นหน้าเว็บ จึงย้าย endpoint ไปยัง prefix API ที่ production ส่งถึง Express ได้ การตั้งค่ายัง **ไม่ถูกบันทึก** จนกว่า Discord จะตรวจ PING ของ URL ใหม่ผ่าน

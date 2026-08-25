# บันทึกการตั้งค่า Discord Interaction Endpoint

## ข้อมูลที่ตรวจพบ

วันที่ตรวจสอบ: 25 สิงหาคม 2026

| รายการ | ค่า/สถานะ |
|---|---|
| Application ที่เลือก | `AI test` (RitzSMP AI) |
| Application ID | `1539911381069864980` |
| Interactions Endpoint ก่อนแก้ | `https://nice-example.local/api/interactions` |
| Endpoint ที่ต้องตั้ง | `https://ritzsmpstore-94jhsfkx.manus.space/api/discord/interactions` |
| การยืนยันลายเซ็น | เว็บตรวจ Ed25519 ด้วย `DISCORD_AI_PUBLIC_KEY` ที่เก็บในช่องลับ |

## ขอบเขตความปลอดภัย

บันทึกนี้ไม่บันทึก Bot Token, DiscordSRV BOT CHAT token หรือค่า secret อื่นใด และการแก้ไขมีผลเฉพาะ application AI เดิมเท่านั้น ไม่กระทบ Music bot หรือ BOT CHAT/DiscordSRV bridge

## เกณฑ์การยืนยันหลังบันทึก

Discord ต้องส่ง PING ถึง endpoint และยอมรับ URL ได้ก่อน จึงจะเริ่มทดสอบปุ่มเชื่อมบัญชีจาก Discord จริง

## ผลการตั้งค่าเมื่อ 25 สิงหาคม 2026

Discord Developer Portal ปฏิเสธการบันทึก endpoint พร้อมข้อความว่า `interactions_endpoint_url: The specified interactions endpoint url could not be verified.` ดังนั้นการตั้งค่ายัง **ไม่ถูกบันทึก** และยังไม่มีการส่ง interaction ของผู้เล่นมายังเว็บ ต้องแก้ endpoint ให้ตอบ PING ตามรูปแบบของ Discord ก่อนลองบันทึกใหม่

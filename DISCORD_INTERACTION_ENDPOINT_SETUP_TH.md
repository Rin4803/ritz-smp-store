# ตั้งค่า Discord Interaction Endpoint สำหรับ RitzSMP AI

เอกสารนี้ใช้สำหรับทำให้ปุ่ม **เชื่อมบัญชี**, **ยกเลิกรหัส** และ **ยกเลิกการเชื่อมต่อ** ของ RitzSMP AI ตอบสนองได้แม้หน้าเว็บรันบน Autoscale ซึ่งไม่เหมาะกับการเปิด Discord Gateway ค้างไว้ตลอดเวลา

## สถานะโค้ด

โครงการมี endpoint ที่ `POST /api/discord/interactions` แล้ว โดยตรวจลายเซ็น Ed25519 ของ Discord ก่อนอ่านข้อความทุกครั้ง และตอบ `PING` ตามข้อกำหนดของ Discord การกดปุ่มเชื่อมบัญชีจะสร้างรหัส `/verify` จากระบบเดิมโดยไม่แตะ Economy, ห้อง Discord หรือการตั้งค่า DiscordSRV

| รายการ | ค่า/สถานะ |
|---|---|
| URL ที่ต้องนำไปตั้งค่า | `https://ritzsmpstore-94jhsfkx.manus.space/api/discord/interactions` |
| ตัวแปรที่ต้องมี | `DISCORD_AI_PUBLIC_KEY` |
| ตำแหน่ง public key | Discord Developer Portal → application ของ RitzSMP AI → **General Information** |
| การรับ interaction | HTTP endpoint แทนการใช้ Gateway สำหรับ application เดียวกัน |
| ปุ่มที่รองรับแล้ว | เชื่อมบัญชี, ยกเลิกรหัส, ยกเลิกการเชื่อมต่อ และ `/verify` |

> ห้ามใส่ `DISCORD_AI_BOT_TOKEN`, `DISCORD_MUSIC_BOT_TOKEN` หรือ token ของ BOT CHAT ลงในช่อง **Public Key** เพราะเป็นคนละค่ากันโดยสิ้นเชิง

## ขั้นตอนดำเนินการ

1. เปิด Discord Developer Portal และลงชื่อเข้าใช้ด้วยบัญชีเจ้าของ application ของ **RitzSMP AI**
2. เลือก application ของ AI bot เดิม ห้ามสร้าง application ใหม่
3. ที่หน้า **General Information** คัดลอกเฉพาะค่า **Public Key** และเพิ่มเป็น `DISCORD_AI_PUBLIC_KEY` ผ่านช่อง Secret ของโครงการ
4. วาง URL ในตารางข้างต้นลงในช่อง **Interactions Endpoint URL** แล้วบันทึก Discord จะส่งคำขอ PING มาตรวจทันที
5. กดปุ่มเชื่อมบัญชีจากข้อความเดิมใน Discord แล้วตรวจว่าระบบส่งรหัส 4 หลักแบบเฉพาะผู้กดหรือไม่
6. เข้า Minecraft และพิมพ์ `/verify <รหัส>` เพื่อตรวจการเชื่อมต่อปลายทาง

หาก Discord ไม่ยอมบันทึก endpoint ให้ตรวจว่า Public Key ถูกตั้งใน Secret แล้วและเว็บเวอร์ชันที่มี endpoint นี้ถูกเผยแพร่ก่อน จากนั้นจึงลองบันทึกใหม่ โดยไม่ต้องเปลี่ยน BOT CHAT token หรือ channel mapping ของ DiscordSRV

## ขอบเขตที่ยังต้องใช้ runtime ต่อเนื่อง

endpoint นี้แก้ปุ่มเชื่อมบัญชีที่ผู้ใช้แจ้งโดยตรง แต่คำสั่ง AI ที่ใช้ Gateway ต่อเนื่อง, การจัด role แบบเรียลไทม์, ระบบเพลง และ voice audio ยังต้องใช้ runtime ถาวรแยกต่างหาก จึงไม่ควรอ้างว่าพร้อมใช้งานจนกว่าจะทดสอบบน runtime ดังกล่าวจริง

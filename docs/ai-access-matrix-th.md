# ตารางสิทธิ์และการเข้าถึงสำหรับ AI

## หลักการ

AI ควรเข้าถึง **โค้ดและเอกสารได้เต็มที่** แต่เข้าถึงการกระทำที่กระทบระบบจริงแบบจำกัดและตรวจสอบย้อนกลับได้

| พื้นที่ | AI ควรทำได้ | วิธีเข้าถึง | ข้อจำกัด |
|---|---|---|---|
| Source code | อ่าน, แก้, test, สร้าง branch/PR | GitHub Private | ห้าม commit secret |
| Git history | อ่าน commit/diff | GitHub | ห้ามลบประวัติโดยพลการ |
| Web preview | เปิดดูและทดสอบแบบไม่ทำธุรกรรมจริง | Preview/public URL | ห้ามใช้บัญชีหรือยอดเงินจริง |
| Web production | ดู health/log และ deploy ที่ผ่าน validation | Hosting connector/CI | ต้องมี approval สำหรับ production deploy ถ้าเปลี่ยน behavior สำคัญ |
| Database | อ่าน schema/รายงานที่ลดข้อมูลส่วนบุคคล | migration/test fixtures | ห้าม dump ฐานข้อมูลจริงลง GitHub |
| Discord AI Bot | ดู log, ตรวจ command, แก้ source | runtime + secret manager | token ไม่อยู่ใน repo; จำกัด channel/role |
| DiscordSRV | ดู/แก้ config และ log บน MCSV | MCSV connector | backup ก่อนเขียน; ห้ามแสดง token |
| Minecraft | ตรวจ plugin/config/log และแก้ตามงาน | MCSV | คำสั่งลบโลก/ข้อมูลต้องอนุมัติแยก |
| Secrets | ใช้ผ่าน runtime เท่านั้น | Secret Manager / environment | AI ไม่ควรอ่านค่า plaintext หรือพิมพ์ค่าออก log |
| Billing/account security | ไม่มีสิทธิ์อัตโนมัติ | ผู้ใช้ทำเอง | ห้ามเปลี่ยน billing, owner, MFA, repo visibility โดยไม่มีอนุมัติ |

## รายชื่อ secret ที่ใช้เป็นชื่อเท่านั้น

- `DISCORD_AI_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DATABASE_URL`
- `JWT_SECRET`
- `RCON_HOST`
- `RCON_PORT`
- `RCON_PASSWORD`
- `BUILT_IN_FORGE_API_KEY`
- `DISCORD_*_CHANNEL_ID`

ค่าเหล่านี้ต้องอยู่ใน GitHub Actions Secrets, hosting Secret Manager หรือ `.env` บนเครื่อง runtime ที่มีสิทธิ์ `600` เท่านั้น

## การให้ AI ตัวอื่นเข้าถึง

1. ให้ AI อ่าน repository Private ผ่าน GitHub App/OAuth ที่มีสิทธิ์ Contents Read/Write ตามจำเป็น
2. เปิด Pull Request เป็นค่าเริ่มต้น
3. ให้สิทธิ์ Actions เฉพาะ workflow ที่จำเป็น
4. ตั้ง Environment `production` ให้มี review ก่อน deploy
5. แยก secret ระหว่าง preview และ production
6. ห้ามแชร์ personal access token ในเอกสารหรือแชต

## สิ่งที่เอกสารนี้ไม่รับรอง

การเห็น source code ไม่ได้แปลว่า AI ควบคุม runtime ได้ และการมี token ใน environment ไม่ได้แปลว่า bot online ต้องตรวจ process, container, health endpoint และ log จริงทุกครั้ง

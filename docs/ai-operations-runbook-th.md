# AI Operations Runbook — RitzSMP

## ตรวจสถานะก่อนทำงาน

```bash
git status --short --branch
ps -ef | grep -Ei 'discord|node|tsx' | grep -v grep
curl -fsS http://127.0.0.1:3000/healthz
```

บน runtime ที่มี Docker:

```bash
docker compose ps
docker compose logs --since=10m app
docker compose logs --since=10m ai-bot
```

บน MCSV ให้ใช้ server overview, plugins list และ startup logs ตามลำดับ ห้ามสรุปจากไฟล์ source เพียงอย่างเดียว

## แก้เว็บ

1. สร้าง branch ชื่อ `fix/<คำอธิบายสั้น>`
2. แก้ source และเพิ่ม/ปรับ test
3. รัน `pnpm check`, `pnpm test`, `pnpm build`, `git diff --check`
4. ตรวจ secret scan
5. สร้าง PR พร้อมสรุปผลและ rollback

## แก้ AI Bot

ไฟล์หลัก:

- `server/discordAiBot.ts`
- `server/discordAiBotCommands.ts` ถ้ามี
- `server/discordAiCommandRegistry.ts`
- `server/discordNotifications.ts`
- `server/discordInteractions.ts`

ห้ามแก้ token ใน source ให้แก้ผ่าน secret manager แล้ว restart เฉพาะ service ที่เกี่ยวข้อง

## แก้ DiscordSRV/Minecraft

1. ตรวจผู้เล่นออนไลน์และสถานะ server
2. สร้าง backup ผ่าน MCSV
3. อ่าน config ปัจจุบันและ log ล่าสุด
4. แก้เฉพาะ anchor ที่เกี่ยวข้อง
5. restart/reload ตาม plugin ที่รองรับ
6. อ่าน startup log และทดสอบด้วยบัญชีควบคุม
7. บันทึก backup ID, เวลา และผลทดสอบในเอกสารภาษาไทย

## Rollback

- โค้ด: revert PR หรือ rollback checkpoint
- Docker: ใช้ image/commit ก่อนหน้า ห้าม `down -v`
- Config Minecraft: restore backup จาก MCSV
- Database: ใช้ migration rollback/backup ที่ตรวจสอบแล้วเท่านั้น

## เหตุการณ์ที่ต้องหยุดทันที

- token/password ปรากฏใน output
- พบ 401/403 จาก Discord หรือ GitHub
- database migration จะลบ/เปลี่ยนข้อมูลเดิม
- ต้องลบโลก, ผู้เล่น, ออเดอร์ หรือไฟล์ backup
- ต้องเปลี่ยน owner, billing, role สูง หรือ security settings
- MCSV server suspended/offline จนตรวจ live ไม่ได้

## รูปแบบรายงานงาน

```text
ขอบเขต:
สิ่งที่ตรวจ:
สิ่งที่แก้:
ไฟล์/commit:
Validation:
ผล live ที่ยืนยันได้:
สิ่งที่ยังยืนยันไม่ได้:
Rollback:
```

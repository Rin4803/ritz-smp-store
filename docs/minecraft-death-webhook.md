# Minecraft Death Webhook

ระบบ RitzSMP รับเหตุการณ์ผู้เล่นเสียชีวิตที่ `POST /api/minecraft/death` แล้วส่ง Embed ไปยังช่อง Discord `server-chat` ผ่าน `DISCORD_CHAT_CHANNEL_ID`.

## การยืนยันตัวตน

ส่ง HTTP header ดังนี้:

```http
Authorization: Bearer <BUILT_IN_FORGE_API_KEY>
```

หากตั้งค่า `DISCORD_MINECRAFT_WEBHOOK_SECRET` ระบบจะใช้ค่านี้แทน ซึ่งเหมาะกับการสร้าง secret แยกสำหรับปลั๊กอิน Minecraft โดยเฉพาะ

## JSON payload

```json
{
  "playerName": "RitzWarrior",
  "message": "ถูกซอมบี้ฆ่าตาย",
  "occurredAt": "2026-08-26T08:00:00.000Z"
}
```

`playerName` ต้องมีความยาว 1–64 ตัวอักษร และ `message` ต้องมีความยาว 1–900 ตัวอักษร ระบบจะตัด whitespace และตรวจวันที่ `occurredAt` หากส่งมา การตอบกลับ `202` หมายถึงรับ event และส่งต่อไป Discord สำเร็จ ส่วน `401`, `400` และ `502` หมายถึงยืนยันตัวตนไม่ผ่าน ข้อมูลไม่ถูกต้อง หรือ Discord ส่งข้อความไม่สำเร็จตามลำดับ

## ตัวอย่างคำสั่งทดสอบจากเครื่องเซิร์ฟเวอร์

```bash
curl -X POST "https://<ritzsmp-domain>/api/minecraft/death" \
  -H "Authorization: Bearer <WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  --data '{"playerName":"RitzWarrior","message":"ถูกซอมบี้ฆ่าตาย"}'
```

ปลั๊กอินหรือสคริปต์ Minecraft ต้องเป็นผู้เรียก endpoint นี้เมื่อได้รับ death event จริง ระบบเว็บจะไม่สร้างเหตุการณ์การตายจากการ polling สถานะออนไลน์เอง

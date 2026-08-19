# คู่มือการติดตั้งและใช้งาน RitzSMP Discord-Only Store

คู่มือนี้จัดทำขึ้นเพื่อช่วยให้คุณตั้งค่าบอทและช่องร้านค้าภายใน Discord ของเซิร์ฟเวอร์ RitzSMP ได้อย่างสมบูรณ์แบบโดยไม่ต้องพึ่งพาหน้าเว็บไซต์ภายนอก

## 1. การสร้างและตั้งค่า Discord Bot

1. เข้าไปที่ [Discord Developer Portal](https://discord.com/developers/applications)
2. กด **New Application** ตั้งชื่อว่า `RitzSMP Store Bot`
3. ไปที่เมนู **Bot** ด้านซ้าย:
   - กด **Reset Token** แล้วคัดลอก Token เก็บไว้เป็นความลับ (`DISCORD_BOT_TOKEN`)
   - เปิดใช้งาน **Message Content Intent** และ **Server Members Intent** ด้านล่างสุด
4. ไปที่เมนู **OAuth2 → URL Generator**:
   - เลือก Scopes: `bot`, `applications.commands`
   - เลือก Bot Permissions: `Manage Channels`, `Send Messages`, `Manage Messages`, `Embed Links`, `Attach Files`, `Read Message History`, `Use Slash Commands`
   - คัดลอก URL ด้านล่างไปเปิดในเบราว์เซอร์เพื่อเชิญบอทเข้าเซิร์ฟเวอร์ RitzSMP

## 2. โครงสร้างช่องและ Role ที่แนะนำ

- **หมวดหมู่:** `🛒 ── RITZSMP STORE ──`
- **ช่องสำหรับผู้ซื้อ:** `#shop` (ใช้สำหรับกดปุ่มเลือกยศและแสดงคำแนะนำการโอนเงิน)
- **ช่องสำหรับแอดมิน:** `#admin-orders` (ตั้งค่าให้มองเห็นเฉพาะ Role `Store Admin` เท่านั้น เพื่อใช้ตรวจสลิปและกดปุ่มอนุมัติ/ปฏิเสธ)
- **Role สำหรับแอดมิน:** `Store Admin` (กำหนดให้ทีมงานที่มีสิทธิ์ตรวจสอบสลิปและมอบยศ)

## 3. รายการตัวแปรที่ต้องใช้ในระบบ

เมื่อคุณพร้อมเปิดใช้งานบอท กรุณาเตรียมข้อมูลดังนี้ให้พร้อม:
- `DISCORD_BOT_TOKEN`: Token ของบอท
- `DISCORD_GUILD_ID`: Server ID ของ RitzSMP
- `DISCORD_STORE_CHANNEL_ID`: Channel ID ของช่อง `#shop`
- `DISCORD_ORDERS_CHANNEL_ID`: Channel ID ของช่อง `#admin-orders`
- `DISCORD_ADMIN_ROLE_ID`: Role ID ของ `Store Admin`
- `RCON_HOST`, `RCON_PORT`, `RCON_PASSWORD`: ข้อมูลเชื่อมต่อ RCON ของเซิร์ฟเวอร์ Minecraft (ถ้ามี)

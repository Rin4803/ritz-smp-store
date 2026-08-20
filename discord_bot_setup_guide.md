# คู่มือการตั้งค่า Discord Bot และช่องประกาศโดเนท (RitzSMP)

คู่มือนี้อธิบายวิธีตั้งค่า Environment Variables และการแก้ไขปัญหา Token ของ Discord Bot เพื่อให้ระบบสามารถโพสต์และอัปเดตประกาศในห้อง `#โดเนท` อัตโนมัติ

---

## 1. ตัวแปรสภาพแวดล้อม (Environment Variables) ที่จำเป็น
ในการเชื่อมต่อบอทและการโพสต์ประกาศใน Discord เซิร์ฟเวอร์ คุณต้องกำหนดค่าตัวแปรเหล่านี้:

- `DISCORD_BOT_TOKEN`: Token ของ Discord Bot ตัวจริงที่สร้างจาก Discord Developer Portal (ต้องระวังไม่ให้มีช่องว่างหรือ Token เก่าที่ถูกรีเซ็ตแล้ว)
- `DISCORD_GUILD_ID`: ID ของเซิร์ฟเวอร์ Discord หลัก
- `DISCORD_DONATE_CHANNEL_ID`: ID ของห้อง `#โดเนท` ที่ต้องการให้บอทโพสต์ข้อความแนะนำการเติมเงินและซื้อยศ
- `DISCORD_STORE_CHANNEL_ID`: ID ของห้องแสดงปุ่มสั่งซื้อยศ (Store Panel)

---

## 2. วิธีการแก้ไขปัญหา `DiscordjsError [TokenInvalid]`
หากใน Log ปรากฏข้อผิดพลาด `TokenInvalid`:
1. ไปที่ [Discord Developer Portal](https://discord.com/developers/applications)
2. เลือกบอทของคุณ ไปที่แท็บ **Bot**
3. กดปุ่ม **Reset Token** เพื่อสร้าง Token ใหม่
4. คัดลอก Token ใหม่แล้วนำไปอัปเดตในระบบความลับ (Secrets) ของโปรเจกต์ (Key: `DISCORD_BOT_TOKEN`)
5. รีสตาร์ทเซิร์ฟเวอร์เพื่อให้บอทเชื่อมต่อด้วย Token ใหม่

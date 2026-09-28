# คู่มือรันระบบ RitzSMP บน VPS

เอกสารนี้อธิบายการรัน **เว็บสโตร์** และ **RitzSMP AI Bot** เป็นบริการแยกกันด้วย Docker โดย **DiscordSRV** จะรันบนเครื่อง Minecraft/MCSV แยกต่างหาก

| บริการ | Container | หน้าที่ |
|---|---|---|
| เว็บสโตร์ | `app` | หน้าเว็บ, Wallet, ออเดอร์ และการแจ้งเตือนผ่าน Discord API |
| AI Bot | `ai-bot` | คำสั่ง AI/ผู้ดูแล และการแจ้งเตือนร้านค้า |
| Minecraft Bridge | DiscordSRV บนเซิร์ฟเวอร์ Minecraft | แชต Minecraft↔Discord, event และ role/group sync |

> ระบบ Music Bot ถูกนำออกจากโปรเจกต์แล้ว ไม่มี service, token, command หรือ process สำหรับเพลงเหลืออยู่

## 1. เตรียม VPS

ใช้ Linux ที่รัน Docker Engine และ Docker Compose v2 ได้ จากนั้น clone โปรเจกต์ไปยัง VPS เช่น `/opt/ritz-smp-store`

```bash
cd /opt/ritz-smp-store
cp env.template .env
chmod 600 .env
nano .env
```

กรอกเฉพาะค่าจริงใน `.env` เท่านั้น ห้าม commit ไฟล์นี้เข้า Git

| กลุ่ม | ตัวแปรสำคัญ |
|---|---|
| AI Bot | `DISCORD_AI_BOT_TOKEN`, `DISCORD_GUILD_ID` |
| Discord channels | `DISCORD_*_CHANNEL_ID` ตามห้องที่ใช้งานจริง |
| เว็บ/ฐานข้อมูล | `DATABASE_URL`, `JWT_SECRET` หรือค่าที่ Compose กำหนด |
| Minecraft | `RCON_HOST`, `RCON_PORT`, `RCON_PASSWORD` |

## 2. Build และเริ่มบริการ

```bash
docker compose config >/tmp/ritz-compose-resolved.yml
docker compose up -d --build --remove-orphans
docker compose ps
```

ควรพบเฉพาะ service หลัก:

```text
db
app
ai-bot
```

## 3. ตรวจการทำงาน

```bash
docker compose logs --since=10m app
docker compose logs --since=10m ai-bot
curl http://127.0.0.1:3000/healthz
```

การอัปเดตโค้ด:

```bash
git pull origin main
docker compose up -d --build --remove-orphans
```

## 4. ความปลอดภัย

- ห้ามใช้ token เดียวกันกับ DiscordSRV และ AI Bot
- ห้ามวาง token, RCON password หรือฐานข้อมูลใน GitHub
- ให้ไฟล์ `.env` เป็นสิทธิ์ `600`
- ไม่ให้ AI Bot มีสิทธิ์ `Administrator` หากไม่จำเป็น
- ให้ AI Bot เห็นและส่งข้อความเฉพาะห้องที่เกี่ยวข้อง
- อย่าใช้ `docker compose down -v` เพราะอาจลบข้อมูลฐานข้อมูล

DiscordSRV ตั้งค่าแยกอยู่บน Minecraft host ที่:

```text
/plugins/DiscordSRV/config.yml
```

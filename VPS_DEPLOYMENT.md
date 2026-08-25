# คู่มือรัน RitzSMP Discord System บน VPS

เอกสารนี้อธิบายการรัน **เว็บสโตร์**, **RitzSMP AI bot** และ **RitzSMP Music bot** เป็นบริการ Docker คนละตัว เพื่อป้องกันการเปิด Discord Gateway ด้วย token เดียวกันซ้ำซ้อน โดย DiscordSRV จะรันบนเครื่อง Minecraft แยกต่างหากเสมอ ไม่มี token หรือค่า ID จริงอยู่ในไฟล์ตัวอย่างนี้

| บริการ | Container | Token ที่ใช้ | หน้าที่ |
|---|---|---|---|
| เว็บสโตร์ | `app` | ไม่เปิด Gateway | รับคำสั่งเว็บและส่งแจ้งเตือนธุรกรรมผ่าน API ของ Discord |
| AI bot | `ai-bot` | `DISCORD_AI_BOT_TOKEN` | คำสั่ง AI/ผู้ดูแล และแจ้งเติมเงินหรือซื้อยศ |
| Music bot | `music-bot` | `DISCORD_MUSIC_BOT_TOKEN` | `/music`, `/play`, `/leave`, queue และเสียงในห้อง Voice |
| Minecraft Bridge | DiscordSRV บนเซิร์ฟเวอร์ Minecraft | token ของ `BOT CHAT` ใน `plugins/DiscordSRV/config.yml` | แชท Minecraft↔Discord, event และ role/group sync |

> **ห้ามใช้ token เดียวกันกับมากกว่าหนึ่ง Gateway process** และห้ามวาง token ใน Git, ช่อง Discord, ภาพหน้าจอ หรือ log. DiscordSRV เองระบุว่าไม่ควรใช้ token เดียวกันมากกว่าหนึ่ง Minecraft server [3]

## 1. เตรียม VPS

ใช้ Linux ที่รัน Docker Engine และ Docker Compose v2 ได้ จากนั้นคัดลอกหรือ clone โปรเจกต์ไปยัง VPS ตัวอย่างเช่น `/opt/ritz-smp-store` แล้วสร้างไฟล์ตั้งค่าส่วนตัว

```bash
cd /opt/ritz-smp-store
cp env.template .env
chmod 600 .env
nano .env
```

กรอกเฉพาะตัวแปรที่ใช้จริงตามตารางด้านล่าง ค่าใน `env.template` เป็นคำแทนที่เท่านั้น ไม่ใช่ค่าใช้งานจริง

| กลุ่ม | ตัวแปรสำคัญ | หลักการตั้งค่า |
|---|---|---|
| AI | `DISCORD_AI_BOT_TOKEN` | token ของ application **AI test** เท่านั้น |
| Music | `DISCORD_MUSIC_BOT_TOKEN` | token ของ application **Music test** เท่านั้น |
| Bridge | ไม่มีใน `.env` นี้ | owner วาง token **BOT CHAT** เองใน `plugins/DiscordSRV/config.yml` บน Minecraft host |
| แจ้งเตือนเว็บ | `DISCORD_DONATE_LOG_CHANNEL_ID`, `DISCORD_ORDERS_CHANNEL_ID`, `DISCORD_SUPPORT_CHANNEL_ID` | ระบุ ID ห้องตามหน้าที่ที่ต้องการรับข้อความ |
| เพลง | `DISCORD_MUSIC_CHANNEL_ID` | ระบุ ID ห้อง text สำหรับคำสั่งเพลง หากระบบมีสิทธิ์จัดการห้องจะเตรียมห้องให้ได้ |

ตั้งให้ role ของ AI bot และ Music bot มองเห็น/ส่งข้อความในห้องที่เกี่ยวข้อง ส่วน Music bot ต้องมี `View Channel`, `Connect` และ `Speak` ในห้องเสียงด้วย การทำงานของ Discord permissions และ channel overwrite เป็นไปตาม role และสิทธิ์ระดับห้อง [1]

## 2. Build และเริ่มบริการ

ตรวจไฟล์ Compose โดยไม่แสดง token แล้วเริ่มบริการทั้งหมด

```bash
docker compose config >/tmp/ritz-compose-resolved.yml
docker compose up -d --build --remove-orphans
docker compose ps
```

ถ้าต้องการอัปเดตโค้ด ให้ pull เวอร์ชันใหม่และ build service ใหม่ โดยไม่ต้องลบ volume ฐานข้อมูล

```bash
git pull origin main
docker compose up -d --build --remove-orphans
```

## 3. ตรวจการทำงานแยกตามบริการ

คำสั่งต่อไปนี้ช่วยแยกปัญหาได้ว่าเกิดที่เว็บ, AI gateway หรือ music gateway โดยไม่มีคำสั่งใดแสดง secret

```bash
docker compose logs --since=10m app
docker compose logs --since=10m ai-bot
docker compose logs --since=10m music-bot
docker compose exec music-bot sh -lc 'command -v ffmpeg && ffmpeg -version | head -1'
docker compose exec music-bot sh -lc 'command -v yt-dlp && yt-dlp --version'
```

ผลที่ควรพบคือ AI bot ลงทะเบียนเฉพาะคำสั่ง AI, Music bot ลงทะเบียนเฉพาะ `/music`, `/play`, `/leave`, และเว็บไม่มีข้อความเริ่ม Discord Gateway การแจ้งเตือนซื้อยศ/เติมเงินจะใช้ **AI token เท่านั้น**; ระบบจะไม่ fallback ไปใช้ generic token หรือ token ของ Music bot

## 4. ทดสอบเพลงบน VPS อย่างถูกต้อง

Music bot ใช้ `yt-dlp → FFmpeg → PCM → Discord Voice` และต้องรันบน VPS ที่อนุญาต outbound UDP และเข้าถึง YouTube ได้ การที่ bot เข้า Voice หรือแสดง Playing **ไม่ยืนยันว่าได้ยินเสียงแล้ว** ให้เข้าห้องด้วยบัญชีทดสอบและใช้ `/play query:<ลิงก์ YouTube>` จากนั้นดู log ของ music service

```bash
docker compose logs --since=2m -f music-bot | grep -Ei 'Music|yt-dlp|FFmpeg|AudioPlayer|VoiceConnection|PCM'
```

ให้ยืนยันทั้งสองข้อก่อนปิดงานเพลง: log แสดงการส่ง decoded PCM และผู้ฟังจริงยืนยันว่าได้ยินเสียง หากมี `429`, `Sign in to confirm`, `yt-dlp stream failed` หรือสถานะ Playing แต่ไร้เสียง ให้ตรวจ firewall/security group, outbound UDP, IP ของ VPS และ cookies ของ YouTube ก่อนปรับโค้ดเพิ่ม

หากต้องใช้ YouTube cookies ให้สร้างโฟลเดอร์ใน VPS เท่านั้น และอย่าส่งไฟล์ดังกล่าวผ่าน Discord หรือ commit ลง Git

```bash
mkdir -p secrets
chmod 700 secrets
chmod 600 secrets/youtube-cookies.txt
docker compose up -d --build music-bot
```

## 5. ตรวจ token แบบ opt-in

การทดสอบนี้เรียกเพียง `GET https://discord.com/api/v10/users/@me` ด้วย Authorization header และไม่พิมพ์ token, body หรือข้อมูลบัญชีลงผลลัพธ์ โดยปกติจะถูกข้ามเสมอ ใช้เฉพาะหลังใส่ secret แล้วและเมื่อ VPS ออก HTTPS ไป Discord ได้

```bash
DISCORD_TOKEN_LIVE_VALIDATION=ai pnpm exec vitest run server/discordTokenHealth.test.ts
DISCORD_TOKEN_LIVE_VALIDATION=music pnpm exec vitest run server/discordTokenHealth.test.ts
```

หากได้ HTTP 401/403 ให้ reset แล้ววาง token ใหม่ผ่านช่องจัดการ secret ที่ปลอดภัย ห้ามส่ง token ให้ผู้ดูแลหรือวางลงใน issue/chat เพื่อแก้ปัญหา

## 6. สิทธิ์และลำดับ role

Discord กำหนดให้ bot จัดการได้เฉพาะ role ที่อยู่ต่ำกว่า role สูงสุดของ bot [2] ดังนั้นวาง role ของ `BOT CHAT` เหนือ role Discord ที่อนุญาตให้ DiscordSRV sync และอย่าเปิดการ sync owner/admin โดยปริยาย สำหรับ DiscordSRV สิทธิ์ `Manage Roles` ใช้เฉพาะกรณี role synchronization; `Manage Channels` ใช้เมื่อให้ plugin สร้าง/แก้ช่อง; ส่วน bridge chat ต้องมีสิทธิ์เห็นและส่งข้อความในห้องปลายทาง [3]

| Bot | สิทธิ์หลักขั้นต่ำตามหน้าที่ | ไม่ควรให้โดยไม่จำเป็น |
|---|---|---|
| AI test | View Channel, Send Messages, Embed Links, Attach Files ในห้องแจ้งเตือน | Administrator |
| Music test | View Channel, Send Messages, Connect, Speak, Use Application Commands | Administrator, Manage Roles |
| BOT CHAT / DiscordSRV | View Channel, Send Messages, Embed Links; เพิ่ม Manage Roles เฉพาะ sync | Administrator, console command access สำหรับทุกคน |

## 7. อ้างอิง

[1] [Discord Developer Documentation — Permissions](https://docs.discord.com/developers/topics/permissions)  
[2] [Discord Developer Documentation — Role hierarchy](https://docs.discord.com/developers/topics/permissions#role-hierarchy)  
[3] [DiscordSRV Documentation — Home, bot permissions และ bridge](https://docs.discordsrv.com/)

# คู่มือผู้ดูแลระบบ Discord ของ RitzSMP

เอกสารนี้เป็นจุดอ้างอิงสำหรับแก้ไขระบบ Discord โดยแยกหน้าที่ชัดเจนระหว่าง **AI test**, **Music test** และ **BOT CHAT (DiscordSRV)** เพื่อไม่ให้ token ชนกันหรือสั่งงานข้ามหน้าที่ เอกสารระบุเฉพาะชื่อไฟล์, ชื่อตัวแปร และขั้นตอนทดสอบ โดยไม่มี token, Discord ID หรือข้อมูลบัญชีจริง

## ภาพรวมและไฟล์ที่แก้ไขได้

| ระบบ | จุดตั้งค่าหลัก | ไฟล์/ทางเข้า | สิ่งที่แก้ได้อย่างปลอดภัย |
|---|---|---|---|
| AI bot | VPS `.env` หรือ Secret manager | `DISCORD_AI_BOT_TOKEN`, `DISCORD_*_CHANNEL_ID` | ห้องแจ้งเตือนและ token ของ AI application |
| Music bot | VPS `.env` หรือ Secret manager | `DISCORD_MUSIC_BOT_TOKEN`, `DISCORD_MUSIC_CHANNEL_ID` | token ของ Music application และห้องคำสั่งเพลง |
| DiscordSRV | Minecraft server file manager / MCSV | `/plugins/DiscordSRV/config.yml` | token ของ BOT CHAT และ channel mapping เท่านั้น |
| รูปแบบข้อความ Bridge | Minecraft server file manager / MCSV | `/plugins/DiscordSRV/messages.yml` | prefix Minecraft, format Discord→Minecraft และ event message |
| role/group sync | Minecraft server file manager / MCSV | `/plugins/DiscordSRV/synchronization.yml` | mapping เฉพาะยศที่อนุมัติ |
| alert เพิ่มเติม | Minecraft server file manager / MCSV | `/plugins/DiscordSRV/alerts.yml` | event ขั้นสูงเท่านั้น; event ปกติใช้ `messages.yml` |
| โค้ด AI | repository | `server/discordAiBot.ts`, `server/discordAiBotRunner.ts` | คำสั่ง AI และการเริ่ม AI gateway |
| โค้ด Music | repository | `server/discordMusic.ts`, `server/discordMusicBot.ts`, `server/discordMusicBotRunner.ts` | queue, audio pipeline, command และ music gateway |
| แจ้งเตือนจากเว็บ | repository | `server/discordNotifications.ts`, `server/routers.ts` | รูปแบบ embed และปลายทางแจ้งเตือน โดยใช้ AI token เท่านั้น |
| Deployment | repository/VPS | `docker-compose.yml`, `env.template`, `VPS_DEPLOYMENT.md` | ชื่อ service, environment และวิธีดู log |

> **จุดสำคัญ:** `BOT CHAT` ไม่ใช่ AI bot และไม่ใช่ Music bot. ใส่ token ของมันเฉพาะใน DiscordSRV บน Minecraft host เท่านั้น ส่วนเว็บ, AI และเพลงใช้ token ของตนเองผ่าน secret manager หรือ VPS `.env` ที่จำกัดสิทธิ์ไฟล์

## การเข้าแก้ไขด้วยตนเอง

การแก้ DiscordSRV ทำผ่านหน้า file manager ของ MCSV หรือ SSH ไปยังเครื่อง Minecraft แล้วเข้าที่โฟลเดอร์ `plugins/DiscordSRV/` ก่อนแก้ให้สร้างสำเนาไฟล์ชื่อมีวันที่ เช่น `config.yml.backup-YYYYMMDD` และ **อย่าเปิดไฟล์หรือส่งภาพที่มี token** หากต้องเปลี่ยน token ให้ owner paste ตรงช่อง `BotToken` ใน `config.yml` เอง แล้วบันทึก

การแก้เว็บ/AI/Music ทำผ่าน repository หรือ VPS โฟลเดอร์โปรเจกต์ ไม่ต้องแก้ token ใน source code ให้เปลี่ยนผ่าน secret manager ของโปรเจกต์ หรือไฟล์ `.env` บน VPS เท่านั้น หลังแก้ `.env` ให้ตรวจสิทธิ์ด้วย `chmod 600 .env` และ restart เฉพาะ service ที่เกี่ยวข้อง

```bash
# แก้ Music token แล้ว restart เฉพาะ music bot
docker compose up -d --build music-bot

# แก้ AI token หรือ channel ID แล้ว restart เฉพาะ AI bot
docker compose up -d --build ai-bot

# ดู log โดยไม่พิมพ์ค่า secret
docker compose logs --since=10m ai-bot
docker compose logs --since=10m music-bot
```

## หากไม่มี VPS

AI bot ต้องมี Gateway ที่เชื่อม Discord ตลอดเวลา จึงไม่ทำงานบน web hosting แบบ autoscale ซึ่งพัก process ได้ การใช้ **Reserved Hosting** ของโปรเจกต์บน Manus เป็นทางเลือกที่ไม่ต้องจัดหา VPS เองสำหรับ AI bot: เปิดบริการถาวร แล้วตั้ง secret server-side `DISCORD_AI_GATEWAY_RUNTIME=persistent` ร่วมกับ `DISCORD_AI_BOT_TOKEN` ระบบจะเปิด AI gateway หนึ่งตัวและทำให้ปุ่ม `เชื่อมบัญชี` ตอบสนองได้

Music bot ยังต้องใช้ Discord Voice, FFmpeg, yt-dlp และการเชื่อมต่อ UDP ออกสู่ Discord จึงไม่ควรอ้างว่าใช้ได้จริงบน Reserved Hosting จนกว่าจะทดสอบ `/play` และมีผู้ฟังยืนยันเสียง หากต้องการความเสถียรของเพลงระดับ production ให้ใช้ runtime ที่ควบคุม OS/network ได้ เช่น VPS หรือ Cloud Computer แยกต่างหาก ขณะที่ DiscordSRV ยังคงทำงานบน Minecraft host ตามเดิม

## การตั้งค่า DiscordSRV ที่ต้องมี

`config.yml` ปัจจุบันมี **main chat mapping** ของห้องเดิมที่ผ่าน controlled test แล้วว่าแชต Minecraft↔Discord ทำงานทั้งสองทิศทาง จึงไม่ต้องแก้ mapping หรือ token ของ BOT CHAT เพื่อซ่อมแชตหลัก ส่วน logical channel `join-leave`, `deaths`, `advancements` จะตรวจเฉพาะเมื่อมีผลทดสอบ event ที่ไม่แสดง และต้องใช้ห้องเดิมที่เจ้าของยืนยันเท่านั้น ห้ามเดา ID หรือคัดลอก token จาก bot อื่น ส่วน console channel หากยังไม่มีห้องที่ได้รับสิทธิ์เหมาะสม ให้ปิด/เว้นค่าว่างตาม schema ของ plugin แทนการใส่ ID ที่ไม่ถูกต้อง

ใน `messages.yml` ให้คงแนวคิดต่อไปนี้: ข้อความ Minecraft→Discord มี `%primarygroup%` หรือ prefix จาก LuckPerms/PlaceholderAPI; ข้อความ Discord→Minecraft แสดง role alias ที่ตั้งใจให้เห็นเท่านั้น เช่น `%toprolealias%`. DiscordSRV รองรับ bridge chat และ plugin hook กับ LuckPerms/PlaceholderAPI [1]

| ความต้องการ | ไฟล์ | หลักการตรวจ |
|---|---|---|
| เกมพิมพ์แล้วไป Discord | `config.yml`, `messages.yml` | **ยืนยันแล้ว** ว่าข้อความปรากฏใน main chat; เหลือตรวจ prefix/group |
| Discord พิมพ์แล้วไปเกม | `config.yml`, `messages.yml` | **ยืนยันแล้ว** ว่าข้อความปรากฏในเกม; เหลือตรวจ alias ของ Discord role |
| เข้า/ออก | `config.yml`, `messages.yml` | event ไป logical channel `join-leave` |
| ตาย | `config.yml`, `messages.yml` | event ไป logical channel `deaths` |
| Advancement | `config.yml`, `messages.yml` | event ไป logical channel `advancements` |
| sync ยศ | `synchronization.yml` | sync เฉพาะ control account และยศที่อนุมัติ |

## ตั้งค่า role synchronization อย่างระมัดระวัง

เปิด mapping เฉพาะ Minecraft group กับ Discord role ที่ต้องการจริง และทดสอบด้วยบัญชีทดสอบหนึ่งบัญชีก่อน ไม่ควร map `Owner`, `Admin`, หรือ role สิทธิ์สูงแบบอัตโนมัติโดยไม่มีนโยบายชัดเจน DiscordSRV ต้องใช้ `Manage Roles` สำหรับ role sync [1] และ Discord จะให้ bot จัดการได้เฉพาะ role ที่ต่ำกว่า role สูงสุดของ bot [2]

ลำดับ role ที่แนะนำจากบนลงล่างคือ Owner/ผู้ดูแลจริง, `BOT CHAT`, role ที่อนุญาตให้ sync, แล้วจึงเป็น role สมาชิกทั่วไป อย่าให้ `BOT CHAT` หรือ AI/Music bot ได้ Administrator เพียงเพื่อแก้ปัญหาสิทธิ์ เพราะควรให้สิทธิ์เฉพาะห้อง/หน้าที่แทน [3]

## ขั้นตอนเปิดใช้และทดสอบ Bridge

ก่อน restart Minecraft server ให้ตรวจผู้เล่นออนไลน์เป็น `0` และสำรองไฟล์ DiscordSRV ก่อนเสมอ ห้ามใช้ Paper/Bukkit global `/reload` เพราะอาจทำให้ plugin ทำงานผิดปกติ; เอกสาร DiscordSRV เองแนะนำใช้คำสั่งเฉพาะของ plugin หรือ restart server หากการ reload ไม่พอ [4] สำหรับงานนี้ให้เลือก **restart server ตอนผู้เล่นเป็น 0 คน** เป็นค่าเริ่มต้นที่ปลอดภัยกว่า

| ลำดับ | การทดสอบควบคุม | หลักฐานที่ต้องได้ | หากไม่ผ่าน |
|---:|---|---|---|
| 1 | เปิด Minecraft แล้วดู `latest.log` | DiscordSRV login สำเร็จ, WebSocket connected, finished loading | ตรวจ token ของ BOT CHAT โดย owner และสิทธิ์ bot |
| 2 | ส่งข้อความด้วย Minecraft test account | **ยืนยันแล้ว** ว่าข้อความถึง main Discord channel; ให้บันทึก prefix/group ที่แสดง | หาก prefix ไม่ขึ้น ให้ตรวจ `messages.yml` และ placeholder hook โดยไม่แตะ main mapping |
| 3 | ส่งข้อความจาก Discord test account | **ยืนยันแล้ว** ว่าข้อความถึง Minecraft; ให้บันทึก role format ที่แสดง | หาก role ไม่ขึ้น ให้ตรวจ message format และ role alias โดยไม่แตะ main mapping |
| 4 | เข้า/ออกด้วย test account | event ไป `join-leave` | ตรวจ channel ID / logical channel mapping |
| 5 | เปลี่ยนเฉพาะยศ test | sync ถูกทิศทางและไม่กระทบ admin | ตรวจ mapping และลำดับ role |
| 6 | ลอง `/play` จาก Music bot ใน voice | มี decoded PCM log **และ** ผู้ฟังได้ยิน | ตรวจ `music-bot` logs, outbound UDP, YouTube access |
| 7 | ทำธุรกรรม test แบบไม่บันทึกจริง | AI bot ส่ง embed ไปห้องถูกต้อง | ตรวจ channel ID และ AI bot logs |

สถานะปัจจุบันคือ DiscordSRV login, WebSocket และ main chat bridge ของห้องเดิมผ่านการยืนยันแล้วทั้งสองทิศทาง จึงไม่ควรแก้ `config.yml` เพื่อแก้แชตหลักอีก งานที่ยังต้องทำ control-account test คือ prefix/ยศ, role sync และ event messages เท่านั้น

## ตรวจ token โดยไม่รั่ว

ทดสอบได้หลัง secret พร้อม โดยคำสั่งจะติดต่อ Discord เพียง endpoint ระบุตัวตนของ bot และไม่แสดง token หรือรายละเอียดบัญชี หากไม่ระบุ `DISCORD_TOKEN_LIVE_VALIDATION` test จะ skip โดยเจตนา

```bash
DISCORD_TOKEN_LIVE_VALIDATION=ai pnpm exec vitest run server/discordTokenHealth.test.ts
DISCORD_TOKEN_LIVE_VALIDATION=music pnpm exec vitest run server/discordTokenHealth.test.ts
```

หาก test ไม่ถึง Discord เพราะ network timeout ให้ตรวจ network ของ VPS ก่อน และอย่าตีความว่า token ผิดโดยอัตโนมัติ หากตอบ 401/403 ให้ reset แล้วใส่ใหม่ผ่าน secure secret UI เท่านั้น

## อ้างอิง

[1] [DiscordSRV Documentation — Bridge, hooks และ bot permissions](https://docs.discordsrv.com/)  
[2] [Discord Developer Documentation — Role hierarchy](https://docs.discord.com/developers/topics/permissions#role-hierarchy)  
[3] [Discord Developer Documentation — Permissions](https://docs.discord.com/developers/topics/permissions)  
[4] [DiscordSRV FAQ — plugin reload และ server restart](https://docs.discordsrv.com/faq/)

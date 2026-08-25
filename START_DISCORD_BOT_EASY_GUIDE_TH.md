# เริ่มทำระบบบอท Discord ของ RitzSMP แบบเข้าใจง่าย

เอกสารนี้อธิบายว่า หากเริ่มจากศูนย์ ระบบบอท Discord ของ RitzSMP ต้องเริ่มตรงไหน ต้องเปิดอะไร และต้องทดสอบอย่างไร โดยไม่ต้องอ่านโค้ดก่อน จุดสำคัญที่สุดคือ **อย่าให้ bot ทุกหน้าที่ใช้ token เดียวกัน** เพราะแต่ละตัวต้องมีหน้าที่และโปรแกรมที่รันของตนเอง

> **จำง่ายที่สุด:** สร้าง bot ใน Discord ก่อน → เก็บ token ในที่ลับ → รัน bot บนเครื่องที่เปิดตลอด → เชิญ bot เข้า server → ทดสอบทีละหน้าที่

## 1. แยกหน้าที่ของ bot ก่อนเริ่ม

RitzSMP ใช้ Discord application สามตัว ไม่ใช่ bot ตัวเดียวทำทุกอย่าง การแยกแบบนี้ลดปัญหา token ชนกันและทำให้หาสาเหตุเมื่อมีข้อผิดพลาดได้ง่ายขึ้น

| ชื่อ bot/application | หน้าที่ | ใช้ที่ไหน | ห้ามใช้ token ร่วมกับ |
|---|---|---|---|
| **AI test** | ปุ่มเชื่อมบัญชี, คำสั่ง AI, แจ้งซื้อยศและเติมเงินจากเว็บ | Discord และเว็บ | Music test, BOT CHAT |
| **Music test** | `/music`, `/play`, `/leave`, คิวเพลง และเข้าห้องเสียง | Discord Voice | AI test, BOT CHAT |
| **BOT CHAT** | ส่งแชท Minecraft ↔ Discord, เข้า/ออก, ตาย, advancement และ role/group sync | DiscordSRV ใน MCSV | AI test, Music test |

ห้องในภาพชื่อ **ระบบเชื่อมบัญชี** เป็นห้องของ **AI test** สำหรับกดปุ่มเชื่อมบัญชี จึงไม่ใช่ห้องที่ใช้ส่งแชทจาก Minecraft โดยตรง ส่วนแชท Minecraft↔Discord ต้องมีห้องหลักอีกห้องหนึ่ง เช่น `แชท-เกม` ซึ่งกำหนดใน DiscordSRV

## 2. สร้าง bot ใน Discord เริ่มตรงไหน

เริ่มที่ [Discord Developer Portal](https://discord.com/developers/applications) แล้วทำทีละ application ตามตารางข้างต้น หากสร้างไว้แล้ว ให้ใช้ application เดิมและตรวจชื่อ/หน้าที่ให้ตรง ไม่จำเป็นต้องสร้างซ้ำ

| ลำดับ | สิ่งที่กดใน Discord Developer Portal | ผลที่ควรได้ |
|---:|---|---|
| 1 | **New Application** | application หนึ่งตัว เช่น `RitzSMP AI` |
| 2 | เมนู **Bot** → Add Bot | มี bot user สำหรับ application นั้น |
| 3 | เมนู **Bot** → Reset Token เมื่อจำเป็น | token ใหม่สำหรับเจ้าของเก็บเป็นความลับ |
| 4 | เมนู **Installation** | ลิงก์เชิญ bot เข้า Discord server |
| 5 | เลือก scope `bot` และ `applications.commands` | bot รับ slash command และปุ่ม interaction ได้ |
| 6 | เชิญ bot เข้า Discord server | เห็น bot อยู่ในรายชื่อสมาชิกของ server |

Discord application commands คือ slash command ที่ผู้ใช้เรียกด้วยเครื่องหมาย `/` เช่น `/play` และ `/leave` [1] การติดตั้ง application และเลือก permissions ทำให้ bot มีสิทธิ์ตามที่กำหนดใน server [2]

> **เรื่อง token:** token เปรียบเสมือนรหัสผ่านเต็มสิทธิ์ของ bot ห้ามส่งให้ใครทางแชท ห้ามใส่ในรูป ห้ามเก็บใน Git และห้ามเขียนลง source code หาก token หลุด ให้ Reset Token ทันที แล้วเปลี่ยนค่าใน secret manager หรือ `.env` บนเครื่องที่รันเท่านั้น

## 3. เชิญ bot เข้า Discord ต้องเปิดสิทธิ์อะไร

เลือกสิทธิ์เท่าที่หน้าที่ต้องใช้ ไม่ต้องเปิด `Administrator` เพื่อให้ "ง่าย" เพราะจะเพิ่มความเสี่ยงโดยไม่จำเป็น Discord คำนวณสิทธิ์จาก role และ channel overwrite ตามลำดับชั้น [3]

| Bot | สิทธิ์พื้นฐานที่ต้องมี | สิทธิ์เพิ่มเมื่อใช้ฟังก์ชันนั้น |
|---|---|---|
| AI test | View Channel, Send Messages, Embed Links, Use Application Commands | Attach Files เมื่อส่งรูปสลิป; Manage Roles เฉพาะถ้าสั่งยศ Discord |
| Music test | View Channel, Send Messages, Use Application Commands, Connect, Speak | ไม่มีความจำเป็นต้องมี Manage Roles |
| BOT CHAT | View Channel, Send Messages, Embed Links | Manage Roles เฉพาะเมื่อเปิด role sync ผ่าน DiscordSRV |

หากต้องให้ bot จัดการ role ได้ ให้วาง role ของ bot **สูงกว่า role ที่ต้องจัดการ** แต่ต่ำกว่า Owner/ผู้ดูแลจริง เพราะ Discord ไม่อนุญาตให้ bot จัดการ role ที่สูงกว่าหรือเท่ากับ role สูงสุดของ bot [4]

## 4. ใส่ token ตรงไหน

token ไม่ได้ใส่ใน Discord chat และไม่ต้องใส่ในไฟล์ source การใส่ token ที่ถูกต้องขึ้นกับ bot ตัวนั้นดังนี้

| Bot | ชื่อตัวแปรลับ | ที่เก็บ | อย่าใส่ใน |
|---|---|---|---|
| AI test | `DISCORD_AI_BOT_TOKEN` | Secret manager ของโปรเจกต์ หรือ `.env` บน host ที่รัน AI | `server/*.ts`, DiscordSRV config |
| Music test | `DISCORD_MUSIC_BOT_TOKEN` | Secret manager / `.env` ของ host music | เว็บ client, DiscordSRV config |
| BOT CHAT | ค่า Bot Token ของ DiscordSRV | `/plugins/DiscordSRV/config.yml` บน MCSV เท่านั้น | `.env` เว็บ, source code |

สำหรับ RitzSMP ไฟล์ตัวอย่างของตัวแปรอยู่ที่ `env.template` และคู่มือ runtime อยู่ที่ `VPS_DEPLOYMENT.md` แต่ไฟล์ตัวอย่างไม่มี token จริง หากเปิดดูแล้วเห็น `replace_with_...` แปลว่าเป็นเพียงช่องให้เจ้าของกรอกในเครื่องของตนเอง

## 5. ทำไมปุ่มเชื่อมบัญชีจึงขึ้นว่า “แอปพลิเคชันไม่ตอบสนอง”

ปุ่ม Discord ต้องมีโปรแกรม bot ที่กำลังเชื่อมต่อกับ Discord อยู่ในขณะกดปุ่มเสมอ หากเว็บอยู่บน hosting แบบ autoscale process อาจพักหรือถูกสร้างใหม่ จึงไม่เหมาะสำหรับ Discord Gateway ที่ต้องเชื่อมต่อยาวตลอด 24 ชั่วโมง ผลคือ Discord จะรอคำตอบจากปุ่มแล้วแจ้งว่าแอปพลิเคชันไม่ตอบสนอง

วิธีแก้คือให้ **AI test** รันบนบริการถาวรหนึ่งแห่ง โดยมีสองแนวทางทั่วไป:

| ทางเลือก | เหมาะกับ | สิ่งที่ต้องทำ |
|---|---|---|
| **Reserved / Always On Hosting** | AI bot และปุ่มเชื่อมบัญชี | เปิด hosting แบบถาวร แล้วตั้ง `DISCORD_AI_GATEWAY_RUNTIME=persistent` และ `DISCORD_AI_BOT_TOKEN` เป็น secret ฝั่ง server |
| **VPS หรือ Cloud Computer** | AI bot และ music bot | ใช้ `docker-compose.yml` แล้วรัน service `ai-bot` และ `music-bot` แยกกัน |

โค้ดปัจจุบันของ RitzSMP ป้องกันไม่ให้ AI Gateway เปิดเองบน autoscale โดยจะเปิดเฉพาะเมื่อมีค่า `DISCORD_AI_GATEWAY_RUNTIME=persistent` เท่านั้น นี่เป็นเหตุผลที่เว็บเผยแพร่ได้ แต่ปุ่ม AI ไม่ตอบจนกว่าจะมี runtime แบบถาวร

## 6. เริ่ม bot แต่ละตัวตามปกติ

### 6.1 AI test: ปุ่มเชื่อมบัญชีและแจ้งเตือนเว็บ

หลังมีบริการถาวร ให้ใส่ secret ของ AI test แล้วเริ่ม application หนึ่ง instance เท่านั้น หากใช้ Docker Compose คำสั่งคือ `docker compose up -d --build ai-bot` หากใช้ Reserved Hosting ให้ตั้งค่า `DISCORD_AI_GATEWAY_RUNTIME=persistent` ใน secret ของโปรเจกต์ แล้ว restart/deploy service หนึ่งครั้ง

เมื่อสำเร็จ ให้ตรวจ log ว่ามีข้อความ login และลงทะเบียนคำสั่งสำเร็จ จากนั้นกลับไปที่ห้อง **ระบบเชื่อมบัญชี** แล้วกดปุ่ม `เชื่อมบัญชี` หนึ่งครั้ง หาก bot ทำงานอยู่ จะต้องตอบทันภายในไม่กี่วินาที ไม่ควรขึ้นข้อความว่าแอปพลิเคชันไม่ตอบสนอง

### 6.2 Music test: เพลงในห้องเสียง

Music bot ไม่ใช่เพียง bot พิมพ์ข้อความ เพราะต้องเชื่อม Voice, อ่านสตรีม YouTube ผ่าน `yt-dlp`, แปลงเสียงผ่าน FFmpeg แล้วส่ง PCM เข้า Discord จึงควรรันบนเครื่องที่เปิดตลอดและอนุญาต network ออกไปยัง Discord/YouTube ได้ ใน RitzSMP ใช้คำสั่ง `docker compose up -d --build music-bot` เมื่อ host พร้อมแล้ว

ทดสอบในห้องเสียงด้วย `/play query:<ลิงก์หรือชื่อเพลง>` จากนั้นตรวจสามอย่าง: bot เข้าห้อง, log แสดงว่า PCM ถูกส่ง, และผู้ฟังจริงได้ยินเสียง การเห็น bot เข้าห้องหรือเห็นชื่อเพลงอย่างเดียว **ยังไม่ยืนยันว่าเสียงออกจริง**

### 6.3 BOT CHAT: Minecraft ↔ Discord

BOT CHAT รันเป็น DiscordSRV plugin บน Minecraft host/MCSV ไม่ได้รันในเว็บ ไม่ได้รันใน AI bot และไม่ต้องใช้ Docker ของเว็บ ไฟล์สำคัญคือ:

| ไฟล์ใน MCSV | ใช้ทำอะไร |
|---|---|
| `/plugins/DiscordSRV/config.yml` | token ของ BOT CHAT และ mapping ห้อง Discord |
| `/plugins/DiscordSRV/messages.yml` | รูปแบบข้อความและ prefix ยศ |
| `/plugins/DiscordSRV/synchronization.yml` | mapping ยศ Minecraft กับ Discord role |
| `/plugins/DiscordSRV/alerts.yml` | event เสริมที่ต้องแจ้ง Discord |

ให้ตั้ง main mapping ไปที่ห้อง **แชทเกม** หนึ่งห้อง ไม่ใช่ห้องระบบเชื่อมบัญชี และกำหนด logical channel แยกสำหรับ `join-leave`, `deaths`, `advancements` เมื่อแก้ไฟล์แล้วให้สำรองไฟล์ก่อน และ restart Minecraft server เฉพาะเวลาผู้เล่นออนไลน์เป็น `0` หลีกเลี่ยง `/reload` รวมของ Paper/Bukkit เพราะอาจทำให้ plugin มีสถานะผิดปกติ [5]

## 7. วิธีทดสอบที่ถูกต้องทีละข้อ

ทดสอบทีละระบบเพื่อไม่ให้สับสนว่า error มาจากส่วนไหน

| ลำดับ | ทดสอบจากไหน | ผลที่ถูกต้อง | ถ้าไม่ผ่านให้ดูอะไร |
|---:|---|---|---|
| 1 | กดปุ่มในห้องระบบเชื่อมบัญชี | AI bot ตอบภายในไม่กี่วินาที | AI service log และ runtime แบบ persistent |
| 2 | ส่งข้อความจาก Minecraft ใน main chat | ข้อความไปห้องแชทเกมบน Discord พร้อมยศ Minecraft | `config.yml`, `messages.yml`, DiscordSRV log |
| 3 | ส่งข้อความจากห้องแชทเกมบน Discord | ข้อความเข้าหน้า chat Minecraft พร้อม role format | channel mapping, bot permissions, client chat filter |
| 4 | เข้า/ออกด้วยบัญชีทดสอบ | event ไปห้อง `join-leave` | logical channel mapping |
| 5 | เปลี่ยนยศเฉพาะบัญชีทดสอบ | Discord role sync เฉพาะ role ที่ตั้งใจ | `synchronization.yml`, role hierarchy |
| 6 | ใช้ `/play` ในห้องเสียง | bot เข้า, log PCM และผู้ฟังได้ยิน | music service log, FFmpeg, yt-dlp, network UDP |
| 7 | สร้างธุรกรรมทดสอบแบบไม่บันทึกจริง | AI bot ส่ง embed ไปห้องที่กำหนด | AI token, channel ID, notification log |

ก่อนสรุปว่า "ใช้ได้แล้ว" ให้ทำครบตามตารางอย่างน้อยด้วยบัญชีทดสอบหนึ่งบัญชี โดยไม่ใช้ Owner/Admin จริงในการทดสอบ role sync

## 8. ถ้าเกิดปัญหา ให้แยกตามอาการ

| อาการ | สาเหตุที่พบบ่อย | ขั้นแรกที่ควรทำ |
|---|---|---|
| ปุ่มขึ้นว่าแอปไม่ตอบสนอง | AI Gateway ไม่ได้รันหรือพัก | ตรวจ runtime แบบ persistent และ AI bot log |
| พิมพ์ใน Discord แล้วเข้า Minecraft แต่ไม่เห็นในหน้าจอ | DiscordSRV ส่งแล้ว แต่อาจถูก plugin chat, Geyser หรือ client filter | ดู DiscordSRV log แล้วทดสอบ Java/Bedrock แยกกัน |
| พิมพ์ Minecraft แล้วไม่ไป Discord | main channel mapping/permission ไม่ตรง | ตรวจ `config.yml` และสิทธิ์ BOT CHAT ในห้องแชทเกม |
| เพลง bot เข้าแต่ไม่ออกเสียง | runtime/network/PCM ไม่พร้อม | ตรวจ music log และให้ผู้ฟังจริงยืนยัน |
| bot ไม่จัดการ role | role bot อยู่ต่ำเกินหรือไม่มี Manage Roles | ย้าย role bot ขึ้นและจำกัด mapping เฉพาะยศทดสอบ |

## 9. รายชื่อไฟล์โค้ดของ RitzSMP สำหรับผู้ที่ต้องแก้ระบบเอง

| งาน | ไฟล์ |
|---|---|
| เริ่ม AI bot | `server/discordAiBot.ts`, `server/discordAiBotRunner.ts`, `server/discordRuntime.ts` |
| Music bot และคิวเพลง | `server/discordMusic.ts`, `server/discordMusicBot.ts`, `server/discordMusicBotRunner.ts` |
| แจ้งเตือนซื้อยศ/เติมเงิน | `server/discordNotifications.ts`, `server/routers.ts` |
| เริ่ม web server | `server/_core/index.ts` |
| รัน Docker | `docker-compose.yml`, `Dockerfile`, `env.template` |
| คู่มือผู้ดูแลเชิงเทคนิค | `DISCORD_SYSTEM_GUIDE.md`, `VPS_DEPLOYMENT.md` |

หากต้องแก้ source code ให้แก้เฉพาะ logic/ข้อความ/คำสั่ง ไม่เขียน token ลงไฟล์ใด ๆ แล้วต้องรัน `pnpm check`, `pnpm test` และ `pnpm build` ก่อน deploy ทุกครั้ง

## 10. สรุปขั้นตอนสำหรับ RitzSMP ตอนนี้

ตอนนี้ BOT CHAT/DiscordSRV เชื่อม Discord สำเร็จแล้ว แต่ยังต้องทดสอบ main chat mapping ด้วยผู้เล่นจริงอีกครั้ง ส่วน AI test มีข้อความและปุ่มอยู่แล้ว แต่ปุ่มไม่ตอบเพราะยังไม่มี runtime แบบ persistent จึงต้องเปิด Reserved/Always On Hosting หรือมีเครื่องรัน AI bot ตลอดเวลา Music test ต้องรันบน runtime ที่รองรับ Voice/FFmpeg/yt-dlp และต้องยืนยันเสียงโดยผู้ฟังจริงก่อนประกาศว่าใช้งานได้

## เอกสารอ้างอิง

[1] [Discord Developer Documentation — Application Commands](https://docs.discord.com/developers/interactions/application-commands)  
[2] [Discord Developer Documentation — Getting Started with Apps](https://docs.discord.com/developers/quick-start/getting-started)  
[3] [Discord Developer Documentation — Permissions](https://docs.discord.com/developers/topics/permissions)  
[4] [Discord Developer Documentation — Role Hierarchy](https://docs.discord.com/developers/topics/permissions#role-hierarchy)  
[5] [DiscordSRV Documentation](https://docs.discordsrv.com/)

# ทะเบียนไฟล์ระบบ Discord เดิมก่อนเริ่มใหม่

เอกสารนี้เป็นจุดอ้างอิงก่อนเริ่มสร้างระบบ Discord ใหม่ของ RitzSMP โดยยืนยันหลักการว่า **ไม่มีการลบไฟล์เดิม ไม่มีการเผย token และไม่มีการเปลี่ยนการตั้งค่า Minecraft ในขั้นนี้**

> สถานะ ณ วันที่ 25 สิงหาคม 2026: พบไฟล์ทั้งฝั่งเว็บและโฮสต์ Minecraft แล้ว ขั้นถัดไปคือเก็บโครงสร้างเดิมไว้เป็นต้นแบบ แล้วสร้าง flow ใหม่แบบแยกหน้าที่และทดสอบได้ทีละระบบ

## แผนผังตำแหน่งไฟล์

| พื้นที่ | ตำแหน่ง | ใช้ทำอะไร | วิธีดูแลที่ปลอดภัย |
|---|---|---|---|
| เว็บและบอท | `/home/ubuntu/ritz-smp-store/` | โค้ดร้านค้า เว็บแจ้งเตือน และ source code ของ AI/music bot | แก้ผ่านโครงการเว็บและเก็บ version ทุกครั้ง |
| DiscordSRV | `/plugins/DiscordSRV/` บนโฮสต์ Minecraft | เชื่อมแชต อีเวนต์ และกลุ่มยศระหว่าง Minecraft กับ Discord | สำรองก่อนแก้ ใช้การแก้เฉพาะจุด และรีสตาร์ตเฉพาะเมื่อไม่มีผู้เล่น |
| การตั้งค่าลับ | Secret settings ของโครงการเว็บ และ `config.yml` ของ DiscordSRV | token ของ AI bot, music bot และ BOT CHAT | ห้ามส่งในแชต ห้ามบันทึกลง git และห้ามคัดลอกลงเอกสารนี้ |

## ฝั่งเว็บ: source code ที่มีอยู่

| ไฟล์ | หน้าที่ปัจจุบัน | สถานะในการเริ่มใหม่ |
|---|---|---|
| `server/discordAiBot.ts` | onboarding, verification และตัวกระจาย interaction ของ AI bot | ใช้ต่อโดยแยกทะเบียนคำสั่งออกแล้ว; ไม่เปิด gateway บน autoscale |
| `server/discordAiCommandRegistry.ts` | ทะเบียนคำสั่งใหม่เพียงจุดเดียวสำหรับ AI bot | ใช้งานแล้ว; มีเฉพาะคำสั่ง AI/onboarding และไม่มีคำสั่ง music หรือ alias เก่า |
| `server/discordAiCommandRegistry.test.ts` | ชุดทดสอบทะเบียนคำสั่งใหม่ | ใช้งานแล้ว; ตรวจชื่อคำสั่งไม่ซ้ำและสิทธิ์ผู้ดูแลของคำสั่งตั้งค่า |
| `server/discordAiBotRunner.ts` | ตัวสั่งรัน AI gateway แยก process | เก็บไว้; ใช้ได้เฉพาะ runtime ที่รันต่อเนื่อง |
| `server/discordMusic.ts` | คิวเพลง, ดึงเสียง และควบคุมการเล่น | ใช้ต่อโดยแยกทะเบียนคำสั่งออกแล้ว; ห้ามยืนยันว่าเสียงใช้ได้จนกว่าจะมีการฟังจริง |
| `server/discordMusicCommandRegistry.ts` | ทะเบียนคำสั่งใหม่เพียงจุดเดียวของ music bot | ใช้งานแล้ว; มีเฉพาะ `/music`, `/play` และ `/leave` เพื่อไม่ให้ชนกับ AI bot |
| `server/discordMusicCommandRegistry.test.ts` | ชุดทดสอบทะเบียนคำสั่ง music bot | ใช้งานแล้ว; ตรวจรายการคำสั่งและ subcommand ที่ต้องลงทะเบียน |
| `server/discordMusicBot.ts` | bootstrap ของ music bot และการลงทะเบียนคำสั่ง | ใช้ต่อ; รับ payload จากทะเบียนใหม่และใช้ token ของ music bot เท่านั้น |
| `server/discordMusicBotRunner.ts` | ตัวสั่งรัน music gateway แยก process | เก็บไว้; ต้องใช้ runtime ต่อเนื่องและตรวจ voice networking |
| `server/discordRuntime.ts` | ป้องกัน AI gateway เปิดบน autoscale โดยไม่ตั้งใจ | เก็บไว้เป็นมาตรการความปลอดภัย |
| `server/discordNotifications.ts` | ส่งแจ้งเตือนธุรกรรมจากเว็บไป Discord | เก็บไว้; จะตรวจให้ใช้ AI bot token เท่านั้น |
| `server/discordBot.ts` | โค้ดบอทเดิม/ความเข้ากันได้ย้อนหลัง | เก็บไว้เพื่อ audit ก่อนตัดสินใจเลิกใช้ |
| `server/discordMinecraftStatusChannel.ts` | อัปเดตสถานะ Minecraft ใน Discord | เก็บไว้เป็นโมดูลแยกสำหรับทดสอบ |
| `server/discordMusicChannel.ts` | ความสามารถเกี่ยวกับห้องเพลง | เก็บไว้เพื่อ audit ก่อนสร้าง flow เพลงใหม่ |
| `server/minecraftIntegration.ts` | การเชื่อมเว็บกับ Minecraft | ไม่อยู่ในขอบเขตแก้ไขรอบแรก เว้นแต่จำเป็นต่อแจ้งเตือน Discord |
| `server/minecraftPresenceMonitor.ts` และ `server/minecraftPresenceRoute.ts` | สถานะผู้เล่น Minecraft | เก็บไว้; ไม่ใช่ DiscordSRV bridge โดยตรง |

## ฝั่งเว็บ: ชุดทดสอบที่มีอยู่

| กลุ่มไฟล์ | ครอบคลุมเรื่อง | การใช้เมื่อเริ่มใหม่ |
|---|---|---|
| `server/discordAiBot*.test.ts` | คำสั่ง, interaction, timeout, ความทนทาน และ response | ใช้เป็น regression tests แล้วเพิ่ม test ของคำสั่งชุดใหม่ |
| `server/discordMusic*.test.ts` | music flow, bot bootstrap และ channel behavior | ใช้ทดสอบตรรกะ แต่ไม่ใช่หลักฐานว่าเสียงออกจริง |
| `server/discordNotifications.test.ts` | แจ้งเตือนธุรกรรมจากเว็บ | รันทุกครั้งที่ปรับ notification |
| `server/discordRuntime.test.ts` | ป้องกัน gateway บน autoscale | ต้องคงไว้เพื่อป้องกันบอท disconnect ซ้ำ |
| `server/discordTokenHealth.test.ts` | ตรวจ token แบบ opt-in | ใช้เฉพาะเมื่อเปิดการทดสอบด้วย secret setting; ห้ามแสดง token หรือ response body |
| `server/discordMinecraftStatusChannel.test.ts` | แสดงสถานะ Minecraft | ใช้ทดสอบโมดูลสถานะโดยแยกจาก DiscordSRV |

## ไฟล์ตั้งค่าและคู่มือของเว็บ

| ไฟล์ | หน้าที่ | สถานะในการเริ่มใหม่ |
|---|---|---|
| `docker-compose.yml` | โครงแยก `app`, `ai-bot`, `music-bot` และฐานข้อมูลบน VPS | เก็บไว้เป็นพิมพ์เขียว runtime ต่อเนื่อง |
| `env.template` | รายชื่อตัวแปรตั้งค่าแบบไม่มี secret | เก็บไว้และปรับเฉพาะชื่อ/คำอธิบายเมื่อโครงใหม่ชัดเจน |
| `VPS_DEPLOYMENT.md` | คู่มือติดตั้งบน VPS | เก็บไว้และอัปเดตตาม flow ใหม่ |
| `DISCORD_SYSTEM_GUIDE.md` | คู่มือผู้ดูแล Discord เดิม | เก็บไว้เป็นเอกสารอ้างอิง แล้วจัดทำคู่มือเริ่มใหม่แทน |
| `START_DISCORD_BOT_EASY_GUIDE_TH.md` | คู่มือภาษาไทยแบบทีละขั้น | เก็บไว้และจะปรับให้ตรงกับโครงใหม่ |
| `DISCORD_INTEGRATION_AUDIT_2026-08-22.md` | ผลตรวจสภาพระบบก่อนหน้า | เก็บไว้เป็นประวัติ ไม่ใช่การตั้งค่าที่ต้องนำมาใช้ซ้ำโดยอัตโนมัติ |
| `discord_bot_setup_guide.md`, `discord_ai_embed_guide.md`, `discord_live_test_summary.md`, `discord_donate_channel_update.md` | คู่มือ/บันทึกงานเดิม | เก็บไว้เป็นข้อมูลอ้างอิงและตรวจความซ้ำซ้อนก่อนรวมเป็นคู่มือเดียว |

## ฝั่ง Minecraft: ไฟล์ DiscordSRV ที่พบ

| ไฟล์บนโฮสต์ Minecraft | หน้าที่ | สถานะในการเริ่มใหม่ |
|---|---|---|
| `/plugins/DiscordSRV/config.yml` | การตั้งค่าหลักและ channel mapping ของ DiscordSRV; มีข้อมูลลับ | **ห้ามอ่านหรือส่งออกโดยไม่ปกปิด token**; เก็บไว้และแก้เฉพาะ channel mapping ที่ผู้ใช้ยืนยัน |
| `/plugins/DiscordSRV/config copy.yml` | สำเนา config เดิม | เก็บเป็น backup; ไม่ใช้เป็นไฟล์ runtime |
| `/plugins/DiscordSRV/messages.yml` | รูปแบบข้อความ Minecraft→Discord, Discord→Minecraft และ event messages | เก็บเป็นต้นแบบ; จะปรับข้อความหลัง mapping ใหม่ผ่านการทดสอบ |
| `/plugins/DiscordSRV/messages copy.yml` | สำเนาข้อความเดิม | เก็บเป็น backup |
| `/plugins/DiscordSRV/synchronization.yml` | mapping กลุ่ม Minecraft กับ role Discord | เก็บเป็นต้นแบบ; ยังห้ามแก้ owner/admin จนกว่าจะกำหนดทิศทาง role sync และทดสอบบัญชีควบคุม |
| `/plugins/DiscordSRV/synchronization copy.yml` | สำเนา role sync เดิม | เก็บเป็น backup |
| `/plugins/DiscordSRV/linking.yml` | การเชื่อมบัญชี Minecraft–Discord | เก็บไว้; ไม่เปิดบังคับ linking จนกว่า onboarding ใหม่ผ่านการทดสอบ |
| `/plugins/DiscordSRV/alerts.yml` | การแจ้งเตือนจาก DiscordSRV | เก็บเป็นต้นแบบ |
| `/plugins/DiscordSRV/alerts copy.yml` | สำเนา alerts เดิม | เก็บเป็น backup |
| `/plugins/DiscordSRV/voice.yml` | ตั้งค่าความสามารถด้าน voice ของ DiscordSRV | เก็บไว้; ไม่เกี่ยวกับ music bot โดยตรง |
| `/plugins/DiscordSRV/accounts.aof` | สถานะ/ข้อมูลบัญชีที่ plugin ใช้งาน | ห้ามแก้หรือส่งออก; ปล่อยไว้ให้ DiscordSRV ดูแล |

## โครงใหม่ที่ตั้งใจใช้

| บัญชีบอท | หน้าที่เดียวที่รับผิดชอบ | ข้อห้ามสำคัญ |
|---|---|---|
| **AI bot** | onboarding, ปุ่มยืนยันตัวตน, คำสั่งช่วยเหลือ/AI, แจ้งเตือนจากเว็บ | ห้ามใช้ token ร่วมกับบอทอื่น และห้ามเปิด gateway บน autoscale |
| **Music bot** | เข้าห้องเสียง, เล่น/พัก/ข้าม/ออก และแสดงคิวเพลง | ห้ามอ้างว่าเสียงพร้อมจนกว่าผู้ฟังในห้องจะยืนยัน |
| **BOT CHAT (DiscordSRV)** | แชต Minecraft↔Discord, event messages และ role display/sync ที่ผ่านการทดสอบ | ห้ามนำ token ไปใช้รัน discord.js gateway พร้อมกัน |

### สถานะการเริ่มใหม่ของ AI bot

AI bot เริ่มย้ายจุดตั้งค่าคำสั่งไปที่ `server/discordAiCommandRegistry.ts` แล้ว โดยคำสั่งที่ลงทะเบียนมีเพียง `/ask`, `/status`, `/store`, `/ranks`, `/topup`, `/verify`, `/players`, `/members`, `/profile`, `/help`, `/setup` และ `/embed` เท่านั้น คำสั่ง `/ai-status` ถูกยกเลิกจากทะเบียนใหม่เพื่อลดคำสั่งซ้ำซ้อน ส่วน `/play` และ `/leave` เป็นของ music bot เท่านั้น

> การเปลี่ยนทะเบียนคำสั่งจะมีผลใน Discord ก็ต่อเมื่อมีการรัน AI gateway บน runtime ต่อเนื่องที่แยกจากเว็บ autoscale แล้วเท่านั้น จึงยังไม่มีการเปิด bot หรือใช้ token ในขั้นตอนนี้

### สถานะการเริ่มใหม่ของ music bot

Music bot ใช้ทะเบียนที่ `server/discordMusicCommandRegistry.ts` แล้ว โดยลงทะเบียนเฉพาะ `/music`, `/play` และ `/leave` เท่านั้น คำสั่ง `/music` มีคำสั่งย่อย `play`, `queue`, `skip`, `stop` และ `leave` เพื่อให้ควบคุมคิวได้จากที่เดียว ขณะที่ `/play` และ `/leave` เป็นทางลัดสำหรับผู้เล่น

> การตรวจโค้ดและ PCM ในชุดทดสอบยืนยันได้เพียงตรรกะการทำงานภายในเท่านั้น การยืนยันว่าเพลงออกจาก Discord Voice ต้องรัน music bot บน runtime ต่อเนื่องที่มี Voice UDP, FFmpeg และ yt-dlp พร้อมผู้ฟังจริงในห้องเสียง

## สิ่งที่ยังทำไม่ได้บน runtime ปัจจุบัน

เว็บโครงการกำลังทำงานแบบ autoscale จึงไม่เหมาะกับการคง Discord Gateway ไว้ตลอดเวลา การเปิด AI bot หรือ music bot จริงต้องมี runtime ต่อเนื่องที่ผู้ใช้จัดเตรียมและเปิดใช้งานก่อน ส่วน DiscordSRV อยู่บนโฮสต์ Minecraft แล้ว จึงสามารถตรวจและปรับ mapping แบบปลอดภัยได้โดยไม่ต้องรอ runtime ของเว็บ

## ขั้นตอนก่อนแตะไฟล์จริง

1. ใช้ทะเบียนนี้ตรวจว่าแต่ละหน้าที่จะย้ายไปที่ bot ใด
2. สำรองไฟล์ DiscordSRV ที่จะเปลี่ยนเฉพาะไฟล์นั้นก่อนทุกครั้ง
3. ใช้ channel ID ที่ผู้ใช้ยืนยันเท่านั้น และไม่เดา ID
4. แก้ครั้งละหนึ่งหน้าที่แล้วทำ controlled test
5. รีสตาร์ต Minecraft เฉพาะเมื่อยืนยันว่าผู้เล่นออนไลน์เป็นศูนย์
6. บันทึกผลทดสอบและวิธีย้อนกลับในคู่มือก่อนเปิดใช้จริง

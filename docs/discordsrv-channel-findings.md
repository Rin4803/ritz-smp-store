# DiscordSRV channel findings

ตรวจจากไฟล์บนเซิร์ฟเวอร์ Minecraft เมื่อวันที่ 26 สิงหาคม 2026

- `synchronization.yml` ใช้ชื่อ channel สำหรับ event: `join-leave` สำหรับ join/first join/leave และ `deaths` สำหรับ death event
- `config.yml` มี mapping ของชื่อ channel เหล่านี้ไปยัง Discord channel IDs จริงบนเซิร์ฟเวอร์
- ยังไม่แก้ไฟล์บนเซิร์ฟเวอร์ในขั้นตอนตรวจสอบนี้
- ค่าความลับ เช่น BotToken, JDBC username และ JDBC password ถูกพบในไฟล์ต้นทาง แต่ไม่บันทึกไว้ในเอกสารนี้และไม่ควรนำไปแสดงหรือ commit
- ขั้นถัดไปต้องเปลี่ยนเฉพาะ mapping ของ `join-leave` ให้ชี้ไปช่อง `server-realtime` และ `deaths` ให้ชี้ไปช่อง `server-chat` โดยคงชื่อ key ที่ DiscordSRV รองรับ และควรสำรองไฟล์ก่อนแก้
- ต้องตรวจว่า runtime ของ DiscordSRV reload/restart หลังแก้ config แล้วจึงทดสอบ event จริง

## หลักฐานเพิ่มเติมจากเอกสาร DiscordSRV (2026-08-26)
แหล่งข้อมูล: https://docs.discordsrv.com/config/
เอกสารระบุว่า `Channels` ใช้ชื่อพิเศษสำหรับข้อความแต่ละประเภท โดย `global` เป็นห้องหลัก และ `status` เป็นปลายทางของข้อความ server start/stop; ถ้าไม่มี channel เฉพาะ ข้อความเพิ่มเติมทั้งหมดจะไป channel แรกที่กำหนด. ชื่อ `join`, `leave`, `deaths`, `awards` และ `watchdog` เป็นชื่อเฉพาะที่ DiscordSRV รองรับ.

ตรวจจาก `/plugins/DiscordSRV/config.yml` บนเซิร์ฟเวอร์จริงพบว่า `global` ชี้ `1539202486311592016`, `status` และ `join-leave` ชี้ `1530761640830832721`, ส่วน `deaths` ชี้ `1539202951380205618`. อย่างไรก็ตาม `/plugins/DiscordSRV/messages.yml` ยังใช้คีย์ข้อความ `DiscordChatChannelServerStartupMessage` และ `DiscordChatChannelServerShutdownMessage`; จึงต้องตรวจว่าเซิร์ฟเวอร์กำลังโหลดไฟล์ config ชุดเดียวกันจริง และไม่มีกระบวนการหรือปลั๊กอินอีกตัวส่งข้อความไป global.


## หลักฐานเอกสาร DiscordSRV รุ่น 1.30.x

อ้างอิงเอกสารทางการ: https://docs.discordsrv.com/config/ (ตรวจเมื่อ 26 สิงหาคม 2026)

เอกสารระบุว่า `Channels` เป็นคู่ชื่อภายในกับ Discord channel ID และใช้ channel แรกเป็น main channel สำหรับข้อความที่ไม่มี mapping เฉพาะ ส่วนชื่อที่รองรับสำหรับข้อความเฉพาะคือ `status` สำหรับ server start/stop, `deaths` สำหรับ death, `join` สำหรับ join และ `leave` สำหรับ leave ดังนั้นหากข้อความ start/stop ยังเข้า channel `global` แสดงว่า event ไม่ได้ถูกจับด้วย mapping `status` หรือข้อความนั้นมาจาก notifier/ปลั๊กอินคนละตัวกับ DiscordSRV

สถานะจากไฟล์จริงที่อ่านได้: `global` ชี้ไป `server-chat`, `status` ชี้ไป `server-realtime`, `deaths` ชี้ไป `server-chat`, ส่วน join/leave ต้องตรวจให้ใช้ชื่อ mapping ที่ DiscordSRV รองรับจริง (`join` และ `leave`) ไม่ใช่รวมเป็นชื่อเดียวหากต้องการ routing แยกประเภท


## เอกสารทางการที่ตรวจล่าสุด

แหล่งอ้างอิง: https://docs.discordsrv.com/config/

เอกสารระบุว่า `Channels` ใช้คู่ชื่อภายในกับ Discord channel ID โดย channel แรกเป็น main channel และข้อความประเภท start/stop จะใช้ mapping ชื่อ `status`; หากไม่มี mapping ที่ตรงประเภท ข้อความจะ fallback ไป channel แรก. ชื่อที่รองรับสำหรับ routing เฉพาะ ได้แก่ `global`, `status`, `deaths`, `join`, `leave` และ `watchdog`. ดังนั้น `status` ต้องอยู่ใน block `Channels` ของ config.yml และต้องชี้ไป channel ID ของ `server-realtime` ขณะที่ `global` และ `deaths` ชี้ไป `server-chat` ตามความต้องการของ RitzSMP.


## ข้อสรุปจากเอกสารทางการ

เอกสาร DiscordSRV ระบุว่า `Channels` อยู่ใน `config.yml` และรูปแบบคือ `{"Minecraft-Channel-Name": "Discord-Channel-ID"}` โดย channel แรกเป็น main channelและเป็น fallback สำหรับข้อความที่ไม่มี mapping เฉพาะ. Mapping เฉพาะที่รองรับคือ `global` สำหรับ chat, `status` สำหรับ server start/stop, `awards` สำหรับ advancement, `deaths` สำหรับ death, `join` และ `leave` สำหรับ join/quit. การตั้งชื่อ `join-leave` หรือการเพิ่มคีย์ custom ใน `synchronization.yml` ไม่ใช่ mapping มาตรฐานสำหรับ start/stop.

## หลักฐานตรวจซ้ำจากเซิร์ฟเวอร์จริง (26 สิงหาคม 2026)

- `config.yml` ของ DiscordSRV v1.30.5 มี `global: 1539202486311592016`, `status: 1530761640830832721`, `join-leave: 1530761640830832721` และ `deaths: 1539202951380205618` ใน block `Channels`.
- Log startup ล่าสุดยืนยันว่า DiscordSRV v1.30.5 เปิดใช้งานและเชื่อมต่อ JDA สำเร็จ แต่ไม่พบ log ที่ระบุการส่งข้อความ `Server has stopped` ไป channel ใดโดยตรง.
- จากภาพ Discord ข้อความ `Server has stopped` แสดงโดย BOT CHAT ใน `server-chat` จึงต้องตรวจต้นทาง status notifier หรือการตั้งค่า channel ของบอท/bridge เพิ่มเติม ไม่ควรสรุปว่าเป็นข้อความจาก `synchronization.yml` เพียงอย่างเดียว.

## ผลยืนยันเพิ่มเติม (26 สิงหาคม 2026)

เอกสารทางการยืนยันว่า `status` ใน `config.yml` เป็น mapping สำหรับ server start/stop และข้อความจะ fallback ไป channel แรกเมื่อไม่มี mapping ที่ตรงประเภท. จาก config จริง `status` ชี้ไป `server-realtime` แล้ว แต่ข้อความในภาพยังมาจาก BOT CHAT และอยู่ใน `server-chat`; จึงต้องตรวจ bridge หรือบอทที่ประกาศสถานะโดยตรงต่อไป.

แหล่งอ้างอิง: https://docs.discordsrv.com/config/
## บันทึกผลตรวจล่าสุด (26 สิงหาคม 2026)

อ้างอิงเอกสารทางการ: https://docs.discordsrv.com/config/

เอกสารยืนยันว่า `status` ใน `config.yml` เป็น mapping สำหรับ server start/stop และข้อความจะ fallback ไป channel แรกเมื่อไม่มี mapping ที่ตรงประเภท. จาก config จริง `status` ชี้ไป `server-realtime` แล้ว แต่ข้อความในภาพยังมาจาก BOT CHAT และอยู่ใน `server-chat`; จึงต้องตรวจ bridge หรือบอทที่ประกาศสถานะโดยตรงต่อไป.


## หลักฐานยืนยันจากเซิร์ฟเวอร์และ Discord API ล่าสุด (26 สิงหาคม 2026)

- รายการ `/plugins` มี `DiscordSRV-Build-1.30.5.jar` เป็นปลั๊กอิน bridge Discord เพียงตัวเดียวที่พบ; ไม่พบชื่อปลั๊กอิน bridge อื่น เช่น Dischook หรือ LiteDiscord. ยังมี `Skript` และปลั๊กอินแชทอื่น แต่ไม่มีหลักฐานว่าเป็นผู้ส่ง lifecycle message.
- ตรวจ identity จาก BotToken ภายใน `/plugins/DiscordSRV/config.yml` โดยไม่บันทึก token พบว่า DiscordSRV ใช้บัญชี `BOT CHAT#3673` (`1540762534603128913`) จึงยืนยันว่า BOT CHAT ในภาพคือ DiscordSRV ไม่ใช่บอทเว็บ `RitzSMP AI`.
- Discord API รายชื่อ channel ล่าสุดยืนยันว่า `1539202486311592016` คือ `👾︱server-chat` และ `1539202951380205618` คือ `👾︱server-raeltime` (สะกดชื่อห้องบน Discord ปัจจุบันเป็น `raeltime`). ID เดิม `1530761640830832721` ที่อยู่ใน DiscordSRV config ไม่ปรากฏในรายชื่อ channel ปัจจุบัน.
- Audit ข้อความย้อนหลัง 20 รายการจาก BOT CHAT พบ `Server has started/stopped` ที่ `server-chat` เวลา `2026-08-26T08:12:05Z`, `08:11:32Z` และ `08:29:33Z`; ไม่มี lifecycle message ใน `server-realtime` ปัจจุบัน. เวลาดังกล่าวตรงกับการ boot ล่าสุดใน log local time ประมาณ 15:29 (+07:00).
- ข้อสรุปเชิงสาเหตุ: mapping `status` ใน config ใช้ ID ห้องเก่าที่ถูกลบ/เปลี่ยน จึงไม่ชี้ไป channel ปัจจุบัน และ DiscordSRV fallback ไป channel แรกของ `Channels` ซึ่งคือ `global`/`server-chat`. การแก้ต้องเปลี่ยน `status` เป็น `1539202951380205618`; ควรเปลี่ยน `join-leave` เป็น mapping มาตรฐาน `join` และ `leave` ที่ ID เดียวกัน, คง `global` และ `deaths` เป็น `1539202486311592016`.

แหล่งข้อมูลภายนอกที่ใช้ประกอบ: DiscordSRV configuration documentation https://docs.discordsrv.com/config/ และ Discord API v10 endpoint `/guilds/{guild.id}/channels` ที่เรียกด้วยบัญชีผู้ใช้ของเซิร์ฟเวอร์.

## 2026-08-26 routing/economy verification

- หลัง restart เวลาโดยประมาณ 16:27 ตาม `logs/latest.log`, DiscordSRV 1.30.5 โหลดสำเร็จและเชื่อม JDA สำเร็จ
- ตรวจ Discord API ล่าสุด: `BOT CHAT` (ID 1540762534603128913) ส่ง `Server has started` เวลา 2026-08-26T09:27:39Z เข้า `server-realtime` (ID 1539202951380205618) แล้ว; ข้อความเก่าเวลา 08:12 และ 08:29 ยังอยู่ใน `server-chat` (ID 1539202486311592016) จึงเป็นประวัติก่อนแก้ ไม่ใช่ข้อความหลัง restart
- EssentialsX 2.22.0 และ FoShop 1.6 โหลดสำเร็จ; FoShop global-sell-prices เปิดใช้งานและมี `DIAMOND: enabled: true, price: 10.0`
- Essentials `worth.yml` มี `diamond: 10.00` แต่การทดสอบ console `worth diamond` บันทึกผล `Error: That item cannot be sold to the server.` จึงยังต้องทดสอบในบริบทผู้เล่นและตรวจ command/plugin precedence ก่อนสรุปว่าเศรษฐกิจผ่าน

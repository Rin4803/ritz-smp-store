# DiscordSRV routing reference

แหล่งอ้างอิงทางการที่ตรวจเมื่อ 2026-08-26:

- https://docs.discordsrv.com/config/
- https://docs.discordsrv.com/messages/
- https://docs.discordsrv.com/alerts/

เอกสาร `config.yml` ระบุว่า `Channels` ใช้ชื่อ Minecraft channel มาตรฐาน โดย key พิเศษที่ DiscordSRV route ให้เองคือ `global` สำหรับแชต, `status` สำหรับ server start/stop, `awards` สำหรับ achievement/advancement, `deaths` สำหรับ death, `join` สำหรับ join และ `leave` สำหรับ leave. ชื่อด้านซ้ายของคู่ mapping ไม่ใช่ชื่อ Discord channel แต่เป็น logical channel ของ DiscordSRV.

ข้อค้นพบจาก config จริงของ RitzSMP คือเดิมใช้ key `join-leave` และ `advancements` ซึ่งไม่ใช่ key มาตรฐานของ DiscordSRV จึงมีความเสี่ยงสูงที่ join/leave และ advancement จะ fallback ไปที่ channel หลัก `global` (`chat-game`). ได้แก้เป็น `join` และ `leave` ให้ชี้ไป `server-login` และ `awards` ให้ชี้ไป `advancement` แล้ว ส่วน `global`, `status`, `deaths` คง channel เดิมตาม requirement.

เอกสาร `messages.yml` ยืนยันว่า format ของ join/leave/death/achievement เป็นคนละ message type แต่ channel routing ต้องอาศัย logical keys ใน `config.yml`. เอกสาร `alerts.yml` เป็นระบบเสริมสำหรับ Bukkit/Paper events และไม่ควรใช้แทน built-in join/leave/advancement หากต้องการ routing มาตรฐาน.

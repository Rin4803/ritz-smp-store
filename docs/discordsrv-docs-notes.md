# DiscordSRV routing reference

แหล่งข้อมูลทางการ: https://docs.discordsrv.com/config/ (หน้า config.yml, เข้าถึงวันที่ 2026-08-26)

เอกสารระบุว่า `Channels` เป็น mapping ของชื่อช่องฝั่ง Minecraft ไปยัง Discord channel ID โดยช่องแรกเป็น main channel และมีชื่อพิเศษที่รองรับ ได้แก่ `global` สำหรับแชตผู้เล่น, `status` สำหรับ server start/stop, `awards` สำหรับ achievement/advancement, `deaths` สำหรับ death, `join` สำหรับ join และ `leave` สำหรับ leave. รูปแบบตัวอย่างคือ `Channels: { "global": "<DISCORD_CHANNEL_ID>", "admin": "<DISCORD_CHANNEL_ID>" }`.

แหล่งข้อมูลทางการ: https://docs.discordsrv.com/alerts/ (หน้า alerts.yml, เข้าถึงวันที่ 2026-08-26)

`alerts.yml` เป็นระบบ advanced สำหรับส่งข้อความเมื่อเกิด Bukkit/Paper event หรือมีการเรียก command โดยต้องระบุ `Trigger` และ `Channel` ตาม syntax ของ DiscordSRV. ไฟล์ `alerts.yml` live ที่ตรวจพบมีเพียงตัวอย่างที่ถูกคอมเมนต์ ไม่มี alert ที่เปิดใช้งานจริง.

หลักฐาน live server ที่ตรวจพบ: `/plugins/DiscordSRV/config.yml` มี `Channels` mapping แยก `global`, `status`, `join`, `leave`, `deaths`, `awards`; `/plugins/RitzAuctionBridge/config.yml` กำหนด `order-in-game-channel-id: "1542112620402970654"`, อ่าน log จาก `../AuctionHouse/logs`, และเปิด `forward-listings`/`forward-sales`. Log ล่าสุดระบุว่า RitzAuctionBridge v1.0.0 enable สำเร็จและทำงานแบบอ่านเฉพาะรายการลงขาย/ซื้อสำเร็จเพื่อส่งไป order-in-game.

ข้อควรระวัง: config audit ที่ดึงจาก live มี credential/token อยู่ในบางบรรทัด จึงไม่ควรนำค่า secret ไปใส่ในรายงานหรือ commit.

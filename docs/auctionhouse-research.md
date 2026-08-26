# AuctionHouse integration findings

วันที่ตรวจสอบ: 2026-08-26

แหล่งข้อมูล: ไฟล์จากเซิร์ฟเวอร์ Minecraft RitzSMP ผ่าน MCSV MCP

## ปลั๊กอินและการตั้งค่า

ปลั๊กอินตลาดประมูลที่ติดตั้งจริงคือ **AuctionHouse version 1.5.2** (`/plugins/AuctionHouse/config.yml` และไฟล์ข้อความของปลั๊กอิน)

ค่าที่เกี่ยวข้อง:

- `sold-message: true`
- `auto-collect: true`
- `auction-announcements: false`
- รองรับ `/ah sell` และ `/ah bid`
- placeholder ที่มีในข้อความ: `%player_name%`, `%seller%`, `%buyer%`, `%item%`, `%price%`

## Event/message ที่พบ

AuctionHouse มีข้อความสำหรับการซื้อสำเร็จใน `chat.purchase-auction` และข้อความสำหรับผู้ขายเมื่อขายสำเร็จใน `chat.sold-message.auto-collect` ซึ่งมีรูปแบบข้อมูลผู้ซื้อ สินค้า ผู้ขาย และราคา เช่น `%buyer%`, `%item%`, `%seller%`, `%price%`

ในไฟล์ config ที่อ่านได้ ไม่พบ webhook หรือ Discord destination โดยตรง และไม่พบการตั้งค่าให้ส่ง event ออก HTTP ดังนั้นการแจ้งเตือนเข้า Discord ต้องใช้แหล่ง event เพิ่มเติม เช่น DiscordSRV-compatible event/placeholder, Skript/ปลั๊กอิน bridge หรือ webhook adapter ที่รองรับ AuctionHouse 1.5.2

## ขอบเขตที่ต้องรักษา

ช่อง `order-in-game` ต้องใช้สำหรับ:

1. การลงรายการใน `/ah`: ผู้ขาย, ไอเทม, จำนวน, ราคา และประเภท BIN/BID ถ้าทราบ
2. การซื้อสำเร็จ: ผู้ซื้อ, ไอเทม, ผู้ขาย และราคาที่ซื้อ

ไม่ควรส่งแจ้งเตือนร้านค้าเว็บ, เติมเงิน หรือเติมยศเข้า `order-in-game` ตามข้อกำหนดล่าสุดของผู้ใช้

## ข้อควรระวัง

ก่อนแก้ไฟล์เซิร์ฟเวอร์จริง ต้องยืนยันวิธีรับ event ที่ใช้งานได้จริงจากปลั๊กอินที่ติดตั้งอยู่ ไม่ควรสร้าง event ปลอมหรืออ่านข้อความทั่วไปแบบเดา เพราะอาจทำให้แจ้งเตือนผิดรายการหรือซ้ำ
## ผลตรวจเพิ่มเติม 2026-08-26
- ปลั๊กอินที่เปิดใช้งานจริง: AuctionHouse-1.5.2.jar, DiscordSRV-Build-1.30.5.jar, Skript-2.16.1.jar และ PlaceholderAPI-2.12.3.jar
- orders.sk เป็นระบบ /order แบบกำหนดเอง ไม่ใช่ AuctionHouse และไม่มีการเชื่อม Discord
- plugin.yml ของ AuctionHouse ประกาศ main เป็น me.elaineqheart.auctionHouse.AuctionHouse, depend เฉพาะ Vault และ softdepend PlaceholderAPI/Locale-API; ไม่ประกาศ API package หรือ event dependency
- รายชื่อคลาสที่ตรวจพบมี commands, listeners และ data ภายใน แต่ยังไม่พบชื่อคลาสสาธารณะที่เป็น AuctionHouse event จากรายการ jar
- ขั้นต่อไปคือตรวจ bytecode/decompile เพื่อยืนยัน hook ก่อนเขียน bridge; ห้าม parse ข้อความทั่วไปหรือสร้างข้อมูลสมมติ

## แหล่งทางการที่ตรวจเพิ่มเติม 2026-08-26
- GitHub ของผู้พัฒนา: https://github.com/ElaineQheart/Auction-House เป็น open-source GPL-3.0; README อธิบายเพียงการเปิด /ah และไม่แสดงเอกสาร API/event/webhook
- Modrinth รุ่น 1.5.2: https://modrinth.com/plugin/auction-house-plugin/version/1.5.2 ระบุ compatibility Bukkit/Folia/Paper/Purpur/Spigot และลิงก์กลับไปยัง source เดิม; changelog รุ่นนี้ไม่ระบุ webhook หรือ Discord integration
- ขณะนี้ยังไม่มีหลักฐานจากเอกสารทางการว่า AuctionHouse 1.5.2 มี webhook หรือ public event API; ต้องตรวจ source/bytecode/decompile ต่อก่อนสร้าง bridge

## หลักฐานเพิ่มเติมจากการตรวจ source และ jar จริง (2026-08-26)

- AuctionHouse 1.5.2 เขียนธุรกรรมจริงลงไฟล์ `plugins/AuctionHouse/logs/YYYY-MM-DD-N.log` ผ่าน `TransactionLogger` โดย `logSetUpAuction` ใช้รูปแบบ `Player set up an auction: ... | Item: ... | Amount: ... | Price: ... | BID: ...` และ `logTransaction` ใช้รูปแบบ `Buyer: ... | Seller: ... | Item: ... | Amount: ... | Price: ... | BID: ...`.
- จุดบันทึก `logTransaction` อยู่หลัง `ItemNoteStorage.setSoldIfOnAuction(...)` สำเร็จ และหลังตรวจสอบการชำระเงิน/การ claim แล้ว จึงเหมาะเป็น event source ของการซื้อจริงมากกว่าการอ่านข้อความในเกม.
- ข้อมูล `ItemNote` ที่ source เปิดเผยมี `playerName`, `playerUUID`, `buyerName`, `buyerUUID`, `price`, `itemName`, `partiallySoldAmountLeft`, `noteID`, `isSold` และจำนวนไอเทมที่ซื้อถูกส่งเข้า transaction logger โดยตรง.
- DiscordSRV 1.30.5 ที่ติดตั้งจริงมี public API `DiscordSRV.getPlugin()`, `getJda()`, JDA `getTextChannelById(String)` และ JDA `TextChannel.sendMessage(MessageEmbed)`; จึงสามารถให้ companion bridge ใช้บอทเดิมส่ง Embed ไปยัง channel ID เฉพาะได้โดยไม่ต้องเพิ่ม Discord token อีกชุด.
- สรุปวิธีที่เลือก: companion Paper plugin จะ tail เฉพาะ AuctionHouse transaction log, parse เฉพาะ `Player set up an auction` และ `Buyer` entries, เก็บ cursor/dedup ในไฟล์ bridge และส่ง Embed ผ่าน DiscordSRV ไป `DISCORD_ORDER_IN_GAME_CHANNEL_ID`; ห้ามอ่าน chat ทั่วไปและห้ามสร้าง event จากข้อมูลที่ไม่มีใน log.
- แหล่งภายนอกที่ตรวจ: [AuctionHouse source repository](https://github.com/ElaineQheart/Auction-House), [AuctionHouse 1.5.2 release page](https://modrinth.com/plugin/auction-house-plugin/version/1.5.2).

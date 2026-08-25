# MCSV Export Inventory

วันที่ตรวจสอบ: 2026-08-25

## Root ที่พบ

เซิร์ฟเวอร์มีไดเรกทอรี `Lobby`, `config`, `plugins`, `plugins-disabled`, `logs`, `cache`, `libraries`, `versions` และไฟล์ระดับ root ของ Minecraft เช่น `server.properties`, `bukkit.yml`, `spigot.yml`, `commands.yml`, `permissions.yml`, `help.yml`, `RitzSMP-SUMMARY.txt`, `server-icon.png` และไฟล์สถานะผู้เล่น/การแบน

## กฎคัดออกจาก GitHub

ห้ามส่งออก `server.jar`, `logs/`, `cache/`, `libraries/`, `versions/`, `.cache/`, `.console_history`, `.mcsv-install.log`, `usercache.json`, `whitelist.json`, `ops.json`, `banned-players.json`, `banned-ips.json` และไฟล์ world/runtime ใด ๆ เนื่องจากเป็น binary, runtime data, ประวัติคำสั่ง หรือข้อมูลผู้เล่น/สิทธิ์

`server.properties` และไฟล์ config อื่น ๆ ต้องตรวจเนื้อหาแบบ redaction ก่อน หากมี RCON password, token, secret, IP ภายใน, webhook หรือ credential ให้แทนด้วย placeholder หรือเก็บเป็นตัวอย่างเท่านั้น

## สิ่งที่ต้องสำรวจต่อ

ต้องตรวจรายชื่อภายใน `plugins/`, `config/`, `Lobby/` และ `plugins-disabled/` แล้วเลือกเฉพาะ source/config ที่จำเป็นต่อการดูแลระบบ เช่น Skript source, DiscordSRV config ที่ลบ secret แล้ว, รายการคำสั่ง และคู่มือ setup

เอกสารนี้เป็น inventory ไม่ใช่ backup และไม่มีค่าลับจากเซิร์ฟเวอร์จริง

## Plugins ที่พบ

จาก inventory ของ `/plugins` พบปลั๊กอินที่เกี่ยวข้องกับระบบหลัก ได้แก่ `DiscordSRV`, `Skript`, `LuckPerms`, `Vault`, `PlayerPoints`, `Essentials`, `FoShop`, `AuctionHouse`, `AuthMe`, `Geyser-Spigot`, `floodgate`, `PlaceholderAPI`, `TAB`, `LPC`, `InteractiveChat`, `MiniMOTD`, `FancyNpcs`, `DecentHolograms`, `ExcellentCrates`, `CrazyCrates`, `Multiverse-*`, `WorldEdit`, `ProtocolLib`, `GrimAC`, `voicechat`, `HomeForge`, `AmethystItems`, `DonutScoreboard`, `ajLeaderboards` และส่วนเสริมอื่น ๆ

ไม่ควรนำไฟล์ `.jar`, `.zip`, `.backup` หรือโฟลเดอร์ `_backups` เข้า GitHub เพราะเป็น binary/backup ขนาดใหญ่และอาจมีข้อมูล runtime หรือ license ที่ไม่ควรเผยแพร่ โดยเฉพาะไฟล์ `ritzsmp-economy-*.zip` ซึ่งเป็น backup ก่อนแก้ไข ไม่ใช่ source ที่ควรใช้เป็น repository หลัก

งานรวบรวมต่อควรเจาะเฉพาะไฟล์ `.sk`, `.yml`, `.yaml`, `.json` และ `.md` ที่จำเป็นจากโฟลเดอร์ config/plugin หลัง redaction เท่านั้น

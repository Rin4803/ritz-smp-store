# RitzSMP Server Export Manifest

วันที่จัดทำ: 25 สิงหาคม 2026 (เวลาไทย)

## สรุป

ชุดข้อมูลเซิร์ฟเวอร์ Minecraft ถูกสำรองด้วยระบบ MCSV แบบ **full server backup** สำเร็จแล้ว โดยรวมไฟล์ทั้งหมดของเซิร์ฟเวอร์ในขณะสร้าง backup ข้อมูลนี้ไม่ควรนำไปเผยแพร่สาธารณะ เพราะอาจมีโลกเซิร์ฟเวอร์ ข้อมูลผู้เล่น การตั้งค่า plugin และไฟล์ที่มีข้อมูลลับรวมอยู่ด้วย

| รายการ | ค่า |
|---|---|
| ชื่อ backup | `RitzSMP-full-server-export-2026-08-25` |
| Backup UUID | `8d272ad2-3942-41f0-95c8-91de67c3aa1d` |
| สถานะ | สำเร็จ |
| ขนาด | 2,248,571,172 bytes โดยประมาณ |
| ประเภท | Full server backup (`tar.gz`) |
| วิธีรับไฟล์ | เปิดหน้าเซิร์ฟเวอร์ใน MCSV → เมนู **Backups** → เลือกชื่อ backup → Download |

## โครงสร้างที่สำรวจพบจาก root

รายการระดับ root ที่พบและถูกรวมอยู่ใน full backup ได้แก่ `.cache`, `Lobby`, `cache`, `config`, `libraries`, `logs`, `plugins`, `plugins-disabled`, `versions`, `.console_history`, `.mcsv-install.log`, `.mcsv-java-gamerules.json`, `.update-geyser.sh`, `RitzSMP-SUMMARY.txt`, `banned-ips.json`, `banned-players.json`, `bukkit.yml`, `commands.yml`, `eula.txt`, `help.yml`, `ops.json`, `permissions.yml`, `server-icon.png`, `server.jar`, `server.properties`, `spigot.yml`, `usercache.json`, `version_history.json`, `wepif.yml` และ `whitelist.json`.

## การคัดกรองความลับ

ไฟล์ full backup จาก MCSV เป็นสำเนาสำหรับเจ้าของเซิร์ฟเวอร์ จึง **ไม่ใช่ชุดสำหรับอัปโหลด GitHub** และไม่ควรส่งต่อผ่านลิงก์สาธารณะ ผมไม่ได้คัดลอก token, password, private key หรือ environment values ลงใน source export ของเว็บ หากต้องแชร์โค้ดกับผู้อื่น ให้ใช้ไฟล์ source export ที่ปลอดภัยแยกต่างหากแทน

## ข้อจำกัดการสร้าง ZIP เพิ่ม

การสร้าง ZIP ซ้ำผ่าน File API ถูกระบบป้องกันไว้ เนื่องจากพบโฟลเดอร์ลึกเกิน 6 ชั้นใน `plugins/ajLeaderboards/libs/...` ดังนั้นวิธีที่รักษาความครบถ้วนที่สุดคือใช้ full backup ที่ MCSV สร้างไว้แล้วผ่านเมนู Backups โดยตรง

## วิธีดาวน์โหลดแบบเข้าใจง่าย

1. เข้าหน้าเซิร์ฟเวอร์ RitzSMP ใน MCSV
2. เปิดเมนู **Backups**
3. ค้นหารายการ `RitzSMP-full-server-export-2026-08-25`
4. ตรวจ UUID ให้ตรงกับ `8d272ad2-3942-41f0-95c8-91de67c3aa1d`
5. กด **Download** และเก็บไฟล์ไว้ในคอมพิวเตอร์ที่ปลอดภัย
6. ห้ามอัปโหลดไฟล์นี้เข้า GitHub, Discord หรือเว็บไซต์สาธารณะ

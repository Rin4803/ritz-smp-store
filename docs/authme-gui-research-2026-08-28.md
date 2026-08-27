# AuthMe GUI Login Research — 2026-08-28

การตรวจสอบข้อมูลสาธารณะพบว่า AuthMeReloaded มีรุ่นแยกตามแพลตฟอร์มและรองรับ Paper 1.21+ ตามหน้า release ของโครงการ แต่เซิร์ฟเวอร์ RitzSMP ใช้ fork `AuthMe v5.7.0-FORK-b53` จึงยังไม่ควรแทนที่ JAR เดิมโดยไม่ทดสอบฐานข้อมูลและการ bypass ของ Bedrock.

ผลการค้นพบทางเลือกมีดังนี้:

| ทางเลือก | สิ่งที่พบ | ความเสี่ยง/สถานะ |
|---|---|---|
| AuthMeReloaded รุ่นใหม่ | โครงการหลักมีเอกสารและรุ่นสำหรับ Paper 1.21+ | ต้องตรวจ compatibility กับ fork และสำรองฐานข้อมูลก่อน จึงยังไม่ติดตั้ง |
| AuthMeUI | มีโครงการบน Modrinth ที่ระบุรองรับ Minecraft 1.21.x | ต้องยืนยันว่าเชื่อมกับ fork รุ่นที่ใช้อยู่และไม่เปลี่ยน Floodgate bypass ก่อนติดตั้ง |
| authmebia | ระบุว่าแทน chat login/register ด้วย native dialog สำหรับ 1.21.6+ | เป็นทางเลือกใหม่ ต้องตรวจ dependency, release artifact และ AuthMe API ก่อน |
| Floodgate | เอกสาร Geyser ระบุว่า key/ระบบ Floodgate ใช้ช่วยให้ Bedrock bypass Java authentication | ต้องคง `bedrockAutoLogin: true` และทดสอบเฉพาะ Bedrock หลังเพิ่ม GUI |

แหล่งอ้างอิง: [AuthMeReloaded Hangar](https://hangar.papermc.io/0D00_0721/AuthMeReReloaded), [AuthMeReloaded releases](https://github.com/AuthMe/AuthMeReloaded/releases), [AuthMeUI Modrinth](https://modrinth.com/project/xwRjZuDG), [authmebia Modrinth](https://modrinth.com/plugin/authmebia), [Floodgate setup](https://geysermc.org/wiki/floodgate/setup/).

ข้อสรุปเชิงปฏิบัติ: ยังไม่ติดตั้ง addon หรือแทนที่ AuthMe ใน live server จนกว่าจะตรวจไฟล์ release/การรองรับ API กับ fork และทำ backup เพิ่ม การเปลี่ยนที่ปลอดภัยที่สุดคือใช้ GUI addon ที่เป็น non-destructive ต่อฐานข้อมูล AuthMe และให้ Bedrock bypass ทำงานจาก Floodgate เดิม.

# คู่มือตั้งค่าระบบรายงานผู้เล่น RitzSMP

## ภาพรวม

สมาชิกทุกคนสามารถเปิดระบบจากปุ่ม `ritz_report_button` ใน onboarding panel ของ RitzSMP AI ได้ ระบบจะแสดงเมนูเลือกผู้เล่นจากบัญชี Discord/Minecraft ที่เชื่อมกัน แล้วเปิด modal ให้เลือกหมวดหมู่และกรอกรายละเอียด ระบบตรวจรูปแบบข้อมูลก่อนสร้างรายงานและไม่เปิดเผยข้อมูลลับในข้อความตอบกลับหรือ Minecraft chat

## Interaction IDs

| ส่วน | Custom ID |
|---|---|
| ปุ่มเริ่มรายงาน | `ritz_report_button` |
| เมนูเลือกผู้ถูกรายงาน | `ritz_report_target` |
| modal สร้างรายงาน | `ritz_report_modal` |
| ปุ่มแก้ไขรายงาน | `ritz_report_edit` |
| modal แก้ไขรายงาน | `ritz_report_edit_modal` |

## Environment

ต้องกำหนด `DISCORD_REPORT_CHANNEL_ID` เป็น Channel ID ของห้องสำหรับทีมงานตรวจรายงาน ระบบใช้ token ของ AI bot ตามการตั้งค่าเดิม และไม่ใช้ token ของ music bot หรือ DiscordSRV แทน หากไม่พบ channel หรือ token ระบบจะคืนผลลัพธ์แบบปลอดภัยและไม่ทำให้ interaction ค้าง

คูลดาวน์อ่านจาก `PLAYER_REPORT_COOLDOWN_SECONDS` หากไม่ได้กำหนดจะใช้ค่าโหมดทดสอบ `0` วินาทีตามงานรอบแรก เมื่อพร้อมเปิดใช้จริงให้กำหนดเป็น `900` วินาที หรือ 15 นาที โดยไม่ต้องแก้ flow หลัก

## กฎข้อมูล

ผู้รายงานไม่ต้องมี role พิเศษ แต่ต้องอยู่ใน guild ที่ส่ง interaction และต้องกรอกหมวดหมู่ที่ระบบอนุญาตกับรายละเอียดที่มีความยาวตาม validation ผู้ถูกรายงานต้องเป็นรายการบัญชีที่มีอยู่ในข้อมูลการเชื่อมจริง ไม่รับชื่อที่ผู้ใช้พิมพ์เองเพื่อป้องกันการปลอมแปลงเป้าหมาย

รายงานหนึ่งรายการแก้ไขได้ **เพียงหนึ่งครั้ง** โดยเจ้าของรายงานเท่านั้น หลังแก้ไขสำเร็จระบบจะล็อกการแก้ไขเพิ่มเติมและปรับ Embed ให้แสดงสถานะแก้ไข การแก้ไขจะไม่รีเซ็ตหรือขยาย cooldown ของการสร้างรายงานใหม่

## การแจ้งเตือน

เมื่อบันทึกรายงานสำเร็จ ระบบจะส่ง Embed ไปยัง channel ที่กำหนด โดยประกอบด้วยเลขที่รายงาน ผู้รายงาน เป้าหมาย Discord เป้าหมาย Minecraft หมวดหมู่ และรายละเอียด จากนั้นส่ง safe summary ผ่าน RCON ไปยัง Minecraft โดยไม่ส่งรายละเอียดหลักฐานหรือ token ลงแชตเกม

## ทะเบียนคำสั่งบอท

AI และ Music มี command registry ของตนเองสำหรับ slash commands ส่วน DiscordSRV ในโปรเจกต์นี้เป็น bridge ฝั่ง Minecraft ไม่ใช่ Discord gateway bot จึงมีทะเบียนแยกแบบอ่านอย่างเดียวใน `server/discordSrvCommandRegistry.ts` สำหรับคำสั่งเดิม `discordsrv force-link` และไม่ลงทะเบียนซ้ำเป็น Discord slash command การจัดระเบียบนี้ไม่แก้ channel mapping, role, token หรือ bridge เดิม

## ผลการตรวจสอบ

ชุดทดสอบล่าสุดผ่าน 154 tests และข้าม 4 tests ที่เป็น live/external validation ตามเงื่อนไขของ test suite TypeScript check ผ่าน และมีการรีสตาร์ท dev server สำเร็จหลังแก้ transform error จาก log เก่า การทดสอบ production แบบกดปุ่มจริงและตรวจข้อความใน Discord/Minecraft ยังควรทำโดยผู้ดูแลหลังตรวจว่า channel ID และ RCON พร้อมใช้งาน

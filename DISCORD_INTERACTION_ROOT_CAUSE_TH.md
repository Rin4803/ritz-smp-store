# ผลวินิจฉัยปุ่มแผงรายชื่อบัญชี

## ข้อเท็จจริงที่ยืนยันได้ — 25 สิงหาคม 2026

| รายการ | หลักฐาน | ข้อสรุป |
|---|---|---|
| เจ้าของข้อความแผงเดิม | Discord REST แบบอ่านอย่างเดียวพบ `authorId` เป็น `1539911381069864980` และปุ่มมี custom ID `ritz_profile_button`, `ritz_discord_members_button`, `ritz_players_button`, `ritz_unlink_button` | ข้อความเป็นของ RitzSMP AI application เดียวกับที่กำหนด HTTP endpoint |
| Endpoint ใน Developer Portal | บันทึกเป็น `https://ritzsmpstore-94jhsfkx.manus.space/api/discord/interactions` | URL ถูกต้อง ไม่ได้ว่างหรือชี้ไปยังโดเมนอื่น |
| ข้อความที่ผู้ใช้พบ | ตรงตัวกับ fallback ใน checkpoint `7ca8ddf5` ก่อนเพิ่ม 3 action | interaction ถูกตอบด้วย deployment เก่า ไม่ใช่ handler ของ checkpoint `cb6cbe23` |
| ลำดับเวลา | ภาพผู้ใช้เวลา 20:46 (GMT+7); production logs เริ่ม server ใหม่เวลา 13:50 UTC = 20:50 (GMT+7) | ผลกดปุ่มเกิดก่อน production runtime ใหม่เริ่มทำงาน |

> สรุป: ยังไม่มีหลักฐานว่า custom ID ผิดหรือข้อความแผงเป็นของบอทคนละตัว ปัญหาที่พบสอดคล้องกับการทดสอบในช่วง deployment เก่ายังตอบคำขออยู่ การทดสอบครั้งถัดไปต้องทำหลัง runtime ใหม่เริ่มแล้ว และดูว่ามีข้อความของ handler ใหม่หรือไม่

## ผลการทดสอบหลัง runtime ใหม่เริ่ม

| รายการ | หลักฐานแบบไม่เปิดเผยข้อมูลสมาชิก | ข้อสรุป |
|---|---|---|
| ปุ่ม HTTP ทั้งสาม | ผู้ใช้กดหลัง 21:05 และได้รับโปรไฟล์ของตน, สถานะ Minecraft `0/20`, และข้อความสรุปสมาชิก | ปุ่มถึง HTTP endpoint ใหม่แล้ว ไม่ได้ใช้ fallback ของ Gateway เดิม |
| Discord Guild Members REST | คำขอ read-only สำเร็จ (`HTTP 200`) และคืนสมาชิก 25 รายการ โดยตัวอย่างมี `user.id` แต่ไม่มี `id` ระดับบน | Discord ส่ง ID ของสมาชิกไว้ภายใน `user` ตาม payload จริง |
| สาเหตุจำนวนสมาชิกเป็น 0 | parser เดิมตรวจ `member.id` แล้วกรองทุกผลลัพธ์ออก | แก้ให้ตรวจ `member.user.id` พร้อมเพิ่ม regression test แล้ว |

> ขอบเขตการตรวจครั้งนี้จำกัดเฉพาะจำนวนและโครงสร้างข้อมูล จึงไม่บันทึกหรือแสดงชื่อ, ID, อีเมล, token หรือข้อมูลส่วนบุคคลของสมาชิก

เอกสารนี้ไม่มี token, public key, รหัส RCON, ข้อมูลสมาชิก หรือค่า secret ใด ๆ

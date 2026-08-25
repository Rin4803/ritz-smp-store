# บันทึกการตรวจเส้นทาง Discord Interaction

## 25 สิงหาคม 2026

ตรวจจากหน้า General Information ของ Discord Developer Portal สำหรับแอป **AI test / RitzSMP AI** (Application ID `1539911381069864980`) แล้วพบว่า Interaction Endpoint URL ที่บันทึกอยู่คือ

`https://ritzsmpstore-94jhsfkx.manus.space/api/discord/interactions`

ดังนั้นเมื่อผู้ใช้กดปุ่มบัญชี แต่ยังได้รับข้อความ fallback แบบเดิมจาก AI bot ปัญหาไม่ได้เกิดจาก URL ใน Developer Portal เป็นค่าว่างหรือชี้คนละโดเมน การแก้ไขถัดไปต้องตรวจว่า interaction ของข้อความแผงเดิมเป็นของ application เดียวกันและว่า Gateway/runtime เก่ากำลังรับ event ซ้อนหรือเป็น deployment คนละชุด

เอกสารนี้ไม่บันทึก token, รหัส RCON, URL ฐานข้อมูล หรือค่า secret ใด ๆ

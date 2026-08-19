# คู่มือการย้าย Backend และฐานข้อมูลสู่ Google Cloud / Firebase

เอกสารนี้รวบรวมแนวทางและสถาปัตยกรรมสำหรับย้ายส่วน Backend API, ฐานข้อมูล และการจัดเก็บไฟล์สลิปของ RitzSMP Web Store ไปยัง Google Cloud เพื่อให้ระบบทำงานเต็มรูปแบบบนโดเมนใหม่

## 1. องค์ประกอบที่ต้องย้าย
- **Frontend:** ย้ายไปที่ Firebase Hosting สำเร็จแล้ว (`https://ritzsmp-web-store.web.app`)
- **Backend API (Node.js/Express/tRPC):** แนะนำให้ deploy บน **Google Cloud Run** ซึ่งรองรับ Container และเชื่อมต่อฐานข้อมูลได้อย่างปลอดภัย
- **Database:** ย้ายจาก SQLite ภายใน sandbox ไปยัง **Cloud SQL (MySQL/PostgreSQL)** หรือ **Firebase Firestore**
- **File Storage (สลิปโอนเงิน):** ย้ายจากการเก็บชั่วคราวไปที่ **Google Cloud Storage (GCS)** หรือ **Firebase Storage**

## 2. ขั้นตอนการตั้งค่า Cloud Run สำหรับ Backend
1. สร้าง Dockerfile สำหรับรัน Express Server บน Cloud Run (มีเตรียมไว้แล้วในโปรเจกต์)
2. ตั้งค่า Environment Variables ใน Google Cloud Console (เช่น `DATABASE_URL`, `JWT_SECRET`, `DISCORD_WEBHOOK_URL`)
3. เชื่อมต่อโดเมนหลักของร้านค้า (เช่น `shop.ritzsmp.com`) เข้ากับ Cloud Run และ Firebase Hosting

## 3. ระบบสำรอง (Backup)
ระหว่างดำเนินการย้าย Backend ระบบบน Manus (`https://ritzsmpstore-94jhsfkx.manus.space`) จะยังคงเปิดใช้งานสำรองเพื่อไม่ให้กระทบต่อผู้เล่นในเซิร์ฟเวอร์

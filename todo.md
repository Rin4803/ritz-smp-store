# RitzSMP Web Store TODO

- [x] วางสเปกและออกแบบฐานข้อมูลสำหรับจัดการยศ ออเดอร์ และสลิป
- [x] สร้าง Schema ใน `drizzle/schema.ts` สำหรับตาราง `ranks` และ `orders`
- [x] เขียนและรัน Migration SQL สำหรับสร้างตารางในฐานข้อมูล
- [x] พัฒนากลไกอัปโหลดสลิปและบันทึกออเดอร์ใน tRPC routers
- [x] สร้างระบบแจ้งเตือนเจ้าของเซิร์ฟเวอร์ (Owner Notifications)
- [x] พัฒนาหน้าแรก (Store Landing & Ranks Catalog) และปรับแต่งเอกลักษณ์ RitzSMP Realm Identity
- [x] พัฒนาหน้าฟอร์มสั่งซื้อ (Checkout & Slip Upload) พร้อมแสดงบัญชีออมสินและ PromptPay ชัดเจน
- [x] พัฒนาหน้าประวัติการซื้อของผู้เล่น (My Orders) พร้อม Robust Error & Loading States
- [x] พัฒนาหน้า Dashboard สำหรับแอดมินเพื่อตรวจสอบและเปลี่ยนสถานะออเดอร์ พร้อมดูสลิป
- [x] เพิ่ม Vitest coverage ครอบคลุมทั้ง Catalog, Auth Guards, Success Paths ของ Order Creation และ Admin Status Management
- [x] ตรวจสอบ Responsive (Mobile & Desktop), Build ผ่าน และเตรียมข้อมูลสรุปสำหรับนำไปใช้งานจริง

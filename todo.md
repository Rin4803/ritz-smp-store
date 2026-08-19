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
- [x] RCON rank fulfillment integration for order approval
- [x] Discord webhook notification integration for new orders and approvals
- [x] ตรวจสอบและเพิ่มรายการยศทั้งหมดให้แสดงใน Web Store และเชื่อมโยงกับข้อมูลยศใน Discord
- [x] แยกข้อมูลทดสอบออเดอร์ออกจาก ID ของยศจริง เพื่อไม่ให้ Vitest เขียนทับ Emperor ในฐานข้อมูลจริง
- [ ] เพิ่ม Discord Role ID จริงของแต่ละยศเมื่อผู้ใช้จัดเตรียม ID เพื่อให้การอนุมัติออเดอร์ผูกยศ Discord ได้
- [x] แยก Vitest ออกจากฐานข้อมูลจริงด้วย mock และล้างข้อมูลทดสอบอัตโนมัติหลังจบเทสต์
- [x] mock DB helper ใน `server/store.orders.test.ts` และเพิ่มหลักฐานว่า Vitest ทั้งชุดไม่เชื่อมต่อฐานข้อมูลจริง

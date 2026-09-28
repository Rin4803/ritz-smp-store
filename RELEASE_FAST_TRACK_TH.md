# RitzSMP Store — Fast Release Track

เป้าหมาย: เปิดเว็บร้านให้ผู้เล่นใช้งานจริงเร็วที่สุด โดยใช้ source ที่มีอยู่ใน repository เป็นหลัก และไม่แตะ secret จริง

## สถานะที่ตรวจพบ

- Web app หลัก: React + Vite + Express + tRPC + Drizzle/MySQL
- มีหน้า Home, Account, Admin, Bot Dashboard และ Server Directory
- Store flow หลักมี Wallet, Top-up พร้อมสลิป, ซื้อยศ และ RCON fulfillment
- Discord AI / Discord integration / Minecraft integration มี source และ test จำนวนมาก
- มี Docker Compose สำหรับ app + MariaDB + AI bot และ profile music
- มี Store API แยกอีกชุด (store-api/) สำหรับ UUID, player-seen, link-code, Wallet ledger และ delivery queue
- Firebase Hosting config ยังไม่อยู่ใน repository ปัจจุบัน
- root GitHub Pages preview ไม่ใช่ production backend

## สิ่งที่ต้องให้พร้อมก่อนเปิดจริง

### 1. Web + API
- Build ผ่าน pnpm run build
- GET /healthz ต้องตอบ 200
- หน้า / ต้องโหลดจาก production build
- /api/trpc/* ต้องเข้าถึง backend เดียวกับหน้าเว็บ
- session/cookie ต้องทำงานบน HTTPS

### 2. Account
เป้าหมายคือผู้เล่น RitzSMP เท่านั้น:
- Login เว็บ
- Link Minecraft UUID ผ่าน flow ที่ยืนยันจากในเกม
- Java และ Bedrock ใช้ flow เดียวกัน
- ห้ามใช้ชื่อ IGN อย่างเดียวเป็นหลักฐาน ownership
- Purchase ต้องผูกกับบัญชี/UUID ที่ยืนยันแล้ว

### 3. Wallet / Store
- Top-up = แนบสลิป + รอแอดมินอนุมัติ
- อนุมัติ top-up แล้วจึง credit Wallet
- ซื้อยศใช้ Wallet
- ห้าม browser เป็นคนกำหนดราคา
- หัก Wallet และสร้าง order ต้องมี idempotency/transaction protection
- RCON ล้มเหลวต้องไม่แสดงว่าส่งยศสำเร็จ

### 4. Minecraft delivery
- RCON credentials อยู่ใน secret/env เท่านั้น
- ใช้ LuckPerms สำหรับ rank grant
- รายการ purchase ต้องตรวจผล RCON ก่อน mark สำเร็จ
- UUID/IGN ต้องถูกตรวจสอบกับระบบเชื่อมบัญชี

### 5. Discord
- AI Gateway และ Music Gateway แยก token/process
- Store notifications ใช้ AI bot/API ตาม config
- ช่อง purchase / donate / Minecraft status / music แยกหน้าที่กัน

### 6. Deployment ที่เร็วที่สุด
สถาปัตยกรรมปัจจุบันเหมาะกับ persistent Node runtime + MariaDB มากกว่า static Firebase Hosting เพียงอย่างเดียว

เส้นทางเร็ว:
1. Deploy app + db ด้วย Docker Compose บน persistent host/VPS
2. เปิด HTTPS reverse proxy ให้ app:3000
3. Run AI bot แยก container
4. ใช้ Firebase ต่อเป็น frontend/redirect ได้ภายหลัง แต่ไม่ควรทำให้ Firebase Hosting อย่างเดียวเป็นตัว backend

## ห้ามทำ
- ห้าม commit token/password
- ห้ามเอา .env จริงขึ้น Git
- ห้าม mark order สำเร็จเพราะแค่สร้างรายการ
- ห้ามถือว่า IGN ที่กรอกบนเว็บ = เจ้าของบัญชี
- ห้ามแก้ production secret จาก source control

## Release gate
[ ] production runtime ทำงาน
[ ] database migration สำเร็จ
[ ] HTTPS + cookie/session สำเร็จ
[ ] login สำเร็จ
[ ] Minecraft link สำเร็จ
[ ] Wallet read/write สำเร็จ
[ ] top-up + admin approval สำเร็จ
[ ] purchase + RCON delivery สำเร็จ
[ ] order history สำเร็จ
[ ] Discord notification สำเร็จ
[ ] health check สำเร็จ
[ ] mobile flow สำเร็จ
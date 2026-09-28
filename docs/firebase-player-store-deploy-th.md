# แนวทาง Deploy เว็บร้านค้า RitzSMP ไป Firebase

## สถาปัตยกรรม

หน้าเว็บผู้เล่นจะถูก build เป็นไฟล์ static แล้วให้ Firebase Hosting เสิร์ฟ ส่วนคำขอ `/api/**` จะถูกส่งต่อไปยัง Cloud Run service ชื่อ `ritz-smp-store-api` ใน region `asia-southeast1` โดยใช้ backend Express เดิมของโปรเจกต์

วิธีนี้ทำให้ผู้เล่นเห็นเฉพาะหน้าเติมเงินและซื้อยศ ขณะที่ logic Wallet, การตรวจสิทธิ์, การบันทึกออเดอร์ และการเชื่อมฐานข้อมูลยังใช้ backend เดิม

## ไฟล์ที่เตรียมไว้

- `.firebaserc` ผูก project ID กับ `ritzsmp-web-store`
- `firebase.json` ตั้ง Hosting, SPA fallback, cache headers และ rewrite `/api/**` ไป Cloud Run
- `Dockerfile` ใช้ build backend เดิมสำหรับ Cloud Run
- `railway.json` ยังคงเก็บไว้เป็นแผนสำรองและไม่เกี่ยวกับ Firebase

## สิ่งที่ต้องตั้งใน Cloud Run Secret/Environment Variables

ต้องตั้งจาก Firebase/Google Cloud Console หรือ Secret Manager เท่านั้น ห้ามเขียนค่าจริงลง Git:

- `DATABASE_URL`
- `JWT_SECRET`
- OAuth variables ของระบบเดิม
- storage variables สำหรับเก็บสลิป
- `DISCORD_*` เฉพาะกรณีต้องการแจ้งเตือนคำสั่งซื้อเข้า Discord
- `RCON_*` เฉพาะกรณีต้องการส่งยศเข้า Minecraft อัตโนมัติ

## ขั้นตอน deploy ที่ปลอดภัย

1. Login ด้วย Firebase CLI ในบัญชีเจ้าของ project `ritzsmp-web-store`
2. Build project ด้วย `pnpm build`
3. Deploy backend container ไป Cloud Run service `ritz-smp-store-api`
4. ตั้ง Cloud Run environment variables และตรวจ `/healthz`
5. Deploy `dist/public` ไป Firebase Hosting
6. ทดสอบ Login, เปิดดูยศ, เติมเงินด้วยรายการทดสอบ, ดู Wallet และซื้อยศด้วย test account
7. ตรวจว่า user หนึ่งเห็นเฉพาะ orders และ wallet ของตนเอง
8. เปลี่ยน custom domain หลัง rollback target และ backup พร้อม

## ข้อควรระวัง

Firebase Hosting อย่างเดียวไม่สามารถรัน Express/tRPC backend ได้ จึงต้องมี Cloud Run คู่กัน และ Cloud Run ต้องเข้าถึงฐานข้อมูลเดิมได้อย่างปลอดภัย การ deploy จะยังไม่ถือว่าเสร็จจนกว่าจะตรวจ database connection, login cookie, storage ของสลิป และการส่งคำสั่งซื้อครบทุกขั้นตอน

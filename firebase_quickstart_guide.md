# คู่มือสร้าง URL บน Firebase อย่างรวดเร็ว

เพื่อให้ได้ลิงก์เว็บไซต์ใหม่ที่ไม่มีคำว่า `manus` และพร้อมนำไปใส่ใน Discord คุณสามารถทำตาม 3 ขั้นตอนง่ายๆ บนเครื่องของคุณได้ทันที:

## 1. ติดตั้ง Firebase Tools
เปิด Terminal หรือ Command Prompt ในเครื่องของคุณแล้วพิมพ์:
```bash
npm install -g firebase-tools
```

## 2. ล็อกอินและสร้างโปรเจกต์
เข้าสู่ระบบบัญชี Google ของคุณ:
```bash
firebase login
```
จากนั้นเชื่อมต่อโปรเจกต์ Firebase:
```bash
firebase init hosting
```
- เลือก **Use an existing project** หรือสร้างใหม่
- กำหนด Public directory เป็น: `dist/public`
- กำหนดค่า Single-page app (Rewrite URLs to /index.html): ตอบ **Yes**

## 3. Deploy และรับ URL
เมื่อตั้งค่าเรียบร้อยแล้ว ให้รันคำสั่ง Build และ Deploy:
```bash
pnpm build
firebase deploy --only hosting
```
ระบบจะแสดง URL ใหม่ของคุณทันที เช่น `https://ritzsmp-store.web.app` หรือ `https://ritzsmp-store.firebaseapp.com`

---
เมื่อคุณได้ URL ใหม่นี้แล้ว สามารถส่งมาให้ผมเพื่อนำไปอัปเดตใส่ในข้อความร้านค้า Discord ได้ทันที โดยระบบ Manus เดิมจะยังคงเปิดสำรองไว้ตามปกติครับ

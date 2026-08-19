# คู่มือการย้าย RitzSMP Web Store ไปยัง Google Cloud / Firebase

คู่มือนี้จัดทำขึ้นเพื่อช่วยให้คุณนำโปรเจกต์ RitzSMP Web Store ไปติดตั้งบน Google Cloud และ Firebase เพื่อให้เว็บไซต์ไม่มีคำว่า `manus.space` ใน URL พร้อมตั้งค่า SEO ให้ติด Google Search ได้อย่างสมบูรณ์ โดยยังคงเปิดเว็บไซต์บน Manus ไว้เป็นระบบสำรองจนกว่าการย้ายจะเสร็จสิ้น

---

## ขั้นตอนที่ 1: เตรียมโปรเจกต์บน Google Cloud และ Firebase

1. ไปที่ [Firebase Console](https://console.firebase.google.com/) และสร้างโปรเจกต์ใหม่ (เช่น `ritz-smp-store`)
2. เปิดใช้งาน **Firebase Hosting** ในโปรเจกต์
3. ติดตั้ง Firebase CLI บนเครื่องของคุณ:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
4. เชื่อมต่อโปรเจกต์ที่สร้างในโฟลเดอร์โปรเจกต์:
   ```bash
   firebase use --add
   ```

---

## ขั้นตอนที่ 2: การสร้างและติดตั้ง Backend บน Cloud Run

เนื่องจากเว็บสโตร์มีระบบ tRPC, ฐานข้อมูล และ RCON จึงต้องรันส่วน Backend บน **Google Cloud Run** โดยใช้ Dockerfile ที่เตรียมไว้ในโปรเจกต์:

1. เปิดใช้งาน Google Cloud Project และเปิด Cloud Build / Artifact Registry API
2. บิวด์และส่ง Container Image ขึ้น Google Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/ritz-smp-api
   ```
3. Deploy ขึ้น Cloud Run:
   ```bash
   gcloud run deploy ritz-smp-api \
     --image gcr.io/YOUR_PROJECT_ID/ritz-smp-api \
     --platform managed \
     --region asia-southeast1 \
     --allow-unauthenticated \
     --set-env-vars DATABASE_URL=...,JWT_SECRET=...
   ```

---

## ขั้นตอนที่ 3: การ Deploy หน้าเว็บไปที่ Firebase Hosting

1. แก้ไขไฟล์ `firebase.json` ให้ชี้ API rewrite ไปยัง URL ของ Cloud Run ที่ได้จากขั้นตอนที่ 2
2. สร้างไฟล์สำหรับ Production:
   ```bash
   pnpm build
   ```
3. สั่ง Deploy ขึ้น Firebase Hosting:
   ```bash
   firebase deploy --only hosting
   ```

---

## ขั้นตอนที่ 4: การตั้งค่า Custom Domain และ Google SEO

1. ไปที่ **Firebase Hosting Dashboard** เลือก **Add Custom Domain**
2. ใส่โดเมนของคุณเอง (เช่น `shop.ritzsmp.com` หรือโดเมนที่คุณซื้อไว้)
3. ยืนยันตัวตนโดเมนตามคำแนะนำของ Google
4. เพิ่ม `robots.txt` และ `sitemap.xml` ในโฟลเดอร์ `client/public/` เพื่อให้ Googlebot สามารถเข้ามาเก็บข้อมูลเว็บสโตร์และติดหน้าแรก Google Search ได้ทันที

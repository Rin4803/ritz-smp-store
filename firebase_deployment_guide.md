# คู่มือการติดตั้งและใช้งาน RitzSMP Web Store บน Firebase Hosting และ Google Cloud Run

คู่มือนี้จัดทำขึ้นเพื่อให้คุณสามารถย้ายเว็บไซต์ RitzSMP Web Store จากแพลตฟอร์ม Manus ไปยัง **Firebase Hosting** (สำหรับหน้าเว็บ React) และ **Google Cloud Run** (สำหรับ Backend API และฐานข้อมูล) เพื่อนำคำว่า `manus` ออกจากลิงก์และทำให้เว็บไซต์สามารถค้นพบบน Google Search (SEO) ได้อย่างสมบูรณ์

---

## 1. สถาปัตยกรรมระบบหลังย้าย
- **Frontend (หน้าเว็บร้านค้าและแดชบอร์ด):** โฮสต์บน **Firebase Hosting** (รองรับ Custom Domain เช่น `shop.ritzsmp.com` และทำ SEO ได้เต็มรูปแบบ)
- **Backend (API, tRPC, ฐานข้อมูล และ RCON):** รันบน **Google Cloud Run** (เชื่อมต่อผ่าน Docker Container ที่เตรียมไว้)
- **ระบบสำรอง:** เว็บไซต์เดิมบน Manus ยังคงเปิดใช้งานตามปกติจนกว่าคุณจะยืนยันว่าโดเมนและระบบบน Google Cloud ทำงานได้ครบถ้วน

---

## 2. ขั้นตอนการ Deploy หน้าเว็บไปยัง Firebase Hosting

1. ติดตั้ง Firebase CLI ในเครื่องคอมพิวเตอร์ของคุณ:
   ```bash
   npm install -g firebase-tools
   ```
2. เข้าสู่ระบบ Google / Firebase:
   ```bash
   firebase login
   ```
3. เริ่มต้นโปรเจกต์ Firebase ในโฟลเดอร์โปรเจกต์:
   ```bash
   firebase init hosting
   ```
   - เลือกโปรเจกต์ Firebase ของคุณ
   - ระบุ Public directory เป็น: `dist/public`
   - ตั้งค่าเป็น Single-page app (Rewrite ทุก URL ไปที่ `/index.html`): ตอบ **Yes**
   - ตั้งค่าทับไฟล์ index.html เดิมหรือไม่: ตอบ **No**
4. รันคำสั่ง Build โปรเจกต์เพื่อสร้างไฟล์แจกจ่าย:
   ```bash
   pnpm build
   ```
5. Deploy ขึ้น Firebase Hosting:
   ```bash
   firebase deploy --only hosting
   ```

---

## 3. ขั้นตอนการ Deploy Backend ไปยัง Google Cloud Run

1. ติดตั้งและตั้งค่า Google Cloud SDK (`gcloud` CLI) ในเครื่องของคุณ พร้อมเลือก Project ID
2. สร้าง Container Image และส่งขึ้น Google Container Registry (Artifact Registry):
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/ritz-smp-store
   ```
3. Deploy ขึ้น Cloud Run:
   ```bash
   gcloud run deploy ritz-smp-api \
     --image gcr.io/YOUR_PROJECT_ID/ritz-smp-store \
     --platform managed \
     --region asia-southeast1 \
     --allow-unauthenticated \
     --set-env-vars DATABASE_URL="YOUR_CLOUD_SQL_OR_MYSQL_URL",JWT_SECRET="YOUR_JWT_SECRET"
   ```

---

## 4. การปรับแต่ง Google SEO
ในโปรเจกต์นี้ได้เตรียมไฟล์สนับสนุน SEO ไว้เรียบร้อยแล้ว:
- `client/public/robots.txt`: อนุญาตให้ Googlebot เข้าถึงหน้าแรกและหน้าร้านค้า
- `client/public/sitemap.xml`: แผนผังเว็บไซต์สำหรับให้ Google Search Index หน้าเว็บ
- Meta Tags ใน `client/index.html`: ชื่อร้านและคำอธิบายรองรับภาษาไทยเพื่อการค้นหาที่ดีเยี่ยม

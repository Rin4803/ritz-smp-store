# รายงานผลการย้าย RitzSMP Web Store สู่ Firebase Hosting และ Google Cloud

โปรเจกต์ **RitzSMP Web Store** ได้รับการย้ายและเผยแพร่ขึ้นสู่โครงสร้างพื้นฐานของ Google Cloud / Firebase เป็นที่เรียบร้อยแล้ว โดยไม่มีคำว่า `manus` ใน URL และได้รับการปรับแต่งระบบ SEO (sitemap, robots.txt และ meta tags) เพื่อรองรับการค้นหาบน Google Search สำเร็จ

## ข้อมูลระบบใหม่

| รายการ | รายละเอียด |
|---|---|
| **URL เว็บไซต์ใหม่** | `https://ritzsmp-web-store.web.app` |
| **Hosting Platform** | Firebase Hosting (Asia Southeast) |
| **Google Cloud Project ID** | `ritzsmp-web-store` |
| **ระบบสำรอง (Backup)** | ระบบเดิมบน Manus (`https://ritzsmpstore-94jhsfkx.manus.space`) ยังคงเปิดใช้งานสำรองไว้ตามปกติจนกว่าคุณจะยืนยันความเรียบร้อย |
| **สถานะ Discord / RCON** | พร้อมใช้งาน โดยโครงสร้างข้อความร้านค้าและการแจ้งเตือนถูกออกแบบให้ชี้ไปยังลิงก์ใหม่ |

---

## ขั้นตอนการตรวจสอบและใช้งาน

1. เข้าชมเว็บไซต์ใหม่ผ่านทาง: [https://ritzsmp-web-store.web.app](https://ritzsmp-web-store.web.app)
2. ตรวจสอบหน้าแคตตาล็อกยศ 10 ระดับ ระบบสั่งซื้อ และหน้าอัปโหลดสลิป
3. หากต้องการเชื่อมต่อโดเมนส่วนตัว (เช่น `shop.ritzsmp.com`) สามารถไปที่ [Firebase Console Hosting](https://console.firebase.google.com/project/ritzsmp-web-store/hosting) แล้วกด **Add custom domain** ได้ทันที

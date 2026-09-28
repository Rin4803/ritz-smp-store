# RitzSMP Store — ระบบร้านเวอร์ชันใช้งานจริง

## เป้าหมาย

เว็บต้องให้ผู้เล่น Java และ Bedrock ใช้บัญชีเดียวกัน และ **ผู้ที่ไม่เคยเข้า RitzSMP จะไม่สามารถสร้างบัญชีร้านด้วยการกรอกชื่อ Minecraft เฉย ๆ**

ตัวตนหลักของระบบคือ Minecraft UUID ที่เซิร์ฟเวอร์ยืนยันแล้ว ไม่ใช่ชื่อที่กรอกในหน้าเว็บ

## Flow ผู้เล่น

1. ผู้เล่นเข้า RitzSMP อย่างน้อย 1 ครั้ง
2. ฝั่งเซิร์ฟเวอร์ส่ง `uuid + username + platform` ไปที่ Store API ผ่าน bridge secret
3. ผู้เล่นใช้คำสั่งเชื่อมบัญชีในเกมเพื่อรับ one-time link code
4. เปิดเว็บไซต์ → Login → กรอกรหัสที่ได้จากในเกม
5. Store API ตรวจว่า code ถูกออกโดยเซิร์ฟเวอร์และยังไม่หมดอายุ
6. สร้าง session ให้ UUID นั้น
7. เว็บไซต์โหลด Wallet, ยศ, Order และข้อมูลบัญชีจาก API

## Java / Bedrock

ทั้งสองระบบใช้ flow เดียวกัน ไม่ผูกเว็บกับ Java username หรือ Bedrock username โดยตรง

`platform` มีไว้สำหรับข้อมูล/การตรวจสอบเท่านั้น ส่วน authorization ใช้ UUID ที่เซิร์ฟเวอร์ยืนยัน

## การซื้อ

Browser ส่งแค่ `productId`

API เป็นคนอ่านราคาและผู้เล่นจาก session เอง จึงไม่เชื่อราคาที่ส่งจาก browser และไม่รับ UUID จาก browser สำหรับการซื้อ

Flow:

`Login → GET /api/me → POST /api/orders → delivery_queue → Minecraft bridge → delivered`

ถ้า Wallet ไม่พอ API ปฏิเสธคำสั่งซื้อ

## Delivery

ระบบไม่ให้หน้าเว็บรันคำสั่ง Minecraft เอง

Order จะเข้า `delivery_queue` ก่อน จากนั้น Minecraft-side bridge/worker ดึงรายการและดำเนินการในเซิร์ฟเวอร์ แล้วส่งผลกลับมาที่ API

สถานะ:

- `pending`
- `processing`
- `delivered`
- `failed`
- `refunded`

## สิ่งที่ยังต้องเชื่อมก่อนเปิดใช้งานจริง

- Deploy Store API บน backend ที่มี HTTPS
- ตั้ง `RITZ_BRIDGE_SECRET` เป็น secret ของ environment จริง
- ทำ bridge ใน RitzSMP ให้เรียก `/bridge/player-seen` ตอนผู้เล่นเข้าเซิร์ฟเวอร์
- ทำคำสั่งเชื่อมบัญชีที่ขอ `/bridge/link-code`
- ให้ bridge ดึง `/bridge/delivery` และ execute delivery ตาม product ที่ได้รับอนุญาต
- เปลี่ยน frontend จาก Preview login เป็น `/api/auth/link`
- เปลี่ยน Wallet จากข้อมูลตัวอย่างเป็น ledger จริง
- เพิ่ม webhook/payment provider จริงเมื่อเลือกช่องทางรับเงิน
- ตั้ง rate limit, reverse proxy และ HTTPS ก่อนเปิดระบบซื้อเงินจริง

## สิ่งที่ไม่ควรทำ

- อย่าใช้ IGN เป็นหลักในการยืนยันตัวตน
- อย่าเก็บ bridge secret ใน frontend หรือ GitHub
- อย่าให้ browser เป็นคนกำหนดราคา
- อย่าให้ browser ส่ง Minecraft command โดยตรง
- อย่าให้หน้า GitHub Pages มี database credentials

# RitzSMP Store API — Endpoint สรุป

## Public

`GET /health`

ตรวจสถานะ API

`GET /api/products`

คืนรายการสินค้าที่เปิดขาย พร้อมราคาและสิทธิ์

## Player authentication

`POST /api/auth/link`

Body:

```json
{ "code": "AB12CD34" }
```

Code ต้องมาจาก RitzSMP bridge และต้องยังไม่หมดอายุ/ยังไม่ถูกใช้

`GET /api/me`

Header:

`Authorization: Bearer <session-token>`

คืนข้อมูลผู้เล่น Wallet และ Order

`POST /api/logout`

ยกเลิก session ปัจจุบัน

## Store

`POST /api/orders`

Body:

```json
{ "productId": "noble" }
```

API จะอ่านราคาและ UUID จาก server-side session เอง

## Minecraft bridge

ทุก endpoint ใต้ `/bridge/*` ต้องส่ง `x-ritz-bridge-secret`

`POST /bridge/player-seen`

```json
{
  "uuid": "minecraft-uuid",
  "username": "PlayerName",
  "platform": "java"
}
```

`platform` รองรับ `java`, `bedrock`, `unknown`

`POST /bridge/link-code`

```json
{ "uuid": "minecraft-uuid" }
```

สร้าง one-time code สำหรับบัญชีที่มีประวัติการเข้า RitzSMP แล้ว

`GET /bridge/delivery`

ดึงงานส่งของที่รออยู่

`POST /bridge/delivery/:orderId`

```json
{ "success": true }
```

หรือเมื่อส่งไม่สำเร็จ:

```json
{ "success": false, "error": "reason" }
```

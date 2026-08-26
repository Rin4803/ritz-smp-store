## AuctionHouse bridge live audit

- จาก `logs_search` คำค้น `RitzAuctionBridge` พบว่า plugin โหลดและ enable สำเร็จหลายรอบ โดย log ระบุว่าอ่านรายการลงขาย/ซื้อสำเร็จและส่งไป `order-in-game`.
- ในผล log ที่ตรวจยังไม่พบ event จากผู้เล่นจริง เช่น รายการลงขายหรือการซื้อ จึงยังยืนยัน realtime end-to-end ไม่ได้.
- มีบรรทัด disable ตามรอบ restart/reload ของเซิร์ฟเวอร์ ไม่ใช่หลักฐานว่า bridge crash; ต้องอ่าน log ล่าสุดหลังผู้เล่นใช้ `/ah sell` เพื่อแยกกรณี bridge ไม่ได้รับ event กับส่ง Discord ไม่สำเร็จ.

แหล่งหลักฐาน: MCSV `logs_search` ผลลัพธ์วันที่ 2026-08-26 คำค้น `RitzAuctionBridge`.

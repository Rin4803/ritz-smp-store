# หลักฐานตรวจสอบสด MCSV — 27 สิงหาคม 2026

> เอกสารนี้บันทึกเฉพาะข้อเท็จจริงที่อ่านจากเซิร์ฟเวอร์หลังติดตั้ง RitzAuctionBridge รุ่นแก้ cursor ไฟล์ว่างแล้ว ไม่ใช่ผลยืนยันการใช้งานของผู้เล่น

## การบูตและ DiscordSRV

จาก `logs/latest.log` หลังรีสตาร์ตช่วง 09:20–09:21 น. (GMT+7) พบว่า AuctionHouse 1.5.2 เปิดใช้งานสำเร็จก่อน RitzAuctionBridge 1.0.0 และ DiscordSRV 1.30.5 ยืนยัน `JDA Login Successful`, เชื่อม WebSocket และ `Finished Loading` สำเร็จก่อน bridge เปิดใช้งาน จึงไม่พบหลักฐานว่า bridge เริ่มก่อน DiscordSRV พร้อมใช้งาน

DiscordSRV มีคำเตือนว่า Console channel ID ไม่ถูกต้องและจึงไม่ส่ง console output แต่เป็นคนละเส้นทางกับ bridge ซึ่งเรียก DiscordSRV/JDA โดยตรงไปยัง channel ID ที่กำหนดใน RitzAuctionBridge

## RitzAuctionBridge และ TransactionLogger

ไฟล์ `/plugins/RitzAuctionBridge/config.yml` ที่อ่านสดกำหนด directory เป็น `../AuctionHouse/logs`, pattern เป็น `*.log`, เปิดทั้งรายการลงขายและซื้อสำเร็จ, poll ทุก 40 ticks และใช้ channel `order-in-game` ที่กำหนดไว้แล้วใน config (ไม่คัดลอก identifier ลงในเอกสารนี้)

cursor หลังการบูตชี้ไปยัง `2026-08-27-3.log` ที่ offset 0 ซึ่งตรงกับไฟล์ log ปัจจุบันและเป็นผลที่คาดไว้เมื่อไม่มีธุรกรรมหลังเริ่ม bridge การสำรวจ directory ยืนยันว่า AuctionHouse สร้างไฟล์ TransactionLogger จำนวนมาก และไฟล์ว่างเกิดขึ้นได้จริง จึงยืนยันความสำคัญของการแก้ให้ cursor ข้ามไฟล์ว่าง

ค้นหา runtime log ล่าสุดด้วยคำว่า `RitzAuctionBridge` พบเฉพาะการโหลดและเปิดใช้งาน ไม่มี `ERROR`, `retry`, timeout หรือข้อความส่ง Discord ล้มเหลว ณ เวลาตรวจ

## ข้อจำกัดการยืนยัน

การตรวจนี้พิสูจน์ได้เพียงว่า plugin, directory, cursor และ DiscordSRV พร้อมเริ่มรับข้อมูลแล้ว ยังพิสูจน์ไม่ได้ว่า AuctionHouse จะเขียน record สำหรับ `/ah sell` หรือ JDA ส่งข้อความได้ใน channel ปลายทางจริง จึงต้องทดสอบด้วยธุรกรรมผู้เล่นจริงหนึ่งรายการ และอ่าน transaction log/cursor ทันทีหลังเหตุการณ์

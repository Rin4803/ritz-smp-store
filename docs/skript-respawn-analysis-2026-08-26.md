# บันทึกวิเคราะห์ Respawn และตำแหน่งล่าสุด — 26 สิงหาคม 2026

## แหล่งอ้างอิงไวยากรณ์ Skript

เอกสาร SkriptHub ระบุรูปแบบ expression สำหรับจุดเกิดจากเตียงว่า `[the] [((safe|valid)|(unsafe|invalid))] bed[s] [location[s]] of %offlineplayers%` และอธิบายว่า **safe/valid bed location** จะคืนค่าเฉพาะเมื่อเตียงยังอยู่และจุดเกิดปลอดภัย จึงเหมาะกับการตรวจใน `on respawn` ก่อนกำหนดตำแหน่งเกิดเอง [1]

> `the safe bed location of player` คือการตรวจจุดเกิดจากเตียงที่ Minecraft ยืนยันว่าใช้ได้ ไม่ใช่การตรวจชนิดของ `respawn location` ซึ่งเป็น location อยู่แล้ว

## ผลตรวจ MCSV ก่อนแก้

ไฟล์ `/plugins/Multiverse-Core/worlds.yml` ยืนยันชื่อโลกจริงที่ควรถือเป็นกลุ่ม Survival ดังนี้

| หน้าที่ | ชื่อโลกจริง |
| --- | --- |
| Overworld | `survival` |
| Nether | `survival_nether` |
| End | `survival_the_end` |
| Lobby | `minecraft:overworld` |

สคริปต์เดิมมีความคลาดเคลื่อนสองจุดสำคัญ คือใช้ชื่อ `Survival`/`survival` สลับกันและสะกด Nether เป็น `survival_neither` ในการบันทึกตำแหน่ง จึงไม่ครอบคลุมโลก Nether จริง อีกทั้ง `/play` ยอมคืนตำแหน่งเฉพาะใน Overworld เท่านั้น

นอกจากนี้ `/plugins/Skript/scripts/rtp.sk` ใช้ `Survival` ทั้งใน options, world lookup และ guard ของคำสั่ง แต่โลกที่ MCSV ลงทะเบียนคือ `survival` จึงอธิบายได้ว่าการเรียก `/rtp` หลัง death ถูกปฏิเสธหรือหาโลกไม่พบ แม้ `/play` จะใช้งานได้จาก fallback เป็นตัวพิมพ์เล็กแล้ว

## แนวทางแก้ที่ต้องตรวจหลังนำขึ้น

ปรับ `survival-respawn.sk` ให้คง safe bed respawn ตาม vanilla และพาผู้ที่ไม่มีเตียงไปยังจุดเริ่มต้นของ Overworld Survival ก่อนเรียก RTP แบบปลอดภัย ปรับ `save-location.sk` ให้บันทึกตำแหน่งล่าสุดในทั้งสามโลกเมื่อออกเกม และปรับ `/play` ให้คืนตำแหน่งที่เก็บไว้ได้ทั้ง Overworld, Nether และ End โดยไม่มีการเดาชื่อโลก

ผลการตรวจจากโค้ดและ log ไม่ใช่การยืนยันพฤติกรรมในเกม ต้องให้ผู้เล่นทดสอบผู้มีเตียง ผู้ไม่มีเตียง และการออก/เข้าใหม่จากโลกทั้งสามหลัง reload แล้ว

## References

[1] [SkriptHub — Bed Expression](https://skripthub.net/docs/?id=927)

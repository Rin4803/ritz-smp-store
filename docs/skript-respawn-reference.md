# Skript Respawn Reference

จากการค้นเอกสารภายนอกเมื่อ 26 Aug 2026 พบว่า Skript รองรับ expression สำหรับตรวจจุดเกิดใน respawn event และมี condition สำหรับตรวจว่า respawn location เป็น bed/respawn anchor ใน Skript 2.7+.

- Bed expression: https://skripthub.net/docs/?id=927
- Respawn location expression: https://skripthub.net/docs/?id=927
- Bed/anchor spawn condition: https://skripthub.net/docs/?id=9464
- Official events documentation: https://docs.skriptlang.org/events.html

แนวทางที่ต้องตรวจบนเซิร์ฟเวอร์จริงก่อนใช้งาน: ใช้ `on respawn`, ตรวจ `respawn location is a bed` เพื่อคงการเกิดที่เตียง, และกำหนด `respawn location` เป็นจุดปลอดภัยในโลก Survival เมื่อไม่มี bed/anchor spawn. ต้อง reload/restart แล้วตรวจ Skript parse log และทดสอบผู้เล่นจริงทั้งสองกรณี.

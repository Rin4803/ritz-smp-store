# Night Vision External Findings — 2026-08-28

## Official syntax reference

Source: https://docs.skriptlang.org/conditions.html (Skript Documentation 2.16.1, section “Has Potion Effect”, accessed 2026-08-28)

The official condition supports checking whether a living entity has a specific active potion effect. The documented pattern is `if the player has a potion effect of speed:` and the negated form is supported as well. The documentation states the feature supports potion effects since Skript 2.14.

## MCSV live log evidence

The MCSV `logs_search` query `NV-DIAG` returned repeated entries in `logs/2026-08-28-11.log.gz` showing Night Vision being removed from player `KIWIOWO555` in the `survival` world, followed by older recovery messages from `nightvision-gui.sk`. Examples include lines 778–808 around 03:57:29–03:57:36 and lines 998–1016 around 03:58:01–03:58:03. This confirms the effect was externally removed during live play; the cause is not yet identified by the current diagnostic event because the event only records the removal.

The latest reload at 11:05:23 reported `Successfully reloaded nightvision-gui.sk. (32ms)`. The current script was patched to use `execute console command "effect give %player% minecraft:night_vision 1000000 0 true"` and a two-second recovery loop. A further refinement should only re-issue the command when the player does not currently have the effect, to avoid repeatedly replacing an existing effect and causing client flicker.

## ผลค้น log เพิ่มเติม 2026-08-28

ผล `logs_search` ค้น `NV-DIAG` จาก MCSV พบเหตุการณ์เก่าจำนวนมากใน `logs/2026-08-28-11.log.gz` ช่วงประมาณ 03:48:39–03:57:36 ซึ่งมีรูปแบบ Night Vision ถูกล้างแล้ว recovery เติมกลับทันทีหลายครั้ง; ตำแหน่งและการเคลื่อนที่ของผู้เล่นใน log สอดคล้องกับการทดสอบก่อนหน้า และเป็นหลักฐานว่าพฤติกรรม flicker เคยเกิดจริง. ผลค้นยังพบไฟล์ `logs/2026-08-28-14.log.gz` ล่าสุดถึงประมาณ 10:19:29 แต่ไม่มีหลักฐานจากผู้เล่นจริงหลัง reload เวลา 11:09:46 ใน console tail.

สรุป: patch ล่าสุด parse/reload สำเร็จ แต่ยังไม่สามารถอ้างว่าแก้ live behavior ได้จนกว่าจะมี Java/Bedrock player ทดสอบ `/nv`, ตีอากาศ, ทุบ และวางบล็อก พร้อมตรวจ log ในช่วงเดียวกัน. ไม่ควรเพิ่ม recovery loop ที่ถี่ขึ้นหรือเปลี่ยน plugin แบบ blind ก่อนมี live evidence.

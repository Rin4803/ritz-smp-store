# Minecraft Audit Continuation — 2026-08-28

## ขอบเขต
ผลนี้มาจากการอ่านไฟล์จริงบน MCSV แบบ read-only ต่อจาก audit ก่อนหน้า และยังไม่ถือว่าเป็นผลทดสอบกับผู้เล่นจริง

## Findings ที่ยืนยันได้

| ระบบ | หลักฐานจากไฟล์จริง | ข้อสรุป |
|---|---|---|
| Night Vision | `/plugins/Skript/scripts/nightvision-gui.sk` เปิดใช้ `apply night vision 1 ... 999999 seconds`; เติมซ้ำเมื่อ join/respawn/world change และทุก 2 วินาทีเฉพาะเมื่อไม่มี effect; ไม่มี event break/place/attack ในไฟล์นี้ | ไฟล์นี้ไม่ได้ตั้งใจเติมซ้ำระหว่าง action และไม่พบต้นเหตุการกระพริบจากตัวมันเองในส่วนที่อ่านแล้ว |
| Lobby | `/plugins/Skript/scripts/lobby.sk` มีการ apply night vision ตอน teleport เข้า Lobby | มีการเติม effect ตอนเข้า Lobby ซึ่งอาจเป็น effect ซ้ำคนละอายุ/แหล่งกับ `/nv` แต่ยังไม่พิสูจน์ว่าเป็นตัวล้าง effect |
| AuthMe | `/plugins/AuthMe/config.yml` มี `bedrockAutoLogin: true`, `Hooks.floodgate: true`, `ignoreBedrockNameCheck: true`; Java ยังใช้ AuthMe registration/login แบบ PASSWORD และจำกัด command ก่อน login | ส่วน Bedrock bypass ถูกเปิดอยู่ใน config แล้ว; Java GUI login ยังต้องตรวจว่า GUI มาจาก plugin/flow ใด เพราะ AuthMe native flow เป็น command/password ไม่ใช่ GUI โดยตรง |
| GrimAC | `/plugins/GrimAC/config.yml` เปิด `experimental-checks: true`, `reset-item-usage-on-attack/item-use/item-update/slot-change: true`, Reach block-impossible-hits; `/plugins/GrimAC/punishments.yml` มี placeholder Autoclicker แต่ระบุว่า Grim 2.2.10 ยังไม่มี Autoclicker checks | Grim ตรวจ movement/reach/packet ได้ แต่ไม่ควรอ้างว่ามี auto-clicker detection จริงจาก placeholder นี้ |
| X-ray | `/config/paper-world-defaults.yml` เปิด `anti-xray.enabled: true`, `engine-mode: 1` | Anti-Xray เปิดอยู่แล้ว แต่ต้องตรวจ worlds และ hidden-block settings ว่าครอบคลุมโลก Survival/Nether/End และประสิทธิภาพเพียงพอหรือไม่ |
| Performance | `/server.properties` มี `view-distance=6`, `simulation-distance=4`; `/config/paper-world-defaults.yml` มี `prevent-moving-into-unloaded-chunks: false` | ค่าระยะมองไม่สูง แต่การป้องกันการเดินเข้า unloaded chunks ยังปิด จึงควรทดสอบ/ปรับอย่างระมัดระวังร่วมกับ chunk settings |
| Scoreboard | มี DonutScoreboard, TAB, PlaceholderAPI และ Skript `rankgrad.sk`/`rankgrad copy.sk` | ต้องอ่าน config/placeholder จริงของ scoreboard และ chat แล้วเทียบกับ LuckPerms prefix; ยังสรุปสาเหตุ mismatch ไม่ได้จากชุดไฟล์นี้ |

## ข้อควรระวัง

ไฟล์ AuthMe ที่อ่านมี credential ภายใน การบันทึกนี้จงใจไม่เก็บค่ารหัสผ่าน/token ใด ๆ และไม่ควรนำ credential ไป commit หรือแสดงในรายงาน

## ขั้นตอนถัดไป

1. ค้นทุก Skript/plugin config ที่เรียก `remove/clear potion effects` และตรวจ log event รอบ action ของผู้เล่นจริงก่อนแก้ Night Vision
2. ตรวจ plugin ที่ทำ GUI login และ AuthMe integration ก่อนออกแบบ flow Java ให้ไม่กระทบ Bedrock auto-login
3. อ่าน config ของ DonutScoreboard/TAB/PlaceholderAPI และ LuckPerms แล้วทำ mapping rank เดียวกัน
4. อ่าน Paper world configs รายโลกและ Grim startup/runtime logs ก่อนปรับ anti-cheat/X-ray
5. ทำ backup ก่อนแก้ไฟล์ MCSV และทดสอบ reload เฉพาะส่วนที่ปลอดภัย; งานที่ต้อง restart หรือทดสอบด้วยผู้เล่นจริงต้องระบุแยกจาก validation แบบ static


## หลักฐานเพิ่มเติม: GUI authentication และสถานะ boot ล่าสุด

Release notes ทางการของ AuthMeReloaded 6.0.0 ระบุว่า native dialog login/register รองรับ Spigot 1.21.6+ และ Paper/Folia 1.21.11+ โดย Paper 1.21.11+ เป็นรุ่นที่แนะนำ และ AuthMe 6 เปลี่ยนไปใช้ PacketEvents สำหรับบางฟังก์ชันแทน ProtocolLib. เซิร์ฟเวอร์ปัจจุบันโหลด `AuthMe 5.7.0-FORK-b53` และ ProtocolLib จึงยังไม่ควรสลับ JAR แบบทันทีจนกว่าจะยืนยัน Minecraft/Paper build และเตรียมแผน rollback/migration ฐานข้อมูล.

แหล่งอ้างอิง: [AuthMeReloaded releases](https://github.com/AuthMe/AuthMeReloaded/releases) (อ่านเมื่อ 2026-08-28) ซึ่งระบุข้อกำหนด Paper/Folia 1.21.11+ สำหรับ Dialog และ Java 21 สำหรับ platform รุ่นใหม่.

จาก boot log ล่าสุด: AuthMe 5.7.0-FORK-b53, Geyser 2.11.2-SNAPSHOT, Floodgate 2.2.5-SNAPSHOT, GrimAC 2.3.74 และ Skript 2.16.1 โหลดสำเร็จ; Essentials แจ้ง unsupported server version และ Grim แจ้ง SLF4J provider ไม่พบ แต่ไม่มี plugin failed/disabled. AuthMe config เปิด `bedrockAutoLogin: true` และ Floodgate hook อยู่แล้ว.

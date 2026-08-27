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


## Paper Anti-Xray evidence — 2026-08-28

อ้างอิงเอกสารทางการของ Paper: https://docs.papermc.io/paper/anti-xray/

เอกสารระบุว่า `engine-mode: 1` ซ่อนเฉพาะบล็อกที่ถูกบังด้วยบล็อกทึบ ขณะที่ `engine-mode: 2` และ `engine-mode: 3` ใช้การสุ่มบล็อกหลอกเพื่อป้องกัน X-ray ได้ดีกว่า โดย mode 3 สุ่มต่อชั้นของ chunk และช่วยลด network load/ช่วยการบีบอัด packet ตอนผู้เล่นเข้าโลกได้ประมาณหนึ่ง แต่ยังไม่ใช่การรับประกันป้องกัน X-ray ทุกกรณี และแร่ที่เปิดสู่ air/transparent blocks อาจยังมองเห็นได้ตามข้อจำกัดของ Paper

สถานะที่ตรวจพบก่อนแก้: `/config/paper-world-defaults.yml` เปิด Anti-Xray อยู่แล้ว แต่ใช้ `engine-mode: 1`, `max-block-height: -1`, `update-radius: 2`, `use-permission: false` และมีรายการ hidden/replacement blocks ของเซิร์ฟเวอร์อยู่แล้ว จึงเปลี่ยนเฉพาะ `engine-mode` เป็น `3` หลังสร้าง backup เพื่อเพิ่มความยากในการใช้ X-ray โดยไม่ทับรายการบล็อกเดิม

หลัง restart log ดิบยืนยันว่าเซิร์ฟเวอร์ Paper `26.2-71-main@5563e58` เริ่มโหลด plugin ตามปกติ และพบ GrimAC warning เรื่อง SLF4J provider ซึ่งไม่เกี่ยวกับการ parse Paper Anti-Xray โดยตรง; ผล `logs_startup` ที่รายงาน plugin จำนวนมากว่าไม่ถึงขั้น enable เป็น partial scan ระหว่าง boot ไม่ใช่หลักฐานว่า plugin ทั้งหมดล้มเหลว เพราะ log ดิบแสดงการ Loading/Enabling ต่อเนื่อง


## Remediation continuation — 2026-08-28

อ่านไฟล์จริง `/plugins/Skript/scripts/nightvision-gui.sk` พบว่าเดิมมี fallback เติม effect ทุก 2 วินาทีและไม่มี interaction recovery handler. ได้เพิ่ม handler หลัง `break`, `place`, `left click` และ `right click` โดยรอ 2 ticks แล้วตรวจว่าผู้เล่นยังเปิด `{nv.enabled::UUID}` และไม่มี night vision จึงค่อยเติมกลับ ระยะเวลายังคง 999999 วินาที และไม่สร้าง loop ทุก tick. คำสั่ง `skript reload nightvision-gui` ตอบสำเร็จจาก console แล้ว แต่ผลว่าหาย flicker/ไม่ดับต้องทดสอบด้วยผู้เล่นจริงหลัง action หลายแบบ จึงยังไม่ถือว่ายืนยันสมบูรณ์.

AuthMe audit ยืนยัน `bedrockAutoLogin: true`, `Hooks.floodgate: true` และ `ignoreBedrockNameCheck: true` อยู่แล้ว. เซิร์ฟเวอร์ใช้ AuthMe 5.7.0-FORK-b53 และ Paper game version 26.2; ยังไม่เปลี่ยนเป็น AuthMe 6 native dialog เพราะแหล่งทางการที่ตรวจไว้ระบุข้อกำหนด platform รุ่นใหม่และการเปลี่ยน dependency/ฐานข้อมูลที่ต้องวางแผน migration ก่อน. Java login จึงยังใช้ flow AuthMe เดิมจนกว่าจะยืนยัน Paper build ที่รองรับและมี rollback/test plan.


## Boot verification after remediation — 2026-08-28

ผล `logs_startup` หลัง restart รายงาน `boot_completed: false` ที่บรรทัด 14 จึงเป็นการอ่านช่วงต้นของ startup และยังไม่ควรใช้เป็นข้อสรุปว่า plugin หลักล้มเหลว. รายงานมี LuckPerms อยู่ในรายการ enabled แล้ว และพบเฉพาะ GrimAC SLF4J provider warning; รายชื่อ plugin อื่นที่ถูกจัดเป็น `โหลดแล้วแต่ไม่ถึงขั้น enable` ไม่มี `error_lines` และต้องอ่าน `logs/latest.log` ต่อจน boot จบก่อนวินิจฉัย. ขั้นตอนนี้จึงถือเป็น pending verification ไม่ใช่ plugin failure.


## Completed boot verification — 2026-08-28

อ่านท้าย `logs/latest.log` หลัง restart พบ `Done (22.333s)!` และยืนยันว่า Skript, AuctionHouse, DonutScoreboard, GrimAC, AuthMe, Geyser-Spigot และ RitzAuctionBridge enable สำเร็จ. AuthMe รายงาน `AuthMeReReloaded is enabled successfully!`; Geyser รายงาน `Done`; AuctionHouse รายงาน `AuctionHouse enabled`; DonutScoreboard รายงาน enabled บน Bukkit 26.2; RitzAuctionBridge รายงาน enabling โดยไม่พบ error ในช่วงท้าย log. GrimAC ยังมีเพียง warning เรื่อง SLF4J provider/deprecated listener ไม่ใช่การ disable plugin.

หลังแก้ `prevent-moving-into-unloaded-chunks: true` ได้ restart และ boot สำเร็จใน 22.333 วินาที. ค่านี้ช่วยป้องกันผู้เล่นเดินเข้า chunk ที่ยังไม่โหลดและลดผลกระทบจาก chunk stall แต่ยังต้องทดสอบความรู้สึกการเดินทางจริงก่อนสรุปว่าแก้ปัญหา world loading ได้สมบูรณ์.


## AuthMe native dialog verification — 2026-08-28

แหล่งข้อมูลทางการ: [AuthMeReloaded](https://github.com/AuthMe/AuthMeReloaded) และ [releases](https://github.com/AuthMe/AuthMeReloaded/releases) รวมถึงไฟล์เผยแพร่ [AuthMe 6.0.0](https://dev.bukkit.org/projects/authme-reloaded/files/8055464)

AuthMe 6.0.0 ระบุว่ารองรับ graphical login/register dialogs โดยตั้งค่า `settings.registration.dialog.postJoin.enable` หรือ `settings.registration.dialog.preJoin.enable` แยกกันได้ โดย pre-join dialog ต้องใช้ Paper/Folia รุ่นที่รองรับ Dialog สมัยใหม่ เช่น 1.21.11+ ส่วนไฟล์เผยแพร่ระบุการรองรับ Spigot 1.21.6+ และ Paper/Folia 1.21.11+ เป็นหลัก. เซิร์ฟเวอร์ปัจจุบันโหลด `AuthMe 5.7.0-FORK-b53` และยังต้องยืนยัน Paper build/Java runtime ให้ตรงเงื่อนไขก่อนสลับ JAR เพื่อป้องกันผลกระทบต่อฐานข้อมูลบัญชี.

AuthMe config ปัจจุบันยืนยัน `bedrockAutoLogin: true`, `Hooks.floodgate: true`, `Hooks.ignoreBedrockNameCheck: true`, `settings.sessions.enabled: true` และ `settings.registration.type: PASSWORD`; Bedrock bypass จึงเปิดอยู่แล้ว แต่ Java GUI login/register ยังไม่ยืนยันว่าเปิดอยู่. ไม่ควรสร้างระบบเก็บรหัสผ่านใหม่ด้วย Skript และไม่ควรแทนที่ AuthMe 5 ด้วย AuthMe 6 จนกว่าจะมี backup, migration plan และ test/rollback plan.


## Live verification checkpoint — 2026-08-28

ตรวจ server overview และ boot log ล่าสุดจาก MCSV แบบ read-only พบว่า RitzSMP ยัง `running`, boot completed และไม่พบ plugin ที่ failed/disabled. AuctionHouse 1.5.2, AuthMe 5.7.0-FORK-b53, DiscordSRV 1.30.5, DonutScoreboard 1.8, GrimAC 2.3.74, Geyser-Spigot 2.11.2-SNAPSHOT, Skript 2.16.1 และ RitzAuctionBridge enable สำเร็จ. พบ warning ที่ยังต้องติดตามคือ Essentials แจ้ง unsupported server version, GrimAC ไม่มี SLF4J provider และ GrimAC แจ้ง ViaBackwards บน server 1.21.2+ ไม่รองรับ older-client vehicles; ยังไม่มีหลักฐานว่า warning เหล่านี้ทำให้ระบบหลักหยุดทำงาน.

ขณะตรวจ live มีผู้เล่นออนไลน์ 0 คน จึงยังไม่สามารถยืนยัน click-through ของ `/nv`, Bedrock bypass/Java login, scoreboard rank, world-loading UX หรือ AuctionHouse sell/cancel ผ่านผู้เล่นจริงได้. การอ่าน Skript ที่เกี่ยวข้อง (`clearlag.sk`, `lobby.sk`, `death-effects.sk`, `afk.sk`, `lobby-protection.sk`) ยังไม่พบคำสั่งล้าง potion effect โดยตรง; สาเหตุของ Night Vision ที่หายระหว่าง action จึงยังไม่ถูกพิสูจน์ และไม่ควรเปลี่ยน plugin/config เพิ่มโดยไม่มีการทดสอบจริงหรือ log ที่ชี้ต้นเหตุ.

ผลรอบนี้เป็น verification checkpoint ไม่ใช่ข้อสรุปว่า live tests ผ่าน.


## Live test results from player — 2026-08-28

ผู้เล่นทดสอบจริงยืนยันว่า AuctionHouse แจ้งเตือนใน `order-in-game` ใช้งานได้, การยกเลิกขายลบข้อความ Discord เดิมได้ และ scoreboard rank ตรงกับ chat rank แล้ว. ประเด็นที่ยังไม่ผ่านคือ `/nv` ถูกล้างชั่วคราวเมื่อโจมตีอากาศแล้วกลับมาเองภายหลัง, การกลับเข้าเกมหรือใช้ `/play` หลังอยู่ `Nether`/`End` ไปลงที่พิกัด 0,0 ของโลก Survival แทนตำแหน่ง/โลกเดิม, และ Java ยังต้องใช้ `/login`/`/register` แบบคำสั่งไม่มี GUI. Bedrock bypass ยังต้องตรวจด้วยผู้เล่น Bedrock จริง.

การแก้ location รอบก่อนพบ parser incompatibility ของ Skript และได้แก้เป็น nested `if` แล้ว restart/ตรวจ boot ต่อ แต่ผลจากผู้ใช้แสดงว่ายังมี fallback หรือ timing/ตัววาร์ปอื่นเขียนทับตำแหน่ง จึงต้องเก็บหลักฐานจาก event จริงและห้ามถือว่าผ่านจนกว่าจะทดสอบซ้ำ.

แนวทาง Java GUI ที่ปลอดภัยเบื้องต้นคือประเมิน AuthMeUI addon ก่อน major upgrade เป็น AuthMe 6 เพราะเซิร์ฟเวอร์ใช้ `AuthMe 5.7.0-FORK-b53`; การสลับ AuthMe 6 มีข้อกำหนด Paper/Java และ dependency/migration ที่อาจกระทบบัญชีเดิม. ยังไม่ติดตั้ง addon จนกว่าจะตรวจ artifact/version และทำ backup เฉพาะกิจอีกครั้ง.


### External reference retained — AuthMe GUI decision

- AuthMe Reloaded official Spigot resource: https://www.spigotmc.org/resources/authmereloaded.6269/ — หน้าที่ตรวจเมื่อ 2026-08-28 แสดงรุ่น 6.0.0 และรายการรองรับ Minecraft 1.21/26.1; ต้องตรวจ release note/compatibility กับ Paper 26.2 และ fork AuthMe ที่ติดตั้งจริงก่อนเปลี่ยนไฟล์
- AuthMe project source: https://github.com/AuthMe/AuthMeReloaded
- AuthMeUI project result: https://modrinth.com/project/xwRjZuDG — เป็นทางเลือก addon UI แต่ต้องยืนยันไฟล์/รุ่นและ dependency จากแหล่งดาวน์โหลดจริงก่อนติดตั้ง
- Live console ยืนยัน Paper version: `26.2-71-main@5563e58` (API `26.2.build.71-beta`), Java runtime `1474` ตาม log ล่าสุด
- Current AuthMe config evidence: `3rdPartyFeature.features.bedrockAutoLogin: true`, `Hooks.floodgate: true`, `Hooks.ignoreBedrockNameCheck: true`; therefore Bedrock bypass is configured, while Java GUI remains unimplemented.

## Final world cleanup and mapping — 2026-08-28

หลังผู้ใช้ยืนยัน ได้สร้าง full MCSV backup ก่อนดำเนินการลบ และหยุดเซิร์ฟเวอร์ก่อนลบ storage ของ `Lobby_nether` กับ `Lobby_the_end` จากนั้นลบ world registry ของทั้งสองโลกผ่าน Multiverse เพื่อป้องกันการถูกสร้างกลับมาเมื่อเซิร์ฟเวอร์เริ่มใหม่ ผล `mv list` หลัง cleanup ยืนยันว่าเหลือเฉพาะ `Survival` (NORMAL), `Lobby` (NORMAL), `afk` (NORMAL), `survival_nether` (NETHER) และ `survival_the_end` (THE_END)

ได้อัปเดตและ reload `save-location.sk`, `travel.sk` และ `lobby.sk` แยกทีละไฟล์สำเร็จ โดย mapping ปัจจุบันคือ `survival_nether` สำหรับ NETHER และ `survival_the_end` สำหรับ THE_END ไม่พบ syntax error จากการ reload รอบนี้ การกลับตำแหน่งเดิมเมื่อออกเกม/กลับเข้าเกมหรือใช้ `/play` ยังต้องทดสอบด้วยผู้เล่นจริงในแต่ละโลกก่อนสรุปว่า live flow เสร็จสมบูรณ์

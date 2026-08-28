# AuthMe GUI Login Research — 2026-08-28

การตรวจสอบข้อมูลสาธารณะพบว่า AuthMeReloaded มีรุ่นแยกตามแพลตฟอร์มและรองรับ Paper 1.21+ ตามหน้า release ของโครงการ แต่เซิร์ฟเวอร์ RitzSMP ใช้ fork `AuthMe v5.7.0-FORK-b53` จึงยังไม่ควรแทนที่ JAR เดิมโดยไม่ทดสอบฐานข้อมูลและการ bypass ของ Bedrock.

ผลการค้นพบทางเลือกมีดังนี้:

| ทางเลือก | สิ่งที่พบ | ความเสี่ยง/สถานะ |
|---|---|---|
| AuthMeReloaded รุ่นใหม่ | โครงการหลักมีเอกสารและรุ่นสำหรับ Paper 1.21+ | ต้องตรวจ compatibility กับ fork และสำรองฐานข้อมูลก่อน จึงยังไม่ติดตั้ง |
| AuthMeUI | มีโครงการบน Modrinth ที่ระบุรองรับ Minecraft 1.21.x | ต้องยืนยันว่าเชื่อมกับ fork รุ่นที่ใช้อยู่และไม่เปลี่ยน Floodgate bypass ก่อนติดตั้ง |
| authmebia | ระบุว่าแทน chat login/register ด้วย native dialog สำหรับ 1.21.6+ | เป็นทางเลือกใหม่ ต้องตรวจ dependency, release artifact และ AuthMe API ก่อน |
| Floodgate | เอกสาร Geyser ระบุว่า key/ระบบ Floodgate ใช้ช่วยให้ Bedrock bypass Java authentication | ต้องคง `bedrockAutoLogin: true` และทดสอบเฉพาะ Bedrock หลังเพิ่ม GUI |

แหล่งอ้างอิง: [AuthMeReloaded Hangar](https://hangar.papermc.io/0D00_0721/AuthMeReReloaded), [AuthMeReloaded releases](https://github.com/AuthMe/AuthMeReloaded/releases), [AuthMeUI Modrinth](https://modrinth.com/project/xwRjZuDG), [authmebia Modrinth](https://modrinth.com/plugin/authmebia), [Floodgate setup](https://geysermc.org/wiki/floodgate/setup/).

ข้อสรุปเชิงปฏิบัติ: ยังไม่ติดตั้ง addon หรือแทนที่ AuthMe ใน live server จนกว่าจะตรวจไฟล์ release/การรองรับ API กับ fork และทำ backup เพิ่ม การเปลี่ยนที่ปลอดภัยที่สุดคือใช้ GUI addon ที่เป็น non-destructive ต่อฐานข้อมูล AuthMe และให้ Bedrock bypass ทำงานจาก Floodgate เดิม.


## เพิ่มเติมจากการตรวจ 2026-08-28

- [AuthMeUI on Modrinth](https://modrinth.com/project/xwRjZuDG) ระบุรองรับ Java Edition 1.21.x และ Bukkit/Folia/Paper/Purpur/Spigot พร้อม login/register dialogs และ AuthMe API compatibility แต่เป็นโครงการภายนอก ไม่ใช่ปลั๊กอินทางการของ Mojang/Microsoft.
- [AuthMe 6.0.0 release](https://dev.bukkit.org/projects/authme-reloaded/files/8055464) ระบุ native graphical login/register dialogs สำหรับ Spigot 1.21.6+ และ Paper/Folia 1.21.11+ รวมถึงต้องใช้ Java 21 ใน build รุ่นใหม่ และมีความแตกต่างระหว่าง platform-specific jars.
- [AuthMeReloaded repository](https://github.com/AuthMe/AuthMeReloaded) ระบุ post-join และ pre-join dialog settings โดย pre-join ต้องใช้ Paper/Folia รุ่นที่รองรับ Dialog เช่น 1.21.11+.

ขอบเขตการตัดสินใจยังคงเดิม: เซิร์ฟเวอร์ live ใช้ AuthMe 5.7 fork และ config ไม่มี dialog section จึงยังไม่แทนที่ JAR หรือเพิ่ม addon โดยไม่ตรวจ exact Paper build, AuthMe API/fork compatibility, dependency และ backup ฐานข้อมูลก่อน ต้องคง Java authentication และ Floodgate/Bedrock policy เดิมจนกว่าจะผ่าน regression test แยก Java และ Bedrock.

## ตรวจ repository ทางการเพิ่มเติม

วันที่ 2026-08-28 เปิด repository ทางการ [AuthMe/AuthMeReloaded](https://github.com/AuthMe/AuthMeReloaded) และยืนยันว่าโครงการมี graphical login/register dialogs สอง flow แยกกัน: `settings.registration.dialog.postJoin.enable` สำหรับ dialog หลังผู้เล่นเข้าเซิร์ฟเวอร์ และ `settings.registration.dialog.preJoin.enable` สำหรับ Paper/Folia pre-join dialog. เอกสารที่ repository แสดงระบุว่า pre-join ต้องใช้ Paper/Folia รุ่นที่รองรับ Dialog เช่น 1.21.11+ และ premium bypass อาจทำให้ผู้เล่นที่ผ่าน premium ไม่เห็น pre-join dialog.

ข้อสรุปเชิงปฏิบัติยังไม่เปลี่ยน: ต้องตรวจ exact Paper build และฐานข้อมูล/behavior ของ AuthMe fork 5.7 ก่อนเปลี่ยน JAR; สำหรับเซิร์ฟเวอร์ปัจจุบัน post-join GUI หรือ addon ที่เรียก AuthMe API มีความเสี่ยงต่ำกว่า pre-join replacement แต่ต้องยืนยัน artifact และ dependency ก่อนติดตั้งจริง. `bedrockAutoLogin`/Floodgate bypass ต้องถูกทดสอบแยกหลังการเปลี่ยน.

## ตรวจหน้า Modrinth AuthMeUI เพิ่มเติม

หน้า [AuthMeUI บน Modrinth](https://modrinth.com/plugin/authmeui) ที่เปิดดูวันที่ 2026-08-28 ระบุว่าเป็น Bukkit/Paper/Folia/Purpur/Spigot plugin สำหรับ Java Edition 1.21.x และคำอธิบายระบุ login/register popup dialogs บน vanilla client โดยไม่ต้องใช้ mod. ผู้พัฒนาระบุ compatibility กับ AuthMeReloaded และ AuthMeReReloaded แบบเต็ม และระบุว่า fork อื่นควรทำงานได้เมื่อใช้ standard AuthMe API.

อย่างไรก็ตาม หน้าเดียวกันแสดงว่าเผยแพร่ประมาณ 7 เดือนก่อนและอัปเดต 4 เดือนก่อน และเนื้อหาที่เปิดดูไม่แสดง dependency/version artifact ที่ละเอียดพอจะยืนยันกับ `5.7.0-Fork-b53` และ Paper `26.2-71-main` ของ RitzSMP ได้. จึงยังไม่ติดตั้ง live jar หรือเปลี่ยน AuthMe จนกว่าจะอ่าน release metadata/ไฟล์ plugin และทำ backup ที่เกี่ยวข้อง.

## ตรวจ source repository AuthMeUI

หน้า source [TejasLamba2006/AuthMeUI](https://github.com/TejasLamba2006/AuthMeUI) ที่เปิดดูวันที่ 2026-08-28 ระบุ requirement ที่ชัดเจนกว่า Modrinth: Java 21+, AuthMe 5.6.0+ หรือ fork ที่ compatible, และ Paper 1.21.7+ เพราะใช้ Dialog API. README ระบุว่า plugin รองรับ configuration phase ด้วย `dialogs.use-configuration-phase: true` และ timeout สำหรับผู้เล่นที่ยังไม่ authenticate; มีคำสั่ง `/authmeui reload`.

Repository ระบุว่า AuthMeUI ควรทำงานกับ AuthMeReReloaded และ fork อื่นที่ใช้ standard AuthMe API แต่ไม่ใช่การรับรองจากผู้ดูแล fork RitzSMP โดยตรง. ก่อนติดตั้งต้องตรวจ JAR release จริง, `plugin.yml`, config ค่า default, event listener และ behavior เมื่อ Floodgate ทำ auto-login. ห้ามเปิด configuration-phase หรือแทนที่ AuthMe จนกว่าจะมี backup และ regression test Java/Bedrock.

## ตรวจ release metadata และ JAR แบบ passive

Modrinth API `https://api.modrinth.com/v2/project/xwRjZuDG/version` วันที่ 2026-08-28 แสดงรุ่นล่าสุด `1.3.4`, เผยแพร่ `2026-05-02T18:05:37.750048Z`, รองรับ game versions `1.21` ถึง `1.21.11` และ `26.1`, `26.1.1`, `26.1.2`, loaders `folia,paper,purpur,spigot`, ไม่มี dependency ที่ประกาศ และ primary artifact คือ `AuthMeUI-1.3.4.jar` จาก `https://cdn.modrinth.com/data/xwRjZuDG/versions/8tYeXZL1/AuthMeUI-1.3.4.jar`.

JAR ถูกดาวน์โหลดไว้ใน `/tmp` เพื่ออ่าน `plugin.yml`/`config.yml` เท่านั้น ไม่ได้รันหรืออัปโหลด. Config ที่อ่านพบ `dialogs.use-configuration-phase: false` เป็นค่าเริ่มต้น, timeout 60 วินาที, และ `configuration-phase-respect-authme-sessions: true`; login/register dialogs ใช้ native Dialog API. ค่า default ยังเปิด `rules-dialog.enabled: true` และ `metrics.enabled: true`, จึงควรปิด rules dialog และ bStats หากไม่ต้องการเปลี่ยน UX/ส่ง metrics ก่อนติดตั้ง.

ข้อมูลนี้ยังไม่ใช่หลักฐานว่า server `Paper 26.2-71-main` รองรับ artifact ที่ประกาศสูงสุดถึง `26.1.2` แบบไม่มีข้อจำกัด เพราะ Modrinth metadata ไม่ได้แสดง `26.2`; ต้องตรวจ `plugin.yml` และทดสอบบน backup/staging หรือใช้ post-join mode เท่านั้น. ห้ามติดตั้ง live จนกว่าจะยืนยัน exact compatibility และ backup.

## Live installation result — 2026-08-28

A full MCSV backup named `pre-authmeui-2026-08-28` was created before installation. AuthMeUI 1.3.4 was passively inspected, uploaded as `/plugins/AuthMeUI-1.3.4.jar`, and loaded successfully after a graceful server restart. The startup report lists `AuthMe 5.7.0-FORK-b53` and `AuthMeUI 1.3.4` as enabled; no AuthMeUI load error was reported.

The AuthMeUI artifact does not declare Floodgate/Geyser support in `plugin.yml`, and its configuration-phase listener does not provide a Floodgate-specific bypass. Therefore `dialogs.use-configuration-phase` remains `false`: Java players receive the post-join Paper Dialog login/register UI, while AuthMe's existing `floodgate: true` and `bedrockAutoLogin: true` flow remains responsible for Bedrock bypass. Enabling configuration-phase blindly would risk showing a dialog to Bedrock players before AuthMe can auto-authenticate them.

Live player click-through is still required to confirm the Java dialog renders and submits `/login`/`/register` through the AuthMe fork, and to confirm Bedrock users continue entering without a login prompt.

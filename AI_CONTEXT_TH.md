# RitzSMP AI Context — ศูนย์กลางข้อมูลสำหรับ AI

อัปเดตล่าสุด: 29 กันยายน 2026

## วัตถุประสงค์

เอกสารนี้เป็นจุดเริ่มต้นสำหรับ AI หรือผู้ดูแลคนใหม่ที่ต้องเข้ามาตรวจ แก้ ทดสอบ และดูแลระบบ RitzSMP โดยต้องอ่านไฟล์นี้ก่อนแก้ไขใด ๆ

## กฎความปลอดภัยที่ห้ามละเมิด

1. ห้ามขอให้ผู้ใช้ส่ง token, password, webhook URL, RCON password, database URL หรือ private key ในแชต
2. ห้าม commit ค่า secret จริงลง GitHub แม้ repository จะเป็น Private
3. ให้ใช้ชื่อ environment variable แทนค่าจริง เช่น `DISCORD_AI_BOT_TOKEN`
4. ก่อนแก้ระบบ live ต้องอ่าน backup, สถานะ runtime และ log ล่าสุดก่อน
5. การลบข้อมูล, ลบโลก, reset token, เปลี่ยนสิทธิ์, เปลี่ยน billing หรือเปลี่ยน repository visibility ต้องหยุดและขออนุมัติเฉพาะเจาะจง
6. หลังแก้ต้องรัน typecheck, tests, build และ diff check พร้อมบันทึกผล
7. ทุกการแก้ production ต้องมี rollback plan และบันทึกใน `todo.md` หรือ `docs/`

## แผนผังระบบ

```text
ผู้เล่น
  ├─ เว็บร้านค้า RitzSMP
  │    ├─ Frontend React/Vite
  │    ├─ Express/tRPC backend
  │    ├─ Wallet / เติมเงิน / ซื้อยศ / ประวัติคำสั่งซื้อ
  │    └─ Discord REST notification + RCON
  ├─ Minecraft Java/Bedrock
  │    └─ Paper + Geyser/Floodgate + DiscordSRV บน MCSV
  └─ Discord
       ├─ RitzSMP AI Bot: คำสั่ง AI/ดูแลระบบ/แจ้งเตือนร้านค้า
       └─ BOT CHAT: DiscordSRV bridge จาก Minecraft
```

## ตำแหน่งระบบ

| ส่วน | ตำแหน่ง/ไฟล์ | สถานะที่ต้องยืนยันก่อนรายงาน |
|---|---|---|
| เว็บสโตร์ source | `client/`, `server/`, `shared/` | ดู branch และ commit ล่าสุด |
| AI Bot | `server/discordAiBot.ts`, `server/discordAiBotRunner.ts` | ต้องมี runtime ถาวรและ secret ครบ |
| Discord bridge | MCSV `/plugins/DiscordSRV/` | ตรวจ server overview และ startup log |
| Minecraft config | MCSV `/plugins/`, Skript และ world data | สำรองก่อนเขียนทุกครั้ง |
| Deployment blueprint | `docker-compose.yml`, `Dockerfile`, `VPS_DEPLOYMENT.md` | ใช้เป็นแบบติดตั้ง ไม่ใช่หลักฐานว่ากำลังรัน |
| Secret names | `env.template` และ Secret Manager | ห้ามใส่ค่าจริง |

## ระบบที่ถูกยกเลิก

Music Bot ถูกลบออกจาก source, runner, tests, package scripts, dependency, Docker Compose, env template และ Dockerfile แล้ว ห้ามสร้างกลับโดยอัตโนมัติ

## จุดเริ่มต้นเมื่อรับงานใหม่

1. อ่าน `todo.md` และเอกสารที่เกี่ยวข้องใน `docs/`
2. ตรวจ `git status`, branch และ remote
3. ตรวจ runtime จริงแยกจาก source code
4. ทำ backup หากเกี่ยวข้องกับ MCSV/database/config live
5. แก้เฉพาะขอบเขตที่ได้รับอนุมัติ
6. รัน validation และบันทึกหลักฐาน
7. ใช้ branch/PR เมื่อแก้ repository ที่ผู้ใช้งานจริง

## คำสั่ง validation

```bash
pnpm check
pnpm test
pnpm build
git diff --check
```

Live Discord tests อาจต้อง network และ secret จริง ให้ระบุแยกจาก unit tests ห้ามสรุปว่า bot ออนไลน์จากผล build เพียงอย่างเดียว

## แหล่งความจริง

- สถานะงาน: `todo.md`
- สถาปัตยกรรมและสิทธิ์: `docs/ai-access-matrix-th.md`
- ขั้นตอนปฏิบัติการ: `docs/ai-operations-runbook-th.md`
- กติกาแก้ไข: `CONTRIBUTING.md`
- ตัวแปรที่ต้องมี: `env.template`

## สถานะปัจจุบันสำหรับ GPT ที่เชื่อม GitHub

เว็บ public ที่เผยแพร่บน Firebase คือผลลัพธ์จากการ build ไม่ใช่ source of truth ให้ใช้ source ใน repository นี้เป็นหลัก ห้ามเดาโครงสร้างจากหน้าเว็บหรือ Firebase หากยังไม่ได้อ่านไฟล์จริง

โค้ดเว็บและ AI Bot อยู่ใน repository `Rin4803/ritz-smp-store` โดยส่วนเว็บอยู่ใน `client/`, `server/`, `shared/` และส่วน Discord AI Bot อยู่ใน `server/discordAiBot.ts` กับ `server/discordAiBotRunner.ts` ระบบ Music Bot ถูกลบแล้วและไม่ควรเพิ่มกลับ

เอกสาร AI ที่ต้องอ่านตามลำดับคือ `AI_CONTEXT_TH.md`, `CONTRIBUTING.md`, `docs/ai-access-matrix-th.md` และ `docs/ai-operations-runbook-th.md` จากนั้นอ่าน `todo.md` และเอกสารเฉพาะระบบที่กำลังแก้

## การแบ่งงานระหว่าง Manus กับ GPT

GPT ช่วยอ่าน source, วิเคราะห์ปัญหา, แก้โค้ด, เพิ่ม test, review diff และเตรียม Pull Request ได้ ส่วน Manus ช่วยตรวจ runtime จริง, MCSV, Minecraft, Discord connector, log, backup และ live click-through ได้ การมี source ใน GitHub ไม่ได้หมายความว่า GPT เข้าถึง MCSV, Discord หรือ secret ได้แล้ว ต้องยืนยัน runtime แยกต่างหาก

งานทุกชิ้นต้องแยกเป็น `โค้ดที่ตรวจแล้ว`, `ระบบที่ตรวจ live แล้ว` และ `สิ่งที่ยังยืนยันไม่ได้` ห้ามรายงานว่า bot หรือเว็บทำงานจริงจากผล build เพียงอย่างเดียว

## Commit สำคัญล่าสุด

- `985270a6`: ลบ Music Bot ออกจาก source, dependency, Docker Compose และ env template; คงเว็บ, AI Bot และ DiscordSRV
- `fb45cc07`: เพิ่มเอกสารศูนย์กลาง AI และกติกาการทำงานร่วมกัน

การ push ไป GitHub อาจต้องให้เจ้าของบัญชีอนุญาต GitHub App ด้วยสิทธิ์ Contents read/write และ Pull Requests read/write ก่อน หากพบ `403`, ให้หยุดและรายงานสิทธิ์ที่ขาด ห้ามใช้ token ใหม่จากแชตหรือใส่ secret ลง repository

## Prompt เริ่มงานสำหรับ GPT

```text
อ่าน AI_CONTEXT_TH.md, CONTRIBUTING.md, docs/ai-access-matrix-th.md,
docs/ai-operations-runbook-th.md และ todo.md ก่อนเริ่ม

ตรวจ source จริงของ RitzSMP แยกเว็บ, Wallet, Discord AI Bot,
DiscordSRV/Minecraft และ deployment ออกจากกัน ห้ามเดาจาก Firebase URL
ห้ามขอหรือสร้าง token/password จริง ให้ทำงานผ่าน branch/PR
สรุปสิ่งที่ตรวจ, สิ่งที่แก้, validation, live evidence และ rollback ทุกครั้ง
```

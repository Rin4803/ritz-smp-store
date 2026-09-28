# RitzSMP Store — Production Readiness Pass (2026-09-29)

## ขอบเขต

รายงานนี้ตรวจเฉพาะเว็บสโตร์และ backend ใน repository `Rin4803/ritz-smp-store` ตามลำดับ P0 ที่กำหนดไว้ ไม่ถือว่า source code เป็นหลักฐาน runtime และไม่บันทึก secret ลง repository

## สรุป architecture ที่ตรวจพบ

- **Production application path:** Express + tRPC ใน `server/_core/index.ts` และ router ใน `server/routers.ts`
- **Database path:** Drizzle ORM ผ่าน `DATABASE_URL` ไปยัง MySQL/MariaDB ใน `server/db.ts`
- **Wallet / Order / Product:** ใช้ตารางเดียวกันใน schema เดียวกัน (`wallets`, `wallet_transactions`, `orders`, `ranks`) ไม่มี `store-api` implementation ซ้ำใน repository
- **Frontend:** Vite build ไป `dist/public`
- **Planned hosting:** Firebase Hosting rewrite `/api/**` ไป Cloud Run service `ritz-smp-store-api` ที่ `asia-southeast1`
- **Discord AI Bot:** มี runner แยก `dist/discordAiBotRunner.js`; ไม่ควรเปิด Gateway ซ้ำบน autoscale backend
- **Music Bot:** ไม่พบ source/dependency/service ของ Music Bot ใน working tree ตาม remediation ก่อนหน้า

> ข้อสรุป: source-of-truth ใน repository เป็น backend เดียว แต่ Cloud Run service และ production database ยังไม่มีหลักฐาน deployment/runtime ใน session นี้ จึงยังไม่เรียกว่า production จริง

## สถานะตามเกณฑ์ A–E

| ระบบ | สถานะ | หลักฐาน / เหตุผล |
|---|---:|---|
| Architecture | B | เห็นเส้นทาง source เดียวและ database contract เดียว แต่ยังไม่มี runtime deployment evidence |
| Build / Typecheck | A | `pnpm check` และ production build ผ่านในรอบ validation ล่าสุด |
| Default unit/integration tests | A | 36 test files ผ่าน, 176 tests ผ่าน, 3 skipped; default suite ไม่เรียก Discord API ภายนอกอีกต่อไป |
| Local email/password auth | B | มี scrypt password hash + signed session cookie ใน source; ยังไม่มี production cookie/domain/secret click-through |
| Player identity Java/Bedrock + UUID | E | order ใช้ `minecraftIGN` เป็นหลัก ยังไม่มี local-user ↔ verified Minecraft UUID contract สำหรับการซื้อ |
| Wallet balance / ledger | C | มี transaction และ unique `referenceKey`; ยังไม่มี production DB concurrency evidence และ purchase flow ไม่ได้อยู่ transaction เดียวกับ order |
| Top-up approval | C | admin approval ใช้ reference `order:<id>:topup` ป้องกันการเติมซ้ำระดับ ledger; ยังไม่ได้ยืนยัน webhook/slip verification หรือ runtime DB |
| Store / order | C | ราคาอ่านจาก server-side rank; order สร้างและมี status; ยังขาด idempotency key ของคำขอซื้อและ state lock สำหรับ concurrent fulfillment |
| Minecraft delivery | C | RCON มี success/failure path และ order pending เมื่อ RCON fail; ใช้ IGN ไม่ใช่ verified UUID และยังไม่มี live RCON confirmation รอบนี้ |
| Discord | C | code มี notifications และ AI runner; live Discord tests เดิมตอบ HTTP 401 ด้วย token ปัจจุบัน จึงยังยืนยัน runtime ไม่ได้ |
| Deployment | E | `firebase.json` อ้าง Cloud Run service `ritz-smp-store-api` แต่ยังไม่พบหลักฐานว่า service นี้ deploy อยู่หรือ Firebase CLI authenticated |
| Security | C | session/password/authz และ RCON input validation มีใน source; ยังต้องตั้ง secrets, DB permissions, webhook validation และ run production scan |

## สิ่งที่แก้ใน pass นี้

1. **ปิดช่องโหว่ RCON command injection จาก IGN**
   - `purchaseRank` ใช้ `isValidMinecraftIgn` เดียวกับ integration layer
   - รับเฉพาะ `A-Z`, `a-z`, `0-9`, `_` ความยาว 3–16 ตัวอักษร
   - ลดความเสี่ยงที่ input จะถูกนำไปต่อเป็นคำสั่ง `lp user ...` / `points give ...`

2. **แยก live Discord checks ออกจาก default test suite**
   - `pnpm test` ไม่เรียก Discord API ภายนอก จึงไม่ fail เพราะ token หมดอายุ/ตอบ 401
   - `pnpm test:live` เป็นคำสั่ง explicit สำหรับตรวจ credential และ channel runtime จริง
   - การ skip นี้ไม่เปลี่ยนผลเป็น A: live Discord ยังคงอยู่สถานะ C จนกว่าจะผ่านด้วย secret ที่ถูกต้อง

## Blockers ที่ต้องแก้ก่อนเปิดให้ผู้เล่นใช้เงินจริง

1. **Deploy backend และ database ให้สำเร็จ**
   - สร้าง/ยืนยัน Cloud Run service `ritz-smp-store-api`
   - ตั้ง `DATABASE_URL`, `JWT_SECRET`, storage credentials, RCON และ Discord secrets ใน secret manager/environment
   - ยืนยัน Firebase Hosting rewrite ด้วย request จริง `/healthz` และ `/api/trpc/system.health`

2. **ผูกบัญชีร้านกับ Minecraft UUID แบบยืนยันตัวตน**
   - เพิ่ม durable identity table ที่ผูก `userId`, UUID, IGN, edition (`java`/`bedrock`) และ verified timestamp
   - ให้ `/store verify` หรือ plugin callback เป็นผู้ยืนยัน UUID; ห้ามให้ผู้ใช้กรอก UUID/IGN แล้วอ้างเป็นเจ้าของเอง
   - order/delivery ต้องอ้าง identity ที่ verified แล้ว ไม่รับ IGN อิสระเป็นหลักฐาน

3. **ทำ purchase เป็น workflow ที่ atomic/idempotent**
   - สร้าง idempotency key ต่อคำขอซื้อ
   - ทำ order creation + wallet deduction + ledger reference ใน DB transaction เดียวกัน หรือใช้ state machine ที่มี recovery ชัดเจน
   - กัน concurrent admin fulfillment ไม่ให้ points ถูกส่งซ้ำ

4. **ยืนยันการส่ง Minecraft แบบมีผลตอบกลับ**
   - บันทึก delivery attempt, command result, retry count และ last error
   - ไม่ตั้ง `สำเร็จ` จนกว่าจะได้รับผลตอบกลับจาก RCON/plugin ตาม contract ที่กำหนด

## คำสั่ง validation

```bash
pnpm check
pnpm test
pnpm build
git diff --check

# ต้องใช้เมื่อมี secrets ที่ถูกต้องและต้องการทดสอบ Discord runtime เท่านั้น
pnpm test:live
```

## การจัดระดับเปิดใช้งาน

- **เปิด public browsing ได้:** หน้า catalog และหน้า health เท่านั้น หลังตรวจ deployment
- **ยังไม่ควรเปิดเงินจริง:** top-up, wallet purchase และ automatic rank delivery จนกว่า blocker E ข้างต้นจะถูกปิดและมี runtime evidence
- **ห้ามรายงานเป็น A:** local auth, wallet, order, RCON, Discord และ deployment จนกว่าจะมีหลักฐานจาก environment production จริง

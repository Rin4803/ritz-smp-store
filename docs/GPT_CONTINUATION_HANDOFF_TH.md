# RitzSMP Store — สรุปส่งต่องานให้ GPT ดำเนินการต่อ

วันที่อัปเดต: 2026-09-29 03:14 (+07:00)
Repository: `Rin4803/ritz-smp-store`
Branch ล่าสุด: `production-readiness-pass`
Commit ล่าสุด: `34c3491f chore: start production readiness pass`

---

## 1. เป้าหมายหลัก

ทำให้ RitzSMP Store เป็นเว็บสโตร์สำหรับผู้เล่นที่เปิดใช้งานจริงได้อย่างปลอดภัย โดยมีเฉพาะความสามารถหลัก:

- ดูและซื้อยศ Minecraft
- เติมเงินเข้า Wallet
- ดูยอดเงินและประวัติธุรกรรม
- ดูประวัติ Order
- รองรับผู้เล่น Java และ Bedrock
- เชื่อมบัญชีร้านกับ Minecraft UUID ที่ผ่านการยืนยันจริง
- ส่งยศ/เหรียญเข้า Minecraft ผ่านระบบที่ตรวจสอบผลลัพธ์ได้
- ใช้ local Email/Password ไม่ redirect ไป Manus
- เก็บข้อมูลเว็บและบอทไว้ใน GitHub เพื่อให้ AI อื่นช่วยตรวจและแก้ไขได้
- ไม่มี Music Bot อีกต่อไป

ห้ามเพิ่มฟีเจอร์ที่ไม่จำเป็นต่อการเปิด Store ให้ผู้เล่นใช้งานจริงจนกว่า P0 จะผ่านทั้งหมด

---

## 2. Architecture ที่ยืนยันจาก source

### Backend ตัวจริง

- Express + tRPC
- Entry point: `server/_core/index.ts`
- Router: `server/routers.ts`
- Database helper: `server/db.ts`
- Schema: `drizzle/schema.ts`
- Frontend: React 19 + Vite + Tailwind 4

### Database ตัวจริง

- Drizzle ORM
- MySQL/MariaDB ผ่าน `DATABASE_URL`
- ตารางธุรกิจหลักอยู่ใน database path เดียวกัน:
  - `ranks`
  - `orders`
  - `wallets`
  - `wallet_transactions`
  - `users`

ไม่พบ implementation ของ `store-api` แยกอีกชุดใน repository ปัจจุบัน ดังนั้น source-of-truth คือ backend เดียวนี้

### Hosting ที่เตรียมไว้

- Firebase project: `ritzsmp-web-store`
- Firebase Hosting เสิร์ฟ `dist/public`
- `/api/**` rewrite ไป Cloud Run service:
  - service: `ritz-smp-store-api`
  - region: `asia-southeast1`
- Config:
  - `.firebaserc`
  - `firebase.json`
- Docker entrypoint: `node dist/index.js`
- Backend bind ที่ `0.0.0.0`
- Health endpoint: `GET /healthz`

**สำคัญ:** ยังไม่มีหลักฐานว่า Cloud Run service, production database หรือ Firebase deployment ใช้งานจริงแล้ว ห้ามรายงานว่า deploy สำเร็จจนกว่าจะทดสอบ URL จริง

### Discord AI Bot

- Source: `server/discordAiBot.ts`
- Runner: `server/discordAiBotRunner.ts`
- Build output: `dist/discordAiBotRunner.js`
- ควรรันเป็น process แยกจาก web backend
- ห้ามเปิด Discord Gateway ซ้ำบน autoscale backend
- Music Bot ถูกลบออกแล้ว ห้ามเพิ่มกลับ

---

## 3. สถานะล่าสุดตาม A–E

| ระบบ | สถานะ | ความหมาย |
|---|---:|---|
| Architecture | B | Source path เดียวชัดเจน แต่ยังไม่มี production runtime evidence |
| Build / Typecheck | A | `pnpm check` และ `pnpm build` ผ่าน |
| Default tests | A | 36 files ผ่าน, 176 tests ผ่าน, 3 skipped |
| Local Email/Password Auth | B | มี scrypt password hash และ signed session cookie แต่ยังไม่ได้ click-through บน production domain |
| Java/Bedrock UUID identity | E | ยังไม่มี local user ↔ verified Minecraft UUID contract สำหรับซื้อยศ |
| Wallet | C | มี ledger และ unique `referenceKey` แต่ purchase ยังไม่ atomic กับ order |
| Top-up | C | มี approval flow และ idempotent ledger reference ระดับ order แต่ยังไม่มี runtime verification |
| Store / Order | C | ราคามาจาก server-side rank แต่ยังขาด request idempotency และ concurrency state lock |
| Minecraft delivery | C | มี RCON success/failure path แต่ใช้ IGN เป็นหลักและไม่มี live confirmation รอบล่าสุด |
| Discord | C | Source มี แต่ live token ปัจจุบันตอบ HTTP 401 |
| Deployment | E | ยังไม่ยืนยัน Cloud Run/Firebase deployment และ production database |
| Security | C | Authz/session/RCON input validation มี แต่ยังต้องตรวจ secrets, DB permissions และ webhook validation |

ห้ามเปลี่ยน C/E เป็น A เพียงเพราะเห็น source code

---

## 4. สิ่งที่แก้ไปแล้วใน Production Readiness Pass

Commit `34c3491f` แก้ไขดังนี้:

1. `purchaseRank` ใช้ `isValidMinecraftIgn` จาก `server/minecraftIntegration.ts`
2. IGN ที่รับเข้า purchase ต้องเป็น `A-Z`, `a-z`, `0-9`, `_` และยาว 3–16 ตัวอักษร
3. ลดความเสี่ยง RCON command injection จาก input ผู้เล่น
4. แยก live Discord API tests ออกจาก default test suite
5. `pnpm test` ไม่เรียก Discord API ภายนอก
6. เพิ่ม `pnpm test:live` สำหรับทดสอบ Discord runtime แบบ explicit
7. แก้ mock ใน `server/multiserver.test.ts`
8. เพิ่มรายงาน:
   - `docs/production-readiness-pass-2026-09-29-th.md`

ผล validation ล่าสุด:

```text
pnpm check       PASS
pnpm test        PASS — 36 test files, 176 passed, 3 skipped
pnpm build       PASS
 git diff --check PASS
```

คำเตือน build ที่ยังมีอยู่:

- Vite แจ้ง bundle บาง chunk ใหญ่กว่า 500 kB เป็น warning ไม่ใช่ build failure
- pnpm แจ้งว่า `pnpm.overrides` ใน package.json ไม่ถูกอ่านโดย pnpm รุ่นปัจจุบัน ควรตรวจแยกในงาน dependency cleanup แต่ไม่ใช่ blocker หลักของ P0 รอบนี้

---

## 5. งานที่ GPT ต้องทำต่อ ตามลำดับบังคับ

### P0-1 — ยืนยัน deployment architecture และ runtime

1. ตรวจว่า Firebase project ที่ใช้คือ `ritzsmp-web-store`
2. ตรวจว่า Cloud Run service `ritz-smp-store-api` มีอยู่จริงหรือไม่
3. ตรวจ region ให้ตรง `asia-southeast1`
4. ตรวจว่า backend container start ได้ด้วย `PORT`
5. ตรวจ URL จริง:
   - `/healthz`
   - `/api/trpc/system.health`
6. ตรวจ Firebase Hosting rewrite `/api/**`
7. ตรวจว่า frontend เรียก API URL เดียวกับ production backend
8. ห้าม deploy production หาก environment หรือ database ยังไม่พร้อม

รายงานแยกให้ชัด:

- Source config
- Service exists
- Service reachable
- Health response
- Firebase hosting response
- Database connection

### P0-2 — ยืนยัน environment และ secrets

ต้องมีใน Secret Manager หรือ environment ของ production เท่านั้น ห้าม commit ค่าเหล่านี้:

- `DATABASE_URL`
- `JWT_SECRET`
- `BUILT_IN_FORGE_API_KEY` ถ้าระบบยังใช้ callback เดิม
- Storage credentials
- `RCON_HOST`
- `RCON_PORT`
- `RCON_PASSWORD`
- `DISCORD_AI_BOT_TOKEN`
- `DISCORD_BOT_TOKEN`
- Discord channel/guild configuration

ตรวจว่า:

- production ใช้ secret ที่ไม่ใช่ค่า dev/test
- cookie ใช้ HTTPS และ secure setting ที่ถูกต้อง
- database user มีสิทธิ์เท่าที่จำเป็น
- ไม่มี secret ใน git history, logs, docs หรือ client bundle

### P0-3 — ทำ Minecraft identity ให้ถูกต้องก่อนเปิดซื้อยศ

ปัญหาปัจจุบัน:

- `orders` เก็บ `minecraftIGN`
- ผู้ซื้อสามารถส่ง IGN เข้า `purchaseRank` ได้
- ยังไม่มีการพิสูจน์ว่า local account เป็นเจ้าของ Minecraft account นั้น
- ยังไม่มี durable local-user ↔ Minecraft UUID relation

สิ่งที่ต้องทำ:

1. เพิ่มตาราง identity ใหม่ เช่น `player_identities` โดยมีอย่างน้อย:
   - `id`
   - `userId`
   - `minecraftUuid`
   - `minecraftIGN`
   - `edition` = `java` หรือ `bedrock`
   - `verifiedAt`
   - `updatedAt`
2. ใส่ unique constraint อย่างน้อย:
   - UUID หนึ่งเชื่อมกับ local user ได้เพียงคนเดียว
   - local user หนึ่งมี identity หลักตาม policy ที่กำหนด
3. ทำ verification flow จาก Minecraft server เช่น:
   - ผู้ใช้ login เว็บไซต์
   - กดสร้าง verification code
   - เข้า Minecraft แล้วใช้ `/store verify <code>`
   - plugin/Skript ส่ง UUID จริงจาก server กลับมายัง backend
   - backend redeem code แบบ one-time และหมดอายุ
4. รองรับ Java/Bedrock โดยไม่เดา UUID เองจากชื่อ
5. ปรับ purchase ให้ใช้ `identityId` หรือ verified UUID ไม่รับ IGN อิสระเป็นหลักฐาน
6. หากยังไม่ verified ต้องปฏิเสธการซื้อด้วย `PRECONDITION_FAILED`
7. เพิ่ม tests สำหรับ:
   - code หมดอายุ
   - code ใช้ซ้ำ
   - UUID ถูก link กับบัญชีอื่นแล้ว
   - local user พยายามใช้ IGN ของคนอื่น
   - Java และ Bedrock identity

### P0-4 — ทำ Wallet และ Purchase ให้ atomic/idempotent

ปัญหาปัจจุบัน:

- `adjustUserBalance` มี transaction ของ ledger/balance
- แต่ `purchaseRank` หัก Wallet ก่อน แล้วค่อยสร้าง Order
- หากสร้าง Order fail หลังหักเงิน อาจเกิดเงินหาย
- reference ปัจจุบันสร้างใหม่ทุกครั้ง จึงไม่ใช่ request idempotency ที่ผู้ใช้ retry ได้
- concurrent fulfillment อาจส่ง points ซ้ำได้

สิ่งที่ต้องทำ:

1. เพิ่ม `idempotencyKey` ต่อ purchase request
2. client ต้องส่ง key เดิมเมื่อ retry request เดิม
3. DB ต้อง unique key ต่อ user/order action
4. ทำ flow ให้:
   - lock/ตรวจ identity
   - ตรวจ rank และราคา server-side
   - สร้าง pending order
   - หัก wallet
   - insert ledger
   - commit transaction เดียวกัน
5. ถ้า request เดิมเข้าซ้ำ ให้คืน order เดิม ไม่หักเงินซ้ำ
6. ทำ delivery state machine อย่างน้อย:
   - `รอตรวจสอบ`
   - `กำลังดำเนินการ`
   - `สำเร็จ`
   - `ล้มเหลว`
   - `ยกเลิก`
7. ป้องกัน admin สองคน approve order เดียวกันพร้อมกัน
8. การ refund ต้องมี reference key และ audit trail
9. เพิ่ม tests concurrent purchase และ concurrent approval

ห้ามใช้การแก้ด้วยการเช็ค balance ก่อนอย่างเดียว เพราะไม่ป้องกัน race condition

### P0-5 — ปรับ Minecraft delivery

1. delivery ต้องอ้าง verified UUID/identity
2. บันทึก delivery attempt แยกจาก order:
   - command
   - target UUID/IGN
   - startedAt
   - completedAt
   - result
   - retryCount
   - error
3. ตั้ง order เป็น `สำเร็จ` เฉพาะเมื่อได้รับผลยืนยันจาก RCON/plugin
4. ถ้า RCON fail ให้คงสถานะ retryable ไม่ใช่ success
5. retry ต้อง idempotent ไม่แจก points ซ้ำ
6. แยกคำสั่ง rank และ coin ให้ตรวจผลได้ทั้งคู่

### P0-6 — Security audit

ตรวจและทดสอบ:

- session signature และ expiration
- password policy และ timing-safe password check
- CSRF/cookie settings
- admin/owner authorization
- price tampering จาก client
- rankId ปลอม/ลบ/disabled
- orderId ปลอมของผู้ใช้คนอื่น
- wallet amount ปลอม
- top-up slip MIME/content validation
- webhook signature/token validation
- RCON host/command/input protection
- rate limiting สำหรับ login, register, verify และ purchase
- log redaction ไม่ให้ password/token/cookie/slip secret หลุด

### P0-7 — Discord runtime

1. อย่าถือว่า Discord ใช้งานได้จาก source
2. ใช้ `pnpm test:live` เมื่อมี token ที่ถูกต้อง
3. ตอนนี้ live test เคยตอบ:
   - Discord API HTTP `401 Unauthorized`
4. ตรวจ token/bot ให้ตรงกับ channel/guild ที่ใช้งาน
5. ห้ามใส่ token ในเอกสารหรือ commit
6. ตรวจ AI bot runner แยก process และตรวจ reconnect/error handling

### P0-8 — GitHub workflow

ทำงานทุกครั้งใน branch แยก เช่น:

```bash
git checkout -b fix/player-identity
```

ลำดับบังคับ:

1. อ่านไฟล์และทำ audit ก่อนแก้
2. แก้เฉพาะ scope
3. เพิ่ม/ปรับ tests
4. รัน:

```bash
pnpm check
pnpm test
pnpm build
git diff --check
```

5. ตรวจ secrets
6. commit พร้อมข้อความชัดเจน
7. สรุป changed files, test result, blockers
8. ค่อยเสนอ PR หรือ merge หลัง review

ห้าม commit:

- `.env`
- token
- password
- private key
- webhook URL ที่มี secret
- production database URL
- slip/private storage credential

---

## 6. รายงานที่ต้องส่งทุกครั้ง

ให้รายงานเป็นภาษาไทยและใช้รูปแบบนี้:

```text
Production backend: A/B/C/D/E + หลักฐาน
Production database: A/B/C/D/E + หลักฐาน
Production URL: A/B/C/D/E + URL หรือ blocker
Login status: A/B/C/D/E
Player identity Java/Bedrock UUID: A/B/C/D/E
Wallet status: A/B/C/D/E
Top-up status: A/B/C/D/E
Store/order status: A/B/C/D/E
Minecraft delivery status: A/B/C/D/E
Discord status: A/B/C/D/E
Deployment status: A/B/C/D/E
Security status: A/B/C/D/E

แก้ไขใน commit:
- <hash> <message>

Validation:
- pnpm check: PASS/FAIL
- pnpm test: PASS/FAIL พร้อมจำนวน
- pnpm build: PASS/FAIL
- git diff --check: PASS/FAIL

Blockers:
1. ...
2. ...

เปิดให้ผู้เล่นใช้ได้จริงเฉพาะ:
- ...
```

---

## 7. ข้อความพร้อมส่งให้ GPT

> รับงานต่อจาก repository `Rin4803/ritz-smp-store` ที่ branch `production-readiness-pass`, commit ล่าสุด `34c3491f` ครับ
>
> เป้าหมายคือทำ Production Readiness Pass ของ RitzSMP Store ให้พร้อมใช้งานจริง โดยห้ามเพิ่มฟีเจอร์เกินจำเป็นและห้ามถือ source code เป็น runtime evidence
>
> อ่านไฟล์ต่อไปนี้ก่อนเริ่ม:
>
> - `docs/GPT_CONTINUATION_HANDOFF_TH.md`
> - `docs/production-readiness-pass-2026-09-29-th.md`
> - `AI_CONTEXT_TH.md`
> - `todo.md`
> - `server/routers.ts`
> - `server/db.ts`
> - `drizzle/schema.ts`
> - `server/_core/index.ts`
> - `server/_core/localAuth.ts`
> - `firebase.json`
> - `.firebaserc`
>
> ทำงานตามลำดับ P0:
>
> 1. ยืนยัน backend/database/deployment runtime
> 2. ทำ verified Java/Bedrock Minecraft UUID identity
> 3. ทำ Wallet + Order purchase ให้ atomic และ idempotent
> 4. ทำ delivery state/retry/audit ให้ไม่แจกซ้ำ
> 5. ตรวจ security และ production secrets
> 6. ตรวจ Discord runtime ด้วย live test ที่มี credential ถูกต้อง
>
> ทุกการแก้ต้องอยู่ใน branch แยก, เพิ่ม tests, รัน `pnpm check`, `pnpm test`, `pnpm build`, `git diff --check`, commit และรายงาน A–E ตามเอกสาร ห้ามเปิดใช้งานเงินจริงจนกว่า blocker E เรื่อง deployment และ UUID identity จะถูกปิด

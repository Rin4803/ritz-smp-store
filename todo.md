# RitzSMP Implementation TODO

- [x] Web Store MVP (React, tRPC, Drizzle)
- [x] Wallet ledger and idempotency tests (20/20 Vitest tests passing)
- [x] In-game /pay GUI Skript implementation (`ritz_smp_pay_gui.sk`)
- [x] ตรวจสอบตัวเชื่อมต่อและสถานะ MCSV/Discord ที่ใช้งานจริง
- [x] สำรวจคำสั่ง ปลั๊กอิน Skript และสิทธิ์ยศที่มีอยู่จริง
- [x] สำรองไฟล์และติดตั้งระบบที่ขาดอย่างปลอดภัย
- [x] อัปเดตคู่มือ Discord และทดสอบคำสั่ง/สิทธิ์
- [x] ตรวจสอบความพร้อมของระบบไฟล์สำรองและคู่มือการติดตั้งบน MCSV และ Discord
- [x] จัดทำคู่มือและคำแนะนำพร้อมคัดลอกใช้งานจริงสำหรับการติดตั้ง Skript และการตั้งค่า Discord

- [x] สร้างระบบเติมเงิน (Top-up request) พร้อมแนบสลิปและรอแอดมินอนุมัติเพิ่มยอดเงินเข้ากระเป๋า
- [x] ปรับระบบซื้อยศให้หักจากยอดเงินในกระเป๋าโดยไม่ต้องแนบสลิปซ้ำ
- [x] ปรับหน้าสำเร็จและหน้าประวัติการซื้อให้แสดงเวลา จำนวนเงิน และรายการยศที่ซื้ออย่างชัดเจน
- [x] เพิ่ม Vitest ทดสอบระบบแยกเติมเงินและซื้อยศ
- [x] อัปเดตข้อความประกาศและคู่มือในห้อง Discord #โดเนท ให้แยกการเติมเงิน (แนบสลิป) กับการซื้อยศ (ใช้ยอด Wallet ไม่ต้องแนบสลิป)
- [x] สร้างหน้าเติมเงิน (Top-up) แบบ Modal และ Wallet Workflow บนหน้า Home แยกจากหน้าซื้อยศอย่างชัดเจน
- [x] ปรับหน้าซื้อยศ (Rank Purchase) ให้เลือกยศและใส่เฉพาะชื่อในเกมโดยไม่ต้องแนบรูปสลิป
- [x] ตรวจสอบและยืนยันการแสดงผลหน้าเติมเงินและหน้าซื้อยศบนเว็บไซต์เวอร์ชันล่าสุดผ่านการรีสตาร์ทเซิร์ฟเวอร์และแคช

- [x] อัปเดตข้อความในห้อง Discord #โดเนท ให้เป็นรูปแบบใหม่แยกเติมเงินและซื้อยศจริง
- [x] ตรวจสอบและแก้ไขช่องทางการโพสต์ประกาศห้อง #โดเนท ให้ถูกต้องและส่งข้อความอัตโนมัติเมื่อบอทพร้อมทำงาน
- [x] รองรับการกำหนดช่องประกาศห้อง #โดเนท แยกเฉพาะ (DISCORD_DONATE_CHANNEL_ID) และเพิ่มคำแนะนำแก้ไข Token ให้บอทเชื่อมต่อสำเร็จ
- [x] จัดทำคู่มือ `discord_bot_setup_guide.md` สำหรับตั้งค่า Token และช่อง `DISCORD_DONATE_CHANNEL_ID` เรียบร้อยแล้ว

- [x] พัฒนาคำสั่งและระบบสร้าง Embed ในบอท Discord สำหรับห้องโดเนท พร้อมปุ่มกดลิงก์ร้านค้าแบบมืออาชีพ

- [x] เพิ่ม Slash Command `/embed` ในบอท RitzSMP AI สำหรับสร้างข้อความ Embed และปุ่มกดร้านค้าใน Discord
- [x] เพิ่มชุดทดสอบ Vitest สำหรับคำสั่ง `/embed` ในบอท RitzSMP AI และรันผ่านทั้งหมด 23 tests สำเร็จ

- [x] ลบประกาศและลิงก์เว็บเก่าใน Discord และโพสต์ประกาศ/Embed ใหม่พร้อมลิงก์เว็บที่อัปเดตแล้ว

- [x] ตรวจสอบและแก้ไขบอท RitzSMP AI ให้เริ่มต้นระบบสำเร็จ ไม่เกิด Error TokenInvalid และป้องกัน Unknown interaction

- [x] เพิ่มหน้า RitzSMP AI Bot Dashboard ในเว็บสโตร์ พร้อมตรวจสอบสถานะ สถิติคำสั่ง และ Log ล่าสุดเฉพาะแอดมิน
- [x] แก้ไขการลงทะเบียนคำสั่ง `/embed` ในบอท RitzSMP AI และสร้างหน้าเว็บ BotDashboard สำหรับตรวจสอบสถานะและ Log ของบอท

- [x] แก้ไขปัญหาคำสั่งซ้ำใน Discord, คำสั่งไม่ตอบสนอง, และข้อความตอบวนซ้ำของบอท RitzSMP AI

- [x] เร่งคำสั่ง `/embed` ให้ตอบกลับทันทีโดยไม่ต้องรอ AI และเพิ่มชุดคำสั่งใหม่ให้ RitzSMP AI ครบถ้วน (เช่น `/help`, `/store`, `/ranks`, `/topup`)

- [x] เพิ่มส่วนกฎระเบียบเซิร์ฟเวอร์ RitzSMP (3 ข้อหลัก + บทลงโทษแบนถาวร) ในหน้าเว็บไซต์ (Home.tsx) ตามคำขอของผู้ใช้

- [x] แก้ไขโค้ด server/discordAiBot.ts ให้จัดการ interaction อย่างรวดเร็ว ป้องกันบอทค้าง ไม่ตอบสนอง และทำให้คำสั่ง /embed ทำงานสำเร็จ 100%

- [x] แก้ไขปัญหาข้อผิดพลาด "การผสานการทำงานที่ไม่รู้จัก" (Unknown integration) สำหรับคำสั่งเก่าอย่าง `/ai-status` โดยเพิ่ม `/ai-status` เป็น alias ของ `/status` และล้างคำสั่งเก่าที่ค้างในระบบ Discord

- [x] ตรวจสอบและแก้ไขเส้นทางการทำงานของคำสั่ง `/embed` ใน `server/discordAiBot.ts` ให้ส่ง Embed แบบสาธารณะสำเร็จทันทีโดยไม่ต้องเช็คสิทธิ์แอดมินที่เข้มงวดเกินไป ป้องกันข้อผิดพลาด Unknown Integration

- [x] เพิ่มคำสั่งย่อย `/embed create` ในบอท RitzSMP AI ให้แอดมินสร้างประกาศ Embed กำหนดหัวข้อ เนื้อหา สี และลิงก์ปุ่มได้เองจาก Discord พร้อมทดสอบ Vitest และบันทึก Checkpoint

- [x] แก้ไขคำสั่ง `/embed create` ไม่ให้สร้างปุ่มค่าเริ่มต้นอัตโนมัติเมื่อผู้ใช้ไม่ได้กรอก URL และปุ่มจะแสดงเฉพาะเมื่อผู้ใช้ระบุ URL และชื่อปุ่มเท่านั้น

- [x] ยืนยันการแก้ไขโค้ด `/embed create` ให้ไม่มีปุ่มลิงก์ปรากฏขึ้นมาเองหากไม่ได้ระบุพารามิเตอร์ URL และปุ่ม

- [x] เพิ่มระบบตรวจสอบสถานะเซิร์ฟเวอร์ Minecraft (ออนไลน์, จำนวนผู้เล่น, Latency) ในคำสั่ง `/status` และ `/ai-status` ด้วย fetch แบบ Timeout ป้องกันบอทค้าง
- [x] ปรับปรุงคำสั่ง `/ask` ให้ใช้ Dynamic Prompting, ป้องกันคำตอบซ้ำซ้อน และตอบตรงคำถามของผู้เล่น

- [x] ส่งแจ้งเตือน Embed เมื่อซื้อสินค้า/ยศสำเร็จไปยังช่องสนับสนุนหรือช่องประกาศ Discord ที่ตั้งค่าได้
- [x] ส่งรายละเอียดคำขอเติมเงินพร้อมรูปสลิปไปยังช่อง `donate-log` เพื่อให้แอดมินตรวจสอบ
- [x] เพิ่มการตั้งค่า Channel ID และทดสอบการแจ้งเตือนจากเว็บไป Discord แบบ end-to-end
- [x] ตรวจสอบโทเคนบอท Discord ที่ระบบใช้อยู่และเชื่อมระบบแจ้งเตือนเข้ากับ Discord จริง
- [x] ตรวจสอบหรือกำหนด Channel ID สำหรับช่องประกาศผู้สนับสนุนและช่อง `donate-log` พร้อมทดสอบสิทธิ์ส่งข้อความและไฟล์แนบ
- [x] ทดสอบ live end-to-end จาก flow เติมเงิน/ซื้อยศของเว็บจนถึง Discord API โดยไม่ใช้ข้อมูลทดสอบที่ทำให้ยอดเงินจริงเปลี่ยน
- [x] เพิ่ม live smoke test แบบไม่สร้างข้อมูลธุรกิจถาวร เพื่อตรวจสอบสิทธิ์ส่ง Embed และแนบไฟล์ไปยังช่อง supporter กับ `donate-log`
- [x] ทดสอบ live end-to-end โดยเรียก procedure จริงของเว็บสโตร์ (`createTopup` และ/หรือ `purchaseRank`) ในสภาพแวดล้อมทดสอบที่ไม่กระทบยอดเงินจริง และยืนยัน `discordNotification.sent = true`
- [x] บันทึกผลทดสอบ live flow ที่เรียก backend/tRPC จริงแทนการยิง Discord API โดยตรง
- [x] เพิ่ม live integration test ที่เรียก `/api/trpc` ผ่าน HTTP จริงสำหรับ flow แจ้งเตือนร้านค้า และตรวจสอบ response ที่มี `discordNotification.sent = true`
- [x] บันทึกผลลัพธ์จาก backend HTTP flow จริง โดยไม่ใช้ `appRouter.createCaller` และไม่ยิง Discord API ตรงเป็นหลัก
- [x] เพิ่มประกาศผู้เล่นเข้าและออกเซิร์ฟเวอร์ Minecraft ไปยังช่อง Discord ที่ตั้งค่าได้
- [x] เพิ่ม Embed ปุ่มยืนยันตัวตนใน Discord พร้อมกำหนด Verified Role และป้องกันการกดยืนยันซ้ำ
- [x] เพิ่มระบบเชื่อมบัญชี Discord กับชื่อ Minecraft ก่อนรับยศในเซิร์ฟเวอร์
- [x] เพิ่มปุ่ม/คำสั่งรับยศเริ่มต้นหรือยศที่กำหนด พร้อมตรวจสอบสิทธิ์และเรียก LuckPerms/RCON อย่างปลอดภัย
- [x] เพิ่ม Embed/คำสั่งแสดงรายชื่อผู้เล่นออนไลน์จากสถานะเซิร์ฟเวอร์ Minecraft แบบอัปเดตได้
- [x] เพิ่มการตั้งค่า Channel ID, Role ID และข้อความระบบผ่าน Environment พร้อม Vitest ครอบคลุมทุก flow
- [x] เพิ่มโปรไฟล์สมาชิก RitzSMP ใน Discord แสดง Discord tag, Minecraft IGN, UUID, รูปสกิน/อวตาร, สถานะยืนยัน และยศ
- [x] เพิ่มฟอร์มแก้ไขโปรไฟล์สำหรับคำแนะนำตัวและสไตล์การเล่น พร้อมปุ่มดู/แก้ไขจากแผงสมาชิก
- [x] เชื่อมโปรไฟล์กับระบบยืนยันตัวตน รายชื่อผู้เล่น และการรับยศ พร้อมทดสอบป้องกันข้อมูลของสมาชิกคนอื่นรั่วไหล
- [x] สร้างและทดสอบกลไกตรวจจับผู้เล่น Minecraft เข้า/ออกจริง (polling/query หรือ event bridge) แล้วส่งประกาศไปยัง Discord channel ที่ตั้งค่าได้
- [x] เพิ่ม/ทดสอบการให้ Verified Role และการกันกดยืนยันซ้ำแบบ end-to-end
- [x] เพิ่ม Vitest ครอบคลุม flow ใหม่ทั้งหมด: verify, claim rank, player list, join/leave announcement, profile view/edit
- [x] เพิ่ม tests/guards ด้าน privacy เพื่อยืนยันว่าผู้ใช้ไม่สามารถดูหรือแก้ไขโปรไฟล์ของสมาชิกคนอื่นได้
- [x] เลื่อนการเพิ่มสิทธิ์ผู้ดูแลระบบให้บัญชี Nongmodeknarak@gmail.com ตามคำขอ เพื่อให้ Owner ทดสอบการเพิ่มด้วยตนเองภายหลัง
- [x] กำหนด `optun2264@gmail.com` เป็น Owner ระดับสูงสุดของเว็บ และห้ามบัญชีอื่นยึดสิทธิ์ Owner
- [x] เพิ่มหน้า/แผงจัดการสมาชิกให้ Owner เพิ่มหรือปลด role Admin ได้จากเว็บ
- [x] ป้องกันไม่ให้ Admin เพิ่ม/ปลด Admin คนอื่น ยกระดับตัวเอง หรือปลด Owner ได้
- [x] เพิ่ม Vitest ตรวจสอบสิทธิ์ Owner/Admin และตรวจสอบว่าอีเมล Owner ถูกกำหนดอย่างปลอดภัย

- [x] Persist Minecraft presence snapshots and Heartbeat task identity for reliable join/leave detection across stateless deployments
- [x] Mount and validate the authenticated `/api/scheduled/minecraft-presence` callback
- [x] Create the project-level Heartbeat job for periodic Minecraft presence polling after deployment

- [x] Keep `Nongmodeknarak@gmail.com` unpromoted so the Owner can test manual promotion later
- [x] Stop/restart the website services and validate the rebuilt deployment before the final checkpoint publication
- [x] Add a Vitest or HTTP integration test for the scheduled presence route covering non-cron rejection and cron orphan handling
- [x] Run a manual or automated request against the scheduled presence route after restart/deployment

- [x] Audit and restore all RitzSMP AI commands that fail to respond, including token/lifecycle and command-registration health
- [x] Add focused tests for command timeout, safe interaction replies, and command error recovery
- [x] Decide and document a supported Discord music source and runtime approach that is compatible with production hosting
- [x] Implement safe Discord music playback with join/play/queue/skip/stop/leave controls if the runtime supports it
- [x] Add focused music-command tests and perform a live Discord API smoke test after restart; actual voice playback still requires a member to join a voice channel

- [x] Implement free Autoscale music mode without Reserved Hosting; document that voice playback and queue can stop on cold starts/restarts
- [x] Add free-mode music commands with voice-channel validation, queue controls, source validation, and graceful error replies
- [x] Add tests for free-mode music command validation and interaction timeout safety
- [x] Route music help/status messages to a dedicated `🎵│ห้องเพลง` channel and keep `🐣│รายชื่อผู้ซื้อยศสำเร็จ` limited to purchase notifications
- [x] Add a safe setup or channel-routing helper that can create/use the dedicated music channel only when the bot has Discord channel-management permission

- [x] Route Minecraft join/leave announcements away from `🐣│รายชื่อผู้ซื้อยศสำเร็จ` into a dedicated `📡│สถานะเซิร์ฟเวอร์` channel
- [x] Add channel-routing tests and verify live Discord separation for purchase, music, and Minecraft status messages
- [x] Audit legacy Discord bot entrypoint, token source, command registration, listeners, and permissions against RitzSMP AI
- [x] Restore or safely isolate the previously working Discord bot without duplicate command registrations or listeners
- [x] Add regression tests for every currently nonresponsive command path and both bot lifecycle outcomes
- [x] Run live identity/command smoke checks for the old bot and RitzSMP AI after restart
- [x] Publish the dedicated Minecraft status-channel routing fix so presence events no longer use the purchase channel
- [x] Verify the production bot and Heartbeat callback after publication with a live channel audit

- [x] Make Discord verification identity-first; keep Minecraft account linking optional and clearly labeled
- [x] Make role claiming assign Discord roles without requiring a Minecraft LuckPerms grant
- [x] Route Discord member join/leave announcements to Discord status channels independently from Minecraft presence
- [x] Make the Discord member list show Discord members and privacy-safe profiles rather than only Minecraft players
- [x] Add regression tests proving Discord-native onboarding works when Minecraft/RCON is unavailable
- [x] Transition onboarding verification and member lists to be Discord-native
- [x] Replace legacy Kanopi/Dischook bot output with RitzSMP AI welcome/goodbye and onboarding panels
- [x] Reconcile bot client tokens and prevent duplicate command handlers
- [x] Run Vitest tests and verify Discord synchronization
- [x] Transition onboarding verification to be Discord-native (Minecraft linking optional with 'none' or direct Discord verification)
- [x] Reconcile legacy verification / 4-digit bots and consolidate all onboarding, welcome, leave, verification, role assignment, and member profile capabilities into RitzSMP AI
- [x] Ensure all 75 Vitest tests pass cleanly and prepare live production synchronization checkpoint for morning review
- [x] Add 4-digit code generation / verification flow (`/verify <code>` or modal code input) to RitzSMP AI to fully support user's 4-digit requirement
- [x] Ensure all onboarding buttons (`ritz_verify_button`, `ritz_claim_rank_button`, `ritz_players_button`, `ritz_profile_button`) reply instantly within 3 seconds to avoid "Application didn't respond"
- [x] Post the updated RitzSMP AI onboarding panel into the welcome/verification channel to replace stale legacy messages
- [x] Deploy RitzSMP AI automated channel panels into #✅│เชื่อมต่อดิสคอร์ด, #📋│รายชื่อบัญชี, #🪪│ยืนยันตัวตนแมะ, และ #👋│welcome
- [x] Implement single-button 4-digit code generator in verification channel
- [x] Implement Minecraft /verify <code> command to securely bind Minecraft UUID/IGN to Discord ID
- [x] Implement single-button 4-digit code generator in verification channel
- [x] Implement Minecraft /verify <code> command to securely bind Minecraft UUID/IGN to Discord ID
- [x] Design multi-server database schema (`managed_servers` and server-scoped configs)
- [x] Implement Server Selection and Management UI in web platform
- [x] Implement dynamic bot configuration per server (Discord tokens, RCON, channel mapping)
- [x] Validate multi-tenant isolation and automated tests
- [x] Design multi-server database schema (`managed_servers` and server-scoped configs)
- [x] Implement Server Selection and Management UI in web platform
- [x] Implement dynamic bot configuration per server (Discord tokens, RCON, channel mapping)
- [x] Validate tenant isolation, tests, and deployment readiness
- [x] Inspect startup channel recovery in server/discordAiBot.ts
- [x] Ensure deleted channels are automatically recreated and repopulated upon bot restart
- [x] Fix string length / message size error handling in Discord embeds and responses
- [x] Add an authenticated Minecraft callback for redeeming Discord four-digit verification codes
- [x] Update the Discord connection panel to use the durable four-digit flow end to end
- [x] Keep the Discord-native member list separate from the live Minecraft player list
- [x] Verify the unified bot has one active gateway listener and no legacy duplicate startup
- [x] Implement robust startup channel auto-recreation and idempotent panel publishing in RitzSMP AI
- [x] Harden ensureDeferredReply and safeReply against InteractionNotReplied and string length limits
- [x] Use the provided Minecraft cover image in the Discord welcome message for new members
- [x] Add a matching Discord leave notification with member name, timestamp, and cover image
- [x] Add or update tests for welcome and leave embed payloads and run the full Vitest suite
- [x] Create a visual Discord rank-claim embed using the provided RitzSMP image
- [x] Add a secure verify-and-claim button flow that assigns the configured Discord role and Minecraft rank where configured
- [x] Validate rank-claim permissions, duplicate clicks, and interaction response handling
- [x] Rename auto-created Discord channels with clear system-purpose names and matching topics
- [x] Fix intermittent `RangeError: Maximum call stack size exceeded` during Discord global command registration and prevent duplicate bot startup work
- [x] Fix production `InteractionNotReplied` in the onboarding interaction error path and verify profile/button handling in live logs
- [x] Return a safe 403 response for unauthenticated Heartbeat callbacks instead of leaking a 500 session-cookie error
- [x] Deduplicate the Discord account-list channel header, starter text, and RitzSMP AI panel so only one canonical panel remains after sync/restart
- [x] Add regression coverage proving account-list panel synchronization is idempotent and removes stale duplicates safely
- [x] Keep the purchase-success channel limited to rank-purchase notifications and remove welcome/connect-account panels from it
- [x] Deduplicate welcome panels and route the welcome message only to the dedicated welcome channel
- [x] Add regression coverage for welcome routing and repeated startup synchronization
- [x] Create separate `👋│ระบบต้อนรับ` and `👋│ระบบสมาชิกออก` channels instead of one combined welcome/leave channel
- [x] Route guildMemberAdd only to the welcome channel and guildMemberRemove only to the leave channel
- [x] Migrate the combined-channel panel safely and add regression coverage for separate channel routing
- [x] Fix the `/verify` interaction path that logged `InteractionNotReplied` during live startup validation and add a regression test
- [ ] Clean legacy Kanopi embeds from `📜│บันทึกรับยศสำเร็จ` without touching unrelated Discord channels
- [ ] Ensure current rank-purchase notifications use one canonical RitzSMP AI format and do not duplicate
- [ ] Add regression coverage for legacy rank-log classification and safe cleanup
- [ ] Format the Discord member list as readable line-separated entries without literal `\\n` artifacts or ambiguous mentions
- [ ] Make the Minecraft online-player button finish within a bounded timeout and show `ออนไลน์ 0 คน` when no players or no response is available
- [ ] Add regression coverage for member-list formatting, zero-player fallback, timeout handling, and interaction acknowledgement
- [ ] Reuse one active four-digit verification code per Discord account until it is consumed or expires
- [ ] Add a visible cancel/unlink action for pending codes and existing Discord-to-Minecraft links
- [ ] Enforce one Discord account to one Minecraft account and reject conflicting links safely
- [ ] Add regression coverage for duplicate code clicks, cancellation, relinking, and consumed-code behavior
- [ ] เพิ่ม tRPC query สำหรับดึงประวัติการทำรายการ (orders และ topup requests) ของผู้ใช้ที่ล็อกอินอยู่
- [ ] เพิ่มหน้าหรือแท็บแสดงประวัติการทำรายการ (Transaction History) บนเว็บสโตร์
- [ ] ทดสอบความถูกต้องของสิทธิ์การเข้าถึงและการแสดงผลข้อมูลย้อนหลัง
- [ ] ตรวจสอบผ่าน Vitest และบันทึก checkpoint
- [x] เพิ่ม tRPC query สำหรับดึงประวัติการทำรายการ (orders และ topup requests) ของผู้ใช้ที่ล็อกอินอยู่
- [x] เพิ่มหน้าหรือแท็บแสดงประวัติการทำรายการ (Transaction History) บนเว็บสโตร์
- [x] ทดสอบความถูกต้องของสิทธิ์การเข้าถึงและการแสดงผลข้อมูลย้อนหลัง
- [x] ตรวจสอบผ่าน Vitest และบันทึก checkpoint

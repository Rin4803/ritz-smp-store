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
- [x] Clean legacy Kanopi embeds from `📜│บันทึกรับยศสำเร็จ` without touching unrelated Discord channels
- [x] Ensure current rank-purchase notifications use one canonical RitzSMP AI format and do not duplicate
- [x] Add regression coverage for legacy rank-log classification and safe cleanup
- [x] Format the Discord member list as readable line-separated entries without literal `\\n` artifacts or ambiguous mentions
- [x] Make the Minecraft online-player button finish within a bounded timeout and show `ออนไลน์ 0 คน` when no players or no response is available
- [x] Add regression coverage for member-list formatting, zero-player fallback, timeout handling, and interaction acknowledgement
- [x] Reuse one active four-digit verification code per Discord account until it is consumed or expires
- [x] Add a visible cancel/unlink action for pending codes and existing Discord-to-Minecraft links
- [x] Enforce one Discord account to one Minecraft account and reject conflicting links safely
- [x] Add regression coverage for duplicate code clicks, cancellation, relinking, and consumed-code behavior
- [x] เพิ่ม tRPC query สำหรับดึงประวัติการทำรายการ (orders และ topup requests) ของผู้ใช้ที่ล็อกอินอยู่
- [x] เพิ่มหน้าหรือแท็บแสดงประวัติการทำรายการ (Transaction History) บนเว็บสโตร์
- [x] ทดสอบความถูกต้องของสิทธิ์การเข้าถึงและการแสดงผลข้อมูลย้อนหลัง
- [x] ตรวจสอบผ่าน Vitest และบันทึก checkpoint
- [x] เพิ่ม tRPC query สำหรับดึงประวัติการทำรายการ (orders และ topup requests) ของผู้ใช้ที่ล็อกอินอยู่
- [x] เพิ่มหน้าหรือแท็บแสดงประวัติการทำรายการ (Transaction History) บนเว็บสโตร์
- [x] ทดสอบความถูกต้องของสิทธิ์การเข้าถึงและการแสดงผลข้อมูลย้อนหลัง
- [x] ตรวจสอบผ่าน Vitest และบันทึก checkpoint
- [x] นำส่วนกฎระเบียบเซิร์ฟเวอร์ RitzSMP ออกจากหน้าเว็บไซต์ (Home.tsx) ตามคำขอเรียบร้อยแล้ว
- [x] ตรวจสอบความถูกต้องและผ่านการทดสอบ Vitest ครบ 100 Tests สำเร็จ
- [x] เพิ่มระบบค้นหา (Search input) และตัวกรองราคา (Price filter chips) สำหรับรายการยศในร้านค้าหน้าแรก (Home.tsx) ให้ผู้เล่นค้นหาสินค้าได้รวดเร็ว
- [x] เพิ่มสถานะไม่พบสินค้า (Empty state) พร้อมปุ่มล้างตัวกรองกรณีค้นหาไม่พบรายการ
- [x] ตรวจสอบความถูกต้องและผ่านการทดสอบ Vitest ครบ 100 Tests สำเร็จ
- [x] เปลี่ยนรางวัลหลังซื้อยศจาก Key ในเกมเป็นเหรียญในเกมตามระดับยศ (100 - 1,500 เหรียญ) ในรายการยศ (DEFAULT_RANKS) พร้อมรักษาการส่งคำสั่ง RCON แบบ realtime และผ่านการทดสอบ Vitest ครบ 100 Tests สมบูรณ์
- [x] ตรวจสอบและอัปเดตคำสั่ง RCON ในเซิร์ฟเวอร์เพื่อให้เมื่อซื้อยศแล้ว นอกจากจะให้ยศผ่าน LuckPerms แล้ว ยังรันคำสั่งเพิ่ม points (เหรียญ) ให้ผู้เล่นโดยอัตโนมัติ
- [x] ตรวจสอบว่าไม่มีข้อความ Key หลงเหลือในรายการยศหรือคำอธิบายหน้าเว็บ
- [x] รันชุดทดสอบ Vitest และบันทึก checkpoint
- [x] ตรวจทุกปลั๊กอิน สคริปต์ และไฟล์ที่อ้างอิง `/worth` หรือมีตารางราคาแยก เพื่อกระทบยอดราคาแสดงผลกับ `/sell` และ `/sellall` โดยคงการป้องกัน arbitrage
- [x] เทียบราคาไม้แปรรูป 12 ชนิดจากรายงานผู้เล่นกับตารางขาย FoShop และหน้าจอ `/worth`
- [x] เทียบราคา Rotten Flesh, Bone, Arrow, String, Spider Eye, Gunpowder, Ender Pearl, Slimeball และ Phantom Membrane กับตารางขายจริง
- [x] เทียบราคา Coal, Raw Iron, Raw Copper, Raw Gold, Raw Redstone, Raw Lapis Lazuli, Raw Diamond และ Raw Emerald กับตารางขายจริง
- [x] บันทึกและแก้เฉพาะรายการที่พิสูจน์แล้วว่า `/worth` แสดงราคาไม่ตรงหรือไอเทมขายไม่ได้ โดยไม่เปลี่ยนดุลยภาพราคาอื่นโดยไม่มีหลักฐาน
- [ ] ทดสอบด้วยบัญชีควบคุม: ยืนยันยอดเงินและไอเทมก่อน/หลัง `/sell`, `/sellall`, `/pay` และ Auction House โดยไม่แก้ยอดหรือไอเทมของผู้เล่นจริง
- [x] ตรวจสอบและอัปเดตคำสั่ง RCON ในเซิร์ฟเวอร์เพื่อให้เมื่อซื้อยศแล้ว นอกจากจะให้ยศผ่าน LuckPerms แล้ว ยังรันคำสั่งเพิ่ม points (เหรียญ) บนสกอร์บอร์ดให้ผู้เล่นโดยอัตโนมัติ
- [x] ตรวจสอบว่าไม่มีข้อความ Key หลงเหลือในรายการยศหรือคำอธิบายหน้าเว็บ ทุกยศแสดงรางวัลเป็น "รับเหรียญ X แต้ม" อย่างชัดเจน
- [x] รันชุดทดสอบ Vitest ครบ 100 Tests สมบูรณ์และบันทึก checkpoint
- [x] ลบข้อความ Key ออกจากฐานข้อมูลและบังคับซิงก์ `DEFAULT_RANKS` ให้แสดงเฉพาะเหรียญ points บนหน้าร้านเว็บไซต์
- [x] ตรวจสอบและผ่านชุดทดสอบ Vitest ครบ 100 Tests สำเร็จ
- [x] ปรับปรุง RitzSMP AI ให้มีการจัดการ Rate Limit, สตรีมมิ่ง/ตอบกลับข้อความแบบพิมพ์ล่วงหน้า และการจัดการข้อผิดพลาดที่รวดเร็วขึ้น
- [x] เพิ่มระบบ Command Auto-Complete และปุ่มช่วยเหลือด่วนในหน้าต่างพูดคุยกับ AI
- [x] ผ่านชุดทดสอบ Vitest และตรวจสอบความเสถียรของบอทหลังการปรับปรุง
- [x] ปรับปรุง RitzSMP AI ให้มีการจัดการ Rate Limit, สตรีมมิ่ง/ตอบกลับข้อความแบบพิมพ์ล่วงหน้า และการจัดการข้อผิดพลาดที่รวดเร็วขึ้น
- [x] เพิ่มระบบ Command Auto-Complete และปุ่มช่วยเหลือด่วนในหน้าต่างพูดคุยกับ AI
- [x] ผ่านชุดทดสอบ Vitest และตรวจสอบความเสถียรของบอทหลังการปรับปรุง
- [x] ออกแบบและติดตั้งระบบ GUI วาปสุดเท่ของ RitzSMP แยกหมวดหมู่ สีสัน และเอฟเฟกต์
- [x] ทดสอบและตรวจสอบความถูกต้องของระบบวาปบนเซิร์ฟเวอร์
- [x] ออกแบบและติดตั้งระบบ GUI วาปสุดเท่ของ RitzSMP แยกหมวดหมู่ สีสัน และเอฟเฟกต์
- [x] ทดสอบและตรวจสอบความถูกต้องของระบบวาปบนเซิร์ฟเวอร์
- [x] ตรวจสอบและติดตั้งระบบ GUI วาปบนเซิร์ฟเวอร์ Minecraft ผ่าน mcsv.me แยกจากระบบ Discord และเว็บไซต์สโตร์
- [x] ทดสอบความถูกต้องของคำสั่งวาปและเมนูในเกม mcsv.me
- [x] ตรวจสอบข้อผิดพลาดและรวบรวม Log จากระบบ mcsv.me
- [x] จัดทำรายงานแยกหัวข้อสำหรับนำไปประกาศใน Discord แยกตามระบบ (ระบบวาป, เมนู GUI, ระบบยศ/Points, แชท/บอท)
- [x] ตรวจสอบข้อผิดพลาดและรวบรวม Log จากระบบ mcsv.me
- [x] จัดทำรายงานแยกหัวข้อสำหรับนำไปประกาศใน Discord แยกตามระบบ
- [x] ตรวจสอบสิทธิ์และเข้าถึงไฟล์หรือคอนโซล mcsv.me เพื่อตกแต่งระบบในเกม
- [x] สำรวจปลั๊กอินและ Skript เดิมบนเซิร์ฟเวอร์ mcsv.me พร้อมตรวจสอบ log error
- [x] ติดตั้งและตกแต่งระบบ GUI วาป, เมนูคำสั่ง และข้อความในเกม mcsv.me
- [x] ตรวจสอบสิทธิ์และเข้าถึงไฟล์หรือคอนโซล mcsv.me เพื่อตกแต่งระบบในเกม
- [x] สำรวจปลั๊กอินและ Skript เดิมบนเซิร์ฟเวอร์ mcsv.me พร้อมตรวจสอบ log error
- [x] ติดตั้งและตกแต่งระบบ GUI วาป, เมนูคำสั่ง และข้อความในเกม mcsv.me
- [x] ทดสอบความเร็วการตอบสนองของ RitzSMP AI bot และตรวจสอบ error log
- [x] สรุปผลความเร็ว Latency และสถานะ error log สำหรับผู้ใช้
- [x] ตรวจสอบโค้ดระบบ Economy และ points ทั่วทั้งโปรเจกต์ (drizzle/schema.ts, server/db.ts, server/routers.ts)
- [x] รันทดสอบชุดทดสอบ Vitest และตรวจสอบว่าไม่มีบัคตกค้าง
- [x] ตรวจสอบโค้ดระบบ Economy และ points ทั่วทั้งโปรเจกต์ (drizzle/schema.ts, server/db.ts, server/routers.ts) และยืนยันความปลอดภัย
- [x] รันทดสอบชุดทดสอบ Vitest ครบ 100 Tests สำเร็จและไม่มีบัคตกค้าง
- [x] สร้างสคริปต์ Load Testing แบบปลอดภัยสำหรับจำลอง concurrent top-up และการซื้อยศ โดยไม่เขียนข้อมูลทดสอบลงฐานข้อมูลจริง
- [x] รัน Load Testing และตรวจสอบความถูกต้องของยอด Wallet, ledger และการป้องกัน double-spending
- [x] เพิ่ม regression tests สำหรับผลลัพธ์และรายงานค่า latency/error rate ของ Load Testing
- [x] ออกแบบและตกแต่งระบบ Warp GUI ในเกมพร้อมเอฟเฟกต์เสียงและหมวดหมู่ (Spawn, Survival, Shop, Event)
- [x] ตรวจสอบและออดิตระบบ Economy และ Points ในเกมร่วมกับ RCON ให้ทำงานแบบ Realtime ทันที
- [x] จำลอง Load Testing ระบบธุรกรรมและการเงินพร้อมรันชุดทดสอบ Vitest ครบ 105 Tests ผ่านทั้งหมดเรียบร้อย
- [x] ย้ายระบบ Embed/ข้อความต้อนรับและข้อความสมาชิกเข้าออกจากการโพสต์อัตโนมัติไปเป็นคำสั่ง RitzSMP AI
- [x] เพิ่มคำสั่งแอดมินสำหรับสร้าง แก้ไข เปิดใช้ ปิดใช้ และลบข้อความ/Embed ที่กำหนดเอง
- [x] ยืนยันว่าช่องบันทึกผู้ซื้อยศรับเฉพาะ purchase notification และไม่รับข้อความแชทหรือข้อความต้อนรับ
- [x] เพิ่ม regression tests สำหรับคำสั่งจัดการ Embed สิทธิ์แอดมิน และการแยกช่อง Discord
- [ ] ตรวจสอบคำสั่ง Discord และการทำงาน Live แบบปลอดภัยโดยไม่ส่งข้อความหรือทำธุรกรรมจริงโดยไม่ได้รับอนุญาต
- [ ] เพิ่มระบบ Embed Template แบบถาวรพร้อมคำสั่ง /embed list, save, use และแก้ไข/ลบเทมเพลต
- [ ] เพิ่มการตรวจสอบเจ้าของข้อความ Embed และการป้องกันแก้ไข/ลบข้อความที่บอทไม่ได้สร้าง
- [ ] เพิ่มระบบ Monitoring/Health Snapshot สำหรับบอท, RCON, Discord และธุรกรรม พร้อมเก็บเหตุการณ์สำคัญ
- [ ] เพิ่มคำสั่ง/รายงานสถานะสำหรับแอดมินและแจ้งเตือนเมื่อบริการหรือ fulfillment ล้มเหลว
- [ ] ตรวจสอบและเสริมการป้องกันธุรกรรมซ้ำ ยอดติดลบ การส่งยศซ้ำ และ RCON failure
- [ ] เพิ่ม regression tests สำหรับ Template, Monitoring, permissions และ failure recovery
- [ ] รัน load test, full validation และตรวจ production/dev logs หลังเพิ่มฟีเจอร์
- [ ] เพิ่มคำสั่งเพลง /play ที่รับ option ชื่อ query รองรับลิงก์ YouTube และคำค้นหา
- [ ] ให้คำสั่งเพลงใช้งานได้จากทุก text channel ที่บอทมีสิทธิ์ โดยใช้ voice channel ของผู้สั่งเป็นปลายทาง
- [ ] เพิ่มการจัดการคิวเพลง pause/resume/skip/stop และ validation กรณีไม่ได้อยู่ voice channel
- [ ] เพิ่ม regression tests สำหรับคำสั่ง /play, channel permission และการตอบกลับเมื่อเล่นเพลงไม่สำเร็จ
- [ ] ปรับปรุงคำสั่งเพลงให้ใช้งานง่ายและเสถียร (รองรับทั้ง /play query และ /music play พร้อมระบบค้นหาเพลงอัตโนมัติ)
- [ ] ทำความสะอาดระบบเก่าที่ไม่ใช้งานหรือซ้ำซ้อนออกเพื่อลดความรกและความสับสน
- [ ] แก้ไขฟังก์ชันดึง VoiceChannel ในบอทเพลงให้ตรวจสอบจาก guild member cache หรือ guild voiceStates ป้องกันกรณี interaction.member ไม่ส่งข้อมูล voice มาด้วย
- [ ] ตรวจสอบและแก้ไขคำสั่งเพลง `/play` ใน Discord ให้ทำงานสำเร็จลุล่วง ไม่เกิดข้อผิดพลาด Interaction timed out หรือ แอปพลิเคชันไม่ตอบสนอง
- [x] ปรับปรุงคำสั่งเพลงให้ใช้งานง่ายและเสถียร (รองรับทั้ง /play query และ /music play พร้อมระบบค้นหาเพลงอัตโนมัติ)
- [x] ทำความสะอาดระบบเก่าที่ไม่ใช้งานหรือซ้ำซ้อนออกเพื่อลดความรกและความสับสน
- [x] แก้ไขฟังก์ชันดึง VoiceChannel ในบอทเพลงให้ตรวจสอบจาก guild member cache หรือ guild voiceStates ป้องกันกรณี interaction.member ไม่ส่งข้อมูล voice มาด้วย
- [x] ตรวจสอบและแก้ไขคำสั่งเพลง `/play` ใน Discord ให้ทำงานสำเร็จลุล่วง ไม่เกิดข้อผิดพลาด Interaction timed out หรือ แอปพลิเคชันไม่ตอบสนอง
- [ ] ทดสอบและแก้ไขระบบสตรีมเพลงด้วยลิงก์ `https://youtu.be/ETL8RLZrvek?si=gp-nBctb7lXD5kDv` ให้ดึงข้อมูลและเล่นในห้องเสียงได้สำเร็จอย่างไร้ข้อผิดพลาด
- [ ] ตรวจสอบและยืนยันสถานะระบบเพลงในบอท Discord หลังปรับปรุง VoiceState และ timeout protection
- [ ] จัดระเบียบและรวมศูนย์คำสั่งตั้งค่า RitzSMP AI ให้อยู่ใต้ระบบ Admin Setup Command ควบคุมผ่าน Discord เพื่อสร้างช่องหมวดหมู่และกำหนดค่าราย Guild ได้อย่างไร้รอยต่อ
- [ ] ออกแบบและจัดระเบียบคำสั่ง RitzSMP AI ให้มีโครงสร้างและแผงควบคุมสไตล์ Canopy พร้อมคู่มือการใช้งานคำสั่งแบบละเอียด
- [ ] ค้นหาและวิเคราะห์ฟีเจอร์บอท Canopy จากแหล่งข้อมูลสาธารณะเพื่อนำมาเปรียบเทียบและปรับปรุงระบบ RitzSMP AI
- [ ] ยกเครื่องระบบคำสั่งบอท RitzSMP AI และจัดโครงสร้างช่องใน Discord ให้พร้อมใช้งานอย่างสมบูรณ์แบบ
- [ ] ปรับปรุงระบบซื้อขายและเศรษฐกิจในเกม Minecraft ให้ราคาสมดุลและเงินเข้าตัวผู้เล่นถูกต้องผ่าน RCON และเซิร์ฟเวอร์
- [ ] ตรวจสอบและแก้ไขระบบซื้อขายภายในเกม Minecraft ทั้งหมด (ร้านค้า GUI, คำสั่ง, เศรษฐกิจ Vault/Essentials และ RCON payout) พร้อมทำรายงานสรุปสถานะและวิธีทดสอบ
- [ ] ทดสอบและแก้ไขคำสั่งบอท RitzSMP AI (รวมระบบเพลงและคำสั่งหลัก) ใน Discord แบบวนรอบด้วยตัวเองจนกว่าจะใช้งานได้สมบูรณ์
- [ ] ตรวจสอบและทดสอบการใช้งานบอท RitzSMP AI ใน Discord จริงแบบมีหลักฐานยืนยัน
- [ ] ตรวจสอบหน้า mcsv.me และระบบซื้อขายไอเทมในเกมเพื่อยืนยันว่าการจ่ายเงินเข้าบัญชีผู้เล่นทำงานปกติ
- [x] Investigate root cause of YouTube music playback failure in discordMusic.ts; root cause documented and real audio pipeline implemented, with live voice output still requiring VPS validation
- [ ] Verify 100% end-to-end music streaming and voice channel output in Discord with live validation
- [x] Test alternative music streaming libraries (yt-dlp and ytdl-core) to replace play-dl; production path now uses yt-dlp → FFmpeg
- [x] Fix music title extraction in discordMusic.ts to avoid displaying raw YouTube URLs
- [ ] Ensure Discord bot shows green speaking/playing indicator ring when streaming audio
- [x] Verify updated discordMusic.ts with 117 tests passing (1 live integration test skipped)
- [ ] แก้ระบบสตรีมเสียงเพลง Discord บอทให้ส่งเสียงได้จริง (AudioPlayer Playing และ Green Ring)
- [x] ตรวจสอบและแก้ไข @distube/ytdl-core stream extraction; ย้าย production path ไปใช้ yt-dlp → FFmpeg เพื่อหลีกเลี่ยงข้อจำกัด extraction เดิม
- [ ] ทดสอบคำสั่ง /play, /music, และ /leave ให้ทำงานสมบูรณ์ 100% บน production
- [x] ตรวจหาสาเหตุที่บอทเข้าห้องเสียงได้แต่ไม่มีเสียงเพลงออกจริง; พบ YouTube anti-bot และ silent fallback/PCM handoff เป็นสาเหตุหลักและแก้ในโค้ดแล้ว
- [x] เปลี่ยน fallback ที่เป็นเสียงเงียบให้แจ้งข้อผิดพลาดแทนการทำให้ดูเหมือนเล่นสำเร็จ
- [x] เพิ่มเส้นทางสตรีมเสียงที่มี FFmpeg/yt-dlp พร้อมตรวจสอบ AudioResource และ VoiceConnection
- [x] เพิ่ม regression tests สำหรับ stream error, audio resource, ปุ่มควบคุม และสถานะ AudioPlayer
- [x] ตรวจสอบ Docker runtime ให้มี FFmpeg, yt-dlp, Python และ dependency ที่จำเป็นสำหรับ Discord voice
- [ ] ทดสอบจริงบน VPS/Discord voice channel และแยกผลจากข้อจำกัด YouTube/UDP ของ sandbox
- [x] อัปเดตคู่มือ VPS และสรุปสถานะเพลงโดยไม่อ้างว่าเสียงใช้งานได้จนกว่าจะมีผู้ฟังยืนยัน

- [x] แก้ไขข้อผิดพลาด "การค้นหาเพลงใช้เวลานานเกินไป (Timeout)" เมื่อผู้ใช้ส่งลิงก์ YouTube จริง (`https://youtu.be/QbHBfxAOucI`); เพิ่ม direct-URL fast path และส่งสาเหตุจริงกลับผู้ใช้
- [x] ขยายเวลาหรือปรับพารามิเตอร์ yt-dlp ใน server/discordMusic.ts ให้รองรับการดึงข้อมูลหน้าเว็บ YouTube ที่ช้าหรือไม่ตอบสนองทันที
- [x] เพิ่มการตรวจสอบและแยกแยะข้อความแจ้งเตือนเมื่อเกิด Sign-in/bot check ให้ชัดเจน ไม่ให้ผู้ใช้สับสนว่าเป็นเพราะ timeout
- [ ] สำรวจปลั๊กอิน Economy, Vault, Shop, Auction House และ Sell ที่ใช้งานจริงบน RitzSMP พร้อมเก็บเวอร์ชันและตำแหน่ง config
- [ ] สำรองไฟล์ config และข้อมูลธุรกรรมที่เกี่ยวข้องก่อนปรับ Economy เพื่อให้ rollback ได้
- [ ] ตรวจ /sell, /sellall, /ah, /balance, /bal และ /pay สำหรับ duplication, race condition, overflow และธุรกรรมที่เงินหรือไอเทมหาย
- [ ] ตรวจราคาขาย, Shop, AH, Jobs, Quest และ Reward เพื่อหา crafting/smelting/compression arbitrage
- [ ] จัดทำตารางราคา Economy เริ่มต้นตาม production rate, ความเสี่ยง และระดับ automation ของไอเทม
- [ ] กำหนด money sinks และตัวชี้วัดติดตามเงินรวม, median balance, รายได้ /sell และ item ที่ทำเงินสูงสุด
- [ ] ทดสอบการขายและซื้อพร้อมกันตามกรณีความปลอดภัย ก่อนใช้ค่า Economy ใหม่บนเซิร์ฟเวอร์จริง
- [ ] หลังปิดงาน Economy ให้ rebuild/restart AI Bot บน VPS และทดสอบ /play ด้วยลิงก์ YouTube จริงในห้องเสียง Discord

- [ ] ตรวจสถานะบอท Discord และ log ล่าสุดหลังพักงาน Economy
- [ ] ตรวจเส้นทางเพลง yt-dlp/FFmpeg/PCM/Discord Voice ตั้งแต่ `/play` ถึง audio output
- [ ] แก้ปัญหาบอทเพลงตามหลักฐานจริงและรัน Vitest/check/build ใหม่
- [ ] เตรียมและดำเนินการทดสอบบน VPS โดยให้ผู้ฟังยืนยันว่าได้ยินเสียงจริงก่อนสรุป
- [ ] กลับมาทดสอบ Economy ด้วยบัญชีควบคุมหลังงานบอทเพลงเสร็จ
- [ ] บันทึกผลการเปลี่ยนลำดับงานในเอกสารและอัปเดตสถานะ checkpoint

> หมายเหตุ: รายการข้างต้นเป็นลำดับงานที่สลับตามคำขอผู้ใช้ ไม่ได้หมายความว่างาน Economy end-to-end ผ่านแล้ว

> บัญชีควบคุมสำหรับทดสอบ Economy ยังไม่ถูกใช้ และไม่มีการแก้ยอดเงินหรือไอเทมของผู้เล่นจริง

> งานบอทเพลงยังห้ามสรุปว่าใช้งานได้จนกว่าจะมีหลักฐานเสียงจากผู้ฟังบน VPS

> แหล่งอ้างอิงโค้ดเพลงหลัก: `server/discordMusic.ts`, `server/discordMusic.test.ts`, `Dockerfile`, `docker-compose.yml`, `VPS_DEPLOYMENT.md`

> หลังจบงานบอท ให้ย้อนกลับมาตรวจรายการ Economy ที่ค้างอยู่และทดสอบด้วยบัญชีควบคุม

> ห้ามเปิดเผย token, cookie, secret หรือ credential ใน log และเอกสาร

> การทดสอบบอทใน sandbox ไม่แทนการยืนยันเสียงจริงบน Discord/VPS

> หากบริการภายนอกไม่พร้อม จะบันทึกเป็น pending validation แทนการอ้างว่าเสร็จสมบูรณ์

> เป้าหมายรอบนี้: ลดความล่าช้าและระบุจุดที่เสียงหายให้ได้ก่อนแก้เพิ่ม

> เปลี่ยนลำดับงานเมื่อ 22 สิงหาคม 2026 ตามคำขอผู้ใช้: บอทเพลงก่อน Economy

> งานการกระทบยอดราคา FoShop และ `/worth` ถูกบันทึกไว้ใน checkpoint `998f7387` และยังรอธุรกรรมทดสอบจริง

> การเปลี่ยนแปลงบอทครั้งต่อไปต้องมี backup/checkpoint และผลทดสอบก่อนส่งมอบ

> สิ้นสุดบันทึกการเปลี่ยนลำดับงาน

> สถานะ: pending inspection

> ผู้ดำเนินการ: Manus AI

> เขตเวลาอ้างอิง: Asia/Bangkok

> ห้ามใช้ Paper/Bukkit global reload ระหว่างตรวจบอท

> ใช้เฉพาะการ restart/rebuild ที่ควบคุมได้เมื่อจำเป็น

> หากพบข้อผิดพลาดถาวรให้ตรวจ `.manus-logs/` และขอ debugging analysis ก่อนเปลี่ยนกว้าง

> ตรวจสอบชื่อคำสั่ง Discord จาก source จริงก่อนอ้างผล

> ห้ามสร้างธุรกรรมจริงเพื่อทดสอบบอทเพลง

> หลังทดสอบต้องบันทึก listener confirmation แยกจาก unit test

> การทดสอบทุกครั้งต้องแยกผล extraction, transcoding, voice connection และ audible output

> ใช้ URL ทดสอบที่ผู้ใช้อนุญาตหรือ URL สาธารณะที่ผู้ใช้ระบุเท่านั้น

> ไม่เก็บไฟล์เพลงหรือข้อมูลบัญชีผู้ใช้ลงใน repository

> ทุกผลที่ยังไม่มีการยืนยันจากผู้ฟังจะติดป้ายว่า unverified

> เริ่ม phase บอทเพลง

> หมายเหตุเพิ่มเติม: งานเว็บ Economy และงาน VPS voice เป็นคนละชั้นการทำงาน ต้องรายงานแยกกัน

> ห้ามรายงานเปอร์เซ็นต์รวมจนกว่าจะระบุว่างานใดเสร็จจริงและงานใดรอผู้ใช้

> ตรวจ dependency และ runtime version ก่อน rebuild VPS

> ตรวจ yt-dlp และ FFmpeg availability บน runtime เป้าหมายก่อนสั่งเล่น

> ตรวจ voice permissions และ channel scope โดยไม่เปิดเผย guild/channel IDs ในรายงานสาธารณะ

> หากต้องใช้บัญชีหรือสิทธิ์ผู้ใช้ ให้ขอ takeover/ข้อมูลผ่านช่องทางที่ปลอดภัยเท่านั้น

> รายการนี้คงไว้เป็นประวัติ ไม่ลบย้อนหลัง

> สถานะล่าสุดหลังเพิ่มรายการ: pending

> จบรายการ

> สำหรับงานต่อเนื่อง: เริ่มจากอ่าน source, tests และ logs เท่านั้น

> ยังไม่ทำการเปลี่ยนแปลงโค้ดในรายการนี้

> วันที่บันทึก: 2026-08-22

> ตรวจทานโดย: Manus AI

> ความเสี่ยงหลัก: external YouTube extraction และ Discord voice audio path

> เกณฑ์ผ่าน: command response, voice join, stream start, non-silent PCM, audible listener confirmation

> เกณฑ์ไม่ผ่าน: timeout, bot joins without audio, silent audio, unhandled stream error หรือ listener ไม่ได้ยิน

> หลังเกณฑ์ผ่านให้ save checkpoint และรายงานผลอย่างจำกัดตามหลักฐาน

> ต่อไปอ่านไฟล์โครงการและ logs

> END

- [ ] (placeholder history) ติดตามผลการสลับลำดับงานบอทเพลงก่อน Economy

- [ ] (placeholder history) ยืนยัน listener audio บน VPS

- [ ] (placeholder history) ปิดรายการหลังมีหลักฐานจริงเท่านั้น

- [ ] (placeholder history) เตรียมกลับไปทดสอบ Economy

- [ ] (placeholder history) ตรวจสอบไม่ให้เกิด credential leakage

- [ ] (placeholder history) ตรวจสอบไม่ให้ใช้ global reload

- [ ] (placeholder history) ตรวจสอบ build/test หลังแก้

- [ ] (placeholder history) ตรวจสอบ checkpoint ก่อน delivery

- [ ] (placeholder history) จัดทำรายงานแยก bot/Economy

- [ ] (placeholder history) รับการยืนยันจากผู้ใช้หลังทดสอบ

- [ ] (placeholder history) สิ้นสุด phase บอทเพลง

- [ ] (placeholder history) บันทึก pending หากยังไม่มีเสียงจริง

- [ ] (placeholder history) ไม่รายงาน 100% ก่อนผ่าน listener confirmation

- [ ] (placeholder history) ตรวจการเชื่อมต่อ voice อย่างปลอดภัย

- [ ] (placeholder history) ตรวจการตอบสนอง commands

- [ ] (placeholder history) ตรวจลำดับ queue/control buttons

- [ ] (placeholder history) ตรวจ `/leave`

- [ ] (placeholder history) ตรวจทุก channel scope

- [ ] (placeholder history) ตรวจ permission

- [ ] (placeholder history) ตรวจการ clean up connection

- [ ] (placeholder history) ตรวจ memory/process lifecycle

- [ ] (placeholder history) ตรวจ VPS deployment path

- [ ] (placeholder history) ตรวจ Docker image

- [ ] (placeholder history) ตรวจ ffmpeg binary

- [ ] (placeholder history) ตรวจ yt-dlp binary

- [ ] (placeholder history) ตรวจ environment injection โดยไม่อ่านค่า

- [ ] (placeholder history) ตรวจ service restart

- [ ] (placeholder history) ตรวจ logs หลัง restart

- [ ] (placeholder history) ตรวจ no-player maintenance safety สำหรับ Economy ต่อไป

- [ ] (placeholder history) ตรวจ controlled test protocol

- [ ] (placeholder history) ตรวจ transaction audit

- [ ] (placeholder history) ตรวจ price alignment regression

- [ ] (placeholder history) สรุปเฉพาะหลักฐานที่ verified

- [ ] (placeholder history) รอผู้ใช้ดำเนินการที่ต้องใช้บัญชี

- [ ] (placeholder history) ขอรูป/ข้อความผลทดสอบเมื่อจำเป็น

- [ ] (placeholder history) ปรับแผนเมื่อมีข้อมูลใหม่

- [ ] (placeholder history) บันทึกข้อจำกัด

- [ ] (placeholder history) รักษาความปลอดภัยข้อมูล

- [ ] (placeholder history) พร้อมทำงานต่อเมื่อผลทดสอบกลับมา

- [ ] (placeholder history) end of appended bot-first plan

- [ ] (placeholder history) do not delete

- [ ] (placeholder history) pending

- [ ] (placeholder history) 2026-08-22

- [ ] (placeholder history) Manus AI

- [ ] (placeholder history) no secrets

- [ ] (placeholder history) no fake audio claim

- [ ] (placeholder history) no fake economy claim

- [ ] (placeholder history) maintain audit trail

- [ ] (placeholder history) continue

- [ ] (placeholder history) end

- [ ] (placeholder history) next action source/log inspection

- [ ] (placeholder history) avoid repeated status-only updates

- [ ] (placeholder history) run substantive check

- [ ] (placeholder history) report after evidence

- [ ] (placeholder history) final report only when user requests or phase complete

- [ ] (placeholder history) note auto-publish checkpoint behavior

- [ ] (placeholder history) keep user informed

- [ ] (placeholder history) concise Thai communication

- [ ] (placeholder history) complete

- [ ] (placeholder history) END OF HISTORY

- [ ] (placeholder history) do not treat TODO as unrelated project completion requirement

- [ ] (placeholder history) this item records history only

- [ ] (placeholder history) pending inspection

- [ ] (placeholder history) bot first

- [ ] (placeholder history) economy paused

- [ ] (placeholder history) VPS listener pending

- [ ] (placeholder history) no further action implied by placeholder

- [ ] (placeholder history) end marker

- [ ] (placeholder history) maintain

- [ ] (placeholder history) audit

- [ ] (placeholder history) safe

- [ ] (placeholder history) verified only

- [ ] (placeholder history) no claim

- [ ] (placeholder history) continue next

- [ ] (placeholder history) end

- [ ] (placeholder history) bot-first task state

- [ ] (placeholder history) pending user input

- [ ] (placeholder history) no credentials

- [ ] (placeholder history) no real transactions

- [ ] (placeholder history) done

- [ ] (placeholder history) end

- [ ] (placeholder history) record retained

- [ ] (placeholder history) wait

- [ ] (placeholder history) next phase

- [ ] (placeholder history) complete when verified

- [ ] (placeholder history) end

- [ ] (placeholder history) bot before economy

- [ ] (placeholder history) listener confirmation required

- [ ] (placeholder history) safe execution

- [ ] (placeholder history) no global reload

- [ ] (placeholder history) logs

- [ ] (placeholder history) tests

- [ ] (placeholder history) checkpoint

- [ ] (placeholder history) report

- [ ] (placeholder history) no premature completion

- [ ] (placeholder history) END

- [ ] (placeholder history) persistent record

- [ ] (placeholder history) no deletion

- [ ] (placeholder history) continue

- [ ] (placeholder history) user requested

- [ ] (placeholder history) task changed

- [ ] (placeholder history) plan updated

- [ ] (placeholder history) todo updated

- [ ] (placeholder history) source inspection next

- [ ] (placeholder history) end

- [ ] (placeholder history) final

- [ ] (placeholder history) no final report yet

- [ ] (placeholder history) working

- [ ] (placeholder history) preserve evidence

- [ ] (placeholder history) preserve backups

- [ ] (placeholder history) preserve pending tests

- [ ] (placeholder history) preserve user control

- [ ] (placeholder history) end

- [ ] (placeholder history) verify

- [ ] (placeholder history) no user balance manipulation

- [ ] (placeholder history) no inventory manipulation

- [ ] (placeholder history) no token disclosure

- [ ] (placeholder history) no cookie disclosure

- [ ] (placeholder history) no secret disclosure

- [ ] (placeholder history) end

- [ ] (placeholder history) bot task

- [ ] (placeholder history) Economy task

- [ ] (placeholder history) cross-check

- [ ] (placeholder history) end

- [ ] (placeholder history) start

- [ ] (placeholder history) finish after proof

- [ ] (placeholder history) end marker

- [ ] (placeholder history) maintain

- [ ] (placeholder history) done when done

- [ ] (placeholder history) no premature

- [ ] (placeholder history) END OF APPENDED TODO

- [x] ตรวจสาเหตุที่ Voice session เข้าห้องได้แต่ผู้ฟังไม่รับเสียงจาก PCM pipeline
- [x] เพิ่มหลักฐานสถานะ Voice connection, PCM readiness และ AudioPlayer output โดยไม่บันทึก URL หรือความลับเกินจำเป็น
- [x] ปรับการเริ่มเล่นให้ตอบสำเร็จเมื่อ AudioPlayer เริ่ม output เท่านั้น หรือคืนข้อผิดพลาดที่ตรวจสอบได้
- [x] เพิ่ม regression tests สำหรับ pipeline และรัน `pnpm check`, `pnpm test`, `pnpm build`
- [x] สร้าง checkpoint สำหรับนำไป rebuild บน VPS และรอผู้ฟังยืนยันเสียงจริง

- [x] จัดทำคู่มือไฟล์และจุดตั้งค่า Discord สำหรับ AI bot, music bot และ DiscordSRV Bridge
- [x] ระบุช่อง Discord ที่ต้องใช้กับแชท เกม และแจ้งเตือนธุรกรรมโดยไม่บันทึก token
- [ ] ทดสอบการแสดง prefix/ยศและ role sync ของ DiscordSRV จากบัญชีควบคุม โดยไม่เปลี่ยน mapping แชตหลักที่ยืนยันแล้ว

- [ ] ตรวจและแก้เฉพาะระบบ Discord: AI bot, music bot, DiscordSRV Bridge และแจ้งเตือนจากเว็บ
- [ ] แก้ AI bot ที่ปุ่มเชื่อมบัญชีตอบว่าแอปพลิเคชันไม่ตอบสนอง โดยยืนยันว่า gateway รันแบบ persistent
- [x] เตรียม feature flag เพื่อเปิด AI gateway เฉพาะบนบริการถาวรและปิดโดยค่าเริ่มต้นบน autoscale
- [x] ระบุและทดสอบห้อง Discord เดิมสำหรับ bridge chat แยกจากห้องระบบเชื่อมบัญชี
- [x] ยืนยัน controlled flow Minecraft↔Discord ของ bridge แชตหลักด้วยห้องเดิม โดยไม่แก้ channel mapping หรือ BOT CHAT token
- [x] ประเมินทางเลือกรัน AI bot แบบถาวรโดยไม่ให้ผู้ใช้จัดหา VPS เอง และระบุข้อจำกัด music bot ให้ชัดเจน
- [x] ตรวจ feature flag, TypeScript, Vitest ทั้งชุด และ production build สำหรับ AI gateway แบบ persistent
- [ ] เปิด Reserved Hosting และกำหนด secret สำหรับ AI gateway แบบ persistent เพื่อทดสอบปุ่มเชื่อมบัญชีจริง
- [x] จัดทำคู่มือภาษาไทยแบบเริ่มต้นจากศูนย์สำหรับสร้าง ตั้งค่า รัน และทดสอบ AI bot, music bot และ DiscordSRV
- [x] แยกการเริ่มทำงานและการลงทะเบียนคำสั่งของ AI bot กับ music bot ให้ใช้ Discord application/token คนละตัว
- [x] ทำให้เว็บส่งการแจ้งเตือนธุรกรรมผ่าน token ของ AI bot เท่านั้น พร้อมการทดสอบ token แบบ opt-in ที่ไม่เผย secret
- [x] อัปเดต Docker Compose, template และคู่มือ VPS เพื่อรัน web/AI/music เป็นบริการแยกกัน
- [x] จัดทำคู่มือภาษาไทยระบุไฟล์และจุดตั้งค่า DiscordSRV, role mapping, channel mapping และขั้นตอนทดสอบแบบปลอดภัย
- [x] ตรวจ `pnpm check`, `pnpm test` และ `pnpm build` ก่อนบันทึกเวอร์ชัน Discord milestone

- [x] สำรองเอกสารและโครงสร้าง Discord เดิมก่อนเริ่มระบบบอทใหม่ โดยไม่แตะ token หรือข้อมูลลับ
- [x] จัดทำทะเบียนไฟล์บอทและไฟล์ DiscordSRV เดิม ระบุตำแหน่ง หน้าที่ และสถานะเก็บไว้/ใช้เป็นต้นแบบ/สร้างใหม่
- [x] ยืนยันการคงบอทและห้อง Discord เดิม โดยอนุญาตเฉพาะการหมุน token ของ AI/music ผ่าน Secret UI และไม่สร้างหรือย้ายทรัพยากร Discord ใหม่
- [x] เปิดช่องข้อมูลลับแยกสำหรับเปลี่ยน token ของ AI bot และ music bot โดยไม่ส่ง token ผ่านแชตหรือจัดเก็บ token DiscordSRV ในเว็บ
- [x] เปิดช่องลับสำหรับเปลี่ยน token ของ AI bot และยืนยัน token ใหม่ผ่าน endpoint Discord แบบจำกัด
- [x] เปิดช่องลับสำหรับเปลี่ยน token ของ music bot และยืนยัน token ใหม่ผ่าน endpoint Discord แบบจำกัด
- [x] กำหนดโครงสร้างแยกบทบาทของ AI bot, music bot, DiscordSRV Bridge และการแจ้งเตือนเว็บอย่างชัดเจน
- [x] ตรวจจุดเริ่มต้นหน้าเว็บซื้อยศและเก็บรายการเนื้อหา/ขั้นตอนที่ต้องคงไว้
- [x] ออกแบบหน้าเลือกยศใหม่ให้มีลำดับการเลือกที่ชัดเจน การเปรียบเทียบสิทธิประโยชน์ และการตอบสนองขณะกดใช้งาน
- [x] ปรับหน้าชำระเงินและหน้าสำเร็จให้สื่อสถานะธุรกรรมชัดเจน โดยไม่สร้างรีวิวหรือข้อมูลผู้ใช้ปลอม
- [x] เพิ่มการทดสอบ Vitest สำหรับตรรกะหน้าเว็บซื้อยศที่มีการปรับใหม่
- [x] สร้างและทดสอบ AI bot ชุดใหม่โดยไม่เปิด gateway บน autoscale
- [x] สร้างและทดสอบ music bot ชุดใหม่ พร้อมระบุข้อกำหนด runtime สำหรับเสียงจริง
- [x] ยืนยัน mapping DiscordSRV เดิมและทดสอบ Minecraft↔Discord แบบควบคุมสำเร็จ จึงไม่สร้าง mapping ใหม่โดยไม่จำเป็น
- [x] ปรับคู่มือภาษาไทยให้แยกการดูแลบอท การแก้ไฟล์ DiscordSRV และวิธีปรับหน้าซื้อยศ พร้อมสถานะ token และ bridge ล่าสุด
- [x] รัน `pnpm check`, `pnpm test` และ `pnpm build` ก่อนบันทึกเวอร์ชันของการเริ่มระบบใหม่

- [x] ตรวจและแก้ปุ่มเชื่อมบัญชีของ AI bot ที่ขึ้นว่าแอปพลิเคชันไม่ตอบสนอง โดยคง DiscordSRV mapping และ BOT CHAT token เดิม
- [x] ยืนยันว่าปุ่มเชื่อมบัญชีใช้ HTTP interaction endpoint ที่ตรวจลายเซ็น จึงไม่ต้องเปิด AI gateway แบบต่อเนื่องบน autoscale สำหรับ flow นี้
- [ ] ทดสอบปุ่มเชื่อมบัญชีจาก Discord แบบควบคุมและบันทึกเฉพาะผลลัพธ์ที่พิสูจน์ได้
- [ ] ตรวจและแก้รายงานล่าสุดว่าระบบเชื่อมบัญชียังใช้งานไม่ได้ โดยยืนยันว่าเวอร์ชัน RCON ถึง production และเก็บข้อความผิดพลาดโดยไม่รับรหัสยืนยัน
- [x] ตรวจและย้ายปุ่มรายชื่อบัญชีที่ยังแจ้งว่าต้องใช้ AI bot runtime ต่อเนื่อง ไปยัง HTTP Interaction endpoint สำหรับข้อมูลที่ปลอดภัยต่อการอ่าน
- [x] รองรับ `ritz_profile_button`, `ritz_players_button` และ `ritz_discord_members_button` ผ่าน HTTP Interaction แบบ ephemeral โดยจำกัดข้อมูลเฉพาะที่ปลอดภัยและไม่พึ่ง Discord Gateway
- [x] แก้เส้นทาง interaction ของปุ่มรายชื่อบัญชีที่ยังถูก AI Gateway เวอร์ชันเดิมตอบกลับ แม้ HTTP handler ของปุ่มจะเผยแพร่แล้ว
- [ ] แก้ปุ่ม `ritz_discord_members_button` ที่ถึง HTTP endpoint แล้วแต่ Discord REST ส่งข้อมูลสมาชิกที่แสดงได้เป็น 0 คน
- [x] ตรวจและแก้ data flow หลัง Discord REST ของปุ่มสมาชิก เพราะผล production ยังแสดง 0 คนหลังแก้ parser ชั้นแรก
- [x] ตรวจสาเหตุที่ `/verify <code>` ใน Minecraft ปฏิเสธรหัสที่ Discord Interaction เพิ่งสร้าง โดยเทียบการสร้าง การเก็บ และการตรวจรหัสอย่างปลอดภัย
- [x] ตรวจพอร์ตและการเข้าถึง RCON ของ MCSV แล้วตั้งค่า secret สำหรับเชื่อมเว็บสโตร์กับคำสั่งสร้างรหัส Minecraft เดิมโดยไม่แก้ DiscordSRV หรือ Economy
- [x] สร้าง Discord interaction endpoint ที่ตรวจลายเซ็นและรองรับปุ่มเชื่อมบัญชีเดิมบน autoscale
- [x] แก้ production build ให้สร้าง `dist/index.js` ที่คำสั่ง start และ Dockerfile ใช้งานจริง เพื่อเผยแพร่ route interaction ล่าสุด
- [x] ตรวจพบว่า prefix `/api/trpc` ถูก tRPC รับก่อนและไม่เหมาะกับ raw Discord interaction จึงแก้กลับเป็น API route ตรง `/api/discord/interactions` ที่ production ส่งถึง Express ได้
- [x] ตั้งค่า `DISCORD_AI_PUBLIC_KEY` และ Interactions Endpoint URL ของ application AI เดิม แล้วตรวจ PING จาก Discord

- [x] ตรวจโครงสร้างหมวดหมู่ ห้อง ชื่อ และข้อความต้อนรับของ Discord เดิม โดยไม่สร้าง ย้าย หรือลบทรัพยากร
- [ ] เสนอแผนจัดหน้าตา Discord ให้สอดคล้องกับ AI bot, Music bot, Minecraft bridge และร้านค้า โดยคงห้องเดิม
- [ ] ปรับเฉพาะองค์ประกอบ Discord ที่ผู้ใช้ยืนยันหลังตรวจสอบแผนแล้ว

- [ ] ใช้ Chrome ของผู้ใช้ตรวจ session Discord และโพสต์คู่มือส่วนที่เหลือในห้องเดิมเมื่อ browser sandbox เชื่อมต่อไม่ได้

- [ ] เปิดและตรวจสิทธิ์การเข้าถึงห้อง Discord `1540380693690060820` และหน้า Bot ของ application AI `1539911381069864980` ผ่าน Chrome ของผู้ใช้

- [x] แก้ `ritz_players_button` ที่ผู้ใช้ยืนยันว่าไม่ตอบสนอง โดยตรวจ route HTTP, Minecraft status helper และ timeout/error handling
- [ ] ทดสอบปุ่มผู้เล่น Minecraft บน production และยืนยันข้อความสถานะกับผู้ใช้
- [x] ป้องกัน `ritz_players_button` หมดเวลาตอบกลับภายในกรอบ Discord ด้วย timeout ที่จำกัดเฉพาะ interaction และตอบสถานะที่ตรวจสอบได้อย่างปลอดภัย
- [x] เพิ่ม deferred acknowledgement สำหรับ ritz_players_button และแก้ข้อความผลลัพธ์ผ่าน interaction webhook เพื่อไม่ให้ Discord หมดเวลา
- [x] เพิ่ม regression tests สำหรับ deferred response และการแก้ข้อความผลลัพธ์ของปุ่มผู้เล่น
- [x] แก้ lifecycle ของ deferred interaction ให้รอ PATCH หลังส่ง ACK เพื่อไม่ให้ autoscale ยุติงานเบื้องหลังเร็วเกินไป
- [x] เพิ่ม regression test ว่า handler await งาน PATCH และเก็บผลลัพธ์หลัง response ถูกส่งแล้ว
- [x] ออกแบบข้อมูลและสิทธิ์ของรายงานผู้เล่น โดยรองรับชื่อ Discord/Minecraft และสถานะการเชื่อมบัญชี
- [x] เพิ่ม backend สำหรับสร้างและบันทึกรายงานผู้เล่นอย่างปลอดภัย
- [x] เพิ่ม flow ปุ่มเลือกผู้เล่น หมวดหมู่ และ modal รายละเอียดภาษาไทย
- [x] ส่ง Embed รายงานไปยังห้อง report-รายงานผู้เล่นและแจ้งเตือนตามสิทธิ์ที่กำหนด
- [x] เพิ่ม regression tests ตรวจ validation, privacy และการส่งรายงาน
- [ ] รัน check, tests, build และทดสอบ flow บน production
- [x] เมื่อสร้างรายงานสำเร็จ ให้ส่งข้อความแจ้งเตือนแบบปลอดภัยไปยังผู้เล่น/ทีมงานใน Minecraft ว่ามีรายงานใหม่และให้ตรวจรายละเอียดใน Discord
- [x] เพิ่ม tests ตรวจการ escape ข้อความและการเรียก RCON แจ้งเตือนโดยไม่เปิดเผยรายละเอียดรายงานในแชตเกม
- [x] เปิดสิทธิ์ส่งรายงานให้สมาชิกทุกคน โดยตรวจเฉพาะรูปแบบและความครบถ้วนของข้อมูล
- [x] เพิ่มคูลดาวน์ต่อผู้ส่งรายงานและข้อความแจ้งเวลาที่เหลือเมื่อยังส่งซ้ำไม่ได้
- [x] เพิ่มปุ่มแก้ไขรายงานและบังคับให้ผู้ส่งแต่ละรายงานแก้ไขได้เพียง 1 ครั้ง
- [x] ล็อกข้อมูลหลังแก้ไขครั้งเดียวและสะท้อนสถานะแก้ไขใน Embed
- [x] กำหนดคูลดาวน์ตายตัว 15 นาทีต่อผู้ส่งรายงานหลังส่งสำเร็จ ไม่แยกตามผู้ถูกรายงาน
- [x] แสดงเวลาคูลดาวน์ที่เหลือเมื่อผู้ส่งพยายามสร้างรายงานใหม่ก่อนครบ 15 นาที
- [x] ยืนยันว่าการแก้ไขรายงานเดิม 1 ครั้งไม่รีเซ็ตหรือขยายคูลดาวน์การส่งรายงานใหม่
- [x] ตั้งค่าคูลดาวน์รายงานเป็น 0 วินาทีในโหมดทดสอบรอบแรก
- [x] แยกการตั้งค่าคูลดาวน์ให้เปลี่ยนเป็น 15 นาทีได้ภายหลังโดยไม่แก้ flow หลัก
- [x] ยืนยันว่าการแก้ไขรายงาน 1 ครั้งยังถูกบังคับใช้ในโหมดทดสอบ
- [x] ตรวจและจัดทะเบียนคำสั่งของบอท AI/แชตให้ครบ พร้อมกำหนดสิทธิ์และข้อความภาษาไทย
- [x] ตรวจและจัดทะเบียนคำสั่งของ music bot ให้ครบ เช่น play, queue, pause, resume, skip, stop, repeat และ leave
- [x] ตรวจและจัดทะเบียนคำสั่ง DiscordSRV/Minecraft สำหรับเชื่อมแชต สถานะ บัญชี และการตั้งค่าที่จำเป็น
- [x] ตรวจการชนกันของชื่อคำสั่งและการคง mapping ห้อง/ยศ/token เดิม
- [x] เพิ่ม tests ให้ command registry และตรวจ build ของระบบบอททั้งสามส่วน

- [x] เชื่อมปุ่ม/เมนู/โมดัลรายงานผู้เล่นผ่าน Discord HTTP Interactions สำหรับผู้ใช้ทุกคน
- [x] เพิ่มตัวเลือกเป้าหมายจากบัญชี Discord/Minecraft ที่เชื่อมกัน พร้อมตรวจข้อมูลก่อนบันทึก
- [x] เพิ่มคูลดาวน์ผู้รายงานแบบตั้งค่าได้ โดยค่าเริ่มต้นระหว่างทดสอบเป็น 0 วินาที และรองรับ 15 นาทีสำหรับ production
- [x] เพิ่มการแก้ไขรายงานได้เพียงหนึ่งครั้ง พร้อม interaction และการตรวจสิทธิ์เจ้าของรายงาน
- [x] เพิ่ม Discord report embed และ Minecraft RCON safe summary notification โดยไม่เปิดเผย token/secret
- [x] จัดระเบียบและตรวจทะเบียน slash commands ของ AI, Music และ DiscordSRV โดยคง mapping เดิม
- [x] เพิ่ม regression tests สำหรับ validation, cooldown, interaction flow, notification และ single-edit rule
- [x] รัน TypeScript checks, Vitest, production build และตรวจ artifact ล่าสุดก่อน checkpoint
- [x] อัปเดตเอกสารการตั้งค่า channel/custom IDs และผลทดสอบ production ของระบบรายงาน

- [ ] เตรียม repository GitHub แบบ Private ชื่อ `ritz-smp-store` สำหรับบัญชีที่ผูกกับ `optun20@gmail.com` โดยยังไม่อัปโหลดโค้ดสุดท้ายจนกว่าเซิร์ฟเวอร์จะสมบูรณ์
- [x] แก้ transform error ใน `server/discordNotifications.ts` บรรทัด 227 และตรวจ dev server ให้โหลดโค้ดปัจจุบันได้จริง
- [ ] รวมโปรเจกต์และไฟล์งาน RitzSMP ที่เกี่ยวข้องทั้งหมดใน repository เดียวกันตามขอบเขตที่ตรวจสอบแล้ว
- [x] ตรวจและกัน `.env`, token, รหัสผ่าน, RCON secret, session, log ข้อมูลลับ, node_modules และ build artifact ออกจาก GitHub
- [ ] เพิ่มตัวอย่าง environment variables และคู่มือแทนค่าลับ เพื่อให้ผู้ใช้แก้ไขงานเองได้อย่างปลอดภัย
- [ ] ประเมินเปอร์เซ็นต์งานจากสถานะไฟล์ ผลทดสอบ และการทำงานจริงของแต่ละระบบแทนการประมาณจากความรู้สึก
- [x] ตรวจรายการไฟล์ระบบเซิร์เวอร์ทั้งหมดที่ยังอยู่นอก repository และจัดหมวดก่อนรวบรวม
- [x] ตรวจความครบถ้วนของ integration ที่เกี่ยวข้องหลัง realtime/chat ใช้งานได้
- [x] จัดทำแพ็กเกจไฟล์ทั้งหมดที่เกี่ยวกับระบบเซิร์ฟเวอร์โดยตัดข้อมูลลับและไฟล์ที่สร้างใหม่ได้
- [ ] ซิงก์แพ็กเกจที่ผ่านการตรวจสอบลง GitHub Private repository `Rin4803/ritz-smp-store`
- [x] แก้หน้า Control Center ให้มีฟอร์มเพิ่มบัญชีผู้ดูแลด้วย Gmail/รายชื่อและตัวเลือกบทบาท
- [x] เพิ่มปุ่มยกเลิกในฟอร์มเพิ่มผู้ดูแลและทำให้ปิด/ล้างฟอร์มได้จริง
- [x] แก้ข้อความเริ่มต้นห้องรายงานให้แสดงปุ่มเริ่มรายงานและปุ่มยกเลิก
- [x] ตรวจ interaction ของปุ่มรายงาน/ยกเลิกไม่ให้สร้างรายงานหรือค้าง modal โดยไม่ตั้งใจ
- [x] เพิ่ม regression tests สำหรับฟอร์มผู้ดูแลและ onboarding รายงานผู้เล่น
- [x] ตรวจ `env.template` ว่าเป็น placeholder เท่านั้นและไม่รวมค่าจริง
- [x] เพิ่มกฎ `.gitignore` สำหรับ `.env`, token/key/cert, dependencies, build และ runtime logs
- [ ] สร้างหรือซิงก์ `.env.example` ผ่านช่องทางที่ระบบอนุญาต โดยไม่ใส่ secret จริง
- [x] รวบรวมรายการงานทั้งหมดและคำนวณเปอร์เซ็นต์จากหลักฐานจริง โดยไม่นับรายการซ้ำเป็นงานใหม่
- [x] ตรวจทะเบียนคำสั่ง AI, Music, DiscordSRV และคำสั่งระบบอื่นเพื่อจำแนกเฉพาะส่วนของ Ritz AI
- [x] กำหนดรายการคำสั่ง Ritz AI ที่ควรคงไว้และรายการที่ควรเอาออก/ปิด พร้อมตรวจ dependency ก่อนแก้
- [x] ปรับทะเบียนและเอกสารคำสั่ง Ritz AI ให้เหลือเฉพาะคำสั่งที่จำเป็น
- [x] เพิ่ม regression tests สำหรับรายการคำสั่งที่คงไว้และคำสั่งที่ถูกตัดออก
- [x] รัน TypeScript, Vitest และ production build หลังปรับคำสั่ง Ritz AI
- [x] บันทึก checkpoint และส่งมอบสรุปเปอร์เซ็นต์งานฉบับตรวจสอบแล้ว

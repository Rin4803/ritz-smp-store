# RitzSMP Economy, Auction House และ Sell System — ข้อกำหนดอ้างอิง

> แหล่งข้อมูล: ไฟล์ที่ผู้ใช้อัปโหลด `/home/ubuntu/upload/pasted_content.txt` เมื่อ 22 สิงหาคม 2026

## เป้าหมายและข้อห้ามก่อนเริ่ม

ระบบ Economy ต้องใช้ **สกุลเงินหลักเดียว** ร่วมกันระหว่าง `/balance`, `/bal`, `/money`, `/pay`, `/sell`, `/sellall`, `/ah`, Shop, Jobs, Quest และ Reward โดย Coin, Token, Points หรือ Credits ไม่ควรเป็นสกุลเงินหลักของ Auction House หากไม่ได้ตั้งใจแยกบทบาทไว้อย่างชัดเจน

ห้ามเดาชื่อปลั๊กอินหรือไฟล์ตั้งค่า ห้ามสร้าง config ใหม่หรือเขียนทับไฟล์ก่อนตรวจระบบจริงและสำรองข้อมูล ทั้ง config ของ Economy/Vault/EssentialsX/AH/Sell/SellAll/Placeholder/worth และฐานข้อมูลที่เกี่ยวข้อง

## พฤติกรรมธุรกรรมที่ต้องได้

| ระบบ | ข้อกำหนดสำคัญ |
|---|---|
| `/ah` | ใช้เงินหลักเดียวกัน ตรวจยอดก่อนซื้อ หักเงิน โอนเงินผู้ขาย ส่งมอบไอเทม และปิด listing อย่างสอดคล้อง ป้องกันเงินหรือไอเทมหาย/ซ้ำ |
| Auction fee | ต้องเป็น money sink; ผู้ขายรับยอดหลังหักค่าธรรมเนียม และค่าธรรมเนียมต้องออกจาก Economy |
| `/sell` | ขายเฉพาะไอเทมใน **main hand** ไม่แตะ offhand, slot อื่น, armor, ender chest, container หรือ cursor; ไอเทมไม่มีราคาไม่ถูกลบและไม่ได้เงิน |
| `/sellall` | ขายเฉพาะไอเทมที่มีราคาทั้ง inventory รวม stack เดียวกันเพื่อคำนวณ และไม่แตะไอเทมไม่มีราคา |
| ธุรกรรมขาย | ตรวจ item/จำนวน/ราคา → คำนวณ → เปลี่ยน inventory และยอดเงินโดยป้องกันลบไอเทมแต่ไม่ได้เงิน หรือได้เงินแต่ไอเทมไม่ถูกลบ |

## หลักสมดุลราคา

กำหนดราคาจาก rarity, เวลาผลิต, ผลผลิตต่อชั่วโมง, ระดับ automation/AFK, ต้นทุน, ความเสี่ยง และปริมาณของเข้าสู่ตลาด ไม่ใช้ rarity เพียงอย่างเดียว และตรวจ `price × production rate` เสมอ

กรอบรายได้เริ่มต้นจากเอกสารคือ Starter Farming $5,000–$15,000/ชั่วโมง, Intermediate $15,000–$30,000/ชั่วโมง และ Advanced $30,000–$60,000/ชั่วโมง โดยต้องปรับตามข้อมูลจริงของเซิร์ฟเวอร์

| กลุ่ม | หลักการ |
|---|---|
| Basic farming | Wheat/Carrot/Potato/Beetroot ควรให้รายได้เริ่มต้นที่เหมาะสม |
| Commercial farming | Sugar cane/Pumpkin/Melon/Cocoa/Sweet berry สูงกว่า basic ตามการลงทุน |
| Special farming | Glow berry/Nether wart/Honey มูลค่าสูงขึ้นตามความยาก |
| High automation | Cactus/Bamboo/Kelp ราคาต่อชิ้นต่ำเพื่อไม่ให้ AFK farm สร้างเงินเกินสมดุล |
| Mining/Mob/Nether/End | มีมูลค่าตามความเสี่ยงและความถี่ แต่ไม่ควรกลายเป็นช่องทำเงินไม่จำกัด |
| Food/Building blocks | ราคาต่ำพอไม่ให้ฟาร์มหรือขุดทั่วไปเป็น money generator หลัก |

## การป้องกัน exploit และความสอดคล้อง

ต้องตรวจ crafting, smelting และ compression arbitrage เช่น raw ore→ingot, 9 ingot→block และ conversion ทุกชนิด เพื่อไม่ให้มูลค่าของผลลัพธ์สูงผิดปกติจากวัตถุดิบ และตรวจความสอดคล้องราคาข้าม `/sell`, `/sellall`, `/ah`, Shop, Jobs, Quest และ Reward

ต้อง validate item ID, Minecraft version, YAML syntax, duplicate key, negative/NaN/Infinity price และชนิดข้อมูลราคา พร้อมป้องกัน sell/AH duplication, double-click, command spam, concurrent transaction, invalid stack, negative quantity, overflow, double purchase และ cancel duplication ให้ atomic ตามความสามารถของปลั๊กอิน

## Monitoring หลังปรับ

ติดตามเงินรวม, ค่าเฉลี่ย/median balance, เงินจาก `/sell`, รายได้จาก Farming/Mining/Mob, money sinks, ไอเทมขายมากสุด และไอเทมที่ทำเงินมากสุด โดยทบทวนข้อมูลหลัง 7, 14 และ 30 วันเพื่อปรับราคาอย่างมีหลักฐาน

### สถานะโฮสต์หลังปัญหาการเชื่อมต่อ — 22 สิงหาคม 2026

เวลา 21:02 น. (ตามคอนโซล MCSV) ผู้ดูแลยืนยันการเข้าถึงบัญชีเจ้าของ RitzSMP แล้ว และแผง MCSV แสดงว่าเซิร์ฟเวอร์ **ออนไลน์** บน `SV4` (Paper-Geyser 26.2) ใช้ทรัพยากรปกติที่ CPU 1.5%, RAM 3.68/8 GB และดิสก์ 13.92/100 GB หลังเปิดมา 4 นาที จึงสรุปได้ว่าข้อขัดข้อง `ConnectionException` ที่พบก่อนหน้าเกิดในช่องทางจัดการอัตโนมัติ ไม่ใช่การหยุดทำงานของเซิร์ฟเวอร์จริง

คอนโซลแสดง `An unexpected error occurred while trying to execute that command` พร้อม stack trace ของ Paper และมี `[InteractiveChat] Loaded all 1 languages!` หลังจากนั้น ต้องตรวจ stack trace เต็มและคำสั่งก่อนหน้าแยกต่างหากก่อนสรุปว่าข้อผิดพลาดเกี่ยวข้องกับ Economy หรืองาน reload ใด ๆ

การตรวจหน้า MCSV ซ้ำเวลา 21:12 น. แสดง RitzSMP สถานะ **ออนไลน์** ต่อเนื่อง ใช้ CPU 0.9%, RAM 3.70/8 GB, ดิสก์ 13.92/100 GB และไม่มีรายชื่อผู้เล่นที่แสดงบนหน้า overview; แผนภูมิผู้เล่นปัจจุบันมีค่า `0` ในการแสดงผล จึงเลือกใช้ช่วงนี้เป็นหน้าต่างบำรุงรักษาสั้น ๆ เพื่อโหลด config ที่แก้แล้ว ทั้งนี้จะตรวจ startup log หลังเริ่มใหม่เสมอ ไม่สรุปจากหน้าเว็บเพียงอย่างเดียว

หน้าจัดการผู้เล่น MCSV ยืนยันเชิงระบบว่าออนไลน์ `0/20` และผู้เล่นที่บันทึกไว้ทั้งหมด 38 คนเป็นออฟไลน์ก่อนเริ่มการบำรุงรักษา จึงกดรีสตาร์ต RitzSMP เมื่อเวลา 21:13 น. หน้าควบคุมเปลี่ยนสถานะเป็น `กำลังหยุด...` แล้ว ขั้นถัดไปต้องรอให้กลับมาออนไลน์และตรวจ log การเริ่มต้น/การโหลดปลั๊กอินก่อนทดสอบ Economy ใด ๆ

หลังเริ่มใหม่ ช่องทางจัดการยืนยัน runtime เป็น `running` และ startup scan รายงาน `boot_completed: true` โดย AuctionHouse 1.5.2, Essentials 2.22.0, FoShop 1.6, Skript 2.16.1, Vault 2.20.2 และ PlayerPoints 3.3.5 ถูกโหลดสำเร็จทั้งหมด ไม่มีปลั๊กอิน Economy ใด failed หรือถูกปิดระหว่างบูต

ข้อผิดพลาดที่ยังพบใน startup ไม่ใช่ผลจากการแก้ Economy รอบนี้ ได้แก่ Essentials แจ้งว่า Minecraft server version ไม่อยู่ในรายการรองรับ, DiscordSRV แจ้งว่า bot ไม่ได้อยู่ใน Discord server ใด, และ GrimAC มีคำเตือน SLF4J ไม่มี provider จึงใช้ NOP logger ต้องติดตามแยกต่างหาก แต่ไม่พบ error load ของ FoShop, AuctionHouse, Skript หรือ Vault

หลังการรีสตาร์ต อ่านไฟล์ active `/plugins/FoShop/shops/end.yml` ซ้ำแล้ว ยืนยันว่า `popped_chorus_fruit` (16 ชิ้น) มี `sell-price: 3.0` เท่ากับ `chorus_fruit` (16 ชิ้น) แล้ว จึงปิดเส้นทางนำ Chorus Fruit ไป smelt เป็น Popped Chorus Fruit เพื่อเพิ่มรายได้จาก 3 เป็น 5 ต่อชุดได้สำเร็จ

### ข้อควรระวังการโหลดราคา FoShop

เมื่อ 22 สิงหาคม 2026 ได้ค้นหาคำสั่ง reload ที่ผู้พัฒนา FoShop รองรับ แต่ไม่พบเอกสารคำสั่งเฉพาะเวอร์ชันที่ติดตั้งซึ่งยืนยันได้จากแหล่งทางการ ผลค้นหาที่พบมีเพียงหน้าโครงการ FoShop บน [Modrinth](https://modrinth.com/project/Fi0CQQOz) และคำเตือนทั่วไปว่าห้ามใช้คำสั่ง `/reload` ระดับ Paper/Bukkit เพราะอาจทำให้ปลั๊กอินไม่เสถียร [1] จึงจะไม่ใช้ `/reload` หรือเดาคำสั่ง reload ของ FoShop

การแก้ `Popped Chorus Fruit` ถูกบันทึกใน `/plugins/FoShop/shops/end.yml` แล้วจาก `sell-price: 5.0` เป็น `3.0` ต่อ 16 ชิ้น แต่ยังต้องยืนยันกลไกโหลด config ของ FoShop ผ่านคำสั่งช่วยเหลือของปลั๊กอินหรือการรีสตาร์ตตามรอบบำรุงรักษา ก่อนประกาศว่าราคานี้มีผลกับผู้เล่น

[1]: https://madelinemiller.dev/blog/problem-with-reload/

## ลำดับดำเนินการ

1. สำรวจ Paper/Minecraft version, ปลั๊กอิน, economy provider, Vault, AH, Sell/SellAll และ permissions
2. สำรอง config/database ที่เกี่ยวข้องด้วยชื่อ backup ที่ระบุวัตถุประสงค์
3. ตรวจความเสี่ยง/ตั้ง baseline ก่อนเปลี่ยนราคาและพฤติกรรมคำสั่ง
4. ปรับเฉพาะไฟล์ปลั๊กอินที่ตรวจพบจริง แล้ว validate syntax
5. ทดสอบ `/sell`, `/sellall`, `/ah`, `/ah sell`, `/ah buy`, `/balance`, `/bal`, `/pay` รวมถึง concurrent/race cases
6. บันทึกผลและกำหนดรอบติดตามสมดุลเศรษฐกิจ

## ผลสำรวจเซิร์ฟเวอร์จริง — 22 สิงหาคม 2026

ผลจากการเชื่อมต่อ MCP ของ RitzSMP พบปลั๊กอิน 46 รายการ โดยระบบที่เกี่ยวข้องโดยตรงกับงานนี้คือ:

| บทบาท | ปลั๊กอินที่พบ | สิ่งที่ต้องตรวจต่อ |
|---|---|---|
| Economy provider และคำสั่งเงิน | `EssentialsX-2.22.0.jar` | `config.yml`, `worth.yml`, user data และค่าป้องกันธุรกรรม |
| Economy bridge | `VaultUnlocked-2.20.2.jar` | provider ที่ Vault จับอยู่ และ compatibility กับ AH/Shop |
| Auction House | `AuctionHouse-1.5.2.jar` | config, database/listings, currency, fee, anti-dupe และ transaction behavior |
| Shop | `FoShop-1.6.jar` | buy/sell prices, currency และความสอดคล้องกับ worth/AH |
| Points แยกจากเงินหลัก | `PlayerPoints-3.3.5.jar` | ต้องยืนยันว่าไม่ถูกใช้เป็น currency หลักใน `/ah` หรือ `/sell` โดยไม่ตั้งใจ |
| Custom logic | `Skript-2.16.1.jar`, `skript-placeholders-fork.1.7.2.jar` | scripts ที่อาจ override `/sell`, `/pay`, `/ah` หรือปรับยอดเงิน |
| Audit/anti-exploit | `BlockLedger.jar`, `grimac-bukkit-2.3.74-155abaf.jar` | log/block transaction และข้อจำกัดที่อาจกระทบ workflow |
| Crate/reward | `CrazyCrates-26.1.2-beb9423.jar`, `ExcellentCrates.jar` | reward เงิน/ไอเทมที่อาจไม่สมดุลกับราคา sell |

**ข้อสรุปเบื้องต้น:** ยังไม่ได้เปลี่ยนแปลงไฟล์เซิร์ฟเวอร์ใด ๆ. ขั้นต่อไปคือตรวจเฉพาะ config/data ของปลั๊กอินข้างต้นและสร้าง backup ก่อนแก้ไข.

### EssentialsX baseline

อ่าน `/plugins/Essentials/config.yml` แล้วพบว่าใช้ EssentialsX **2.22.0** และเปิดใช้ Bukkit permissions (`use-bukkit-permissions: true`). คำสั่ง `pay`, `sell`, `balance`, `balancetop` และ `worth` อยู่ในรายการ permission ตัวอย่างของ EssentialsX; การให้ใช้งานจริงจึงต้องตรวจ LuckPerms เพิ่มเติม. ไม่มี Essentials sign ที่เปิดใช้งานใน `enabledSigns` ตาม config ที่อ่าน และ `disabled-commands` มีเพียง `kit` กับ `back`.

> ยังไม่สรุปค่าราคาหรือ policy เศรษฐกิจจากไฟล์นี้ เพราะต้องอ่านส่วน economy/worth, ตรวจ `worth.yml`, และตรวจ config ของ FoShop/AuctionHouse ก่อน. ไม่มีการเขียนไฟล์หรือ reload เซิร์ฟเวอร์ในขั้นนี้.

### FoShop baseline

อ่าน `/plugins/FoShop/config.yml` แล้วพบว่า FoShop บันทึก transaction ของ SellGUI ที่ `transactions/sellgui.log` (`transaction-log.enabled: true`) ซึ่งเป็นแหล่งข้อมูลสำคัญสำหรับ audit ยอดขาย. Global sell prices ปิดอยู่ (`global-sell-prices.enabled: false`); จึงต้องตรวจราคาแบบราย shop/section แทน.

Sell booster เปิดใช้งาน แต่ตั้งให้ **ไม่ stack** ระหว่าง booster หลายตัว และไม่ stack กับ rotating-shop boost (`stack-boosters: false`, `stack-with-rotating-shop: false`). Rotating shop ปิดอยู่. จุดต้องตรวจต่อคือไฟล์ `sell-boosters.yml`, `global-sell-prices.yml` และไฟล์ section/price ที่ FoShop ใช้จริง เพื่อคำนวณราคาและผลของตัวคูณจากข้อมูลจริง.

### AuctionHouse baseline

อ่าน `/plugins/AuctionHouse/config.yml` แล้วพบว่าใช้ AuctionHouse **1.5.2** และยังไม่มี transaction tax (`tax: 0`). ระบบ Buy It Now และ bid เปิดพร้อมกัน, ไม่กำหนดเพดานราคา (`max-bin: -1`, `max-bid: -1`), จำนวน listing เริ่มต้น 10 รายการ, ซื้อสำเร็จแบบ auto-collect, และปิด partial-selling อยู่ (`partial-selling: false`).

> ความเสี่ยงเริ่มต้นคือ AH ยังไม่มี money sink และไม่มีกำแพงกันราคาผิดปกติ. ก่อนปรับต้องสำรอง config และตรวจ syntax/ความหมายของ field ตามเอกสารปลั๊กอิน, ตรวจ permission ที่อาจยกเพดาน listing, และห้ามเปิด partial-selling ก่อนทดสอบการรักษารายการสินค้า/ยอดเงินครบถ้วน.

### EssentialsX worth baseline และ craft check เบื้องต้น

อ่าน `/plugins/Essentials/worth.yml` แล้วพบว่าไฟล์จำกัดรายการที่ขายได้ไว้ชัดเจน. ราคากลุ่ม compressed blocks หลักสอดคล้องกับวัตถุดิบ (iron, gold, diamond และ emerald block เท่ากับ 9× ingredient) จึงไม่มีผลกำไรจาก compression ในกลุ่มนั้น. Netherite ingot ตั้งไว้ 1,200 เทียบกับ 4 scrap + 4 gold ingot = 1,260 จึงเป็น loss เมื่อ craft.

พบความเสี่ยง **craft arbitrage ที่ต้องแก้หลัง backup**: `glowstone_dust` ราคา 4 และ `glowstone` ราคา 18; การ craft 4 dust (ต้นทุนขาย 16) เป็น 1 block (ขาย 18) ให้กำไร 2 ต่อรอบ หากคำสั่งขายใช้ราคานี้. ต้องทดสอบเส้นทางคำสั่ง `/sell` ก่อนเปลี่ยนราคา, แล้วปรับราคา block ลงไม่เกิน 16 หรือปรับ dust ตาม balance target. การเปรียบเทียบกับ FoShop ยังทำไม่ได้จนกว่าจะอ่านไฟล์ราคา Shop จริง.

### FoShop global fallback baseline

อ่าน `/plugins/FoShop/global-sell-prices.yml` แล้วพบว่าเป็นฐานราคา fallback ขนาดใหญ่ โดย header ระบุชัดว่าถูกควบคุมด้วย `global-sell-prices.enabled` ใน `config.yml` และ shop item สามารถ override ราคาได้. จาก `config.yml` ที่ตรวจไว้ ค่า global fallback **ปิดอยู่** ดังนั้นไฟล์นี้ยังไม่ควรส่งผลกับ `/sell` ปัจจุบัน.

> ห้ามเปิด global fallback ก่อน audit ครบ: baseline นี้ครอบคลุมรายการจำนวนมากและมีราคาที่ต่างจาก `Essentials/worth.yml` อย่างมีนัยสำคัญ (ตัวอย่าง bamboo และวัสดุหลายชนิด). หากเปิดทันทีอาจเปลี่ยนอัตราการสร้างเงินอย่างก้าวกระโดด. ขั้นต่อไปต้องตรวจราคาจาก section files ที่ FoShop ใช้งานจริง, ให้ทดสอบ `/sell` บน staging/กับบัญชีทดสอบ, แล้วจึงตัดสินใจว่าจะใช้ Essentials หรือ FoShop เป็นแหล่งราคาเดียว.

### คำสั่ง `/sell` ที่ทำงานจริง — ความเสี่ยงสูง

ตรวจพบว่า `/plugins/Skript/scripts/sell-alias.sk` เป็น Skript ที่ประกาศคำสั่ง `/sell` เอง จึงเป็นตัวที่ต้องถือว่าใช้งานจริงก่อน EssentialsX สำหรับผู้เล่น. สคริปต์นี้วนขาย **ทุก stack ใน inventory** ไม่ใช่เฉพาะ main hand, และใช้คำสั่ง `eco give` เพื่อจ่ายยอดรวมผ่าน Vault/Essentials หลังลบไอเทมออกจาก inventory.

| ประเด็น | พฤติกรรมที่ตรวจพบ | ผลกระทบ |
|---|---|---|
| ขอบเขตการขาย | loop ทุก item ใน inventory | ขัดกับข้อกำหนด `/sell` main-hand-only และเสี่ยงขายไอเทมที่ผู้เล่นไม่ได้ตั้งใจขาย |
| รายการไม่มีราคา | ตั้ง fallback เป็น `0.5` ต่อชิ้น | ไอเทมที่ไม่มีราคาใน worth list ยังถูกลบและสร้างเงินได้ ทำให้ blacklist ไม่ใช่ allowlist ที่ปลอดภัย |
| การบันทึกยอด | คำนวณยอดแล้วลบไอเทม ก่อนเรียก `eco give` | ไม่มี transactional rollback ในสคริปต์ หากการจ่ายเงินผิดพลาดหลังลบไอเทม ผู้เล่นเสี่ยงสูญเสียของ |
| ความสอดคล้องกับ `/sellall` | ไม่พบ implementation ใน Skript ที่อ่าน | ต้องยืนยันเจ้าของคำสั่ง `/sellall` จากปลั๊กอิน/alias ก่อนปรับ เพื่อไม่ให้มีคำสั่งทับซ้อน |

> **ห้ามแก้ราคาอย่างเดียวในสถานะนี้:** ต้องแทนพฤติกรรม `/sell` ให้เป็น main-hand-only และเป็น allowlist (ไม่มีราคา = ไม่ขาย/ไม่ลบ) ก่อน จึงจะปิดช่อง fallback income และทำให้เป็นไปตาม specification ได้.

#### หลักฐานบัคเงินไม่เข้าจากคอนโซล — 22 สิงหาคม 2026

ระหว่างการตรวจจริง ผู้เล่น `KIWIOWO555` เรียก `/sell` และคอนโซลบันทึกว่า Essentials ได้รับคำสั่ง `eco give KIWIOWO555 {_total}` แบบตัวอักษรตรงตัว ไม่ใช่จำนวนเงินที่ Skript คำนวณไว้ จึงยืนยันได้ว่าสาเหตุที่ผู้เล่นรายงานว่า **ขายแล้วเงินไม่เข้า** อยู่ในบรรทัด `execute console command` ของ `sell-alias.sk`: ต้อง interpolate ตัวแปร Skript ก่อนส่งให้ Essentials. การแก้จุดนี้ต้องทำพร้อมกับแก้ขอบเขต main hand, การไม่มี fallback และตรวจการจ่ายเงินให้สำเร็จก่อนนำรายการขายไปใช้—not merely replace the placeholder—เพื่อไม่สร้างเส้นทางที่ลบของโดยไม่ได้เงิน.

> หลักฐานนี้เป็นผลจาก log ของเซิร์ฟเวอร์จริง ไม่ใช่การจำลอง: เวลา `14:18:34` คอนโซลแสดง `/sell` แล้วตามด้วย `[Essentials] CONSOLE issued server command: /eco give KIWIOWO555 {_total}`.

### แหล่งราคาและสกุลเงินที่ซ้อนกัน

Skript `/sell` ใช้ตัวแปร `{w::<material>}` ที่นิยามใน `/plugins/Skript/scripts/worth.sk`; ไม่ได้อ้าง `/plugins/Essentials/worth.yml` โดยตรง. ราคาที่แสดงใน `/worth` ระบุคำว่า “เหรียญ/ชิ้น” แต่การจ่ายเงินจริงใช้ `eco give` (Vault/Essentials). ขณะเดียวกัน `/plugins/Skript/scripts/coins.sk` อ่าน `playerpoints_points` เพื่อแสดง “เหรียญ” บน scoreboard เท่านั้น จึงยืนยันได้ว่ามี **อย่างน้อยสองยอดคงเหลือแยกกัน**: เงิน Vault และ PlayerPoints.

FoShop มีร้านหมวด `farming`, `food`, `mining`, `mob_drops`, `nether`, `end`, `gear` และ `blocks` ที่มี `buy-price`/`sell-price` แยกต่างหาก; global fallback ปิดอยู่ แต่ค่าราคาของร้านยังแตกต่างจาก `worth.sk` อย่างมีนัยสำคัญ. ตัวอย่างที่ตรวจพบคือ `nether_wart` ใน FoShop ขายได้ 3 ต่อรายการ แต่ `worth.sk` ให้ 8 ต่อชิ้น; `totem_of_undying` FoShop ให้ 700 แต่ `worth.sk` ให้ 1,600. การปรับต้องตัดสินใจให้ชัดว่า FoShop ใช้เป็นร้านซื้อขายแยก หรือให้ `/sell`/`/sellall` ใช้ price source เดียวกัน เพื่อไม่สร้างช่อง price arbitrage ข้ามระบบ.

### Craft arbitrage ที่ยืนยันในแหล่งราคา `/sell`

จาก `worth.sk` ซึ่งเป็นแหล่งราคาของ `/sell` ที่ตรวจพบ: `glowstone_dust = 4` และ `glowstone = 6`. การ craft 4 dust เป็น 1 glowstone มีมูลค่าขายลดลงจาก 16 เหลือ 6 จึง **ไม่มี** arbitrage ในเส้นทาง `/sell` จริง. ค่า 18 ที่เคยพบอยู่ใน `Essentials/worth.yml` ไม่ใช่แหล่งราคาของ Skript `/sell` ปัจจุบัน. อย่างไรก็ดี ยังต้องตรวจเส้นทาง `/sellall` และ FoShop ก่อนสรุปว่าช่องนี้ปิดทั้งระบบ.

### การดำเนินการที่ปลอดภัยถัดไป

ต้องตรวจ source ของ `/sellall`, ตรวจว่า AuctionHouse ใช้ Vault money จริงหรือ PlayerPoints, และตรวจ log/permission ก่อนทำ patch. เมื่อยืนยันแล้ว การเปลี่ยนชุดแรกควรมีขอบเขตแคบ: แก้ `sell-alias.sk` ให้ `/sell` ขาย main hand เท่านั้น, ไม่ใช้ fallback, ไม่ลบไอเทมไม่มีราคา, แล้วเพิ่ม `/sellall` ที่ขายเฉพาะ allowlist ใน inventory โดยมีแผนทดสอบบัญชีควบคุมและ rollback ชัดเจน. ยังไม่มีไฟล์บนเซิร์ฟเวอร์ถูกแก้ไขในขั้นตอน audit นี้.

### หลักฐาน runtime และสถานะ `/sellall` เพิ่มเติม

Boot report ล่าสุดยืนยันว่า `Essentials 2.22.0`, `Vault 2.20.2`, `AuctionHouse 1.5.2`, `FoShop 1.6`, `PlayerPoints 3.3.5` และ `Skript 2.16.1` เปิดใช้งานสำเร็จทั้งหมด. Log ระบุว่า Essentials พบ `Vault Compatibility Layer` และ PlayerPoints เปิดฐานข้อมูล SQLite แยกต่างหาก; จึงยืนยันได้ว่า Vault/Economy กับ Points เป็นระบบคนละชุด แต่ log ของ AuctionHouse ยังไม่ได้ระบุชื่อ economy provider อย่างชัดเจน.

การตรวจ `/commands.yml` พบเพียง alias `icanhasbukkit` และไม่มี mapping ของ `/sellall`; จึงไม่ใช่ alias ระดับ Paper. คำสั่ง `/sellall` ปรากฏใน log ผู้เล่นหลายครั้ง แต่การเรียก help จาก console ยังไม่ให้ชื่อปลั๊กอินเจ้าของคำสั่ง. จำเป็นต้องตรวจ registry/ไฟล์ปลั๊กอินที่เกี่ยวข้องต่อก่อนสร้างหรือแทนที่คำสั่ง เพื่อป้องกัน command collision.

### AuctionHouse: currency และความหมายค่าธรรมเนียม

ไฟล์ active `/plugins/AuctionHouse/config.yml` กำหนด `tax: 0`, `min-bin: 1`, `max-bin: -1`, `min-bid: 1`, `max-bid: -1`, `partial-selling: false` และ `auto-collect: true`. Log จริงยืนยันว่าการตั้งขาย ยกเลิก และซื้อสำเร็จถูกบันทึกแยกเป็นเหตุการณ์ และข้อมูล note ที่ค้างอยู่รองรับเลขราคาถึงอย่างน้อย `2,000,000`; ดังนั้นต้องเพิ่ม money sink และเพดานป้องกันรายการราคาเกินสมดุลโดยไม่กระทบรายการที่มีอยู่ย้อนหลัง.

เอกสารผู้พัฒนาสำหรับเวอร์ชัน 1.5.2 ระบุว่า plugin ใช้ Vault (หรือ VaultUnlocked บน Folia) และนิยาม `tax: 0.01` ว่าเป็นค่าธรรมเนียม `1%`; release note 1.5.2 ยังกล่าวถึงคำเตือนเมื่อไม่พบ Vault provider และเมื่อ tax น้อยกว่า `0%` หรือมากกว่าหรือเท่ากับ `100%`. [^ah-hangar] [^ah-modrinth] ด้วยเหตุนี้ `tax: 0` ใน config ปัจจุบันจึงเป็น **0%**, ไม่ใช่ค่า default ที่ไม่ทราบความหมาย. แม้ metadata ของ jar ระบุ `depend: [Vault]` ซึ่งยืนยัน dependency แต่ยังต้องทดสอบ controlled listing/buy เพื่อยืนยัน end-to-end ว่าจะคิดเงินจากยอด Vault/Essentials ไม่ใช่ PlayerPoints ก่อนเปิดใช้ค่าธรรมเนียมใน production.

[^ah-hangar]: [AuctionHousePlugin 1.5.2 configuration and release notes — Hangar](https://hangar.papermc.io/ElaineQheart/AuctionHousePlugin/versions/1.5.2)
[^ah-modrinth]: [Auction House Plugin 1.5.2 release — Modrinth](https://modrinth.com/plugin/auction-house-plugin/version/e7AG6hro)

การอ่าน `FoShop/messages.yml` ให้หลักฐานเพิ่มว่า FoShop มีคำสั่งขายของตนเองครบทั้ง `/sell [all|hand|gui]`, `/sellall` และ `/sellhand`; ข้อความ `sellgui-already-processing` แสดงว่าปลั๊กอินมีกลไกกันการประมวลผล SellGUI ซ้อนกัน. อย่างไรก็ตาม log ใน `transactions/sellgui.log` เก็บเฉพาะ SellGUI—not enough to prove which implementation receives `/sellall` at runtime when Skript also declares `/sell`.

### สัญญาณมูลค่าเงินออกสูงจาก SellGUI — ต้องตรวจราคา ไม่ใช่ข้อกล่าวหา exploit

SellGUI transaction log ยืนยันว่าระบบบันทึกผู้เล่น จำนวนรายการ ยอดเงิน และ receipt ต่อธุรกรรมจริง. ระหว่างเวลา `14:18:54`, `14:19:46` และ `14:21:34` ของวันที่ 22 สิงหาคม 2026 ผู้เล่นเดียวกันขายเพชร `2,304` ชิ้นในแต่ละครั้ง ได้รับ `138.24k` ต่อครั้ง (เท่ากับ `60` ต่อเพชร). Log เพียงอย่างเดียว **ยืนยันไม่ได้ว่าเป็นการทำซ้ำผิดปกติ** เพราะอาจเป็นคลังเพชรที่ได้มาโดยชอบธรรม; แต่ขนาดและความถี่ของเงินออกทำให้ต้องถือว่าราคาพื้นฐานของ diamond และเส้นทางรับของจาก crate/reward เป็นความเสี่ยงเงินเฟ้อระดับสูงที่ต้องเปรียบเทียบก่อนเปิด `/sellall` เป็นช่องทางหลัก.

### ตรวจราคา FoShop แบบต่อหน่วย — 22 สิงหาคม 2026

FoShop มีหมวดเปิดใช้งานคือ `farming`, `food`, `mining`, `mob_drops`, `nether`, `end` และ `gear`; หมวด `blocks` ปิดอยู่. Log ยืนยันว่า `sell-price` ถูกคำนวณ **ต่อหนึ่งชิ้น** ไม่ใช่ตามค่า `amount` ในหน้าร้าน: รายการแร่รวมหนึ่งชิ้นต่อชนิดเมื่อ 12 สิงหาคมได้ `100` พอดีกับผลรวม `diamond 60 + quartz 3 + lapis 8 + amethyst 5 + gold 12 + copper 4 + iron 8`.

| ระดับความเสี่ยง | หลักฐานที่ยืนยัน | ข้อสรุปที่ปลอดภัย |
|---|---|---|
| สูง | `diamond = 60` และยอด SellGUI ล่าสุด `2,304 × 60 = 138.24k` ต่อธุรกรรม | ต้องเปรียบเทียบกับ crate/reward, mining rate และยอดเงินรวมก่อนลดหรือคงราคา; log อย่างเดียวไม่พิสูจน์การทำซ้ำ |
| สูง | `chorus_fruit = 3` แต่ `popped_chorus_fruit = 5` ในหมวด End ที่เปิดอยู่ | การเผา chorus fruit เป็น popped chorus fruit มีรายรับเพิ่มอย่างน้อย `2` ต่อชิ้นก่อนต้นทุนเชื้อเพลิง จึงเป็น **smelting arbitrage** ที่ต้องแก้ในแหล่งราคา active |
| เฝ้าระวัง | `blocks.yml` ปิดอยู่ แต่มี `sand = 8` และ `glass = 18`, `quartz = 3` และ `quartz_block = 20` | ตราบใดที่หมวด blocks ปิดอยู่ต้องยืนยันจาก FoShop ว่าไม่รับซื้อ; ห้ามเปิดหมวดนี้ก่อนปรับ glass/quartz_block เพราะจะสร้าง smelt/craft arbitrage |
| ปานกลาง | `end_crystal = 400`, `respawn_anchor = 400`, `totem = 700` | ไม่มี craft arbitrage จากราคาซื้อในร้านโดยตรงตามชุดค่าปัจจุบัน แต่จำเป็นต้องตรวจ crate/reward/drop source ก่อนสรุประดับรายได้ที่เหมาะสม |

การแก้ราคาชุดแรกควรจำกัดที่ `popped_chorus_fruit` เพื่อปิด arbitrage ที่ยืนยันได้ และต้องไม่เปลี่ยน diamond/totem/end crystal แบบเดา ๆ ก่อนเก็บหลักฐาน reward/drop เพิ่ม.

### หลักฐานเพิ่มจาก Essentials และแหล่งราคา Skript — 22 สิงหาคม 2026

การอ่าน `/plugins/Essentials/config.yml` ยืนยันว่า `starting-balance: 0`, `currency-symbol: '$'`, `max-money: 10000000000000`, `min-money: -10000`, `economy-log-enabled: false`, `economy-log-update-enabled: false` และ `minimum-pay-amount: 0.001`. ผู้เล่นที่มี permission `essentials.eco.loan` จึงอาจมีหนี้ได้ถึง `10,000` ขณะที่ไม่มี economy audit log สำหรับคำสั่งขายหรือการเปลี่ยนยอดผ่าน Vault. **ห้ามเปลี่ยน `min-money` หรือเพดานยอดคงเหลือย้อนหลังโดยยังไม่ตรวจ permission และยอดหนี้จริง**; ชุดแก้ไขแรกควรเปิด logging ที่จำเป็นและปิดเฉพาะช่องสร้างเงินที่ยืนยันแล้วก่อน.

การอ่าน source ล่าสุดยืนยันว่า `/sell` ใน `sell-alias.sk` ลบ stack ใน inventory ทั้งหมด แล้วจ่ายผ่าน `execute console command "eco give %player% {_total}"`. รูปแบบนี้ผิดสองชั้น: ไม่ได้ interpolate `{_total}` และไม่เป็น atomic transaction. ไม่ควรแก้เฉพาะ string payout: ให้แทนคำสั่งเป็น main-hand-only, อ่านเฉพาะ allowlist `{w::<item>}`, ไม่ลบของในกรณีไม่พบราคา, และต้องหลีกเลี่ยงการซ้อนกับ FoShop `/sellall` ที่ลงทะเบียนอยู่แล้ว.

ราคา active ใน `worth.sk` ยืนยัน smelting arbitrage เพิ่มเติม: `chorus_fruit = 8` และ `popped_chorus_fruit = 12`. การเผา Chorus Fruit เป็น Popped Chorus Fruit จึงเพิ่มรายรับ `4` ต่อชิ้นก่อนหักเชื้อเพลิง (และ FoShop Active End section มีความสัมพันธ์ทิศทางเดียวกันที่ `3 → 5`). ต้องลดค่า `popped_chorus_fruit` ให้ไม่เกินราคาวัตถุดิบหลังคิดต้นทุน หรือถอนรายการผลิตภัณฑ์แปรรูปออกจาก allowlist ก่อนเปิดเส้นทาง `/sell` ที่แก้ไขแล้ว.

### ชุดแก้ไข Economy รอบแรก — 22 สิงหาคม 2026

ก่อนแก้ไขได้สร้าง archive เฉพาะไฟล์ Economy ชุดใหม่ผ่านระบบเซิร์ฟเวอร์แล้ว นอกเหนือจาก backup เดิมที่ `/plugins/ritzsmp-economy-prechange-2026-08-22.zip` ทุกการแก้ไฟล์ด้านล่างยังมี snapshot อัตโนมัติของตัวเชื่อมต่อ จึงสามารถย้อนกลับเป็นรายไฟล์ได้โดยไม่แตะยอดเงินจริงของผู้เล่น

| รายการ | การเปลี่ยนแปลงที่ทำ | หลักฐานหลังนำไปใช้ | สถานะ |
|---|---|---|---|
| `/sell` | แทน Skript ที่วนขายทุกช่อง, ลบของก่อนจ่าย และส่ง `{_total}` เป็นข้อความ ด้วยการส่งต่อไปยังคำสั่งขาย main-hand ของ FoShop | `Skript` reload `sell-alias.sk` สำเร็จใน 12 ms โดยไม่มี syntax error | โหลดแล้ว; ยังต้องทดสอบด้วยผู้เล่นควบคุม |
| Auction House fee | เปลี่ยน `AuctionHouse/config.yml` จาก `tax: 0` เป็น `tax: 0.05` | `ah reload` สำเร็จ; คำเตือน 500% ที่เกิดเมื่อทดลอง `tax: 5` หายไปหลังแก้หน่วย | ใช้งานเป็น 5%; ต้องทดสอบ listing/buy/cancel แบบควบคุม |
| Economy debt floor | ปิดการสร้างยอดเงินติดลบใหม่และปรับ minimum pay เป็น 1 หน่วยใน Essentials config โดยไม่แก้ยอดบัญชีเดิม | `Essentials reloaded 2.22.0` สำเร็จและโหลด item registry ครบ | โหลดแล้ว; ต้องทดสอบ `/pay` ด้วยผู้เล่นควบคุม |

> **เหตุการณ์ควบคุมความเสี่ยง:** หลังตั้ง `tax: 5` AuctionHouse runtime เตือนชัดเจนว่าเป็น `500.0%` จึงแก้กลับทันทีเป็น `tax: 0.05` และ reload เฉพาะปลั๊กอินอีกครั้งก่อนมีการทดสอบหรือธุรกรรมผู้เล่นใหม่ เหตุการณ์นี้ยืนยันว่า tax ของปลั๊กอินใช้ **อัตราส่วน** ไม่ใช่เลขเปอร์เซ็นต์เต็ม และไม่มีหลักฐานว่ามีการซื้อ/ลงขายใดเกิดในช่วงค่าผิดหน่วย

### Audit ราคา FoShop หลังเปลี่ยน `/sell`

เมื่อ `/sell` ใช้ FoShop ตามเส้นทางใหม่ แหล่งราคาที่ควรถือเป็น active สำหรับ `/sell` และ `/sellall` คือหมวด FoShop ที่เปิดใช้ ไม่ใช่ `worth.sk` หรือ `Essentials/worth.yml` โดยอัตโนมัติ. การอ่านไฟล์ร้านครบ 8 หมวดยืนยันอีกครั้งว่า `blocks.yml` ปิดอยู่ และหมวดอื่นมีราคา sell ต่อชิ้นตามตารางเดิม. จุด smelting arbitrage ที่ยืนยันได้ยังคงเป็น `CHORUS_FRUIT = 3` ไป `POPPED_CHORUS_FRUIT = 5` ใน `end.yml`.

การลดราคา `popped_chorus_fruit` ยัง **ไม่ถูกดำเนินการ** ในรอบแรก เนื่องจากต้องทดสอบให้แน่ชัดก่อนว่าคำสั่ง main-hand ที่ FoShop เรียกจาก alias รองรับ item และยอดเงินแบบ atomic ใน runtime จริง. จะทำการแก้รายการนี้พร้อม validation ของผู้เล่นควบคุม เพื่อแยกผลของการเปลี่ยนพฤติกรรมคำสั่งออกจากการ rebalance ราคา และหลีกเลี่ยงการเปลี่ยน diamond, totem หรือราคาอื่นโดยไม่มีข้อมูลแหล่งที่มา/อัตราผลิต

### ขอบเขตการทดสอบที่ยังคงเหลือ

เนื่องจาก console ไม่สามารถทำธุรกรรมแทนผู้เล่น และไม่อนุญาตให้แก้ยอด/ไอเทมของผู้เล่นจริง การทดสอบ end-to-end ต้องใช้บัญชีทดสอบที่เจ้าของควบคุม โดยบันทึกยอดเริ่มต้นและไอเทมก่อน/หลังทุกครั้ง. ขั้นทดสอบต้องครอบคลุม `/sell` (main hand และ item ไม่มีราคา), `/sellall` (เฉพาะ allowlist), `/pay` (ยอดต่ำกว่า 1 และยอดเกินจริง), Auction House listing/buy/cancel, และการกดซ้ำ/สองผู้ซื้อพร้อมกัน. จนกว่าการทดสอบนี้เสร็จ ห้ามกล่าวอ้างว่า Economy transaction ปลอด duplication หรือได้เงินถูกต้องครบถ้วน.

### ข้อจำกัด FoShop `/worth` และแนวทางกระทบยอด — 22 สิงหาคม 2026

ตรวจ resource ของ FoShop 1.6 แล้วพบว่า `/worth` ของปลั๊กอินถูกเปิดใช้ได้ก็ต่อเมื่อ `global-sell-prices.enabled: true`; เมื่อปิดอยู่ ปลั๊กอินจะแจ้งว่าต้องเปิด global sell prices. ตาราง global นี้เป็น fallback ขนาดใหญ่และมีรายการ/ราคานอกเหนือจากร้านหมวดที่เปิดใช้อยู่ จึง **ห้ามเปิดเพื่อแก้ `/worth` โดยลำพัง** เพราะอาจขยายรายการขายได้และเปลี่ยนสมดุล Economy โดยไม่ผ่าน audit.

ด้วยเหตุนี้ แนวทางที่ปลอดภัยคือคง global fallback ปิดไว้, ให้ FoShop shop sections ที่เปิดใช้อยู่เป็นราคา canonical สำหรับ `/sell` และ `/sellall`, แล้วปรับ Skript `/worth` ให้แสดงเฉพาะ allowlist และราคา sell จากชุด shop ที่ active. ต้องทำตารางเทียบราย item และทดสอบกับบัญชีควบคุมก่อน reload เพื่อไม่ให้หน้าจอรายงานราคาเก่าหรือส่งเสริมไอเทมที่ขายไม่ได้.

### ผลกระทบยอดราคาและ `/worth` — 22 สิงหาคม 2026

หลังคอนโซลยืนยันผู้เล่นออนไลน์ `0/40` ได้ปรับ FoShop ตามรายการผู้เล่นโดยใช้ `buy-price: -1` สำหรับรายการใหม่ที่ต้องการให้ขายได้อย่างเดียว: หมวด `woods.yml` 12 ชนิด, Arrow และ raw ores. FoShop reload สำเร็จโดยโหลด 9 sections และไม่มี section หรือ item ใดถูกข้าม. ราคาที่ใช้ตามรายงานคือไม้แปรรูป 2–4, Mob Drops: Rotten Flesh 2, Bone 3, Arrow 3, String 4, Spider Eye 5, Gunpowder 8, Slimeball 10, Phantom Membrane 20, Ender Pearl 15; แร่: Coal 3, Raw Iron 6, Raw Copper 4, Raw Gold 10, Redstone 5, Lapis Lazuli 6, Diamond 80 และ Emerald 100. ชื่อ Raw Redstone/Lapis/Diamond/Emerald ถูกแมปกับ vanilla material ปกติเนื่องจากไม่มี raw material IDs สำหรับสี่รายการหลัง.

ได้เขียน `worth.sk` ใหม่ให้แสดงเฉพาะ 79 sellable items จาก FoShop รวมหมวดไม้ และ reload สำเร็จโดยไม่มี syntax error. ปรับ `Essentials/worth.yml` เป็นข้อมูล 79 รายการชุดเดียวกันแล้ว reload EssentialsX 2.22.0 สำเร็จ. ตัวตรวจสอบ deterministic จาก snapshot FoShop ที่ active ยืนยันว่า Skript `/worth` และ Essentials `/worth` มี key/value ตรงกับ FoShop ครบ 79/79. อย่างไรก็ดี ต้องไม่ถือว่าธุรกรรมผ่านการยืนยันจนกว่าจะมีบัญชีควบคุมทดสอบ sell, sellall, pay และ Auction House ตามหัวข้อข้างต้น.

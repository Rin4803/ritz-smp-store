# RitzSMP Economy Audit — 2026-08-26

## แหล่งข้อมูลที่อ่านแบบ read-only

ข้อมูลนี้มาจากเซิร์ฟเวอร์ MCSV ผ่านไฟล์จริงต่อไปนี้:

| แหล่งข้อมูล | Path | ขนาด | สถานะจาก listing |
|---|---|---:|---|
| EssentialsX worth | `/plugins/Essentials/worth.yml` | 36,745 bytes | แก้ไขล่าสุด 2026-08-26 00:43 +07 |
| FoShop global fallback | `/plugins/FoShop/global-sell-prices.yml` | 135,905 bytes | แก้ไขล่าสุด 2026-08-26 00:44 +07 |
| FoShop shop overrides | `/plugins/FoShop/shops/*.yml` | 9 ไฟล์ | farming/mining/mob_drops/end/food/gear/nether เปิดใช้งาน; blocks/woods ปิดใช้งาน |

มี backup เดิมใน `/plugins/Essentials/ritzsmp-essentials-worth-reconcile-prechange-2026-08-22.zip` และ FoShop มีโฟลเดอร์ `/plugins/FoShop/.backup` ซึ่งจะตรวจเพิ่มก่อนแก้จริง

## ข้อสังเกตสำคัญ

นโยบายที่เจ้าของเลือกคือ **A — EssentialsX เป็นแหล่งราคาขายหลัก** ดังนั้นค่าที่จะใช้เป็น canonical คือค่าต่อชิ้นใน `worth.yml` จากนั้นจึงแปลงไปยัง `global-sell-prices.yml` และ `sell-price` ใน shop overrides โดยคำนึงถึง `amount` ของแต่ละรายการ ส่วน `buy-price` ต้องคงเดิม

หัวไฟล์ `worth.yml` ระบุว่าตารางสะท้อน FoShop sections ที่เปิดใช้และมี sell-price แต่ยังมีข้อความเก่าว่า FoShop เป็นแหล่งราคาขายจริงของ `/sell` และ `/sellall`; หลังแพตช์ต้องปรับ comment นี้ให้ตรงกับนโยบายใหม่ เพื่อไม่ให้ผู้ดูแลเข้าใจผิด

ตัวอย่างค่าที่พบใน EssentialsX `worth.yml` เป็นราคาต่อชิ้น ได้แก่ `wheat: 0.19`, `pumpkin: 1.00`, `diamond: 10.00`, `emerald: 12.50`, `shulker_shell: 180.00`, `totem_of_undying: 700.00`

ตัวอย่าง shop override ที่ต้องแปลงจากราคารวมทั้งแพ็กเป็นราคาต่อชิ้นก่อนเขียนกลับ:

| Shop item | amount | sell-price เดิม | ราคาต่อชิ้นจาก EssentialsX ที่คาดว่าจะใช้ |
|---|---:|---:|---:|
| `wheat` | 16 | 3.0 | 0.19 |
| `pumpkin` | 8 | 8.0 | 1.00 |
| `diamond` | 8 | 80.0 | 10.00 |
| `emerald` | 8 | 100.0 | 12.50 |
| `shulker_shell` | 1 | 180.0 | 180.00 |
| `totem_of_undying` | 1 | 700.0 | 700.00 |

ตัวอย่าง global fallback ที่เห็นว่าเป็นราคาต่อชิ้นอยู่แล้วในรูปแบบ uppercase key ได้แก่ `OAK_PLANKS: price: 2.0` และต้องตรวจ mapping กับ `oak_planks: 0.19` ใน EssentialsX ก่อนแก้ เพราะเป็น mismatch จริง ไม่ควรสมมติว่า global price ใช้หน่วยเดียวกันทุก entry

## ข้อควรระวังและแผนถัดไป

ก่อนเริ่มแพตช์ได้อ่าน global file และ shop overrides ครบ ตรวจชนิดข้อมูล YAML ตรวจกรณี item ที่ไม่มี key ใน EssentialsX และสร้าง full backup ใหม่แล้ว รายการที่ไม่มี canonical value ไม่ถูกเดาราคาและคงค่าเดิมไว้ในรายงาน

หลังแก้ต้อง reload/restart ตามวิธีที่เจ้าของเซิร์ฟเวอร์ดำเนินการได้ เนื่องจากคำสั่ง `reload` ถูกป้องกันผ่าน API และการทดสอบ `/worth`, `/sell`, `/sellall` ต้องทำบน production ด้วยบัญชีควบคุมเท่านั้น

## ผลวิเคราะห์ deterministic จากไฟล์จริง

สคริปต์ read-only ตรวจ YAML ได้ผลดังนี้:

| ชุดข้อมูล | จำนวน |
|---|---:|
| รายการใน EssentialsX worth | 1,616 |
| รายการ global FoShop ที่ enabled และมี price | 1,409 |
| รายการใน shop overrides ที่มี sell-price | 79 |
| global items ที่มี key ตรงกับ EssentialsX | 1,409 |
| shop items ที่มี key ตรงกับ EssentialsX | 79 |
| global price ที่ต่างจาก EssentialsX | 76 |
| shop sell-price ที่ไม่เท่ากับ EssentialsX ต่อชิ้นคูณ amount | 44 |
| EssentialsX entries ที่ไม่มีใน global FoShop | 207 |
| EssentialsX entries ที่ไม่มีใน shop overrides | 1,537 |

ผลนี้ยืนยันว่าตัวเลขเดิมใน global fallback ส่วนใหญ่เป็นราคาต่อชิ้นที่ไม่ตรงกับ EssentialsX ขณะที่ shop override จำนวนมากเก็บ `sell-price` เป็นราคารวมตาม `amount` เช่น wheat 16 ชิ้นขาย 3.0 ซึ่งเทียบกับ EssentialsX 0.19 ต่อชิ้นจะได้ 3.04 ต่อแพ็ก

รายการที่ไม่มีใน EssentialsX ไม่ถูกเดาราคาและไม่ถูกแก้ ส่วน shop ที่ปิดใช้งาน (`blocks`, `woods`) ถูกตรวจ mapping ได้แต่ไม่ได้ถูกเปิดใช้งานจากการแก้ราคา ทั้ง global และ shop entries ที่มี mapping ถูกแพตช์แล้ว และผ่านการตรวจหลังแก้โดยไม่แตะ `buy-price`


## ผลการดำเนินการตามนโยบาย A — 2026-08-26

สร้าง full backup ก่อนแก้ไขจริงสำเร็จแล้ว:

| รายการ | ค่า |
|---|---|
| Backup name | `ritzsmp-economy-pre-essentials-canonical-2026-08-26` |
| Backup UUID | `fc561430-3c82-4d77-a395-50e98f057a1d` |
| ขอบเขต | Full server backup |

จากนั้นปรับเฉพาะราคาขายที่มี canonical mapping ใน EssentialsX โดยคง `buy-price`, `enabled`, `amount` และโครงสร้าง shop เดิมไว้ การอ่านไฟล์ MCSV หลังแก้และตรวจแบบ deterministic ได้ผลดังนี้:

| ชุดตรวจ | ผล |
|---|---:|
| EssentialsX prices ที่อ่านได้ | 1,616 |
| FoShop global entries ที่ enabled | 1,409 |
| Global price ที่ยัง mismatch กับ EssentialsX | 0 |
| Shop entries ที่มี EssentialsX mapping | 70 |
| Shop sell-price ที่ยัง mismatch หลังคูณ amount | 0 |
| ผลรวม | `ECONOMY_VERIFY=PASS` |

รายการที่ไม่มี key ใน EssentialsX ไม่ถูกเดาราคาและไม่ถูกแก้ ส่วน shop ที่ปิดใช้งานไม่ได้ถูกเปิดใช้งานจากงานนี้ การ reload/restart และการทดสอบคำสั่ง `/worth`, `/sell`, `/sellall` ด้วยผู้เล่นจริงยังต้องทำบน production ตามคู่มือ เพราะ API ไม่อนุญาตให้ส่งคำสั่ง reload แทนเจ้าของเซิร์ฟเวอร์

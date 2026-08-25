# หลักฐานการปรับราคา Economy — 22 สิงหาคม 2026

เอกสารนี้บันทึกข้อเท็จจริงภายนอกที่ใช้ประกอบการปรับ FoShop โดยไม่มีการเปิด `global-sell-prices` ซึ่งจะขยายรายการสินค้าที่ขายได้เกินตารางที่ตรวจสอบแล้ว

## ผลยืนยันรูปแบบราคา FoShop 1.6

ซอร์ส `ShopItem` ของ FoShop 1.6 ระบุว่า `canBuy()` จะเป็นจริงเมื่อ `buyPrice >= 0D` ขณะที่ `canSell()` จะเป็นจริงเฉพาะสินค้าแบบไอเท็มที่ `sellPrice > 0D` และเป็นจำนวนจำกัด ดังนั้นการกำหนด `buy-price: -1` ปิดการซื้ออย่างชัดเจน และการกำหนด `sell-price` เป็นจำนวนบวกเปิดเฉพาะการขายได้อย่างปลอดภัย [1]

FoShop โหลดเฉพาะไฟล์ YAML ในโฟลเดอร์ `shops` และเพิ่มข้อเสนอขายเข้าสู่ตารางจริงเฉพาะ section ที่เปิดใช้งานและสินค้าที่ผ่าน `canSell()` เท่านั้น [2] โครงสร้างร้านไม้ใหม่จึงใช้ `buy-price: -1` กับทุกสินค้า เพื่อไม่สร้างช่องทางซื้อคืนหรือช่องโหว่ราคา

## ขอบเขตการปรับตามรายการผู้เล่น

ตารางที่ต้องปรับจริงคือ FoShop active sections ซึ่งเป็นแหล่งราคาของ `/sell` และ `/sellall` ส่วน `/worth` จะปรับให้แสดงข้อมูลชุดเดียวกันเท่านั้น. ป้าย “Raw Redstone”, “Raw Lapis”, “Raw Diamond” และ “Raw Emerald” ในรายงานผู้เล่นจะถูกแมปกับวัสดุ vanilla ที่มีอยู่จริงคือ `REDSTONE`, `LAPIS_LAZULI`, `DIAMOND` และ `EMERALD`; Minecraft ไม่มี material ชื่อ Raw สำหรับสี่รายการหลังนี้.

## ชุดปรับที่นำไปใช้จริง

เมื่อคอนโซลยืนยันผู้เล่นออนไลน์ `0/40` ได้ใช้การแก้เฉพาะ FoShop แล้วโหลดใหม่ผ่านคำสั่งที่ปลั๊กอินรองรับ ผลคือ FoShop โหลด **9 shop sections**, `skipped sections: 0` และ `skipped items: 0`.

| กลุ่ม | รายการที่กระทบยอด | ผลที่นำไปใช้ |
|---|---|---|
| ไม้แปรรูป | Oak, Spruce, Birch, Jungle, Acacia, Dark Oak, Mangrove, Cherry, Pale Oak, Bamboo, Crimson และ Warped Planks | เพิ่ม `woods.yml` เป็นร้านขายจริง โดยทุกชิ้น `buy-price: -1`; ราคาขายเป็น 2, 2, 2, 3, 3, 3, 4, 4, 4, 3, 4 และ 4 ตามลำดับ |
| Mob drops | Rotten Flesh, Bone, Arrow, String, Spider Eye, Gunpowder, Ender Pearl, Slimeball, Phantom Membrane | ตาราง FoShop ใช้ 2, 3, 3, 4, 5, 8, 15, 10 และ 20 ตามลำดับ; Ender Pearl เดิมตรงตามรายงานจึงคงที่ 15 |
| แร่ | Coal, Raw Iron, Raw Copper, Raw Gold, Redstone, Lapis Lazuli, Diamond, Emerald | ตาราง FoShop ใช้ 3, 6, 4, 10, 5, 6, 80 และ 100 ตามลำดับ; Raw Ore ที่เพิ่มใหม่ปิดการซื้อด้วย `buy-price: -1` |

ค่าพิเศษที่มีความเสี่ยงด้าน supply ได้แก่ Diamond 80 และ Emerald 100 ถูกใช้ตามรายการที่ผู้ใช้แจ้ง แต่ต้องติดตามยอดขาย เงินรวม และแหล่งรางวัล/ลังตามรอบ 7, 14 และ 30 วันก่อนปรับรอบต่อไป.

## การกระทบยอดคำสั่ง `/worth`

ได้แทนที่ Skript `/worth` เดิมด้วย GUI ที่แสดงเฉพาะ 79 รายการที่ FoShop เปิดรับซื้อจริง, เพิ่มหมวดไม้ และลดขอบเขต handler การคลิกให้ทำงานเฉพาะ inventory ชื่อ `| FoShop` เพื่อไม่ดัก GUI ของปลั๊กอินอื่น. จากนั้นโหลด `worth.sk` สำเร็จใน 71 ms โดยไม่มี syntax error.

ตาราง `/plugins/Essentials/worth.yml` ถูกแทนที่ด้วยรายการ 79 รายการชุดเดียวกัน เพื่อให้ `essentials:worth` ไม่เปิดเผยราคาเก่า EssentialsX 2.22.0 reload สำเร็จ. การตรวจสอบแบบ deterministic จาก snapshot ร้าน FoShop ที่ active ให้ผลว่า `worth.sk` และ `Essentials/worth.yml` มีรายการและราคาตรงกับ FoShop ครบ **79/79** ทั้งสองแหล่ง.

## ข้อจำกัดที่ยังต้องทดสอบ

การโหลด config และการเทียบตารางสำเร็จไม่ใช่หลักฐานธุรกรรมแบบ end-to-end. ต้องใช้บัญชีทดสอบที่เจ้าของควบคุมเพื่อบันทึกยอดเงิน/ไอเทมก่อนและหลัง แล้วทดสอบ `/sell` main hand, `/sell` ของที่ไม่มีราคา, `/sellall` แบบผสม, `/pay` และ Auction House listing/buy/cancel ก่อนสรุปว่าไม่เกิดของหาย เงินหาย หรือ duplication.

## References

[1]: https://raw.githubusercontent.com/Carrotlo/FoShop/main/src/main/java/me/foesio/foShop/model/ShopItem.java "FoShop ShopItem.java"
[2]: https://raw.githubusercontent.com/Carrotlo/FoShop/main/src/main/java/me/foesio/foShop/shop/ShopManager.java "FoShop ShopManager.java"
[3]: https://modrinth.com/plugin/foshop "FoShop on Modrinth"

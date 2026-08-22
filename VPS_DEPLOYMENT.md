# คู่มือการติดตั้งและรัน RitzSMP บน VPS ด้วย Docker Compose

เอกสารฉบับนี้จัดทำขึ้นเพื่อแนะนำขั้นตอนการติดตั้งและใช้งานระบบ **RitzSMP** (เว็บสโตร์, บอท Discord พร้อมระบบเพลงและ AI ภาษาไทย, และฐานข้อมูล MariaDB) บน VPS ของท่านด้วย **Docker Compose** อย่างสมบูรณ์และปลอดภัยในระดับ Production

---

## 1. ข้อกำหนดของระบบ (System Requirements)

- **OS:** Ubuntu 22.04 LTS หรือ Linux แพลตฟอร์มอื่นๆ ที่รองรับ Docker
- **RAM:** ขั้นต่ำ 1 GB (แนะนำ 2 GB ขึ้นไปหากรันบอทเพลงและผู้เล่นใช้งานพร้อมกันจำนวนมาก)
- **CPU:** 1 vCore ขึ้นไป
- **Software:** Docker (เวอร์ชัน 20.10+) และ Docker Compose (เวอร์ชัน 2.0+)

---

## 2. ขั้นตอนการติดตั้งบน VPS

### ขั้นตอนที่ 1: ติดตั้ง Docker และ Docker Compose บน VPS (ถ้ายังไม่ได้ติดตั้ง)
รันคำสั่งต่อไปนี้ใน Terminal ของ VPS:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl git -y

# ติดตั้ง Docker ทางการ
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# ตรวจสอบการติดตั้ง
docker --version
docker compose version
```

### ขั้นตอนที่ 2: โคลนหรืออัปโหลดไฟล์โปรเจกต์ RitzSMP ไปยัง VPS
นำไฟล์โปรเจกต์ทั้งหมด (รวมถึง `docker-compose.yml`, `Dockerfile`, และโฟลเดอร์แอปพลิเคชัน) ไปไว้บน VPS เช่นที่ `/home/ubuntu/ritz-smp-store`

### ขั้นตอนที่ 3: สร้างและตั้งค่าไฟล์ `.env`
คัดลอกไฟล์ `env.template` มาเป็น `.env` แล้วแก้ไขข้อมูลการเชื่อมต่อและความลับให้ถูกต้อง:
```bash
cp env.template .env
nano .env
```

ตารางอธิบายตัวแปรใน `.env`:

| ตัวแปร | คำอธิบาย | ตัวอย่างค่า |
| :--- | :--- | :--- |
| `DB_ROOT_PASSWORD` | รหัสผ่าน Root ของฐานข้อมูล MariaDB | `SuperSecureRootPass2026!` |
| `DB_NAME` | ชื่อฐานข้อมูล | `ritz_smp` |
| `DB_USER` | ชื่อผู้ใช้ฐานข้อมูล | `ritz_user` |
| `DB_PASSWORD` | รหัสผ่านผู้ใช้ฐานข้อมูล | `DbUserPass2026!` |
| `PORT` | พอร์ตสำหรับเข้าถึงเว็บสโตร์จากภายนอก | `3000` |
| `JWT_SECRET` | คีย์เข้ารหัสเซสชันความปลอดภัย | `RandomSecretStringHere` |
| `DISCORD_BOT_TOKEN` | Token ของบอท Discord | `MTUzOT...` |
| `DISCORD_GUILD_ID` | ID ของดิสคอร์ดเซิร์ฟเวอร์ | `123456789012345678` |
| `RCON_HOST` | ไอพีหรือโดเมนของเซิร์ฟเวอร์ Minecraft | `play.ritzsmp.me` |
| `RCON_PORT` | พอร์ต RCON ของเซิร์ฟเวอร์ Minecraft | `25575` |
| `RCON_PASSWORD` | รหัสผ่าน RCON | `YourRconPassword` |

---

## 3. การรันระบบด้วย Docker Compose

เมื่อตั้งค่า `.env` เรียบร้อยแล้ว ให้รันคำสั่งเปิดใช้งานระบบในโหมด Background (Detached):

```bash
docker compose up -d --build
```

ระบบจะทำการ:
1. สร้างฐานข้อมูล MariaDB และรัน Health Check จนกว่าพร้อมใช้งาน
2. Build Docker Image ของแอปพลิเคชัน RitzSMP (เว็บ + บอท Discord)
3. เชื่อมต่อเครือข่ายภายใน (`ritz_net`) และผูกพอร์ต 3000 ออกสู่ภายนอก

หากต้องการตรวจสอบสถานะการทำงานของคอนเทนเนอร์:
```bash
docker compose ps
```

หากต้องการดู Log แบบเรียลไทม์:
```bash
docker compose logs -f app
```

---

## 4. การสำรองข้อมูลฐานข้อมูลอัตโนมัติ (Backup)

ในโปรเจกต์ได้เตรียมสคริปต์สำรองข้อมูล `backup.sh` ไว้ให้แล้ว ท่านสามารถตั้งค่า Cronjob บน VPS เพื่อให้ระบบแบ็คอัพฐานข้อมูลอัตโนมัติทุกวัน:

1. เปิด Crontab:
   ```bash
   crontab -e
   ```
2. เพิ่มบรรทัดนี้เพื่อให้รันแบ็คอัพทุกวันเวลาตี 3:
   ```bash
   0 3 * * * /bin/bash /home/ubuntu/ritz-smp-store/backup.sh >/dev/null 2>&1
   ```

---

## 5. การอัปเดตระบบเมื่อมีเวอร์ชันใหม่

เมื่อมีการแก้ไขโค้ดหรือต้องการอัปเดตเวอร์ชันบน VPS สามารถทำได้ง่ายๆ ด้วยคำสั่ง:
```bash
git pull origin main
docker compose down
docker compose up -d --build
```

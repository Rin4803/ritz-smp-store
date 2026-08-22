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

| ตัวแปร              | คำอธิบาย                              | ตัวอย่างค่า                |
| :------------------ | :------------------------------------ | :------------------------- |
| `DB_ROOT_PASSWORD`  | รหัสผ่าน Root ของฐานข้อมูล MariaDB    | `SuperSecureRootPass2026!` |
| `DB_NAME`           | ชื่อฐานข้อมูล                         | `ritz_smp`                 |
| `DB_USER`           | ชื่อผู้ใช้ฐานข้อมูล                   | `ritz_user`                |
| `DB_PASSWORD`       | รหัสผ่านผู้ใช้ฐานข้อมูล               | `DbUserPass2026!`          |
| `PORT`              | พอร์ตสำหรับเข้าถึงเว็บสโตร์จากภายนอก  | `3000`                     |
| `JWT_SECRET`        | คีย์เข้ารหัสเซสชันความปลอดภัย         | `RandomSecretStringHere`   |
| `DISCORD_BOT_TOKEN` | Token ของบอท Discord                  | `MTUzOT...`                |
| `DISCORD_GUILD_ID`  | ID ของดิสคอร์ดเซิร์ฟเวอร์             | `123456789012345678`       |
| `RCON_HOST`         | ไอพีหรือโดเมนของเซิร์ฟเวอร์ Minecraft | `play.ritzsmp.me`          |
| `RCON_PORT`         | พอร์ต RCON ของเซิร์ฟเวอร์ Minecraft   | `25575`                    |
| `RCON_PASSWORD`     | รหัสผ่าน RCON                         | `YourRconPassword`         |

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

---

## 6. การตั้งค่าระบบเพลงบน VPS

อิมเมจ production ติดตั้ง **FFmpeg**, **Python 3**, และ **yt-dlp พร้อมชุด `yt-dlp-ejs`** ให้โดยอัตโนมัติ ระบบเพลงใช้เส้นทาง `yt-dlp -> FFmpeg -> PCM -> Discord` จึงไม่พึ่งการถอดรหัสเสียงของไลบรารีฝั่ง Node และไม่มี fallback ที่ส่งเสียงเงียบค้างไว้ หากดึงเสียงไม่ได้ บอทจะแจ้งข้อผิดพลาดและหยุดแทร็กนั้นแทน การทดสอบใน sandbox ยืนยันแล้วว่า FFmpeg แปลงสตรีมจำลองเป็น PCM ที่มีข้อมูลเสียงจริงได้ แต่ไม่สามารถยืนยันเสียงจาก YouTube หรือ Discord voice ใน sandbox แทน VPS ได้

ก่อนเริ่มระบบ ให้ตรวจว่าไฟล์ Compose และตัวแปรสำคัญถูกอ่านได้ครบ:

```bash
cd /home/ubuntu/ritz-smp-store
mkdir -p secrets
chmod 700 secrets
docker compose config >/tmp/ritz-compose-resolved.yml
```

หาก VPS ยังได้รับข้อความ YouTube ให้ลงชื่อเข้าใช้หรือยืนยันว่าไม่ใช่บอท ให้ส่งออก cookies จากเบราว์เซอร์เป็นไฟล์ Netscape format แล้วคัดลอกไว้ที่ `secrets/youtube-cookies.txt` บน VPS เท่านั้น จากนั้นตั้งค่าใน `.env` ดังนี้:

```dotenv
YTDLP_COOKIES_PATH=/run/ritz-secrets/youtube-cookies.txt
```

ห้าม commit หรือส่งไฟล์ cookies เข้า Git และห้ามโพสต์ไฟล์นี้ใน Discord เพราะมีข้อมูลเซสชันของบัญชี ควรใช้บัญชี YouTube แยกสำหรับบอทและจำกัดสิทธิ์ของไฟล์:

```bash
chmod 600 secrets/youtube-cookies.txt
docker compose up -d --build
```

ตรวจสอบว่า dependency เสียงอยู่ในคอนเทนเนอร์จริง:

```bash
docker compose exec app ffmpeg -version
docker compose exec app yt-dlp --version
docker compose logs -f app
```

เมื่อต้องการทดสอบ ให้เข้าห้องเสียงเดียวกับบอทแล้วใช้ `/play query:<ลิงก์ YouTube>` จากนั้นตรวจ log ว่าพบข้อความ `AudioPlayer playing decoded PCM` และให้ผู้ฟังยืนยันว่าได้ยินเสียงจริง หากพบ `yt-dlp stream failed`, `FFmpeg stream failed`, `429` หรือ `Sign in to confirm` ให้แก้ที่ IP/คุกกี้/เครือข่ายของ VPS ก่อน ไม่ควรถือว่าระบบเล่นเพลงสำเร็จเพียงเพราะสถานะ Discord เปลี่ยนเป็น Playing

ลำดับตรวจสอบที่แนะนำบน VPS:

```bash
# ตรวจ binary และเวอร์ชันใน container

docker compose exec app sh -lc 'command -v ffmpeg && ffmpeg -version | head -1'
docker compose exec app sh -lc 'command -v yt-dlp && yt-dlp --version'

# ดูเฉพาะ log ที่เกี่ยวกับเสียงระหว่างการทดสอบ

docker compose logs --since=2m -f app | grep -Ei 'Music|yt-dlp|FFmpeg|AudioPlayer|VoiceConnection'
```

เมื่อทดสอบสำเร็จควรเห็นทั้ง log `AudioPlayer playing decoded PCM` และมีผู้ฟังยืนยันว่าได้ยินเสียง หากยังเห็นเพียงสถานะ Playing แต่ไม่มีเสียง ให้ตรวจ outbound UDP ของ VPS, firewall/security group และ region/IP ที่ YouTube อนุญาต ก่อนเปลี่ยนโค้ดเพิ่ม

> หมายเหตุ: การรันบน sandbox หรือ Autoscale อาจยังถูกจำกัดด้วย YouTube anti-bot และ UDP voice discovery ได้ การยืนยันเสียงจริงควรทำบน VPS ที่เปิด outbound UDP และมี IP ที่ YouTube ไม่บล็อก

## 7. คำสั่งตรวจสอบและอัปเดตที่แนะนำ

```bash
# ดูสถานะและ health check
docker compose ps

# ดูเฉพาะ log เพลง
docker compose logs --since=10m app | grep -Ei 'Music|yt-dlp|FFmpeg|VoiceConnection|AudioPlayer'

# อัปเดต image หลังแก้โค้ด
git pull origin main
docker compose up -d --build --remove-orphans

# หยุดระบบโดยไม่ลบ volume ฐานข้อมูล
docker compose down
```

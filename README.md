# 🏀 3×3 Basketball Tournament System v2

ระบบจัดการแข่งขันบาสเกตบอล 3×3 รองรับหลายสนาม หลายรุ่น

---

## 📁 โครงสร้างโปรเจค

```
b3x3/
├── server/
│   ├── server.js       ← Node.js + Socket.io
│   ├── package.json
│   └── .env
└── client/
    ├── public/
    │   ├── _redirects  ← Netlify SPA fix
    │   ├── logo.png    ← โลโก้ทัวร์นาเมนต์
    │   ├── horn.mp3    ← เสียงแตร
    │   ├── buzzer.mp3  ← เสียงบัซเซอร์
    │   └── photo/      ← รูปทีม (TEAM_NAME.jpg)
    ├── src/
    │   ├── pages/
    │   │   ├── HomePage.jsx       ← หน้าแรก
    │   │   ├── ScoreboardPage.jsx ← Operator
    │   │   ├── TvPage.jsx         ← 📺 หน้าจอทีวี (ใหม่!)
    │   │   ├── OverlayPage.jsx    ← OBS
    │   │   ├── TournamentPage.jsx ← ตาราง/ผล
    │   │   └── MonitorPage.jsx    ← ดูทุกสนาม
    │   └── components/
    ├── vercel.json    ← Vercel SPA fix
    ├── .env
    └── package.json
```

---

## 🚀 เริ่มต้น

### 1. ติดตั้ง Node.js v20+
https://nodejs.org

### 2. สร้าง Firebase Project
1. https://console.firebase.google.com → Add project
2. Build → Realtime Database → Create database → Test mode
3. Project Settings → Your apps → Web → ก็อปปี้ config
4. ใส่ config ใน `client/.env` (ตัวแปร `VITE_FIREBASE_*` ทั้งหมด — ดู `client/src/firebase.js`)
5. **ตั้งค่า Security Rules (สำคัญ — ห้ามข้าม):** เข้า Realtime Database → tab **Rules** → คัดลอกเนื้อหาจาก [`database.rules.json`](./database.rules.json) ในโปรเจกต์นี้ไปวางแทนที่ทั้งหมด → **Publish** โดยไม่ทำขั้นตอนนี้ ฐานข้อมูลจะยังอยู่ใน "Test mode" ซึ่งใครก็ได้ที่รู้ URL แก้/ลบข้อมูลทั้งหมดได้โดยไม่ต้องผ่านรหัสผ่าน Admin เลย
6. **ตั้งค่า Service Account สำหรับ Server:** Project Settings → **Service Accounts** → **Generate new private key** (ดาวน์โหลดไฟล์ JSON) → เก็บค่า `project_id`, `client_email`, `private_key` ไว้ใช้เป็น environment variables ของ **Server** (ดูหัวข้อ Deploy ด้านล่าง) — ไฟล์นี้เป็นความลับ **ห้าม commit เข้า git**

### 3. รัน Server
```bash
cd server
npm install
npm start
```

### 4. รัน Client
```bash
cd client
npm install
npm run dev
```

---

## 🌐 URL

| หน้า | URL |
|------|-----|
| หน้าแรก | `/` |
| Operator | `/scoreboard?court=A&division=open` |
| 📺 TV Display | `/tv?court=A` |
| OBS Overlay | `/overlay?court=A` |
| Tournament | `/tournament?division=open` |
| Monitor | `/monitor` |

---

## 📺 ตั้งค่าหน้า TV

เปิดบน Chrome/Browser แล้ว:
- กด **F11** เพื่อ Full Screen
- หรือกด **F11 + Ctrl+Shift+F** บาง browser

สลับสนามและรุ่นได้จาก Tab bar บนหน้า

---

## 🎥 ตั้งค่า OBS

1. Add **Browser Source**
2. URL: `http://localhost:5173/overlay?court=A`
3. Width: **1920**, Height: **1080**
4. ✅ Allow Transparency

---

## 🚀 Deploy

### แก้ 404 (สำคัญ!)
ไฟล์ fix มาให้แล้ว:
- **Netlify**: `client/public/_redirects` (จะ copy ไป `dist/` อัตโนมัติ)
- **Vercel**: `client/vercel.json`

### Netlify
```bash
cd client && npm run build
# Drag & drop โฟลเดอร์ dist/ ที่ netlify.com/drop
```

### Vercel
```bash
cd client
npx vercel --prod
```

### Server (Railway / Render)
```bash
# Environment variables (พื้นฐาน — ระบบทำงานได้แม้ไม่ตั้งค่าส่วนถัดไป):
PORT=3001
CORS_ORIGIN=https://your-client.vercel.app
COURTS=A,B,C

# Environment variables (Firebase Admin — เปิดใช้ 2 อย่าง: (1) คะแนน/นาฬิกาไม่หายเมื่อ
# server restart/redeploy (2) หน้า Admin ของ Tournament ทำงานผ่าน server แทนการเขียน
# Firebase ตรงจาก browser — ถ้าไม่ตั้งค่าพวกนี้ ระบบจะ fallback เป็นแบบเดิม คือเก็บ
# คะแนนใน memory อย่างเดียว และ tab "จัดการทีม" จะใช้งานไม่ได้):
FIREBASE_PROJECT_ID=xxx        # จาก service account JSON: project_id
FIREBASE_CLIENT_EMAIL=xxx      # จาก service account JSON: client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
                                # จาก service account JSON: private_key (คัดลอกทั้งก้อนรวม \n)
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
                                # จาก Realtime Database → ที่อยู่ URL ด้านบนสุดของหน้า

# Environment variable (รหัสผ่าน Admin ของหน้า Tournament — ย้ายมาอยู่ฝั่ง server
# แล้ว ไม่ได้ฝังอยู่ใน client bundle เหมือนเดิม ตั้งรหัสของจริงแทน default นี้ด้วย):
ADMIN_PASSWORD=เปลี่ยนเป็นรหัสผ่านจริง
```

⚠️ **`VITE_ADMIN_PASS` (ฝั่ง client) เลิกใช้แล้ว** — ลบออกจาก environment variables ของ Vercel ได้เลย รหัสผ่าน Admin ตอนนี้ตรวจสอบที่ server เท่านั้น (ตัวแปร `ADMIN_PASSWORD` ด้านบน)

---

## ⚙️ ปรับรุ่น/สนาม/ทีม

- **สนาม/รุ่นการแข่งขัน**: แก้ไขที่ `client/src/constants.js` (`COURTS`, `DIVISIONS`)
- **ทัวร์นาเมนต์ (แบบ FIBA)**: หน้าแรก → กล่อง **Tournament Admin** (หรือ `/tournament?admin=1`) → ล็อกอินด้วย `ADMIN_PASSWORD` → แท็บ ⚙️ Admin ทำตามลำดับ: 🏷️ รุ่น → 👥 ทีม + นักกีฬา (ชื่อ ชื่อย่อ สี โลโก้ roster) → 🎲 แบ่งสาย (จับโถ / snake / เลือกเอง) → 📅 ตารางแข่ง (จัดเวลา+สนามอัตโนมัติ แก้รายเกมได้). ตารางคะแนนใช้กติกา FIBA 3x3 (ชนะ → ผลที่เจอกัน → แต้มเฉลี่ย)
- **Scoreboard ↔ ทัวร์นาเมนต์**: ในหน้า Scoreboard กด **📋 โหลดเกม** → เลือกเกม → server รีเซ็ตกระดาน ดึงชื่อ/สีทีมจากทัวร์นาเมนต์ และส่งคะแนนกลับเข้าเกมนั้นอัตโนมัติ → กด **🏁 จบการแข่งขัน** ผลเข้าตารางคะแนน/สาย Knockout ทันที (ข้อมูลทัวร์นาเมนต์เขียนผ่าน server เท่านั้น ต้องตั้งค่า Firebase Admin ก่อน)

---

## 🎵 ไฟล์เสียงและรูป

วางใน `client/public/`:
- `horn.mp3` — เสียงแตร (timeout / horn)
- `buzzer.mp3` — เสียงหมดเวลา
- `photo/TEAM_NAME.jpg` — รูปทีม (ชื่อไฟล์ = ชื่อทีม แทน space ด้วย `_`)

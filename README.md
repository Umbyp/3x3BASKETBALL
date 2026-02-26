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
4. ใส่ config ใน `client/.env`

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
# Environment variables:
PORT=3001
CORS_ORIGIN=https://your-client.vercel.app
COURTS=A,B,C
```

---

## ⚙️ ปรับรุ่น/สนาม/ทีม

แก้ไขที่ `client/src/constants.js` ไฟล์เดียว

---

## 🎵 ไฟล์เสียงและรูป

วางใน `client/public/`:
- `horn.mp3` — เสียงแตร (timeout / horn)
- `buzzer.mp3` — เสียงหมดเวลา
- `photo/TEAM_NAME.jpg` — รูปทีม (ชื่อไฟล์ = ชื่อทีม แทน space ด้วย `_`)

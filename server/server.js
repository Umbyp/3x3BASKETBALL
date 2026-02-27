/**
 * 🏀 3x3 Basketball Scoreboard Server (v2)
 *
 * Fixes vs v1:
 *  - Clock drift: ใช้ Date.now() reference แทน setInterval ลบ 1 ทุก tick
 *  - Throttled broadcast: master loop 10Hz + dirty flag
 *  - try/catch ทุก action
 *  - CORS รองรับหลาย origin
 *  - Input validation ทุก field
 *  - Graceful shutdown
 */
require("dotenv").config();

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");

// ── Config ─────────────────────────────────────────────────────────────────────
const PORT      = parseInt(process.env.PORT || "3001", 10);
const COURT_IDS = (process.env.COURTS || "A,B,C").split(",").map(s => s.trim()).filter(Boolean);
const allowedOrigins = (process.env.CORS_ORIGIN || "https://3x3basketballbangmod.vercel.app")
  .split(",").map(s => s.trim());

// กติกา 3x3 FIBA
const SHOT_DEFAULT = 120;   // 12 วิ (tenths)
const GAME_DEFAULT = 6000;  // 10 นาที (tenths)
const OT_DEFAULT   = 3000;  // OT 5 นาที
const WIN_SCORE    = 21;
const MAX_TO       = 1;

// ── Express + Socket.io ────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const corsOpts = {
  origin: true, // อนุญาตทุก origin ที่ส่งคำขอมา (ยืดหยุ่นที่สุดสำหรับ Socket.io)
  methods: ["GET", "POST"],
  credentials: true
};
app.use(cors(corsOpts));
const io = new Server(server, { cors: corsOpts, pingTimeout: 20000, pingInterval: 10000 });

app.get("/health", (_req, res) =>
  res.json({ ok: true, courts: COURT_IDS, uptime: Math.floor(process.uptime()), clients: io.engine.clientsCount })
);

// ── State factory ──────────────────────────────────────────────────────────────
function mkState(courtId) {
  return {
    courtId,
    teamA: { name: "HOME", score: 0, teamFouls: 0, timeouts: MAX_TO, color: "#FF6B35" },
    teamB: { name: "AWAY", score: 0, teamFouls: 0, timeouts: MAX_TO, color: "#00D4FF" },
    clockTenths: GAME_DEFAULT, isRunning: false,
    shotClockTenths: SHOT_DEFAULT, shotRunning: false,
    possession: null, jumpBall: false,
    gameOver: false, winner: null, isOvertime: false,
  };
}

// ── Storage ────────────────────────────────────────────────────────────────────
const states  = {};  // gameState per court
const gcMeta  = {};  // gameClock reference { startAt, startTenths }
const scMeta  = {};  // shotClock reference
const dirty   = {};  // broadcast flag

COURT_IDS.forEach(id => {
  states[id] = mkState(id);
  gcMeta[id] = null;
  scMeta[id] = null;
  dirty[id]  = false;
});

// ── Broadcast ──────────────────────────────────────────────────────────────────
// คำนวณเวลาจาก elapsed ณ ขณะส่ง (แม่นยำกว่าอ่านจาก state โดยตรง)
function broadcast(cid) {
  const s = states[cid];
  if (!s) return;
  const now = Date.now();
  const p   = { ...s };
  if (s.isRunning   && gcMeta[cid]) p.clockTenths     = Math.max(0, gcMeta[cid].startTenths - Math.floor((now - gcMeta[cid].startAt) / 100));
  if (s.shotRunning && scMeta[cid]) p.shotClockTenths = Math.max(0, scMeta[cid].startTenths - Math.floor((now - scMeta[cid].startAt) / 100));
  io.to(`court:${cid}`).emit("stateUpdate", p);
}

// ── Master loop 10 Hz ──────────────────────────────────────────────────────────
const masterLoop = setInterval(() => {
  const now = Date.now();
  COURT_IDS.forEach(cid => {
    const s = states[cid];
    if (!s) return;
    let changed = dirty[cid];

    if (s.isRunning && gcMeta[cid]) {
      const rem = gcMeta[cid].startTenths - Math.floor((now - gcMeta[cid].startAt) / 100);
      if (rem <= 0) {
        s.clockTenths = 0; s.isRunning = false; gcMeta[cid] = null;
        stopShot(cid, s, now); changed = true;
      }
    }
    if (s.shotRunning && scMeta[cid]) {
      const rem = scMeta[cid].startTenths - Math.floor((now - scMeta[cid].startAt) / 100);
      if (rem <= 0) {
        s.shotClockTenths = 0; s.shotRunning = false; scMeta[cid] = null; changed = true;
      }
    }
    if (changed || s.isRunning || s.shotRunning) { broadcast(cid); dirty[cid] = false; }
  });
}, 100);

// Monitor 2 Hz
const monitorLoop = setInterval(() => {
  const room = io.sockets.adapter.rooms.get("monitor");
  if (!room || !room.size) return;
  const now = Date.now();
  const snap = {};
  COURT_IDS.forEach(cid => {
    const s = states[cid]; if (!s) return;
    snap[cid] = { ...s };
    if (s.isRunning   && gcMeta[cid]) snap[cid].clockTenths     = Math.max(0, gcMeta[cid].startTenths - Math.floor((now - gcMeta[cid].startAt) / 100));
    if (s.shotRunning && scMeta[cid]) snap[cid].shotClockTenths = Math.max(0, scMeta[cid].startTenths - Math.floor((now - scMeta[cid].startAt) / 100));
  });
  io.to("monitor").emit("allStates", snap);
}, 500);

// ── Clock helpers ──────────────────────────────────────────────────────────────
function startGame(cid, s) { if (s.isRunning || s.clockTenths <= 0) return; s.isRunning = true; gcMeta[cid] = { startAt: Date.now(), startTenths: s.clockTenths }; }
function stopGame(cid, s, now = Date.now()) {
  if (!s.isRunning) return;
  if (gcMeta[cid]) s.clockTenths = Math.max(0, gcMeta[cid].startTenths - Math.floor((now - gcMeta[cid].startAt) / 100));
  s.isRunning = false; gcMeta[cid] = null;
}
function startShot(cid, s) { if (s.shotRunning || s.shotClockTenths <= 0) return; s.shotRunning = true; scMeta[cid] = { startAt: Date.now(), startTenths: s.shotClockTenths }; }
function stopShot(cid, s, now = Date.now()) {
  if (!s.shotRunning) return;
  if (scMeta[cid]) s.shotClockTenths = Math.max(0, scMeta[cid].startTenths - Math.floor((now - scMeta[cid].startAt) / 100));
  s.shotRunning = false; scMeta[cid] = null;
}

function checkWin(cid) {
  const s = states[cid]; if (s.gameOver) return;
  const w = s.teamA.score >= WIN_SCORE ? "teamA" : s.teamB.score >= WIN_SCORE ? "teamB" : null;
  if (w) { s.gameOver = true; s.winner = w; stopGame(cid, s); stopShot(cid, s); }
}

// ── Input helpers ──────────────────────────────────────────────────────────────
const isTeam  = t  => t === "teamA" || t === "teamB";
const isColor = c  => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c);
const toInt   = v  => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
const clamp   = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ── Action handler ─────────────────────────────────────────────────────────────
function handleAction(cid, { type, team, value }) {
  const s = states[cid]; if (!s) return;
  try {
    switch (type) {
      case "score": {
        if (!isTeam(team)) throw new Error(`bad team "${team}"`);
        const d = clamp(toInt(value), -50, 50); if (!d) break;
        if (s.gameOver && d > 0) break;
        s[team].score = Math.max(0, s[team].score + d);
        if (d > 0) { stopShot(cid, s); s.shotClockTenths = SHOT_DEFAULT; }
        checkWin(cid); break;
      }
      case "clockToggle":   if (!s.gameOver) { s.isRunning ? stopGame(cid, s) : startGame(cid, s); } break;
      case "clockReset":    stopGame(cid, s); s.clockTenths = GAME_DEFAULT; s.gameOver = false; s.winner = null; s.isOvertime = false; break;
      case "clockAdjust": {
        const d = clamp(toInt(value), -36000, 36000);
        if (s.isRunning && gcMeta[cid]) gcMeta[cid].startTenths = Math.max(0, gcMeta[cid].startTenths + d);
        s.clockTenths = Math.max(0, s.clockTenths + d); break;
      }
      case "clockSet":      stopGame(cid, s); s.clockTenths = Math.max(0, toInt(value) * 10); break;
      case "shotClockToggle": s.shotRunning ? stopShot(cid, s) : startShot(cid, s); break;
      case "shotClockSet":  stopShot(cid, s); s.shotClockTenths = Math.max(0, clamp(toInt(value ?? 12), 0, 60) * 10); break;
      case "shotClockAdjust": {
        const d = clamp(toInt(value), -120, 120);
        if (s.shotRunning && scMeta[cid]) scMeta[cid].startTenths = Math.max(0, scMeta[cid].startTenths + d);
        s.shotClockTenths = Math.max(0, s.shotClockTenths + d); break;
      }
      case "teamFoul":      if (!isTeam(team)) throw new Error(`bad team`); s[team].teamFouls = Math.max(0, s[team].teamFouls + clamp(toInt(value), -10, 10)); break;
      case "teamFoulReset": isTeam(team) ? (s[team].teamFouls = 0) : (s.teamA.teamFouls = s.teamB.teamFouls = 0); break;
      case "timeout":       if (!isTeam(team)) throw new Error(`bad team`); s[team].timeouts = clamp(s[team].timeouts + clamp(toInt(value), -5, 5), 0, MAX_TO); break;
      case "possession":    s.possession = isTeam(value) ? value : null; s.jumpBall = false; break;
      case "jumpBall":      s.jumpBall = !s.jumpBall; s.possession = null; break;
      case "teamName":      if (!isTeam(team)) throw new Error(`bad team`); s[team].name = String(value||"").slice(0,24).toUpperCase().trim()||"TEAM"; break;
      case "teamColor":     if (!isTeam(team)||!isColor(value)) throw new Error(`bad color`); s[team].color = value; break;
      case "startOvertime": stopGame(cid,s); stopShot(cid,s); s.gameOver=false; s.winner=null; s.isOvertime=true; s.clockTenths=OT_DEFAULT; s.shotClockTenths=SHOT_DEFAULT; break;
      case "resetGame": {
        stopGame(cid,s); stopShot(cid,s);
        const f = mkState(cid); f.teamA.name=s.teamA.name; f.teamA.color=s.teamA.color; f.teamB.name=s.teamB.name; f.teamB.color=s.teamB.color;
        states[cid]=f; gcMeta[cid]=null; scMeta[cid]=null; broadcast(cid); return;
      }
      case "fullReset":     stopGame(cid,s); stopShot(cid,s); states[cid]=mkState(cid); gcMeta[cid]=null; scMeta[cid]=null; broadcast(cid); return;
      default:              console.warn(`[?] unknown action "${type}"`); return;
    }
  } catch (err) { console.error(`[!] action error court=${cid} type=${type}:`, err.message); return; }
  dirty[cid] = true;
}

// ── Socket events ──────────────────────────────────────────────────────────────
io.on("connection", socket => {
  console.log(`[+] ${socket.id}`);

  socket.on("joinCourt", rawId => {
    const cid = String(rawId||"").trim().toUpperCase();
    if (!COURT_IDS.includes(cid)) { socket.emit("serverError",{message:`Court "${cid}" not found`}); return; }
    [...socket.rooms].filter(r=>r.startsWith("court:")).forEach(r=>socket.leave(r));
    socket.join(`court:${cid}`);
    console.log(`[~] ${socket.id} → court:${cid}`);
    broadcast(cid);
  });

  socket.on("action", payload => {
    if (!payload||typeof payload!=="object"||Array.isArray(payload)) return;
    const cid = String(payload.courtId||"").trim().toUpperCase();
    if (!states[cid]) { console.warn(`[?] bad courtId "${payload.courtId}"`); return; }
    handleAction(cid, payload);
  });

  socket.on("joinMonitor", () => { socket.join("monitor"); socket.emit("allStates", states); });
  socket.on("getAllStates", () => socket.emit("allStates", states));
  socket.on("disconnect",   r  => console.log(`[-] ${socket.id} (${r})`));
  socket.on("error",        e  => console.error(`[!] socket:`, e.message));
});

// ── Start ──────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🏀  3x3 Server (v2)`);
  console.log(`    Port   : ${PORT}`);
  console.log(`    Courts : ${COURT_IDS.join(", ")}`);
  console.log(`    CORS   : ${allowedOrigins.join(", ")}\n`);
});

function shutdown(sig) {
  console.log(`\n[${sig}] shutting down...`);
  clearInterval(masterLoop); clearInterval(monitorLoop);
  io.close();
  server.close(() => { console.log("done."); process.exit(0); });
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

/**
 * 🏀 3x3 Basketball Scoreboard Server (v3)
 *
 * Fixes vs v1:
 *  - Clock drift: ใช้ Date.now() reference แทน setInterval ลบ 1 ทุก tick
 *  - Throttled broadcast: master loop 10Hz + dirty flag
 *  - try/catch ทุก action
 *  - CORS รองรับหลาย origin
 *  - Input validation ทุก field
 *  - Graceful shutdown
 *
 * v3 additions:
 *  - Court state persisted to Firebase (court_live/{courtId}) so a
 *    restart/redeploy doesn't wipe every in-progress game — optional,
 *    degrades gracefully to in-memory-only if Firebase Admin isn't
 *    configured (see firebaseAdmin.js).
 *  - Tournament admin actions (team/group edits, bracket regenerate,
 *    schedule delay) moved server-side behind a password-gated session
 *    token, instead of the client writing directly to Firebase with a
 *    password check baked into the browser bundle.
 */
import "dotenv/config";

import express    from "express";
import http       from "http";
import { Server } from "socket.io";
import cors       from "cors";

import { db as adminDb, loadCourtState, saveCourtState } from "./firebaseAdmin.js";
import { checkPassword, issueToken, verifyToken, checkRateLimit } from "./adminAuth.js";
import { DEFAULT_TEAMS, DIVISIONS, generateGroupMatches } from "../client/src/constants.js";
import { generateKoBracket } from "../client/src/lib/bracketGen.js";

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
const HISTORY_MAX  = 30;

// ── Express + Socket.io ────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const corsOpts = {
  origin: true, // อนุญาตทุก origin ที่ส่งคำขอมา (ยืดหยุ่นที่สุดสำหรับ Socket.io)
  methods: ["GET", "POST"],
  credentials: true
};
app.use(cors(corsOpts));
app.use(express.json());
const io = new Server(server, { cors: corsOpts, pingTimeout: 20000, pingInterval: 10000 });

app.get("/health", (_req, res) =>
  res.json({ ok: true, courts: COURT_IDS, uptime: Math.floor(process.uptime()), clients: io.engine.clientsCount, persistence: !!adminDb })
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
    showShotClock: true, // display setting for TV/overlay — not part of undo snapshots
  };
}

// ── Storage ────────────────────────────────────────────────────────────────────
const states     = {};  // gameState per court
const gcMeta     = {};  // gameClock reference { startAt, startTenths }
const scMeta     = {};  // shotClock reference
const dirty      = {};  // broadcast flag
const saveTimers = {};  // debounced persistence timers per court
const history    = {};  // undo stack per court: [{ id, label, color, atTenths, snap }, ...] newest-first
const historySeq = {};  // per-court incrementing id counter

COURT_IDS.forEach(id => {
  states[id]     = mkState(id);
  gcMeta[id]     = null;
  scMeta[id]     = null;
  dirty[id]      = false;
  history[id]    = [];
  historySeq[id] = 0;
});

// Load any persisted state (Firebase Admin only — no-op otherwise). A
// restored clock always comes back paused: silently "catching up" the
// time that elapsed while the server was down would be actively wrong.
async function loadPersistedState() {
  if (!adminDb) return;
  for (const cid of COURT_IDS) {
    const saved = await loadCourtState(cid);
    if (saved) {
      states[cid] = { ...mkState(cid), ...saved, isRunning: false, shotRunning: false };
      console.log(`[persist] restored court ${cid} from Firebase`);
    }
  }
}

function scheduleSave(cid) {
  if (!adminDb) return;
  clearTimeout(saveTimers[cid]);
  saveTimers[cid] = setTimeout(() => saveCourtState(cid, states[cid]), 2000);
}

function flushAllSaves() {
  if (!adminDb) return Promise.resolve();
  return Promise.all(COURT_IDS.map(cid => {
    clearTimeout(saveTimers[cid]);
    return saveCourtState(cid, states[cid]);
  }));
}

// ── Broadcast ──────────────────────────────────────────────────────────────────
// คำนวณเวลาจาก elapsed ณ ขณะส่ง (แม่นยำกว่าอ่านจาก state โดยตรง)
function broadcast(cid) {
  const s = states[cid];
  if (!s) return;
  const now = Date.now();
  const p   = { ...s };
  if (s.isRunning   && gcMeta[cid]) p.clockTenths     = Math.max(0, gcMeta[cid].startTenths - Math.floor((now - gcMeta[cid].startAt) / 100));
  if (s.shotRunning && scMeta[cid]) p.shotClockTenths = Math.max(0, scMeta[cid].startTenths - Math.floor((now - scMeta[cid].startAt) / 100));
  p.history = (history[cid]||[]).map(h => ({ id: h.id, label: h.label, color: h.color, atTenths: h.atTenths, removable: REVERSIBLE.has(h.type) }));
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

// Safety-net persistence flush — covers hard crashes where SIGTERM/SIGINT
// never fires (the debounced per-action save is the primary path).
const persistLoop = setInterval(() => { flushAllSaves(); }, 30000);

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

// ── Undo / history ─────────────────────────────────────────────────────────────
// Actions worth remembering on the undo stack. teamName/teamColor/fullReset are
// deliberately excluded — setup changes, not in-game corrections.
const UNDOABLE = new Set([
  "score","scoreCorrect","clockToggle","clockAdjust","shotClockToggle","shotClockSet","shotClockAdjust",
  "teamFoul","teamFoulReset","timeout","possession","jumpBall","resetGame",
]);

// Action types that are pure additive counters/clock nudges — safe to reverse
// in isolation by re-applying the negated value straight onto *current* state,
// regardless of what else has happened since. Toggle/set-style actions
// (clockToggle, shotClockSet, possession, jumpBall, resetGame, ...) aren't in
// this set: "undo just this one" has no safe meaning for them once anything
// later has touched the same field, so they stay undo-able only via the
// sequential UNDO button (oldest-in-first-out, restoring a full snapshot).
const REVERSIBLE = new Set(["score","scoreCorrect","teamFoul","timeout","clockAdjust","shotClockAdjust"]);

// Applies one of the REVERSIBLE mutations. Used both for the live action (see
// the switch in handleAction) and, with a negated value, to remove a single
// past history entry (see the "removeHistory" case) without touching
// anything that happened after it. "score" resets the shot clock (a made
// basket does that); "scoreCorrect" — used by the Settings stat-correction
// stepper and by removeHistory's inverse of a "score" entry — deliberately
// does not, since fixing a mis-recorded point total isn't a new possession.
function applyReversible(cid, s, type, team, value) {
  switch (type) {
    case "score": {
      const d = clamp(toInt(value), -50, 50); if (!d) return;
      if (s.gameOver && d > 0) return;
      s[team].score = Math.max(0, s[team].score + d);
      if (d > 0) { stopShot(cid, s); s.shotClockTenths = SHOT_DEFAULT; }
      checkWin(cid); return;
    }
    case "scoreCorrect": {
      const d = clamp(toInt(value), -50, 50); if (!d) return;
      s[team].score = Math.max(0, s[team].score + d);
      checkWin(cid); return;
    }
    case "teamFoul":
      s[team].teamFouls = Math.max(0, s[team].teamFouls + clamp(toInt(value), -10, 10)); return;
    case "timeout":
      s[team].timeouts = clamp(s[team].timeouts + clamp(toInt(value), -5, 5), 0, MAX_TO); return;
    case "clockAdjust": {
      const d = clamp(toInt(value), -36000, 36000);
      if (s.isRunning && gcMeta[cid]) gcMeta[cid].startTenths = Math.max(0, gcMeta[cid].startTenths + d);
      s.clockTenths = Math.max(0, s.clockTenths + d); return;
    }
    case "shotClockAdjust": {
      const d = clamp(toInt(value), -120, 120);
      if (s.shotRunning && scMeta[cid]) scMeta[cid].startTenths = clamp(scMeta[cid].startTenths + d, 0, SHOT_DEFAULT);
      s.shotClockTenths = clamp(s.shotClockTenths + d, 0, SHOT_DEFAULT); return;
    }
  }
}

// Keeps older history snapshots consistent after removeHistory splices an
// entry out — every entry *newer* than the removed one had already captured
// its effect, so subtract it back out of those snapshots too. Otherwise a
// later sequential UNDO that reaches back past this point would resurrect
// the removed value.
function adjustSnapshotField(snap, type, team, delta) {
  if (!snap) return;
  switch (type) {
    case "score": case "scoreCorrect": snap[team].score = Math.max(0, snap[team].score - delta); return;
    case "teamFoul":       snap[team].teamFouls = Math.max(0, snap[team].teamFouls - delta); return;
    case "timeout":        snap[team].timeouts = clamp(snap[team].timeouts - delta, 0, MAX_TO); return;
    case "clockAdjust":    snap.clockTenths = Math.max(0, snap.clockTenths - delta); return;
    case "shotClockAdjust":snap.shotClockTenths = clamp(snap.shotClockTenths - delta, 0, SHOT_DEFAULT); return;
  }
}

function liveClockTenths(cid, s) {
  return (s.isRunning && gcMeta[cid])
    ? Math.max(0, gcMeta[cid].startTenths - Math.floor((Date.now() - gcMeta[cid].startAt) / 100))
    : s.clockTenths;
}
function liveShotTenths(cid, s) {
  return (s.shotRunning && scMeta[cid])
    ? Math.max(0, scMeta[cid].startTenths - Math.floor((Date.now() - scMeta[cid].startAt) / 100))
    : s.shotClockTenths;
}

function snapshotState(cid, s) {
  return {
    teamA: { ...s.teamA }, teamB: { ...s.teamB },
    clockTenths: liveClockTenths(cid, s), isRunning: s.isRunning,
    shotClockTenths: liveShotTenths(cid, s), shotRunning: s.shotRunning,
    possession: s.possession, jumpBall: s.jumpBall,
    gameOver: s.gameOver, winner: s.winner, isOvertime: s.isOvertime,
  };
}

function restoreSnapshot(cid, snap) {
  const s = states[cid]; if (!s) return;
  s.teamA = { ...snap.teamA }; s.teamB = { ...snap.teamB };
  s.possession = snap.possession; s.jumpBall = snap.jumpBall;
  s.gameOver = snap.gameOver; s.winner = snap.winner; s.isOvertime = snap.isOvertime;

  s.clockTenths = snap.clockTenths; s.isRunning = false; gcMeta[cid] = null;
  if (snap.isRunning && s.clockTenths > 0) { s.isRunning = true; gcMeta[cid] = { startAt: Date.now(), startTenths: s.clockTenths }; }

  s.shotClockTenths = snap.shotClockTenths; s.shotRunning = false; scMeta[cid] = null;
  if (snap.shotRunning && s.shotClockTenths > 0) { s.shotRunning = true; scMeta[cid] = { startAt: Date.now(), startTenths: s.shotClockTenths }; }
}

function actionLabel(s, type, team, value) {
  const T = t => (s[t] && s[t].name) || (t === "teamA" ? "HOME" : "AWAY");
  switch (type) {
    case "score":           { const d = clamp(toInt(value), -50, 50); return `${T(team)} ${d > 0 ? "+" : ""}${d}`; }
    case "scoreCorrect":    { const d = clamp(toInt(value), -50, 50); return `${T(team)} แก้ ${d > 0 ? "+" : ""}${d}`; }
    case "clockToggle":     return s.isRunning ? "STOP" : "START";
    case "clockAdjust":     { const d = clamp(toInt(value), -36000, 36000), a = Math.abs(d);
                               const lab = a >= 600 ? `${a / 600}M` : a >= 100 ? `${a / 100}0S` : `${a / 10}S`;
                               return `GAME ${d > 0 ? "+" : "−"}${lab}`; }
    case "shotClockToggle": return s.shotRunning ? "SHOT HOLD" : "SHOT RUN";
    case "shotClockSet":    return `SHOT → ${clamp(toInt(value ?? 12), 0, 12)}`;
    case "shotClockAdjust": { const d = clamp(toInt(value), -120, 120); return `SHOT ${d > 0 ? "+" : "−"}${Math.abs(d) / 10}S`; }
    case "teamFoul":        { const d = clamp(toInt(value), -10, 10); return `${T(team)} FOUL ${d > 0 ? "+1" : "−1"}`; }
    case "teamFoulReset":   return isTeam(team) ? `${T(team)} FOULS CLEARED` : "FOULS CLEARED";
    case "timeout":         { const d = clamp(toInt(value), -5, 5); return d < 0 ? `${T(team)} TIMEOUT` : `${T(team)} T.O. +1`; }
    case "possession":      { const nv = isTeam(value) ? value : null; return `BALL → ${nv ? T(nv) : "—"}`; }
    case "jumpBall":        return "JUMP BALL";
    case "resetGame":       return "RESET GAME";
    default:                return type;
  }
}
function actionColor(s, type, team, value) {
  if (type === "jumpBall") return "#FFD700";
  if (type === "possession") { const nv = isTeam(value) ? value : null; return nv ? s[nv].color : "#8a91a6"; }
  if (isTeam(team)) return s[team].color;
  return "#8a91a6";
}

function pushHistory(cid, s, type, team, value) {
  const h = history[cid]; if (!h) return;
  h.unshift({
    id: ++historySeq[cid],
    type, team, value,
    label: actionLabel(s, type, team, value),
    color: actionColor(s, type, team, value),
    atTenths: liveClockTenths(cid, s),
    snap: snapshotState(cid, s),
  });
  if (h.length > HISTORY_MAX) h.length = HISTORY_MAX;
}

// ── Action handler ─────────────────────────────────────────────────────────────
function handleAction(cid, { type, team, value }) {
  const s = states[cid]; if (!s) return;
  try {
    if (UNDOABLE.has(type)) pushHistory(cid, s, type, team, value);
    switch (type) {
      case "score":
        if (!isTeam(team)) throw new Error(`bad team "${team}"`);
        applyReversible(cid, s, "score", team, value); break;
      case "scoreCorrect":
        if (!isTeam(team)) throw new Error(`bad team "${team}"`);
        applyReversible(cid, s, "scoreCorrect", team, value); break;
      case "clockToggle":   if (!s.gameOver) { s.isRunning ? stopGame(cid, s) : startGame(cid, s); } break;
      case "clockReset":    stopGame(cid, s); s.clockTenths = GAME_DEFAULT; s.gameOver = false; s.winner = null; s.isOvertime = false; break;
      case "clockAdjust":   applyReversible(cid, s, "clockAdjust", team, value); break;
      case "clockSet":      stopGame(cid, s); s.clockTenths = Math.max(0, toInt(value) * 10); break;
      case "shotClockToggle": s.shotRunning ? stopShot(cid, s) : startShot(cid, s); break;
      case "shotClockSet":  stopShot(cid, s); s.shotClockTenths = clamp(toInt(value ?? 12), 0, 12) * 10; break;
      case "shotClockAdjust": applyReversible(cid, s, "shotClockAdjust", team, value); break;
      case "teamFoul":      if (!isTeam(team)) throw new Error(`bad team`); applyReversible(cid, s, "teamFoul", team, value); break;
      case "teamFoulReset": isTeam(team) ? (s[team].teamFouls = 0) : (s.teamA.teamFouls = s.teamB.teamFouls = 0); break;
      case "timeout":       if (!isTeam(team)) throw new Error(`bad team`); applyReversible(cid, s, "timeout", team, value); break;
      case "possession":    s.possession = isTeam(value) ? value : null; s.jumpBall = false; break;
      case "jumpBall":      s.jumpBall = !s.jumpBall; s.possession = null; break;
      case "teamName":      if (!isTeam(team)) throw new Error(`bad team`); s[team].name = String(value||"").slice(0,24).toUpperCase().trim()||"TEAM"; break;
      case "shotClockVisible": s.showShotClock = value === true; break;
      case "teamColor":     if (!isTeam(team)||!isColor(value)) throw new Error(`bad color`); s[team].color = value; break;
      case "startOvertime": stopGame(cid,s); stopShot(cid,s); s.gameOver=false; s.winner=null; s.isOvertime=true; s.clockTenths=OT_DEFAULT; s.shotClockTenths=SHOT_DEFAULT; break;
      case "resetGame": {
        stopGame(cid,s); stopShot(cid,s);
        const f = mkState(cid); f.teamA.name=s.teamA.name; f.teamA.color=s.teamA.color; f.teamB.name=s.teamB.name; f.teamB.color=s.teamB.color; f.showShotClock=s.showShotClock;
        states[cid]=f; gcMeta[cid]=null; scMeta[cid]=null; broadcast(cid); dirty[cid]=true; scheduleSave(cid); return;
      }
      case "fullReset":     stopGame(cid,s); stopShot(cid,s); states[cid]=mkState(cid); gcMeta[cid]=null; scMeta[cid]=null; history[cid]=[]; broadcast(cid); dirty[cid]=true; scheduleSave(cid); return;
      case "undo": {
        const h = history[cid]; if (!h || !h.length) return;
        const entry = h.shift();
        restoreSnapshot(cid, entry.snap);
        break;
      }
      case "removeHistory": {
        const h = history[cid]; if (!h || !h.length) return;
        const idx = h.findIndex(e => e.id === toInt(value));
        if (idx === -1) return;
        const entry = h[idx];
        if (!REVERSIBLE.has(entry.type)) return;
        const invType = entry.type === "score" ? "scoreCorrect" : entry.type;
        applyReversible(cid, s, invType, entry.team, -entry.value);
        for (let k = 0; k < idx; k++) adjustSnapshotField(h[k].snap, entry.type, entry.team, entry.value);
        h.splice(idx, 1);
        break;
      }
      default:              console.warn(`[?] unknown action "${type}"`); return;
    }
  } catch (err) { console.error(`[!] action error court=${cid} type=${type}:`, err.message); return; }
  dirty[cid] = true;
  scheduleSave(cid);
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

// ── Admin API — tournament team/group edits, bracket regenerate, schedule ──────
// delay. Moved server-side so the password never ships in the client bundle,
// and so Firebase Security Rules can deny these structural writes to every
// client (authenticated or not) and only trust this server's Admin SDK.
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!verifyToken(token)) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.post("/admin/login", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) return res.status(429).json({ error: "too many attempts, try again later" });
  if (!checkPassword(req.body?.password)) return res.status(401).json({ error: "wrong password" });
  res.json({ token: issueToken() });
});

// ── Divisions (รุ่น) ───────────────────────────────────────────────────────────
// Stored at tournament_divisions as an ordered array; absent = built-in DIVISIONS.
const DIV_ID_RE = /^[a-z0-9_-]{1,24}$/;
async function loadDivisions() {
  const snap = await adminDb.ref("tournament_divisions").get();
  const v = snap.val();
  const list = Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {});
  return list.length ? list : DIVISIONS;
}

// Replaces the whole list. Divisions dropped from it also lose their
// tournament_data — the client confirms that with the admin first.
app.post("/admin/divisions", requireAdmin, async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: "tournament sync not configured" });
  const input = req.body?.divisions;
  if (!Array.isArray(input) || !input.length || input.length > 20) return res.status(400).json({ error: "bad divisions payload" });
  const seen = new Set(), divisions = [];
  for (const d of input) {
    if (!d || !DIV_ID_RE.test(d.id) || seen.has(d.id)) return res.status(400).json({ error: `bad division id "${d?.id}"` });
    const label = String(d.label || "").trim().slice(0, 24);
    if (!label) return res.status(400).json({ error: `division "${d.id}" needs a name` });
    seen.add(d.id);
    divisions.push({
      id: d.id, label,
      color: isColor(d.color) ? d.color : "#FF6B35",
      icon: String(d.icon || "🏀").slice(0, 4),
    });
  }
  try {
    const removed = (await loadDivisions()).map(d => d.id).filter(id => !seen.has(id));
    const updates = { tournament_divisions: divisions };
    removed.forEach(id => { updates[`tournament_data/${id}`] = null; });
    await adminDb.ref().update(updates);
    res.json({ ok: true, removed });
  } catch (err) {
    console.error("[!] divisions error:", err.message);
    res.status(500).json({ error: "internal error" });
  }
});

app.post("/admin/tournament/:division/ensure-seeded", async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: "tournament sync not configured" });
  const divId = req.params.division;
  try {
    // Unauthenticated, so only seed divisions that actually exist
    if (!(await loadDivisions()).some(d => d.id === divId)) return res.status(404).json({ error: "unknown division" });
    const ref = adminDb.ref(`tournament_data/${divId}`);
    const snap = await ref.get();
    if (!snap.exists()) {
      // Built-in divisions get the placeholder groups; new ones start empty
      // (delayMinutes keeps the node from being empty, which RTDB would drop)
      const teams = DEFAULT_TEAMS[divId] || {};
      await ref.set({
        teams, groupMatches: generateGroupMatches(teams),
        koMatches: generateKoBracket(teams), delayMinutes: 0,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[!] ensure-seeded error:", err.message);
    res.status(500).json({ error: "internal error" });
  }
});

app.post("/admin/tournament/:division/regenerate", requireAdmin, async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: "tournament sync not configured" });
  const divId = req.params.division;
  const teams = req.body?.teams;
  if (!teams || typeof teams !== "object" || Array.isArray(teams)) return res.status(400).json({ error: "bad teams payload" });
  for (const [g, ts] of Object.entries(teams)) {
    if (!Array.isArray(ts) || ts.some(t => typeof t !== "string")) return res.status(400).json({ error: `bad team list for group ${g}` });
  }
  // Optional: the full seeded registration list the groups were drawn from
  const registered = req.body?.registeredTeams;
  if (registered !== undefined && (!Array.isArray(registered) || registered.some(t => typeof t !== "string")))
    return res.status(400).json({ error: "bad registeredTeams" });
  try {
    const ref = adminDb.ref(`tournament_data/${divId}`);
    const snap = await ref.get();
    const prev = snap.exists() ? snap.val() : {};
    await ref.set({
      teams, groupMatches: generateGroupMatches(teams),
      koMatches: generateKoBracket(teams), delayMinutes: prev.delayMinutes ?? 0,
      registeredTeams: registered ?? prev.registeredTeams ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[!] regenerate error:", err.message);
    res.status(500).json({ error: "internal error" });
  }
});

// Saves the seeded team list without touching groups/matches
app.post("/admin/tournament/:division/registered", requireAdmin, async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: "tournament sync not configured" });
  const list = req.body?.registeredTeams;
  if (!Array.isArray(list) || list.length > 200 || list.some(t => typeof t !== "string")) return res.status(400).json({ error: "bad registeredTeams" });
  try {
    await adminDb.ref(`tournament_data/${req.params.division}/registeredTeams`).set(list.map(t => t.trim().slice(0, 40)).filter(Boolean));
    res.json({ ok: true });
  } catch (err) {
    console.error("[!] registered error:", err.message);
    res.status(500).json({ error: "internal error" });
  }
});

app.post("/admin/tournament/:division/delay", requireAdmin, async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: "tournament sync not configured" });
  const divId = req.params.division;
  const minutes = parseInt(req.body?.minutes, 10);
  if (isNaN(minutes) || minutes < 0) return res.status(400).json({ error: "bad minutes" });
  try {
    await adminDb.ref(`tournament_data/${divId}/delayMinutes`).set(minutes);
    res.json({ ok: true });
  } catch (err) {
    console.error("[!] delay error:", err.message);
    res.status(500).json({ error: "internal error" });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────
loadPersistedState().finally(() => {
  server.listen(PORT, () => {
    console.log(`\n🏀  3x3 Server (v3)`);
    console.log(`    Port   : ${PORT}`);
    console.log(`    Courts : ${COURT_IDS.join(", ")}`);
    console.log(`    CORS   : ${allowedOrigins.join(", ")}`);
    console.log(`    Persist: ${adminDb ? "Firebase (enabled)" : "in-memory only (disabled)"}\n`);
  });
});

function shutdown(sig) {
  console.log(`\n[${sig}] shutting down...`);
  clearInterval(masterLoop); clearInterval(monitorLoop); clearInterval(persistLoop);
  io.close();
  flushAllSaves().finally(() => {
    server.close(() => { console.log("done."); process.exit(0); });
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

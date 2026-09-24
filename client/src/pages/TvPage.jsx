/**
 * 📺 TvPage — หน้าจอโทรทัศน์
 * URL: /tv?court=A
 *
 * ออกแบบสำหรับแสดงบนจอ 1920×1080 Full HD
 * สไตล์กระดานคะแนนสนามจริง: กล่องเลขคะแนนขอบขาว พื้นหลังดำ สีใช้เท่าที่จำเป็น
 * (สีทีม + สีแดง/เหลืองสำหรับสถานะเตือน/นับถอยหลัง เท่านั้น)
 * - ไม่มีปุ่ม operator
 * - Theme [D]: เลือกธีมให้เหมาะกับสถานการณ์ (มืด/แดดจ้า/อารีน่า/พลบค่ำ)
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { socket } from "../socket.js";
import { COURTS, DIVISIONS } from "../constants.js";
import { useTheme, ThemeSwitcher } from "../theme.jsx";

function fmtClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 600) {
    const s = Math.floor(t / 10);
    return `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;
  }
  return `${String(Math.floor(t / 10)).padStart(2,"0")}.${t % 10}`;
}
function fmtShot(t) {
  t = Math.max(0, t);
  if (t > 120) return String(Math.ceil(t / 10));
  return `${Math.floor(t / 10)}.${t % 10}`;
}

const BEBAS = "'Bebas Neue',Impact,sans-serif";
const COND  = "'Barlow Condensed',sans-serif";

/* ─── Team name row ────────────────────────────────────────────────────────── */
function TeamName({ team, align, hasBall }) {
  const nl = team.name.length;
  const fs = nl <= 10 ? 66 : nl <= 16 ? 50 : 36;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8,
      alignItems: align === "left" ? "flex-start" : "flex-end" }}>
      <div style={{ height:26, display:"flex", alignItems:"center", gap:8,
        flexDirection: align === "left" ? "row" : "row-reverse" }}>
        {hasBall && (
          <span style={{ display:"flex", alignItems:"center", gap:8,
            flexDirection: align === "left" ? "row" : "row-reverse" }}>
            <span style={{ width:11, height:11, borderRadius:"50%", background: team.color,
              boxShadow:`0 0 10px ${team.color}` }}/>
            <span style={{ fontFamily:COND, fontSize:17, fontWeight:800, letterSpacing:"0.25em",
              color: team.color }}>BALL</span>
          </span>
        )}
      </div>
      <span style={{ fontFamily:BEBAS, fontSize:fs, lineHeight:1, color:"#FFF",
        letterSpacing:"0.03em", wordBreak:"break-word", textAlign: align }}>
        {team.name}
      </span>
    </div>
  );
}

/* ─── Score box ────────────────────────────────────────────────────────────── */
function ScoreBox({ team, theme }) {
  const D = (dim, bright) => (theme.highContrast ? bright : dim);
  return (
    <div style={{
      width:330, height:260, display:"flex", alignItems:"center", justifyContent:"center",
      border:`5px solid ${D("rgba(255,255,255,0.7)","#FFFFFF")}`, borderRadius:20,
      background:"rgba(0,0,0,0.3)", flexShrink:0,
    }}>
      <span style={{ fontFamily:BEBAS, fontSize:200, lineHeight:1, color:"#FFF" }}>
        {String(Math.max(0, team.score)).padStart(2,"0")}
      </span>
    </div>
  );
}

/* ─── Fouls box ────────────────────────────────────────────────────────────── */
function FoulsBox({ team, theme }) {
  const D = (dim, bright) => (theme.highContrast ? bright : dim);
  const bonus = team.teamFouls >= 6;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
      <span style={{ fontFamily:COND, fontSize:20, fontWeight:800, letterSpacing:"0.35em",
        color: bonus ? "#FF3333" : D("rgba(255,255,255,0.45)","rgba(255,255,255,0.85)") }}>
        FOULS{bonus ? " · BONUS" : ""}
      </span>
      <div style={{
        width:120, height:95, display:"flex", alignItems:"center", justifyContent:"center",
        border:`4px solid ${bonus ? "#FF3333" : D("rgba(255,255,255,0.55)","rgba(255,255,255,0.85)")}`,
        borderRadius:16, background:"rgba(0,0,0,0.3)",
      }}>
        <span style={{ fontFamily:BEBAS, fontSize:66, color: bonus ? "#FF3333" : "#FFF" }}>
          {team.teamFouls}
        </span>
      </div>
    </div>
  );
}

/* ─── Center clock column ──────────────────────────────────────────────────── */
function CenterClock({ state, courtId, divConfig, theme }) {
  const { clockTenths, isRunning, shotClockTenths, jumpBall, possession, teamA, teamB } = state;
  const D = (dim, bright) => (theme.highContrast ? bright : dim);

  const shotSec    = shotClockTenths / 10;
  const shotUrgent = shotSec <= 3 && shotClockTenths > 0;
  const shotWarn   = shotSec <= 5 && shotClockTenths > 0;
  const shotColor  = shotUrgent ? "#FF2222" : shotWarn ? "#FFA500" : "#FF3B3B";
  const gameEnd    = clockTenths === 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, width:420, flexShrink:0 }}>
      <div style={{ fontFamily:COND, fontSize:18, fontWeight:800, letterSpacing:"0.4em",
        color: D("rgba(255,255,255,0.3)","rgba(255,255,255,0.85)") }}>
        สนาม {courtId} · {divConfig.label.toUpperCase()}
      </div>

      {jumpBall && (
        <div style={{ padding:"4px 18px", background:"rgba(255,255,255,0.07)",
          border:"1px solid rgba(255,255,255,0.2)", borderRadius:10,
          fontFamily:COND, fontSize:18, fontWeight:800, color:D("rgba(255,255,255,0.6)","rgba(255,255,255,0.9)"),
          letterSpacing:"0.2em" }}>⊕ JUMP BALL</div>
      )}

      {/* Game clock — the running match time */}
      <div style={{ fontFamily:BEBAS, fontSize:92, lineHeight:1,
        color: gameEnd ? "#FF3333" : isRunning ? "#FFF" : D("rgba(255,255,255,0.75)","rgba(255,255,255,0.95)"),
        textShadow: gameEnd ? "0 0 40px rgba(255,30,30,0.7)" : "none" }}>
        {fmtClock(clockTenths)}
      </div>

      {/* Shot clock — the big broadcast-style number */}
      <div style={{ fontFamily:BEBAS, fontSize:170, lineHeight:0.9, fontWeight:900, color:shotColor,
        textShadow: shotUrgent ? "0 0 50px rgba(255,30,30,0.85)" : "none" }}>
        {fmtShot(shotClockTenths)}
      </div>

      <div style={{ fontFamily:COND, fontSize:16, fontWeight:700, letterSpacing:"0.3em",
        color: D("rgba(255,255,255,0.2)","rgba(255,255,255,0.7)") }}>
        #3X3BASKETBALL
      </div>

      {/* Possession dots */}
      <div style={{ display:"flex", gap:18, marginTop:2 }}>
        <div style={{ width:18, height:18, borderRadius:"50%",
          background: possession === "teamA" ? teamA.color : D("rgba(255,255,255,0.12)","rgba(255,255,255,0.3)"),
          boxShadow: possession === "teamA" ? `0 0 12px ${teamA.color}` : "none" }}/>
        <div style={{ width:18, height:18, borderRadius:"50%",
          background: possession === "teamB" ? teamB.color : D("rgba(255,255,255,0.12)","rgba(255,255,255,0.3)"),
          boxShadow: possession === "teamB" ? `0 0 12px ${teamB.color}` : "none" }}/>
      </div>
    </div>
  );
}

/* ─── Main TV Page ─────────────────────────────────────────────────────────── */
export default function TvPage() {
  const [searchParams]  = useSearchParams();
  const courtId         = (searchParams.get("court") || "A").toUpperCase();
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const { theme, themeId, setThemeId, cycleTheme } = useTheme();

  useEffect(() => {
    socket.on("connect",     () => setConnected(true));
    socket.on("disconnect",  () => setConnected(false));
    socket.on("stateUpdate", s  => { if (s) setState(s); });
    socket.emit("joinCourt", courtId);
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("stateUpdate");
    };
  }, [courtId]);

  const [showSelector, setShowSelector] = useState(false);
  useEffect(() => {
    const h = e => {
      if (e.key === "c" || e.key === "C") setShowSelector(v=>!v);
      else if (e.key === "d" || e.key === "D") cycleTheme();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const divisionId = searchParams.get("division") || "open";
  const divConfig  = DIVISIONS.find(d => d.id === divisionId) || DIVISIONS[0];

  /* ─── Loading ────────────────────────────────────────────────────────────── */
  if (!state) return (
    <div style={{ width:"100vw", height:"100vh", background:"#000",
      display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:24 }}>
      <div style={{ fontSize:72 }}>🏀</div>
      <div style={{ fontFamily:BEBAS, fontSize:42, color:"#FFF", letterSpacing:"0.2em" }}>
        CONNECTING — COURT {courtId}
      </div>
      <div style={{ fontFamily:COND, fontSize:18, color:"rgba(255,255,255,0.3)", letterSpacing:"0.2em" }}>
        {connected ? "เชื่อมต่อแล้ว กำลังโหลด state..." : "กำลังเชื่อมต่อ server..."}
      </div>
    </div>
  );

  const winTeam = state.winner === "teamA" ? state.teamA : state.winner === "teamB" ? state.teamB : null;

  return (
    <div style={{
      width:"100vw", height:"100vh", overflow:"hidden",
      background: theme.mainBg,
      display:"flex", flexDirection:"column",
      fontFamily:"system-ui",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@700;800;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pulse-slow { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {/* Top bar — minimal, monochrome, status only */}
      <div style={{
        height:44, background:"rgba(0,0,0,0.6)",
        borderBottom:`1px solid ${theme.highContrast ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}`,
        display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", flexShrink:0,
      }}>
        <span style={{ fontFamily:COND, fontSize:12, fontWeight:800, letterSpacing:"0.4em",
          color: theme.highContrast ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}>
          3×3 BASKETBALL · WIN@21 · SHOT 12s
        </span>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6,
            color: connected ? "rgba(0,232,122,0.8)" : "rgba(255,80,80,0.8)",
            fontFamily:COND, fontSize:12, fontWeight:700, letterSpacing:"0.2em" }}>
            <div style={{ width:6, height:6, borderRadius:"50%",
              background: connected ? "#00E87A" : "#FF5050",
              animation: connected && state.isRunning ? "pulse-slow 1.5s infinite" : "none" }}/>
            {connected ? (state.isRunning ? "LIVE" : "READY") : "OFFLINE"}
          </div>
          <ThemeSwitcher themeId={themeId} setThemeId={setThemeId} />
          <div onClick={() => setShowSelector(v=>!v)} style={{ cursor:"pointer",
            fontFamily:COND, fontSize:10, color: theme.highContrast ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)",
            letterSpacing:"0.2em" }}>
            [C] สนาม
          </div>
        </div>
      </div>

      {/* Main scoreboard */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", gap:36, padding:"0 60px" }}>

        {winTeam && (
          <div style={{ padding:"10px 26px", background:"rgba(255,215,0,0.1)",
            border:"2px solid rgba(255,215,0,0.45)", borderRadius:14, textAlign:"center" }}>
            <span style={{ fontFamily:BEBAS, fontSize:26, color:"#FFD700", letterSpacing:"0.1em" }}>
              🏆 {winTeam.name} WINS
            </span>
          </div>
        )}
        {state.isOvertime && !winTeam && (
          <div style={{ padding:"4px 18px", background:"rgba(255,215,0,0.1)",
            border:"1px solid rgba(255,215,0,0.4)", borderRadius:8,
            fontFamily:COND, fontSize:14, fontWeight:800, color:"#FFD700", letterSpacing:"0.25em" }}>⚡ OVERTIME</div>
        )}

        {/* Names row */}
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", width:"100%", maxWidth:1400 }}>
          <TeamName team={state.teamA} align="left"  hasBall={state.possession === "teamA"} />
          <TeamName team={state.teamB} align="right" hasBall={state.possession === "teamB"} />
        </div>

        {/* Score + clock row */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", maxWidth:1400, gap:24 }}>
          <ScoreBox team={state.teamA} theme={theme} />
          <CenterClock state={state} courtId={courtId} divConfig={divConfig} theme={theme} />
          <ScoreBox team={state.teamB} theme={theme} />
        </div>

        {/* Fouls row */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", width:"100%", maxWidth:1400 }}>
          <FoulsBox team={state.teamA} theme={theme} />
          <FoulsBox team={state.teamB} theme={theme} />
        </div>
      </div>

      {/* Bottom accent — thin team-color identifiers only */}
      <div style={{ height:5, flexShrink:0, display:"flex" }}>
        <div style={{ flex:1, background: state.teamA.color, opacity: state.isRunning ? 0.9 : 0.3, transition:"opacity .5s" }}/>
        <div style={{ flex:1, background: state.teamB.color, opacity: state.isRunning ? 0.9 : 0.3, transition:"opacity .5s" }}/>
      </div>

      {/* Court selector overlay (press C) */}
      {showSelector && (
        <div onClick={() => setShowSelector(false)} style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex",
          alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(8px)",
        }}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:"#111", border:"1px solid #333", borderRadius:20, padding:"32px 40px",
            textAlign:"center",
          }}>
            <div style={{ fontFamily:BEBAS, fontSize:28, letterSpacing:"0.2em",
              color:"#FFF", marginBottom:20 }}>เลือกสนาม</div>
            <div style={{ display:"flex", gap:14 }}>
              {COURTS.map(c => (
                <a key={c} href={`/tv?court=${c}&division=${divisionId}`} style={{
                  display:"block", width:80, height:80, borderRadius:16, lineHeight:"80px",
                  fontFamily:BEBAS, fontSize:42, textDecoration:"none",
                  textAlign:"center",
                  background: c === courtId ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${c === courtId ? "#FFF" : "rgba(255,255,255,0.1)"}`,
                  color: c === courtId ? "#FFF" : "rgba(255,255,255,0.5)",
                }}>{c}</a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

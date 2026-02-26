/**
 * 📺 TvPage — หน้าจอโทรทัศน์
 * URL: /tv?court=A
 *
 * ออกแบบสำหรับแสดงบนจอ 1920×1080 Full HD
 * - ตัวเลขคะแนนขนาดใหญ่มาก
 * - Shot clock ใหญ่ชัดเจน
 * - ไม่มีปุ่ม operator
 * - ดูดีทั้งในห้องมืดและสว่าง
 * - รองรับ landscape เต็มจอ
 */

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { socket } from "../socket.js";
import { COURTS, DIVISIONS } from "../constants.js";

function fmtClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 600) {
    const s = Math.floor(t / 10);
    return `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;
  }
  return `${String(Math.floor(t / 10)).padStart(2,"0")}.${t % 10}`;
}
function fmtShot(tenths) {
  const t = Math.max(0, tenths);
  if (t > 120) return String(Math.ceil(t / 10));
  return `${Math.floor(t / 10)}.${t % 10}`;
}

/* ─── Foul dots ────────────────────────────────────────────────────────────── */
function FoulDots({ count, color, max = 6 }) {
  return (
    <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 18, height: 18, borderRadius:"50%",
          background: i < count ? (count >= max ? "#FF3333" : color) : "rgba(255,255,255,0.08)",
          border: `2px solid ${i < count ? (count >= max ? "#FF3333" : color) : "rgba(255,255,255,0.12)"}`,
          boxShadow: i < count ? `0 0 10px ${count >= max ? "#FF333388" : color+"66"}` : "none",
          transition: "all .25s",
        }} />
      ))}
    </div>
  );
}

/* ─── Team Panel ───────────────────────────────────────────────────────────── */
function TeamPanel({ team, tKey, state, flip }) {
  const { color, name, score, teamFouls, timeouts } = team;
  const bonus   = teamFouls >= 6;
  const hasBall = state.possession === tKey;
  const nameLen = name.length;
  const nameSz  = nameLen <= 8 ? 72 : nameLen <= 13 ? 54 : nameLen <= 18 ? 42 : 32;

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: flip ? "row-reverse" : "row",
      alignItems: "stretch",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Accent bar */}
      <div style={{ width: 8, background: color, flexShrink: 0,
        boxShadow: `0 0 40px ${color}`, borderRadius: flip ? "4px 0 0 4px" : "0 4px 4px 0" }} />

      {/* Content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: flip ? "40px 50px 40px 60px" : "40px 60px 40px 50px",
        textAlign: flip ? "right" : "left",
        background: `linear-gradient(${flip?"270deg":"90deg"}, rgba(0,0,0,0) 0%, ${color}09 100%)`,
      }}>

        {/* Name + ball indicator */}
        <div>
          {hasBall && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: color+"22", border: `1px solid ${color}55`,
              borderRadius: 8, padding: "4px 14px", marginBottom: 12,
              flexDirection: flip ? "row-reverse" : "row",
            }}>
              <div style={{ width: 10, height: 10, borderRadius:"50%", background: color,
                boxShadow:`0 0 8px ${color}`, animation:"pulse-slow 1.5s infinite" }} />
              <span style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:22,
                color, letterSpacing:"0.15em" }}>BALL</span>
            </div>
          )}
          <div style={{
            fontFamily:"'Bebas Neue',Impact,sans-serif",
            fontSize: nameSz, lineHeight: 1.05, color: "#FFF",
            textShadow: `0 0 60px ${color}44`,
            letterSpacing: "0.03em",
            wordBreak: "break-word",
          }}>{name}</div>
        </div>

        {/* Score — massive */}
        <div style={{
          fontFamily:"'Bebas Neue',Impact,sans-serif",
          fontSize: 280, lineHeight: 0.82,
          color,
          textShadow: `0 0 120px ${color}55, 0 0 40px ${color}33`,
          margin: "0 -10px",
        }}>{score}</div>

        {/* Stats */}
        <div style={{ display:"flex", flexDirection:"column", gap:16,
          alignItems: flip ? "flex-end" : "flex-start" }}>

          {/* Timeout pip */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18,
              fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em" }}>TO</span>
            <div style={{ display:"flex", gap:6 }}>
              {Array.from({length:1}).map((_,i)=>(
                <div key={i} style={{
                  width: 28, height: 10, borderRadius: 5,
                  background: i < timeouts ? color : "rgba(255,255,255,0.12)",
                  boxShadow: i < timeouts ? `0 0 8px ${color}` : "none",
                }} />
              ))}
            </div>
          </div>

          {/* Fouls */}
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18,
              fontWeight:800, letterSpacing:"0.15em",
              color: bonus ? "#FF4444" : "rgba(255,255,255,0.35)",
              marginBottom: 8,
              textAlign: flip ? "right" : "left",
            }}>
              FOULS {teamFouls}/6 {bonus ? "— BONUS" : ""}
            </div>
            <FoulDots count={teamFouls} color={color} />
          </div>

        </div>
      </div>
    </div>
  );
}

/* ─── Center column ────────────────────────────────────────────────────────── */
function CenterCol({ state }) {
  const { clockTenths, isRunning, shotClockTenths, shotRunning,
          gameOver, winner, isOvertime, jumpBall, teamA, teamB } = state;

  const shotSec    = shotClockTenths / 10;
  const shotUrgent = shotSec <= 3 && shotClockTenths > 0;
  const shotWarn   = shotSec <= 5 && shotClockTenths > 0;
  const shotColor  = shotUrgent ? "#FF2222" : shotWarn ? "#FF8800" : "#00E87A";
  const gameOver0  = clockTenths === 0;
  const clockColor = gameOver0 ? "#FF2222" : isRunning ? "#FFD700" : "rgba(255,255,255,0.75)";

  const winTeam = winner === "teamA" ? teamA : winner === "teamB" ? teamB : null;

  return (
    <div style={{
      width: 380, flexShrink: 0,
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"space-between", padding:"30px 0", gap:0,
      background:"rgba(0,0,0,0.55)",
      borderLeft:"1px solid rgba(255,255,255,0.05)",
      borderRight:"1px solid rgba(255,255,255,0.05)",
    }}>

      {/* TOP: 3x3 + OT badge */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, marginTop:8 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:17, fontWeight:900,
          letterSpacing:"0.35em", color:"rgba(255,255,255,0.18)" }}>3x3 BASKETBALL</div>
        {isOvertime && (
          <div style={{ padding:"4px 18px", background:"rgba(255,215,0,0.12)",
            border:"1.5px solid rgba(255,215,0,0.4)", borderRadius:8,
            fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:"#FFD700",
            letterSpacing:"0.2em" }}>⚡ OVERTIME</div>
        )}
        {jumpBall && (
          <div style={{ padding:"3px 14px", background:"rgba(255,255,255,0.07)",
            border:"1px solid rgba(255,255,255,0.18)", borderRadius:8,
            fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:800,
            color:"rgba(255,255,255,0.55)", letterSpacing:"0.2em" }}>⊕ JUMP BALL</div>
        )}
      </div>

      {/* Game Over */}
      {gameOver && winTeam && (
        <div style={{ textAlign:"center", padding:"18px 20px",
          background:"rgba(255,215,0,0.08)", border:"2px solid rgba(255,215,0,0.4)",
          borderRadius:18, margin:"0 16px" }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900,
            color:"rgba(255,215,0,0.7)", letterSpacing:"0.2em" }}>WINNER</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:38,
            color:"#FFD700", letterSpacing:"0.05em", lineHeight:1.1,
            animation:"win-flash 1s infinite" }}>{winTeam.name}</div>
          <div style={{ fontSize:36, marginTop:4 }}>🏆</div>
        </div>
      )}

      {/* Shot Clock */}
      <div style={{
        textAlign:"center",
        background: shotUrgent ? "rgba(200,0,0,0.18)" : "rgba(0,0,0,0.3)",
        border: `2px solid ${shotUrgent ? "rgba(255,30,30,0.6)" : shotWarn ? "rgba(255,140,0,0.4)" : "rgba(0,232,122,0.25)"}`,
        borderRadius:20, padding:"20px 28px", width:"85%",
        boxShadow: shotUrgent ? "0 0 60px rgba(255,30,30,0.3)" : "none",
        transition:"all .3s",
      }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900,
          letterSpacing:"0.4em", color:"rgba(255,255,255,0.3)", marginBottom:4 }}>SHOT CLOCK</div>
        <div style={{
          fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:130, lineHeight:0.85,
          color: shotColor,
          textShadow: shotUrgent ? "0 0 60px rgba(255,30,30,0.9)" : `0 0 40px ${shotColor}55`,
          transition:"color .15s, text-shadow .15s",
        }}>{fmtShot(shotClockTenths)}</div>
        {/* Progress bar */}
        <div style={{ height:3, background:"rgba(255,255,255,0.07)", borderRadius:2,
          overflow:"hidden", marginTop:10 }}>
          <div style={{ height:"100%", borderRadius:2, transition:"width .1s linear",
            width:`${Math.min(100,(shotClockTenths/120)*100)}%`,
            background: shotColor }} />
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700,
          color:"rgba(255,255,255,0.2)", letterSpacing:"0.2em", marginTop:6 }}>
          {shotRunning ? "▶ RUNNING" : "■ STOPPED"}
        </div>
      </div>

      {/* Game Clock */}
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900,
          letterSpacing:"0.4em", color:"rgba(255,255,255,0.25)" }}>GAME CLOCK</div>
        <div style={{
          fontFamily:"'Bebas Neue',Impact,sans-serif",
          fontSize: clockTenths <= 600 ? 86 : 72,
          lineHeight:1, color: clockColor,
          textShadow: gameOver0 ? "0 0 60px rgba(255,0,0,0.8)" :
                      isRunning ? "0 0 40px rgba(255,215,0,0.6)" : "none",
          transition:"color .2s, text-shadow .2s",
          letterSpacing:"0.02em",
        }}>{fmtClock(clockTenths)}</div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, fontWeight:800,
          letterSpacing:"0.2em", marginTop:-2,
          color: isRunning ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.15)" }}>
          {gameOver ? "■ FINAL" : isRunning ? "▶ LIVE" : "■ PAUSED"}
        </div>
      </div>

      {/* VS / Score separator */}
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900,
        letterSpacing:"0.3em", color:"rgba(255,255,255,0.1)" }}>VS</div>

    </div>
  );
}

/* ─── Main TV Page ─────────────────────────────────────────────────────────── */
export default function TvPage() {
  const [searchParams]  = useSearchParams();
  const courtId         = (searchParams.get("court") || "A").toUpperCase();
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);

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

  /* Court selector overlay (press C or click corner) */
  const [showSelector, setShowSelector] = useState(false);
  useEffect(() => {
    const h = e => { if (e.key === "c" || e.key === "C") setShowSelector(v=>!v); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* ─── Loading ────────────────────────────────────────────────────────────── */
  if (!state) return (
    <div style={{ width:"100vw", height:"100vh", background:"#050505",
      display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:24 }}>
      <div style={{ fontSize:72 }}>🏀</div>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:42, color:"#FFF", letterSpacing:"0.2em" }}>
        CONNECTING — COURT {courtId}
      </div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, color:"rgba(255,255,255,0.25)",
        letterSpacing:"0.2em" }}>
        {connected ? "เชื่อมต่อแล้ว กำลังโหลด state..." : "กำลังเชื่อมต่อ server..."}
      </div>
    </div>
  );

  return (
    <div style={{
      width:"100vw", height:"100vh", overflow:"hidden",
      background:"radial-gradient(ellipse at 50% 0%, #0e0818 0%, #050505 60%)",
      display:"flex", flexDirection:"column",
      fontFamily:"system-ui",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@700;800;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pulse-slow { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes win-flash  { 0%,100%{opacity:1} 50%{opacity:.6} }
      `}</style>

      {/* Top bar */}
      <div style={{
        height:52, background:"rgba(0,0,0,0.7)", borderBottom:"1px solid rgba(255,255,255,0.04)",
        display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 32px", flexShrink:0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900,
            letterSpacing:"0.45em", color:"rgba(255,255,255,0.2)" }}>
            3×3 BASKETBALL
          </span>
          {/* Win condition indicator */}
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700,
            letterSpacing:"0.3em", color:"rgba(255,255,255,0.12)" }}>
            WIN AT 21 · SHOT CLOCK 12s
          </span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {/* Court badge */}
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:"0.2em",
            color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"3px 14px" }}>
            สนาม {courtId}
          </div>
          {/* Status dot */}
          <div style={{ display:"flex", alignItems:"center", gap:6,
            color: connected ? "rgba(0,232,122,0.55)" : "rgba(255,80,80,0.55)",
            fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, fontWeight:700, letterSpacing:"0.2em" }}>
            <div style={{ width:7, height:7, borderRadius:"50%",
              background: connected ? "#00E87A" : "#FF5050",
              boxShadow: connected ? "0 0 6px #00E87A" : "none",
              animation: connected && state?.isRunning ? "pulse-slow 1.5s infinite" : "none",
            }} />
            {connected ? (state?.isRunning ? "LIVE" : "READY") : "OFFLINE"}
          </div>
          {/* Corner hint */}
          <div onClick={() => setShowSelector(v=>!v)} style={{ cursor:"pointer",
            fontFamily:"'Barlow Condensed',sans-serif", fontSize:10, color:"rgba(255,255,255,0.1)",
            letterSpacing:"0.2em" }}>
            [C] สนาม
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        <TeamPanel team={state.teamA} tKey="teamA" state={state} flip={false} />
        <CenterCol state={state} />
        <TeamPanel team={state.teamB} tKey="teamB" state={state} flip={true} />
      </div>

      {/* Bottom bar — thin accent */}
      <div style={{
        height:6, flexShrink:0,
        background:`linear-gradient(90deg, ${state.teamA.color}, rgba(255,255,255,0.2) 50%, ${state.teamB.color})`,
        opacity: state.isRunning ? 1 : 0.3, transition:"opacity .5s",
      }} />

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
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:"0.2em",
              color:"#FFF", marginBottom:20 }}>เลือกสนาม</div>
            <div style={{ display:"flex", gap:14 }}>
              {COURTS.map(c => (
                <a key={c} href={`/tv?court=${c}`} style={{
                  display:"block", width:80, height:80, borderRadius:16, lineHeight:"80px",
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:42, textDecoration:"none",
                  textAlign:"center",
                  background: c === courtId ? "rgba(255,107,53,0.2)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${c === courtId ? "#FF6B35" : "rgba(255,255,255,0.1)"}`,
                  color: c === courtId ? "#FF6B35" : "rgba(255,255,255,0.5)",
                }}>{c}</a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

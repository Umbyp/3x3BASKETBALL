/**
 * 🎥 OverlayPage — OBS Browser Source
 * URL: /overlay?court=A
 * Size: 1920×1080, Allow Transparency: ON
 *
 * Fix: แสดง loading state แทนที่จะ return ว่างเมื่อยังเชื่อมต่อไม่ได้
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { socket } from "../socket.js";

function fmtClock(t) {
  t = Math.max(0, t);
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

const B = "'Oswald',Impact,sans-serif";
const C = "'Barlow Condensed',sans-serif";

function TeamBox({ team, tKey, possession, flip }) {
  const poss  = possession === tKey;
  const bonus = team.teamFouls >= 6;
  const nl    = team.name.length;
  const ns    = nl <= 8 ? 30 : nl <= 14 ? 22 : 16;

  return (
    <div style={{ display:"flex", flexDirection:flip?"row-reverse":"row", alignItems:"stretch", height:"100%" }}>
      {/* Accent bar */}
      <div style={{ width:6, background:team.color, boxShadow:`0 0 12px ${team.color}`, flexShrink:0 }}/>

      {/* Name + stats */}
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center",
        padding:"0 18px", minWidth:200, alignItems:flip?"flex-end":"flex-start" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6,
          flexDirection:flip?"row-reverse":"row", marginBottom:2 }}>
          {poss && <span style={{ fontFamily:B, fontSize:18, color:team.color }}>{flip?"▶":"◀"}</span>}
          <span style={{ fontFamily:B, fontSize:ns, fontWeight:700, color:"#FFF", lineHeight:1.1 }}>
            {team.name}
          </span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexDirection:flip?"row-reverse":"row" }}>
          {/* Timeout pip */}
          <div style={{ display:"flex", gap:3 }}>
            <div style={{ width:18, height:5, borderRadius:3,
              background: team.timeouts > 0 ? "#FFF" : "rgba(255,255,255,0.15)" }}/>
          </div>
          <span style={{ fontFamily:C, fontSize:13, fontWeight:800,
            color:"rgba(255,255,255,0.35)", letterSpacing:"0.08em" }}>
            F {team.teamFouls}
          </span>
          {bonus && <span style={{ fontFamily:C, fontSize:12, fontWeight:900, color:"#FF3333" }}>BONUS</span>}
        </div>
      </div>

      {/* Score box */}
      <div style={{ width:100, display:"flex", alignItems:"center", justifyContent:"center",
        background:"rgba(0,0,0,0.45)",
        borderLeft:  flip ? "none" : "1px solid rgba(255,255,255,0.04)",
        borderRight: flip ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
        <span style={{ fontFamily:B, fontSize:62, fontWeight:700, color:team.color, lineHeight:1 }}>
          {team.score}
        </span>
      </div>
    </div>
  );
}

export default function OverlayPage() {
  const [sp]              = useSearchParams();
  const court             = (sp.get("court") || "A").toUpperCase();
  const [state, setS]     = useState(null);
  const [connected, setCn] = useState(false);

  useEffect(() => {
    const onConnect    = () => { setCn(true); socket.emit("joinCourt", court); };
    const onDisconnect = () => setCn(false);
    const onState      = s  => { if (s) setS(s); };

    socket.on("connect",     onConnect);
    socket.on("disconnect",  onDisconnect);
    socket.on("stateUpdate", onState);

    // ถ้า socket เชื่อมต่ออยู่แล้วตอน mount
    if (socket.connected) {
      setCn(true);
      socket.emit("joinCourt", court);
    }

    return () => {
      socket.off("connect",     onConnect);
      socket.off("disconnect",  onDisconnect);
      socket.off("stateUpdate", onState);
    };
  }, [court]);

  // ─── Loading / Offline state ───────────────────────────────────────────────
  // แสดงแทนที่จะ return ว่าง ทำให้รู้ว่าหน้าโหลดแล้วแต่รอ server
  if (!state) return (
    <div style={{
      width:"100vw", height:"100vh",
      // ใช้พื้นหลังโปร่งใสสำหรับ OBS — จะเห็นแค่ข้อความ
      background: "transparent",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      paddingBottom: 44,
    }}>
      <div style={{
        padding: "12px 28px",
        background: "rgba(10,10,20,0.92)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        display:"flex", alignItems:"center", gap:12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
      }}>
        {/* Pulsing dot */}
        <div style={{
          width: 8, height: 8, borderRadius:"50%",
          background: connected ? "#FFD700" : "#FF5555",
          boxShadow: `0 0 8px ${connected ? "#FFD700" : "#FF5555"}`,
          animation: "pulse 1.2s ease-in-out infinite",
        }}/>
        <span style={{ fontFamily:B, fontSize:20, color:"rgba(255,255,255,0.5)",
          letterSpacing:"0.15em" }}>
          {connected ? `COURT ${court} — WAITING FOR GAME` : `CONNECTING — COURT ${court}`}
        </span>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    </div>
  );

  // ─── Main overlay ──────────────────────────────────────────────────────────
  const {
    teamA, teamB, clockTenths, shotClockTenths,
    possession, jumpBall, gameOver, winner,
    isRunning, isOvertime,
  } = state;

  const shotSec    = shotClockTenths / 10;
  const shotUrgent = shotSec <= 3 && shotClockTenths > 0;
  const shotWarn   = shotSec <= 5 && shotClockTenths > 0;
  const shotColor  = shotUrgent ? "#FF2222" : shotWarn ? "#FFA500" : "#FFD700";
  const gameEnd    = clockTenths === 0 && !isRunning;

  return (
    <div style={{
      width:"100vw", height:"100vh",
      background: "transparent",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      paddingBottom: 44,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Barlow+Condensed:wght@700;800;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>

        {/* Win banner */}
        {gameOver && (
          <div style={{ marginBottom:8, padding:"8px 30px",
            background:"rgba(255,215,0,0.92)", borderRadius:10,
            fontFamily:C, fontSize:22, fontWeight:900, color:"#000", letterSpacing:"0.15em" }}>
            🏆 {winner === "teamA" ? teamA.name : teamB.name} WINS!
          </div>
        )}

        {/* OT badge */}
        {isOvertime && !gameOver && (
          <div style={{ marginBottom:6, padding:"4px 20px",
            background:"rgba(255,215,0,0.12)", border:"1px solid rgba(255,215,0,0.4)",
            borderRadius:8, fontFamily:C, fontSize:14, fontWeight:900,
            color:"#FFD700", letterSpacing:"0.2em" }}>⚡ OVERTIME</div>
        )}

        {/* Main scoreboard bar */}
        <div style={{
          display:"flex", height:80,
          background:"rgba(12,14,22,0.96)",
          borderRadius:10, border:"1px solid rgba(255,255,255,0.08)",
          boxShadow:"0 12px 50px rgba(0,0,0,0.8)",
          overflow:"hidden",
        }}>
          <TeamBox team={teamA} tKey="teamA" possession={possession} flip={false}/>

          {/* Clock */}
          <div style={{ width:160, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            background:"rgba(0,0,0,0.5)", position:"relative" }}>
            {jumpBall && (
              <div style={{ position:"absolute", top:4, fontFamily:C, fontSize:11,
                fontWeight:900, color:"#FFD700" }}>⊕ JUMP</div>
            )}
            <span style={{ fontFamily:B, fontSize:42, fontWeight:700, lineHeight:1,
              color: gameEnd ? "#FF2222" : isRunning ? "#FFD700" : "#FFF" }}>
              {fmtClock(clockTenths)}
            </span>
            <span style={{ fontFamily:C, fontSize:11, fontWeight:800, letterSpacing:"0.1em",
              color: isRunning ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.25)" }}>
              {gameEnd ? "■ END" : isRunning ? "▶ LIVE" : "■ STOP"}
            </span>
          </div>

          <TeamBox team={teamB} tKey="teamB" possession={possession} flip={true}/>
        </div>

        {/* Shot clock tab */}
        <div style={{
          marginTop:-1, padding:"4px 22px",
          background: shotUrgent ? "rgba(200,0,0,0.93)" : "rgba(18,20,30,0.97)",
          borderBottomLeftRadius:10, borderBottomRightRadius:10,
          border:"1px solid rgba(255,255,255,0.08)", borderTop:"none",
          display:"flex", alignItems:"center", gap:10,
          boxShadow:"0 6px 20px rgba(0,0,0,0.5)",
          transition:"background .3s",
        }}>
          <span style={{ fontFamily:C, fontSize:14, fontWeight:800, letterSpacing:"0.1em",
            color: shotUrgent ? "#FFF" : "rgba(255,255,255,0.35)" }}>SHOT</span>
          <span style={{ fontFamily:B, fontSize:28, fontWeight:700, lineHeight:1, color:shotColor }}>
            {fmtShot(shotClockTenths)}
          </span>
          <span style={{ fontFamily:C, fontSize:11, color:"rgba(255,255,255,0.2)" }}>3x3=12s</span>
        </div>

      </div>
    </div>
  );
}
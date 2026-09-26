/**
 * 🎮 ScoreboardPage — Operator control
 * /scoreboard?court=A&division=open
 * Keyboard: SPACE=clock, C=shot hold, Z=12s, H=horn, Q/W=home +1/+2, O/P=away +1/+2,
 *           A/S=home FT made/miss, K/L=away FT made/miss, CTRL+Z=undo, E=settings
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { COURTS, RULES } from "../constants.js";
import { useDivisions, findDivision } from "../divisions.js";
import TournamentBridge from "../components/scoreboard/TournamentBridge.jsx";
import { useGameState } from "./useGameState.js";

const audioCtx = typeof window !== "undefined" ? { horn: new Audio("/buzzer.mp3"), buzzer: new Audio("/buzzer.mp3") } : null;
let unlocked = false;
const unlock = () => {
  if(unlocked||!audioCtx) return; unlocked=true;
  [audioCtx.horn,audioCtx.buzzer].forEach(a=>{ a.play().then(()=>{a.pause();a.currentTime=0;}).catch(()=>{}); });
};
const playHorn   = () => { if(!audioCtx?.horn)   return; unlock(); audioCtx.horn.currentTime=0;   audioCtx.horn.play().catch(()=>{}); };
const playBuzzer = () => { if(!audioCtx?.buzzer) return; unlock(); audioCtx.buzzer.currentTime=0; audioCtx.buzzer.play().catch(()=>{}); };

function fmt(t){const s=Math.max(0,t);if(s>=600){const x=Math.floor(s/10);return`${Math.floor(x/60)}:${String(x%60).padStart(2,"0")}`}return`${String(Math.floor(s/10)).padStart(2,"0")}.${s%10}`;}
function fmtS(t){const s=Math.max(0,t);if(s>50)return String(Math.ceil(s/10));return`${Math.floor(s/10)}.${s%10}`;}
function textOn(hex){
  const h=(hex||"#FFFFFF").replace("#","");
  const r=parseInt(h.slice(0,2),16)||0, g=parseInt(h.slice(2,4),16)||0, b=parseInt(h.slice(4,6),16)||0;
  return (0.299*r+0.587*g+0.114*b)/255 > 0.5 ? "#140c02" : "#fff";
}

const COLORS=["#FF6B35","#FF3333","#FF1493","#9B59B6","#3498DB","#00D4FF","#00E87A","#FFD700","#FFFFFF","#FF8C00"];

// Shot clock is what the operator's eyes stay glued to second-to-second, so it
// gets top billing (bigger + on top); the game clock is secondary reference.
const DISPLAY_SIZES = {
  sm: { shot:"clamp(72px,16vh,140px)",  game:"clamp(34px,6.5vh,60px)" },
  md: { shot:"clamp(100px,20vh,180px)", game:"clamp(42px,8vh,76px)"  },
  lg: { shot:"clamp(130px,25vh,230px)", game:"clamp(50px,9.5vh,92px)" },
};
const DISPLAY_SIZE_LABELS = [["sm","เล็ก"],["md","กลาง"],["lg","ใหญ่"]];

function Kbd({children}){
  return <span style={{position:"absolute",top:6,right:8,fontFamily:"'JetBrains Mono',monospace",fontSize:11,
    fontWeight:500,padding:"1px 5px",borderRadius:4,border:"1px solid #343a4e",color:"#8a91a6"}}>{children}</span>;
}

function FoulPips({count}){
  const max=RULES.BONUS_FOULS;
  return(
    <div style={{flex:1,display:"grid",gridTemplateColumns:`repeat(${max},1fr)`,gap:4}}>
      {Array.from({length:max}).map((_,i)=><div key={i} style={{height:10,borderRadius:3,
        background:i<count?(count>=max?"#ff4d4d":"#e8eaf0"):"#1c2030"}}/>)}
    </div>
  );
}

function ColorDot({color,onPick,align="left"}){
  const [o,setO]=useState(false);
  return(
    <div style={{position:"relative"}}>
      <button onClick={e=>{e.stopPropagation();setO(v=>!v);}} title="เปลี่ยนสีทีม" style={{width:14,height:14,borderRadius:"50%",
        background:color,border:"2px solid rgba(0,0,0,0.35)",cursor:"pointer",flexShrink:0}}/>
      {o&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:20,[align==="right"?"right":"left"]:0,zIndex:80,background:"#0f1219",
          border:"1px solid #262b3a",borderRadius:12,padding:8,display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5}}>
          {COLORS.map(c=>(
            <button key={c} onClick={()=>{onPick(c);setO(false);}}
              style={{width:22,height:22,borderRadius:"50%",background:c,cursor:"pointer",
                border:`2px solid ${color===c?"#FFF":"transparent"}`}}/>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Team scoreboard panel (mirrors what's on the TV/overlay) ── */
function TeamPanel({team,tKey,send,state,align}){
  const [editing,setEditing]=useState(false);
  const [input,setInput]=useState(team.name);
  const flip = align==="right";
  const txt = textOn(team.color);
  const isWin = state.gameOver && state.winner===tKey;
  const isPoss = state.possession===tKey;
  const bonus = team.teamFouls>=RULES.BONUS_FOULS;
  const save=()=>{send("teamName",tKey,input.toUpperCase());setEditing(false);};
  // Long names shrink, then truncate with "…" so they never push past the header
  const nameFs = team.name.length<=12?26:team.name.length<=18?21:18;

  return(
    <div data-screen-label={tKey==="teamA"?"Home":"Away"} style={{display:"flex",flexDirection:"column",minHeight:0,
      background:"#10131c",border:"1px solid #1f2433",borderRadius:20,overflow:"hidden"}}>
      <div style={{height:52,flex:"none",display:"flex",alignItems:"center",gap:10,padding:"0 14px",
        background:team.color,color:txt,flexDirection:flip?"row-reverse":"row"}}>
        <ColorDot color={team.color} onPick={c=>send("teamColor",tKey,c)} align={flip?"right":"left"}/>
        {editing
          ?<input autoFocus value={input} maxLength={24} onChange={e=>setInput(e.target.value.toUpperCase())}
              onBlur={save} onKeyDown={e=>e.key==="Enter"&&save()}
              style={{background:"none",border:"none",borderBottom:`2px solid ${txt}`,outline:"none",color:txt,
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,letterSpacing:".08em",
                flex:"1 1 0",minWidth:0,textAlign:flip?"right":"left"}}/>
          :<span onClick={()=>setEditing(true)} title={team.name} style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,
              fontSize:nameFs,letterSpacing:".06em",cursor:"pointer",flex:"0 1 auto",minWidth:0,
              whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{team.name}</span>
        }
        {isWin&&<span style={{flex:"none",padding:"2px 8px",borderRadius:5,background:txt,color:team.color,fontSize:14,
          fontWeight:800,letterSpacing:".1em"}}>WIN</span>}
        <div style={{flex:1,minWidth:0}}/>
        {isPoss&&<span style={{flex:"none",whiteSpace:"nowrap",fontSize:20,fontWeight:800}}>{flip?"BALL ●":"● BALL"}</span>}
      </div>
      <div className="score-value" style={{flex:1,minHeight:0,display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:"clamp(90px,20vh,230px)",fontWeight:800,lineHeight:.8,color:team.color,
        fontFamily:"'Barlow Condensed',sans-serif",fontVariantNumeric:"tabular-nums"}}>{team.score}</div>
      <div style={{flex:"none",display:"flex",alignItems:"center",gap:10,padding:"0 16px 14px",
        flexDirection:flip?"row-reverse":"row"}}>
        <span style={{fontSize:13,letterSpacing:".2em",color:"#7a8194",fontWeight:700}}>FOULS</span>
        <FoulPips count={team.teamFouls}/>
        <span style={{minWidth:26,textAlign:flip?"left":"right",fontSize:28,fontWeight:700,lineHeight:1,
          fontFamily:"'Barlow Condensed',sans-serif",fontVariantNumeric:"tabular-nums"}}>{team.teamFouls}</span>
        <span style={{marginInlineStart:10,paddingInlineStart:12,borderInlineStart:"1px solid #262b3a",fontSize:13,letterSpacing:".15em",color:"#7a8194",fontWeight:700}}>FT</span>
        <span style={{fontSize:22,fontWeight:700,lineHeight:1,color:"#c8ccd6",fontFamily:"'Barlow Condensed',sans-serif",
          fontVariantNumeric:"tabular-nums"}}>{team.ftMade||0}/{team.ftAtt||0}</span>
      </div>
      <div style={{flex:"none",height:30,display:"flex",alignItems:"center",justifyContent:"center",gap:10,
        background:bonus?"#ffb020":"transparent",color:"#140c02",fontSize:18,fontWeight:800,letterSpacing:".1em"}}>
        {bonus?"BONUS 2FT":""}
      </div>
    </div>
  );
}

/* ── Team controls — the buttons an operator actually presses ── */
function TeamControls({team,tKey,doScore,doFoul,doTimeout,doFT,kbd1,kbd2,kbdFtMade,kbdFtMiss}){
  const txt = textOn(team.color);
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"104px 72px 60px",gap:8}}>
      <button onClick={()=>doScore(tKey,1)} style={{position:"relative",borderRadius:14,border:`1px solid ${team.color}55`,
        background:`${team.color}1c`,color:"#fff",fontSize:52,fontWeight:700,cursor:"pointer",
        fontFamily:"'Barlow Condensed',sans-serif"}}>+1<Kbd>{kbd1}</Kbd></button>
      <button onClick={()=>doScore(tKey,2)} style={{position:"relative",borderRadius:14,border:`1px solid ${team.color}55`,
        background:`${team.color}1c`,color:"#fff",fontSize:52,fontWeight:700,cursor:"pointer",
        fontFamily:"'Barlow Condensed',sans-serif"}}>+2<Kbd>{kbd2}</Kbd></button>
      <button onClick={()=>doFoul(tKey,1)} style={{borderRadius:12,border:"1px solid #262b3a",background:"#12151e",
        color:"#e8eaf0",fontSize:22,fontWeight:700,letterSpacing:".08em",cursor:"pointer",
        fontFamily:"'Barlow Condensed',sans-serif"}}>+ FOUL</button>
      <button onClick={()=>doTimeout(tKey)} disabled={team.timeouts<=0} style={{borderRadius:12,border:"1px solid #262b3a",
        background:"#12151e",color:"#e8eaf0",fontSize:22,fontWeight:700,letterSpacing:".06em",cursor:"pointer",
        opacity:team.timeouts<=0?.4:1,fontFamily:"'Barlow Condensed',sans-serif"}}>{team.timeouts>0?"T.O. ●":"T.O. ○"}</button>
      {/* Free throws — made = +1 and an attempt, missed = attempt only */}
      <button onClick={()=>doFT(tKey,true)} style={{position:"relative",borderRadius:12,border:"1px solid #1f5a3c",
        background:"#0f2119",color:"#4fe39a",fontSize:20,fontWeight:700,letterSpacing:".06em",cursor:"pointer",
        fontFamily:"'Barlow Condensed',sans-serif"}}>FT ✓ +1<Kbd>{kbdFtMade}</Kbd></button>
      <button onClick={()=>doFT(tKey,false)} style={{position:"relative",borderRadius:12,border:"1px solid #4a2530",
        background:"#1a1216",color:"#ff7b7b",fontSize:20,fontWeight:700,letterSpacing:".06em",cursor:"pointer",
        fontFamily:"'Barlow Condensed',sans-serif"}}>FT ✗ MISS<Kbd>{kbdFtMiss}</Kbd></button>
    </div>
  );
}

/* ── Center scoreboard display ── */
function CenterDisplay({state,send,doPossession,doJumpBall,displaySize}){
  const {clockTenths,isRunning,shotClockTenths,possession,gameOver,winner,isOvertime,teamA,teamB}=state;
  const shotSec=shotClockTenths/10, shotRed=shotSec<=5&&shotClockTenths>0;
  const status = gameOver?"FINAL":isOvertime?(isRunning?"OVERTIME":"OT · PAUSED"):isRunning?"RUNNING":"PAUSED";
  const statusColor = gameOver||isOvertime?"#ffb020":isRunning?"#2fd07a":"#7a8194";
  let subline="", sublineColor="#aab0c2";
  if(gameOver){ subline=`${winner==="teamA"?teamA.name:teamB.name} ชนะ · ${teamA.score}–${teamB.score}`; sublineColor=winner==="teamA"?teamA.color:teamB.color; }
  else if(isOvertime){ subline="ต่อเวลา"; sublineColor="#ffc74d"; }
  const poss=(t)=> possession===t ? {bg:state[t].color,color:textOn(state[t].color),border:state[t].color} : {bg:"#171b27",color:"#8a91a6",border:"#2a3042"};
  const hp=poss("teamA"), ap=poss("teamB");
  const sizes = DISPLAY_SIZES[displaySize]||DISPLAY_SIZES.md;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:4,minHeight:0,background:"#0d1018",border:"1px solid #1f2433",
      borderRadius:20,padding:"12px 18px 14px",flex:1,justifyContent:"center"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <span style={{width:8,height:8,borderRadius:"50%",background:statusColor}}/>
        <span style={{fontSize:15,letterSpacing:".2em",fontWeight:700,color:statusColor,fontFamily:"'Barlow Condensed',sans-serif"}}>{status}</span>
      </div>

      {/* Shot clock — primary focus for the operator */}
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <span style={{fontSize:14,letterSpacing:".24em",color:"#7a8194",fontWeight:600,fontFamily:"'Barlow Condensed',sans-serif"}}>SHOT</span>
        <div style={{flex:1,textAlign:"center",fontSize:sizes.shot,fontWeight:800,lineHeight:.95,
          fontFamily:"'Barlow Condensed',sans-serif",fontVariantNumeric:"tabular-nums",
          color:shotRed?"#ff4d4d":"#f4f5f8"}}>{fmtS(shotClockTenths)}</div>
        <div style={{width:60}}/>
      </div>
      <div style={{height:6,borderRadius:3,background:"#1a1f2c",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(100,(shotClockTenths/120)*100)}%`,background:shotRed?"#ff4d4d":"#f4f5f8"}}/>
      </div>

      <div style={{height:1,background:"#1f2433",margin:"6px 0"}}/>

      {/* Game clock — secondary reference */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:12,letterSpacing:".2em",color:"#7a8194",fontWeight:600,fontFamily:"'Barlow Condensed',sans-serif"}}>GAME</span>
        <div style={{flex:1,textAlign:"center",fontSize:sizes.game,fontWeight:800,lineHeight:.95,
          fontFamily:"'Barlow Condensed',sans-serif",fontVariantNumeric:"tabular-nums",color:"#f4f5f8"}}>{fmt(clockTenths)}</div>
        <div style={{width:34}}/>
      </div>
      {subline&&<div style={{textAlign:"center",fontFamily:"'IBM Plex Sans Thai',sans-serif",fontSize:14,fontWeight:600,color:sublineColor}}>{subline}</div>}

      {gameOver&&(
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:2}}>
          <button onClick={()=>send("startOvertime")} style={{padding:"6px 14px",borderRadius:8,
            background:"rgba(0,232,122,0.12)",border:"1.5px solid rgba(0,232,122,0.4)",color:"#00E87A",
            fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,cursor:"pointer"}}>▶ OVERTIME</button>
          <button onClick={()=>send("fullReset")} style={{padding:"6px 14px",borderRadius:8,
            background:"rgba(255,55,55,0.1)",border:"1.5px solid rgba(255,55,55,0.3)",color:"#FF7070",
            fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,cursor:"pointer"}}>↺ NEW GAME</button>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:2}}>
        <button onClick={()=>doPossession("teamA")} title="Possession HOME" style={{width:64,height:64,borderRadius:12,
          border:`1px solid ${hp.border}`,background:hp.bg,color:hp.color,fontSize:24,cursor:"pointer"}}>◀</button>
        <button onClick={doJumpBall} style={{display:"flex",alignItems:"center",padding:"0 6px",fontSize:13,
          letterSpacing:".2em",color:"#5d6478",fontWeight:700,background:"none",border:"none",cursor:"pointer",
          fontFamily:"'Barlow Condensed',sans-serif"}}>BALL</button>
        <button onClick={()=>doPossession("teamB")} title="Possession AWAY" style={{width:64,height:64,borderRadius:12,
          border:`1px solid ${ap.border}`,background:ap.bg,color:ap.color,fontSize:24,cursor:"pointer"}}>▶</button>
      </div>
    </div>
  );
}

/* ── Center controls ── */
function CenterControls({state,doClockToggle,doShotReset,doShotToggle,onHorn}){
  const startDisabled = state.gameOver;
  const startBg = startDisabled?"#161a24":state.isRunning?"#d63a3a":"#1f9d5a";
  const startColor = startDisabled?"#4f566a":"#fff";
  const holdOn = !state.shotRunning;
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gridTemplateRows:"104px 72px",gap:8}}>
      <button onClick={doClockToggle} disabled={startDisabled} style={{position:"relative",gridColumn:"span 3",
        borderRadius:16,border:"none",background:startBg,color:startColor,fontSize:44,fontWeight:800,letterSpacing:".1em",
        display:"flex",alignItems:"center",justifyContent:"center",gap:12,cursor:"pointer",
        fontFamily:"'Barlow Condensed',sans-serif"}}>
        <span style={{fontSize:28}}>{state.isRunning?"■":"▶"}</span>{state.isRunning?"STOP":"START"}
        <span style={{position:"absolute",top:9,right:11,fontFamily:"'JetBrains Mono',monospace",fontSize:11,
          fontWeight:500,padding:"1px 6px",border:"1px solid rgba(255,255,255,.35)",borderRadius:4,opacity:.75}}>SPACE</span>
      </button>
      <button onClick={doShotReset} style={{position:"relative",borderRadius:12,border:"1px solid #262b3a",
        background:"#12151e",color:"#e8eaf0",fontSize:28,fontWeight:800,cursor:"pointer",
        fontFamily:"'Barlow Condensed',sans-serif"}}>12<Kbd>Z</Kbd></button>
      <button onClick={doShotToggle} style={{position:"relative",borderRadius:12,
        border:`1px solid ${holdOn?"#ffb020":"#262b3a"}`,background:holdOn?"#2a2008":"#12151e",
        color:holdOn?"#ffc74d":"#e8eaf0",fontSize:19,fontWeight:700,letterSpacing:".05em",cursor:"pointer",
        fontFamily:"'Barlow Condensed',sans-serif"}}>{holdOn?"SHOT RUN":"SHOT HOLD"}<Kbd>C</Kbd></button>
      <button onClick={onHorn} style={{position:"relative",borderRadius:12,border:"1px solid #262b3a",
        background:"#12151e",color:"#e8eaf0",fontSize:20,fontWeight:800,letterSpacing:".08em",cursor:"pointer",
        fontFamily:"'Barlow Condensed',sans-serif"}}>HORN<Kbd>H</Kbd></button>
    </div>
  );
}

/* ── Bottom bar: undo + recent-action ticker ── */
function HistoryBar({history,undone,onUndo,onRemove,onOpen}){
  return(
    <div style={{flex:"none",display:"flex",alignItems:"center",gap:10,height:64}}>
      <button onClick={onUndo} disabled={history.length===0} style={{height:64,padding:"0 22px",borderRadius:12,
        border:"1px solid #3a3350",background:"#171425",color:"#d6ccff",fontSize:22,fontWeight:700,letterSpacing:".06em",
        display:"flex",alignItems:"center",gap:10,cursor:"pointer",opacity:history.length?1:.4,
        fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>
        ↶ UNDO<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:500,padding:"1px 5px",
          border:"1px solid #3f3a55",borderRadius:4,color:"#9d95bf"}}>CTRL Z</span>
      </button>
      <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8,overflow:"hidden"}}>
        {undone&&<div style={{flex:"none",height:44,display:"flex",alignItems:"center",padding:"0 12px",borderRadius:10,
          background:"#231d3a",color:"#c9bfff",fontSize:16,fontWeight:600,fontFamily:"'Barlow Condensed',sans-serif"}}>↶ {undone}</div>}
        {history.slice(0,5).map((h,i)=>{
          const Tag = h.removable ? "button" : "div";
          return (
            <Tag key={h.id} type={h.removable?"button":undefined}
              onClick={h.removable?()=>onRemove(h.id,h.label):undefined}
              title={h.removable?"คลิกเพื่อยกเลิกรายการนี้ (ไม่กระทบรายการอื่น)":undefined}
              style={{flex:"none",height:44,display:"flex",alignItems:"center",gap:8,padding:"0 10px 0 12px",
                borderRadius:10,border:"1px solid #1f2433",background:"#0e1118",opacity:1-i*0.15,
                cursor:h.removable?"pointer":"default",font:"inherit",color:"inherit"}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:h.color,flexShrink:0}}/>
              <span style={{fontSize:16,fontWeight:600,letterSpacing:".04em",whiteSpace:"nowrap",color:"#dfe2ea",
                fontFamily:"'Barlow Condensed',sans-serif"}}>{h.label}</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#6c7388"}}>{fmt(h.atTenths)}</span>
              {h.removable&&<span style={{fontSize:13,fontWeight:700,color:"#ff6b6b",marginLeft:2}}>✕</span>}
            </Tag>
          );
        })}
      </div>
      <button onClick={onOpen} style={{height:64,padding:"0 18px",borderRadius:12,border:"1px solid #262b3a",
        background:"#12151e",color:"#e8eaf0",fontSize:20,fontWeight:700,letterSpacing:".06em",cursor:"pointer",
        flexShrink:0,fontFamily:"'Barlow Condensed',sans-serif"}}>📜 HISTORY ({history.length})</button>
    </div>
  );
}

/* ── Full history — every recorded action, newest first ── */
function HistoryModal({history,teamA,teamB,onRemove,onUndo,onClose}){
  const [filter,setFilter]=useState("all");
  const F={fontFamily:"'Barlow Condensed',sans-serif"};
  const list=history.filter(h=>filter==="all"||(filter==="ft"?h.ft:h.team===filter));
  const chipS=on=>({height:40,padding:"0 14px",borderRadius:10,border:`1px solid ${on?"#e8eaf0":"#262b3a"}`,
    background:on?"#262b3a":"#161a24",color:on?"#f4f5f8":"#7a8194",fontSize:16,fontWeight:700,cursor:"pointer",...F});
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:60,background:"rgba(4,5,8,.8)",display:"flex",
      alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"min(720px,96vw)",maxHeight:"90vh",display:"flex",flexDirection:"column",
        background:"#10131c",border:"1px solid #262b3a",borderRadius:20,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid #1f2433"}}>
          <span style={{...F,fontSize:24,fontWeight:800,letterSpacing:".1em",color:"#f4f5f8"}}>📜 HISTORY · {history.length} รายการ</span>
          <button onClick={onClose} style={{width:44,height:40,borderRadius:10,border:"1px solid #262b3a",background:"#161a24",color:"#e8eaf0",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex",gap:6,padding:"12px 18px",flexWrap:"wrap"}}>
          {[["all","ทั้งหมด"],["teamA",teamA.name],["teamB",teamB.name],["ft","Free throw"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={chipS(filter===v)}>{l}</button>
          ))}
        </div>
        <div style={{overflowY:"auto",padding:"0 18px 12px"}}>
          {!list.length&&<div style={{...F,color:"#6c7388",fontSize:16,textAlign:"center",padding:"24px 0"}}>ยังไม่มีรายการ</div>}
          {list.map((h,i)=>(
            <div key={h.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 4px",borderBottom:"1px solid #1a1e2a"}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:"#6c7388",width:52,flexShrink:0}}>{fmt(h.atTenths)}</span>
              <span style={{width:10,height:10,borderRadius:"50%",background:h.color,flexShrink:0}}/>
              <span style={{...F,flex:1,minWidth:0,fontSize:19,fontWeight:600,color:"#dfe2ea",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{h.label}</span>
              {filter==="all"&&i===0&&<button onClick={onUndo} style={{...F,height:34,padding:"0 12px",borderRadius:8,border:"1px solid #3a3350",
                background:"#171425",color:"#d6ccff",fontSize:15,fontWeight:700,cursor:"pointer"}}>↶ UNDO</button>}
              {h.removable&&<button onClick={()=>{if(window.confirm(`ยกเลิกรายการ "${h.label}"? (ไม่กระทบรายการอื่น)`))onRemove(h.id,h.label);}}
                style={{...F,height:34,padding:"0 12px",borderRadius:8,border:"1px solid #4a2530",background:"#1a1216",color:"#ff7b7b",
                fontSize:15,fontWeight:700,cursor:"pointer"}}>✕ ยกเลิก</button>}
            </div>
          ))}
        </div>
        <div style={{...F,padding:"10px 18px 14px",borderTop:"1px solid #1f2433",fontSize:14,color:"#6c7388"}}>
          ✕ ยกเลิก = ลบเฉพาะรายการนั้น (คะแนน/ฟาวล์/FT/ปรับเวลา) · UNDO = ย้อนรายการล่าสุด
        </div>
      </div>
    </div>
  );
}

/* ── Settings modal ── */
function SettingsModal({state,send,doScoreCorrect,doFoul,doTimeout,doClockAdjust,doShotAdjust,doShotReset,courtId,divisionId,divConfig,divisions,displaySize,setDisplaySize,onClose,onOpenReset}){
  const {teamA,teamB}=state;
  const rows=[
    // Score here is a stat correction (doScoreCorrect), not a live basket — it
    // must not reset the shot clock the way the main +1/+2 buttons do.
    {label:"คะแนน", hv:teamA.score, av:teamB.score, hMinus:()=>doScoreCorrect("teamA",-1), hPlus:()=>doScoreCorrect("teamA",1), aMinus:()=>doScoreCorrect("teamB",-1), aPlus:()=>doScoreCorrect("teamB",1)},
    {label:"ฟาวล์", hv:teamA.teamFouls, av:teamB.teamFouls, hMinus:()=>doFoul("teamA",-1), hPlus:()=>doFoul("teamA",1), aMinus:()=>doFoul("teamB",-1), aPlus:()=>doFoul("teamB",1)},
    {label:"T.O.", hv:teamA.timeouts, av:teamB.timeouts, hMinus:()=>send("timeout","teamA",-1), hPlus:()=>send("timeout","teamA",1), aMinus:()=>send("timeout","teamB",-1), aPlus:()=>send("timeout","teamB",1)},
  ];
  const chip=(active)=>active?{bg:"#2a1a12",color:"#ff8a55",border:"#ff6a33"}:{bg:"#161a24",color:"#aab0c2",border:"#262b3a"};
  const F={fontFamily:"'Barlow Condensed',sans-serif"};
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(3,4,7,.8)",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:100,padding:16}}>
      <div onClick={e=>e.stopPropagation()} data-screen-label="Settings" style={{width:"min(980px,96vw)",maxHeight:"94vh",
        overflow:"auto",background:"#0f1219",border:"1px solid #262b3a",borderRadius:20,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 14px 14px 22px",borderBottom:"1px solid #1f2433"}}>
          <span style={{...F,fontSize:26,fontWeight:700,letterSpacing:".12em"}}>⚙︎ SETTINGS</span>
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{width:44,height:44,borderRadius:12,border:"1px solid #262b3a",
            background:"#161a24",color:"#e8eaf0",fontSize:22,cursor:"pointer"}}>✕</button>
        </div>

        <div className="settings-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:16,padding:"18px 22px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <span style={{...F,fontSize:14,letterSpacing:".22em",color:"#7a8194",fontWeight:700}}>GAME CLOCK</span>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <button onClick={()=>doClockAdjust(600)} style={btn()}>+1M</button>
                <button onClick={()=>doClockAdjust(100)} style={btn()}>+10S</button>
                <button onClick={()=>doClockAdjust(10)} style={btn()}>+1S</button>
              </div>
              <div style={{height:86,borderRadius:14,background:"#000",border:"1px solid #1f2433",display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:64,fontWeight:800,fontVariantNumeric:"tabular-nums",...F}}>{fmt(state.clockTenths)}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <button onClick={()=>doClockAdjust(-600)} style={btnNeg()}>−1M</button>
                <button onClick={()=>doClockAdjust(-100)} style={btnNeg()}>−10S</button>
                <button onClick={()=>doClockAdjust(-10)} style={btnNeg()}>−1S</button>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <span style={{...F,fontSize:14,letterSpacing:".22em",color:"#7a8194",fontWeight:700}}>SHOT CLOCK</span>
              <div style={{display:"grid",gridTemplateColumns:"64px minmax(0,1fr) 64px 96px",gap:8}}>
                <button onClick={()=>doShotAdjust(-10)} style={btnNeg()}>−1</button>
                <div style={{height:64,borderRadius:12,background:"#000",border:"1px solid #1f2433",display:"flex",
                  alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:800,fontVariantNumeric:"tabular-nums",...F}}>{fmtS(state.shotClockTenths)}</div>
                <button onClick={()=>doShotAdjust(10)} style={btn()}>+1</button>
                <button onClick={doShotReset} style={btn()}>↺ 12</button>
              </div>
              {(()=>{const on=state.showShotClock!==false; return(
                <button onClick={()=>send("shotClockVisible",null,!on)} style={{height:52,borderRadius:12,
                  border:`1px solid ${on?"#1f9d5a":"#3a2328"}`,background:on?"#0f2a1c":"#1a1216",
                  color:on?"#4fe39a":"#ff7b7b",fontSize:18,fontWeight:700,cursor:"pointer",...F}}>
                  แสดงบนจอ TV / Overlay: {on?"เปิด":"ปิด"}
                </button>
              );})()}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <span style={{...F,fontSize:14,letterSpacing:".22em",color:"#7a8194",fontWeight:700}}>ขนาดจอ</span>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {DISPLAY_SIZE_LABELS.map(([v,l])=>{const s=chip(v===displaySize); return(
                  <button key={v} onClick={()=>setDisplaySize(v)} style={{height:52,borderRadius:12,
                    border:`1px solid ${s.border}`,background:s.bg,color:s.color,fontSize:18,fontWeight:700,
                    cursor:"pointer",...F}}>{l}</button>
                );})}
              </div>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div className="settings-row3" style={{display:"grid",gridTemplateColumns:"80px minmax(0,1fr) minmax(0,1fr)",gap:8,alignItems:"center"}}>
              <span/>
              <span style={{textAlign:"center",fontSize:20,fontWeight:800,letterSpacing:".1em",color:teamA.color,...F}}>{teamA.name}</span>
              <span style={{textAlign:"center",fontSize:20,fontWeight:800,letterSpacing:".1em",color:teamB.color,...F}}>{teamB.name}</span>
            </div>
            {rows.map(r=>(
              <div key={r.label} className="settings-row3" style={{display:"grid",gridTemplateColumns:"80px minmax(0,1fr) minmax(0,1fr)",gap:8,alignItems:"center"}}>
                <span style={{fontSize:14,letterSpacing:".18em",color:"#7a8194",fontWeight:700,...F}}>{r.label}</span>
                <Stepper onMinus={r.hMinus} onPlus={r.hPlus} value={r.hv}/>
                <Stepper onMinus={r.aMinus} onPlus={r.aPlus} value={r.av}/>
              </div>
            ))}
            <div style={{height:1,background:"#1f2433",margin:"6px 0"}}/>
            <div style={{display:"grid",gridTemplateColumns:"80px minmax(0,1fr)",gap:8,alignItems:"center"}}>
              <span style={{fontSize:14,letterSpacing:".18em",color:"#7a8194",fontWeight:700,...F}}>สนาม</span>
              <div style={{display:"flex",gap:8}}>
                {COURTS.map(c=>{const s=chip(c===courtId);return(
                  <a key={c} href={`/scoreboard?court=${c}&division=${divisionId}`} style={{flex:1,height:64,
                    borderRadius:12,border:`1px solid ${s.border}`,background:s.bg,color:s.color,fontSize:22,fontWeight:700,
                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",...F}}>{c}</a>
                );})}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"80px minmax(0,1fr)",gap:8,alignItems:"center"}}>
              <span style={{fontSize:14,letterSpacing:".18em",color:"#7a8194",fontWeight:700,...F}}>รุ่น</span>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {divisions.map(d=>{const s=chip(d.id===divisionId);return(
                  <a key={d.id} href={`/scoreboard?court=${courtId}&division=${d.id}`} style={{flex:"1 1 90px",minWidth:0,height:64,padding:"0 6px",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",
                    borderRadius:12,border:`1px solid ${s.border}`,background:s.bg,color:s.color,fontSize:18,fontWeight:700,
                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",...F}}>{d.label.toUpperCase()}</a>
                );})}
              </div>
            </div>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 22px 18px",borderTop:"1px solid #1f2433"}}>
          <span style={{fontFamily:"'IBM Plex Sans Thai',sans-serif",fontSize:14,color:"#6c7388"}}>ทุกการแก้ไขย้อนได้ด้วย UNDO</span>
          <div style={{flex:1}}/>
          <button onClick={onOpenReset} style={{height:64,padding:"0 24px",borderRadius:12,border:"1px solid #5a2328",
            background:"#1c1216",color:"#ff6b6b",fontSize:22,fontWeight:700,letterSpacing:".08em",cursor:"pointer",...F}}>↺ RESET GAME</button>
        </div>
      </div>
    </div>
  );
}
function btn(){return{height:64,borderRadius:12,border:"1px solid #262b3a",background:"#161a24",color:"#e8eaf0",
  fontSize:22,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif"};}
function btnNeg(){return{...btn(),border:"1px solid #3a2328",background:"#1a1216",color:"#ff7b7b"};}
function Stepper({onMinus,onPlus,value}){
  return(
    <div className="stepper" style={{display:"grid",gridTemplateColumns:"64px minmax(0,1fr) 64px",border:"1px solid #262b3a",borderRadius:12,overflow:"hidden"}}>
      <button onClick={onMinus} style={{height:64,border:"none",background:"#161a24",color:"#e8eaf0",fontSize:28,cursor:"pointer"}}>−</button>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:800,
        fontVariantNumeric:"tabular-nums",background:"#000",fontFamily:"'Barlow Condensed',sans-serif"}}>{value}</div>
      <button onClick={onPlus} style={{height:64,border:"none",background:"#161a24",color:"#e8eaf0",fontSize:28,cursor:"pointer"}}>+</button>
    </div>
  );
}

function ResetConfirm({state,onCancel,onConfirm}){
  return(
    <div onClick={onCancel} style={{position:"fixed",inset:0,background:"rgba(3,4,7,.84)",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:110,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"min(500px,92vw)",background:"#0f1219",border:"1px solid #5a2328",
        borderRadius:20,padding:24,display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontFamily:"'IBM Plex Sans Thai',sans-serif",fontSize:26,fontWeight:600}}>รีเซ็ตเกม?</div>
        <div style={{fontFamily:"'IBM Plex Sans Thai',sans-serif",fontSize:16,lineHeight:1.5,color:"#aab0c2"}}>
          คะแนน {state.teamA.score}–{state.teamB.score} ฟาวล์ T.O. และเวลาจะเริ่มใหม่
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8}}>
          <button onClick={onCancel} style={{height:72,borderRadius:12,border:"1px solid #262b3a",background:"#161a24",
            color:"#e8eaf0",fontFamily:"'IBM Plex Sans Thai',sans-serif",fontSize:20,fontWeight:600,cursor:"pointer"}}>ยกเลิก</button>
          <button onClick={onConfirm} style={{height:72,borderRadius:12,border:"none",background:"#d63a3a",color:"#fff",
            fontSize:24,fontWeight:800,letterSpacing:".08em",cursor:"pointer"}}>RESET</button>
        </div>
      </div>
    </div>
  );
}

export default function ScoreboardPage(){
  const [sp]           = useSearchParams();
  const nav            = useNavigate();
  const courtId        = (sp.get("court")||"A").toUpperCase();
  const divisions      = useDivisions();
  const divisionId     = sp.get("division")||divisions[0].id;
  const divConfig      = findDivision(divisions,divisionId);
  const { state, connected: conn, send } = useGameState(courtId);
  const [mobileTab,setMobileTab] = useState("clock");
  const [modal,setModal] = useState(null); // null | "settings" | "reset" | "history"
  const [undone,setUndone]   = useState(null);
  // Per-browser display-size preference (how big the shot/game clock render on
  // this operator's own screen) — not game state, so it lives in localStorage
  // rather than going through the server/socket.
  const [displaySize,setDisplaySize] = useState(()=>{
    try{ const v=localStorage.getItem("scoreboardDisplaySize"); return DISPLAY_SIZES[v]?v:"md"; }catch{ return "md"; }
  });
  useEffect(()=>{ try{ localStorage.setItem("scoreboardDisplaySize",displaySize); }catch{} },[displaySize]);
  const undoneTimer = useRef(null);
  const prevGC = useRef(null), prevSC = useRef(null);
  const stateRef = useRef(null); stateRef.current = state;

  // Score/foul/timeout/clock/possession corrections are undoable — the server
  // keeps the actual history stack and reverts to an exact prior snapshot, so
  // every viewer of this court sees the same undo, not just this browser tab.
  const doScore       = useCallback((tKey,delta)=>send("score",tKey,delta),[send]);
  // Stat correction, not a live basket — unlike doScore, this never resets the
  // shot clock (see server's "scoreCorrect" handling). Used by the Settings
  // score stepper, for fixing a mis-recorded point total after the fact.
  const doScoreCorrect= useCallback((tKey,delta)=>send("scoreCorrect",tKey,delta),[send]);
  const doFoul        = useCallback((tKey,delta)=>send("teamFoul",tKey,delta),[send]);
  const doFT          = useCallback((tKey,made)=>send(made?"ftMade":"ftMiss",tKey,1),[send]);
  const doTimeout     = useCallback((tKey)=>{
    const s=stateRef.current; if(!s||s[tKey].timeouts<=0) return;
    send("timeout",tKey,-1); playHorn();
  },[send]);
  const doClockToggle = useCallback(()=>{
    const s=stateRef.current; if(!s||s.gameOver) return;
    send("clockToggle");
  },[send]);
  const doClockAdjust = useCallback((delta)=>send("clockAdjust",null,delta),[send]);
  const doShotAdjust  = useCallback((delta)=>send("shotClockAdjust",null,delta),[send]);
  const doShotReset   = useCallback(()=>send("shotClockSet",null,12),[send]);
  const doShotToggle  = useCallback(()=>send("shotClockToggle"),[send]);
  const doPossession  = useCallback((tKey)=>{
    const s=stateRef.current; if(!s) return;
    send("possession",null, s.possession===tKey?null:tKey);
  },[send]);
  const doJumpBall    = useCallback(()=>send("jumpBall"),[send]);

  const undo = useCallback(()=>{
    const top = stateRef.current?.history?.[0];
    if(!top) return;
    send("undo");
    clearTimeout(undoneTimer.current);
    setUndone(top.label);
    undoneTimer.current=setTimeout(()=>setUndone(null),2500);
  },[send]);

  // Remove one specific history entry (e.g. a score credited to the wrong
  // team) without touching anything that happened after it — unlike UNDO,
  // which always rolls back the single most recent action.
  const removeHistoryEntry = useCallback((id,label)=>{
    send("removeHistory",null,id);
    clearTimeout(undoneTimer.current);
    setUndone(label);
    undoneTimer.current=setTimeout(()=>setUndone(null),2500);
  },[send]);

  useEffect(()=>{
    if(!state) return;
    if(prevGC.current!==null&&prevGC.current>0&&state.clockTenths===0) playBuzzer();
    if(prevSC.current!==null&&prevSC.current>0&&state.shotClockTenths===0) playHorn();
    prevGC.current=state.clockTenths; prevSC.current=state.shotClockTenths;
  },[state?.clockTenths,state?.shotClockTenths]);

  useEffect(()=>{
    const h=e=>{
      if(e.target.tagName==="INPUT") return;
      if((e.ctrlKey||e.metaKey)&&(e.key==="z"||e.key==="Z")){e.preventDefault();undo();return;}
      if(e.code==="Space"){e.preventDefault();doClockToggle();}
      else if(e.key==="c"||e.key==="C"){e.preventDefault();doShotToggle();}
      else if(e.key==="z"||e.key==="Z"){e.preventDefault();doShotReset();}
      else if(e.key==="h"||e.key==="H"){e.preventDefault();playHorn();}
      else if(e.key==="e"||e.key==="E"){e.preventDefault();setModal("settings");}
      else if(e.key==="q"||e.key==="Q"){e.preventDefault();doScore("teamA",1);}
      else if(e.key==="w"||e.key==="W"){e.preventDefault();doScore("teamA",2);}
      else if(e.key==="o"||e.key==="O"){e.preventDefault();doScore("teamB",1);}
      else if(e.key==="p"||e.key==="P"){e.preventDefault();doScore("teamB",2);}
      else if(e.key==="a"||e.key==="A"){e.preventDefault();doFT("teamA",true);}
      else if(e.key==="s"||e.key==="S"){e.preventDefault();doFT("teamA",false);}
      else if(e.key==="k"||e.key==="K"){e.preventDefault();doFT("teamB",true);}
      else if(e.key==="l"||e.key==="L"){e.preventDefault();doFT("teamB",false);}
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[doClockToggle,doShotToggle,doShotReset,doScore,doFT,undo]);

  if(!state) return(
    <div style={{minHeight:"100vh",background:"#07080c",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:52}}>🏀</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:"#FFF",letterSpacing:"0.2em"}}>CONNECTING — COURT {courtId}</div>
      {!conn&&<div style={{fontFamily:"'IBM Plex Sans Thai',sans-serif",color:"#FF5555",fontSize:12}}>⚠️ ตรวจสอบว่า server รันอยู่ที่ port 3001</div>}
    </div>
  );

  return(
    <div onClick={unlock} className="page-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        html,body{margin:0;background:#07080c;color:#e8eaf0;}
        *{box-sizing:border-box;}
        button{font:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation;cursor:pointer;}
        button:disabled{cursor:not-allowed;}
        a{text-decoration:none;}
        .page-root{height:100vh;min-height:640px;display:flex;flex-direction:column;gap:10px;
          padding:12px 14px 14px;background:#07080c;font-family:'Barlow Condensed','IBM Plex Sans Thai',sans-serif;
          color:#e8eaf0;overflow:hidden;user-select:none;}
        .board-grid,.control-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr) minmax(0,1fr);gap:10px;}
        .board-grid{flex:1;min-height:0;}
        .control-grid{flex:none;}
        .mobile-tabs{display:none;}
        @media (max-width:900px){
          .page-root{height:100dvh;overflow-y:auto;}
          .mobile-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;flex-shrink:0;}
          .mobile-tabs button{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;letter-spacing:0.04em;
            padding:9px 0;border-radius:9px;background:rgba(255,255,255,0.05);
            border:1.5px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);}
          .mobile-tabs button.active{background:rgba(255,255,255,0.14);border-color:rgba(255,255,255,0.4);color:#FFF;}
          .board-grid,.control-grid{grid-template-columns:1fr;}
          .board-grid>*,.control-grid>*{display:none !important;}
          .board-grid[data-tab="home"]>*:nth-child(1),.control-grid[data-tab="home"]>*:nth-child(1){display:flex !important;flex-direction:column;}
          .board-grid[data-tab="clock"]>*:nth-child(2),.control-grid[data-tab="clock"]>*:nth-child(2){display:flex !important;flex-direction:column;}
          .board-grid[data-tab="away"]>*:nth-child(3),.control-grid[data-tab="away"]>*:nth-child(3){display:flex !important;flex-direction:column;}
          .history-bar[data-tab]:not([data-tab="clock"]),.tournament-wrap[data-tab]:not([data-tab="clock"]){display:none;}
        }
        @media (max-width:600px){
          .score-value{font-size:60px !important;}
        }
        @media (max-width:720px){
          .settings-grid{grid-template-columns:1fr !important;}
          .settings-row3{grid-template-columns:56px minmax(0,1fr) minmax(0,1fr) !important;gap:4px !important;}
          .stepper{grid-template-columns:36px minmax(0,1fr) 36px !important;}
          .stepper button{font-size:20px !important;}
        }
      `}</style>

      <div style={{display:"flex",alignItems:"center",gap:10,flex:"none",height:56}}>
        <button onClick={()=>nav("/")} aria-label="กลับหน้าหลัก" style={{width:56,height:56,borderRadius:12,
          border:"1px solid #232838",background:"#11141c",color:"#c9ceda",fontSize:22,flexShrink:0}}>←</button>
        <div style={{display:"flex",alignItems:"baseline",gap:12,paddingLeft:4,minWidth:0,flexWrap:"wrap"}}>
          <span style={{fontSize:24,fontWeight:700,letterSpacing:".1em"}}>3X3</span>
          <span style={{fontSize:18,fontWeight:600,letterSpacing:".08em",color:"#aab0c2"}}>สนาม {courtId}</span>
          <span style={{fontSize:18,fontWeight:600,letterSpacing:".08em",color:divConfig.color}}>{divConfig.label.toUpperCase()}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,height:26,padding:"0 10px",borderRadius:999,
          border:"1px solid #232838",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#9aa1b5",flexShrink:0}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:conn?"#2fd07a":"#ff4d4d"}}/>{conn?"LIVE":"OFFLINE"}
        </div>
        <div style={{flex:1}}/>
        <a href={`/tv?court=${courtId}`} target="_blank" rel="noreferrer" style={{height:56,padding:"0 18px",
          borderRadius:12,border:"1px solid #232838",background:"#11141c",color:"#e8eaf0",fontSize:18,fontWeight:600,
          letterSpacing:".1em",display:"flex",alignItems:"center",flexShrink:0}}>TV ↗</a>
        <button onClick={()=>setModal("settings")} title="Settings (E)" style={{width:56,height:56,borderRadius:12,
          border:"1px solid #232838",background:"#11141c",color:"#e8eaf0",fontSize:26,lineHeight:1,flexShrink:0}}>⚙︎</button>
      </div>

      <div className="mobile-tabs">
        <button className={mobileTab==="home"?"active":""} onClick={()=>setMobileTab("home")}>{state.teamA.name||"HOME"}</button>
        <button className={mobileTab==="clock"?"active":""} onClick={()=>setMobileTab("clock")}>⏱ CLOCK</button>
        <button className={mobileTab==="away"?"active":""} onClick={()=>setMobileTab("away")}>{state.teamB.name||"AWAY"}</button>
      </div>
      <div className="tournament-wrap" data-tab={mobileTab}>
        <TournamentBridge state={state} send={send} divisionId={divisionId} courtId={courtId}/>
      </div>

      <div className="board-grid" data-tab={mobileTab}>
        <TeamPanel team={state.teamA} tKey="teamA" send={send} state={state} align="left"/>
        <CenterDisplay state={state} send={send} doPossession={doPossession} doJumpBall={doJumpBall} displaySize={displaySize}/>
        <TeamPanel team={state.teamB} tKey="teamB" send={send} state={state} align="right"/>
      </div>

      <div className="control-grid" data-tab={mobileTab}>
        <TeamControls team={state.teamA} tKey="teamA" doScore={doScore} doFoul={doFoul} doTimeout={doTimeout} doFT={doFT} kbd1="Q" kbd2="W" kbdFtMade="A" kbdFtMiss="S"/>
        <CenterControls state={state} doClockToggle={doClockToggle} doShotReset={doShotReset} doShotToggle={doShotToggle} onHorn={playHorn}/>
        <TeamControls team={state.teamB} tKey="teamB" doScore={doScore} doFoul={doFoul} doTimeout={doTimeout} doFT={doFT} kbd1="O" kbd2="P" kbdFtMade="K" kbdFtMiss="L"/>
      </div>

      <div className="history-bar" data-tab={mobileTab}>
        <HistoryBar history={state.history||[]} undone={undone} onUndo={undo} onRemove={removeHistoryEntry} onOpen={()=>setModal("history")}/>
      </div>

      {modal==="settings"&&(
        <SettingsModal state={state} send={send} doScoreCorrect={doScoreCorrect} doFoul={doFoul} doTimeout={doTimeout}
          doClockAdjust={doClockAdjust} doShotAdjust={doShotAdjust} doShotReset={doShotReset}
          courtId={courtId} divisionId={divisionId} divConfig={divConfig} divisions={divisions}
          displaySize={displaySize} setDisplaySize={setDisplaySize}
          onClose={()=>setModal(null)} onOpenReset={()=>setModal("reset")}/>
      )}
      {modal==="history"&&(
        <HistoryModal history={state.history||[]} teamA={state.teamA} teamB={state.teamB}
          onRemove={removeHistoryEntry} onUndo={undo} onClose={()=>setModal(null)}/>
      )}
      {modal==="reset"&&(
        <ResetConfirm state={state} onCancel={()=>setModal("settings")} onConfirm={()=>{send("resetGame");setModal(null);}}/>
      )}
    </div>
  );
}

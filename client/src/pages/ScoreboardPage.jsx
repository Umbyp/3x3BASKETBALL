/**
 * 🎮 ScoreboardPage — Operator control
 * /scoreboard?court=A&division=open
 * Keyboard: SPACE=clock, C=shot hold, Z=12s, H=horn, Q/W=home +1/+2, O/P=away +1/+2, CTRL+Z=undo, E=settings
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { socket } from "../socket.js";
import { DIVISIONS, COURTS, RULES } from "../constants.js";
import TournamentBridge from "../components/scoreboard/TournamentBridge.jsx";

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

function ColorDot({color,onPick}){
  const [o,setO]=useState(false);
  return(
    <div style={{position:"relative"}}>
      <button onClick={e=>{e.stopPropagation();setO(v=>!v);}} title="เปลี่ยนสีทีม" style={{width:14,height:14,borderRadius:"50%",
        background:color,border:"2px solid rgba(0,0,0,0.35)",cursor:"pointer",flexShrink:0}}/>
      {o&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:20,left:0,zIndex:80,background:"#0f1219",
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

  return(
    <div data-screen-label={tKey==="teamA"?"Home":"Away"} style={{display:"flex",flexDirection:"column",minHeight:0,
      background:"#10131c",border:"1px solid #1f2433",borderRadius:20,overflow:"hidden"}}>
      <div style={{height:52,flex:"none",display:"flex",alignItems:"center",gap:10,padding:"0 14px",
        background:team.color,color:txt,flexDirection:flip?"row-reverse":"row"}}>
        <ColorDot color={team.color} onPick={c=>send("teamColor",tKey,c)}/>
        {editing
          ?<input autoFocus value={input} maxLength={20} onChange={e=>setInput(e.target.value.toUpperCase())}
              onBlur={save} onKeyDown={e=>e.key==="Enter"&&save()}
              style={{background:"none",border:"none",borderBottom:`2px solid ${txt}`,outline:"none",color:txt,
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,letterSpacing:".08em",
                width:140,textAlign:flip?"right":"left"}}/>
          :<span onClick={()=>setEditing(true)} style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,
              fontSize:26,letterSpacing:".08em",cursor:"pointer",flex:flip?"none":1}}>{team.name}</span>
        }
        {isWin&&<span style={{padding:"2px 8px",borderRadius:5,background:txt,color:team.color,fontSize:14,
          fontWeight:800,letterSpacing:".1em"}}>WIN</span>}
        <div style={{flex:1}}/>
        {isPoss&&<span style={{fontSize:20,fontWeight:800}}>{flip?"BALL ●":"● BALL"}</span>}
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
      </div>
      <div style={{flex:"none",height:30,display:"flex",alignItems:"center",justifyContent:"center",gap:10,
        background:bonus?"#ffb020":"transparent",color:"#140c02",fontSize:18,fontWeight:800,letterSpacing:".1em"}}>
        {bonus?"BONUS 2FT":""}
      </div>
    </div>
  );
}

/* ── Team controls — the buttons an operator actually presses ── */
function TeamControls({team,tKey,doScore,doFoul,doTimeout,kbd1,kbd2}){
  const txt = textOn(team.color);
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"104px 72px",gap:8}}>
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
    </div>
  );
}

/* ── Center scoreboard display ── */
function CenterDisplay({state,send,doPossession,doJumpBall}){
  const {clockTenths,isRunning,shotClockTenths,possession,gameOver,winner,isOvertime,teamA,teamB}=state;
  const shotSec=shotClockTenths/10, shotRed=shotSec<=5&&shotClockTenths>0;
  const status = gameOver?"FINAL":isOvertime?(isRunning?"OVERTIME":"OT · PAUSED"):isRunning?"RUNNING":"PAUSED";
  const statusColor = gameOver||isOvertime?"#ffb020":isRunning?"#2fd07a":"#7a8194";
  let subline="", sublineColor="#aab0c2";
  if(gameOver){ subline=`${winner==="teamA"?teamA.name:teamB.name} ชนะ · ${teamA.score}–${teamB.score}`; sublineColor=winner==="teamA"?teamA.color:teamB.color; }
  else if(isOvertime){ subline="ต่อเวลา"; sublineColor="#ffc74d"; }
  const poss=(t)=> possession===t ? {bg:state[t].color,color:textOn(state[t].color),border:state[t].color} : {bg:"#171b27",color:"#8a91a6",border:"#2a3042"};
  const hp=poss("teamA"), ap=poss("teamB");

  return(
    <div style={{display:"flex",flexDirection:"column",gap:4,minHeight:0,background:"#0d1018",border:"1px solid #1f2433",
      borderRadius:20,padding:"12px 18px 14px",flex:1,justifyContent:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:13,letterSpacing:".24em",color:"#7a8194",fontWeight:600,fontFamily:"'Barlow Condensed',sans-serif"}}>GAME</span>
        <div style={{flex:1}}/>
        <span style={{width:8,height:8,borderRadius:"50%",background:statusColor}}/>
        <span style={{fontSize:15,letterSpacing:".2em",fontWeight:700,color:statusColor,fontFamily:"'Barlow Condensed',sans-serif"}}>{status}</span>
      </div>
      <div style={{textAlign:"center",fontSize:"clamp(72px,15vh,150px)",fontWeight:800,lineHeight:.95,
        fontFamily:"'Barlow Condensed',sans-serif",fontVariantNumeric:"tabular-nums",color:"#f4f5f8"}}>{fmt(clockTenths)}</div>
      {subline&&<div style={{textAlign:"center",fontFamily:"'IBM Plex Sans Thai',sans-serif",fontSize:15,fontWeight:600,color:sublineColor}}>{subline}</div>}

      <div style={{height:1,background:"#1f2433",margin:"6px 0"}}/>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <span style={{fontSize:13,letterSpacing:".24em",color:"#7a8194",fontWeight:600,fontFamily:"'Barlow Condensed',sans-serif"}}>SHOT</span>
        <div style={{flex:1,textAlign:"center",fontSize:"clamp(56px,11vh,104px)",fontWeight:800,lineHeight:.95,
          fontFamily:"'Barlow Condensed',sans-serif",fontVariantNumeric:"tabular-nums",
          color:shotRed?"#ff4d4d":"#f4f5f8"}}>{fmtS(shotClockTenths)}</div>
        <div style={{width:60}}/>
      </div>
      <div style={{height:6,borderRadius:3,background:"#1a1f2c",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(100,(shotClockTenths/120)*100)}%`,background:shotRed?"#ff4d4d":"#f4f5f8"}}/>
      </div>

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
function HistoryBar({history,undone,onUndo}){
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
        {history.slice(0,6).map((h,i)=>(
          <div key={h.id} style={{flex:"none",height:44,display:"flex",alignItems:"center",gap:8,padding:"0 12px",
            borderRadius:10,border:"1px solid #1f2433",background:"#0e1118",opacity:1-i*0.15}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:h.color}}/>
            <span style={{fontSize:16,fontWeight:600,letterSpacing:".04em",whiteSpace:"nowrap",color:"#dfe2ea",
              fontFamily:"'Barlow Condensed',sans-serif"}}>{h.label}</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#6c7388"}}>{fmt(h.atTenths)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Settings modal ── */
function SettingsModal({state,send,doScore,doFoul,doTimeout,doClockAdjust,doShotAdjust,doShotReset,courtId,divisionId,divConfig,onClose,onOpenReset}){
  const {teamA,teamB}=state;
  const rows=[
    {label:"คะแนน", hv:teamA.score, av:teamB.score, hMinus:()=>doScore("teamA",-1), hPlus:()=>doScore("teamA",1), aMinus:()=>doScore("teamB",-1), aPlus:()=>doScore("teamB",1)},
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
              <div style={{display:"flex",gap:8}}>
                {DIVISIONS.map(d=>{const s=chip(d.id===divisionId);return(
                  <a key={d.id} href={`/scoreboard?court=${courtId}&division=${d.id}`} style={{flex:1,height:64,
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
  const divisionId     = sp.get("division")||"open";
  const divConfig      = DIVISIONS.find(d=>d.id===divisionId)||DIVISIONS[0];
  const [state,setS]   = useState(null);
  const [conn,setConn] = useState(false);
  const [mobileTab,setMobileTab] = useState("clock");
  const [modal,setModal] = useState(null); // null | "settings" | "reset"
  const [undone,setUndone]   = useState(null);
  const undoneTimer = useRef(null);
  const prevGC = useRef(null), prevSC = useRef(null);
  const stateRef = useRef(null); stateRef.current = state;

  const send = useCallback((type,team,value)=>socket.emit("action",{courtId,type,team,value}),[courtId]);

  // Score/foul/timeout/clock/possession corrections are undoable — the server
  // keeps the actual history stack and reverts to an exact prior snapshot, so
  // every viewer of this court sees the same undo, not just this browser tab.
  const doScore       = useCallback((tKey,delta)=>send("score",tKey,delta),[send]);
  const doFoul        = useCallback((tKey,delta)=>send("teamFoul",tKey,delta),[send]);
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

  useEffect(()=>{
    const onConnect = ()=>{setConn(true);socket.emit("joinCourt",courtId);};
    socket.on("connect",onConnect);
    socket.on("disconnect",()=>setConn(false));
    socket.on("stateUpdate",s=>{if(s)setS(s);});
    if(socket.connected){setConn(true);socket.emit("joinCourt",courtId);}
    return()=>{socket.off("connect",onConnect);socket.off("disconnect");socket.off("stateUpdate");};
  },[courtId]);

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
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[doClockToggle,doShotToggle,doShotReset,doScore,undo]);

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
        <CenterDisplay state={state} send={send} doPossession={doPossession} doJumpBall={doJumpBall}/>
        <TeamPanel team={state.teamB} tKey="teamB" send={send} state={state} align="right"/>
      </div>

      <div className="control-grid" data-tab={mobileTab}>
        <TeamControls team={state.teamA} tKey="teamA" doScore={doScore} doFoul={doFoul} doTimeout={doTimeout} kbd1="Q" kbd2="W"/>
        <CenterControls state={state} doClockToggle={doClockToggle} doShotReset={doShotReset} doShotToggle={doShotToggle} onHorn={playHorn}/>
        <TeamControls team={state.teamB} tKey="teamB" doScore={doScore} doFoul={doFoul} doTimeout={doTimeout} kbd1="O" kbd2="P"/>
      </div>

      <div className="history-bar" data-tab={mobileTab}>
        <HistoryBar history={state.history||[]} undone={undone} onUndo={undo}/>
      </div>

      {modal==="settings"&&(
        <SettingsModal state={state} send={send} doScore={doScore} doFoul={doFoul} doTimeout={doTimeout}
          doClockAdjust={doClockAdjust} doShotAdjust={doShotAdjust} doShotReset={doShotReset}
          courtId={courtId} divisionId={divisionId} divConfig={divConfig}
          onClose={()=>setModal(null)} onOpenReset={()=>setModal("reset")}/>
      )}
      {modal==="reset"&&(
        <ResetConfirm state={state} onCancel={()=>setModal("settings")} onConfirm={()=>{send("resetGame");setModal(null);}}/>
      )}
    </div>
  );
}

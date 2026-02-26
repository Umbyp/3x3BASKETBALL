/**
 * 🎮 ScoreboardPage — Operator control
 * /scoreboard?court=A&division=open
 * Keyboard: SPACE=clock, C=shot, Z=12s, X=8s, H=horn
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { socket } from "../socket.js";
import { DIVISIONS, COURTS, RULES } from "../constants.js";
import TournamentBridge from "../components/scoreboard/TournamentBridge.jsx";

const audioCtx = typeof window !== "undefined" ? { horn: new Audio("/horn.mp3"), buzzer: new Audio("/buzzer.mp3") } : null;
let unlocked = false;
const unlock = () => {
  if(unlocked||!audioCtx) return; unlocked=true;
  [audioCtx.horn,audioCtx.buzzer].forEach(a=>{ a.play().then(()=>{a.pause();a.currentTime=0;}).catch(()=>{}); });
};
const playHorn   = () => { if(!audioCtx?.horn)   return; unlock(); audioCtx.horn.currentTime=0;   audioCtx.horn.play().catch(()=>{}); };
const playBuzzer = () => { if(!audioCtx?.buzzer) return; unlock(); audioCtx.buzzer.currentTime=0; audioCtx.buzzer.play().catch(()=>{}); };

function fmt(t){const s=Math.max(0,t);if(s>600){const x=Math.floor(s/10);return`${String(Math.floor(x/60)).padStart(2,"0")}:${String(x%60).padStart(2,"0")}`}return`${String(Math.floor(s/10)).padStart(2,"0")}.${s%10}`;}
function fmtS(t){const s=Math.max(0,t);if(s>120)return String(Math.ceil(s/10));return`${Math.floor(s/10)}.${s%10}`;}

const COLORS=["#FF6B35","#FF3333","#FF1493","#9B59B6","#3498DB","#00D4FF","#00E87A","#FFD700","#FFFFFF","#FF8C00"];

function FoulDots({count,color}){
  const max=RULES.BONUS_F;
  return(
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
      {Array.from({length:max}).map((_,i)=>{
        const on=i<count, hot=on&&count>=max;
        return <div key={i} style={{width:13,height:13,borderRadius:"50%",
          background:on?(hot?"#FF3333":color):"rgba(255,255,255,0.07)",
          border:`1.5px solid ${on?(hot?"#FF3333":color):"rgba(255,255,255,0.1)"}`,
          boxShadow:on?`0 0 5px ${hot?"#FF333388":color+"66"}`:"none",transition:"all .2s"}}/>;
      })}
    </div>
  );
}

function ColorPicker({teamKey,color,send}){
  const [o,setO]=useState(false);
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setO(v=>!v)} style={{width:20,height:20,borderRadius:"50%",
        background:color,border:"2px solid rgba(255,255,255,0.3)",cursor:"pointer",
        boxShadow:`0 0 6px ${color}88`,flexShrink:0}}/>
      {o&&(
        <div style={{position:"absolute",top:26,left:0,zIndex:50,background:"#111",
          border:"1px solid #333",borderRadius:12,padding:8,
          display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5}}>
          {COLORS.map(c=>(
            <button key={c} onClick={()=>{send("teamColor",teamKey,c);setO(false);}}
              style={{width:22,height:22,borderRadius:"50%",background:c,cursor:"pointer",
                border:`2px solid ${color===c?"#FFF":"transparent"}`}}/>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({team,tKey,send}){
  const [editing,setEditing]=useState(false);
  const [input,setInput]=useState(team.name);
  const {color,score,teamFouls,timeouts,name}=team;
  const save=()=>{send("teamName",tKey,input.toUpperCase());setEditing(false);};
  const F={fontFamily:"'Bebas Neue',Impact,sans-serif"};
  const nl=name.length, ns=nl<=8?26:nl<=13?19:nl<=18?15:11;
  return(
    <div style={{background:"linear-gradient(160deg,#0d0d1b,#080810)",border:`1px solid ${color}22`,
      borderRadius:18,overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <div style={{height:3,background:`linear-gradient(90deg,transparent,${color},transparent)`}}/>
      {/* Header */}
      <div style={{padding:"12px 16px 0",display:"flex",alignItems:"center",gap:7}}>
        <ColorPicker teamKey={tKey} color={color} send={send}/>
        {editing
          ?<input autoFocus value={input} maxLength={20}
              onChange={e=>setInput(e.target.value.toUpperCase())}
              onBlur={save} onKeyDown={e=>e.key==="Enter"&&save()}
              style={{background:"none",border:"none",borderBottom:`2px solid ${color}`,
                outline:"none",color,...F,fontSize:18,width:160}}/>
          :<span onClick={()=>setEditing(true)} style={{color,cursor:"pointer",flex:1,
              wordBreak:"break-word",lineHeight:1.1,...F,fontSize:ns}}>{name}</span>
        }
        {teamFouls>=RULES.BONUS_F&&<span style={{padding:"1px 6px",borderRadius:5,fontSize:9,
          fontWeight:"bold",background:"rgba(255,0,0,0.15)",border:"1px solid rgba(255,0,0,0.35)",
          color:"#FF6666",letterSpacing:"0.05em"}}>BONUS</span>}
      </div>
      {/* Score */}
      <div style={{textAlign:"center",padding:"4px 0"}}>
        <div style={{...F,fontSize:110,fontWeight:900,lineHeight:.85,color,
          textShadow:`0 0 50px ${color}44`}}>{score}</div>
      </div>
      {/* Score buttons */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,padding:"0 12px 10px"}}>
        {[1,2,3].map(v=>(
          <button key={v} onClick={()=>send("score",tKey,v)}
            style={{...F,fontSize:20,background:`${color}14`,border:`1px solid ${color}33`,
              color,padding:"10px 0",borderRadius:9,cursor:"pointer"}}>+{v}</button>
        ))}
        <button onClick={()=>send("score",tKey,-1)}
          style={{...F,fontSize:20,background:"rgba(255,50,50,0.12)",border:"1px solid rgba(255,50,50,0.3)",
            color:"#FF5555",padding:"10px 0",borderRadius:9,cursor:"pointer"}}>-1</button>
      </div>
      <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"0 12px"}}/>
      {/* Fouls */}
      <div style={{padding:"10px 12px 8px",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{background:"rgba(0,0,0,0.2)",borderRadius:10,padding:"9px 10px",
          border:`1px solid ${teamFouls>=RULES.BONUS_F?"rgba(255,40,40,0.3)":"rgba(255,255,255,0.05)"}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <span style={{...F,fontSize:8,letterSpacing:"0.4em",color:"rgba(255,255,255,0.25)"}}>TEAM FOULS</span>
            <span style={{...F,fontSize:24,fontWeight:900,color:teamFouls>=RULES.BONUS_F?"#FF3333":"rgba(255,255,255,0.7)"}}>{teamFouls}</span>
          </div>
          <FoulDots count={teamFouls} color={color}/>
          <div style={{display:"flex",gap:5,marginTop:6}}>
            <button onClick={()=>send("teamFoul",tKey,1)}
              style={{flex:1,...F,fontSize:11,background:"rgba(255,50,50,0.08)",
                border:"1px solid rgba(255,50,50,0.2)",color:"#FF9090",padding:"5px 0",borderRadius:6,cursor:"pointer"}}>+ FOUL</button>
            <button onClick={()=>send("teamFoul",tKey,-1)} disabled={teamFouls<=0}
              style={{...F,fontSize:11,background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.25)",
                padding:"5px 8px",borderRadius:6,cursor:"pointer",opacity:teamFouls<=0?.3:1}}>-1</button>
            <button onClick={()=>send("teamFoulReset",tKey)}
              style={{...F,fontSize:11,background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.2)",
                padding:"5px 8px",borderRadius:6,cursor:"pointer"}}>CLR</button>
          </div>
        </div>
        {/* Timeout */}
        <div style={{background:"rgba(0,0,0,0.2)",borderRadius:10,padding:"9px 10px",
          border:"1px solid rgba(255,255,255,0.05)",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
            <div>
              <div style={{...F,fontSize:8,letterSpacing:"0.4em",color:"rgba(255,255,255,0.25)"}}>TIMEOUT</div>
              <div style={{fontSize:7,color:"rgba(255,255,255,0.12)"}}>3x3: 1 ครั้ง/เกม</div>
            </div>
            <span style={{...F,fontSize:24,fontWeight:900,color:timeouts>0?color:"rgba(255,255,255,0.2)"}}>{timeouts}</span>
          </div>
          <div style={{display:"flex",gap:4,justifyContent:"center",marginBottom:6}}>
            {Array.from({length:RULES.MAX_TO}).map((_,i)=>(
              <div key={i} style={{width:12,height:12,borderRadius:"50%",
                background:i<timeouts?color:"rgba(255,255,255,0.06)",
                border:`1.5px solid ${i<timeouts?color:"rgba(255,255,255,0.1)"}`,
                boxShadow:i<timeouts?`0 0 5px ${color}77`:"none"}}/>
            ))}
          </div>
          <div style={{display:"flex",gap:5}}>
            <button onClick={()=>{send("timeout",tKey,-1);playHorn();}}
              disabled={timeouts<=0}
              style={{flex:1,...F,fontSize:11,background:`${color}10`,border:`1px solid ${color}30`,
                color,padding:"5px 0",borderRadius:6,cursor:"pointer",opacity:timeouts<=0?.3:1}}>USE T.O.</button>
            <button onClick={()=>send("timeout",tKey,1)} disabled={timeouts>=RULES.MAX_TO}
              style={{...F,fontSize:11,background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.3)",
                padding:"5px 8px",borderRadius:6,cursor:"pointer",opacity:timeouts>=RULES.MAX_TO?.3:1}}>+1</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CenterPanel({state,send,onHorn}){
  const {clockTenths,isRunning,shotClockTenths,shotRunning,possession,jumpBall,gameOver,winner,isOvertime,teamA,teamB}=state;
  const shotSec=shotClockTenths/10, shotUrg=shotSec<=3&&shotClockTenths>0, shotWarn=shotSec<=5&&shotClockTenths>0;
  const shotColor=shotUrg?"#FF3333":shotWarn?"#FFA500":"#00E87A";
  const gameEnd=clockTenths===0;
  const F={fontFamily:"'Bebas Neue',Impact,sans-serif"};
  const Btn=(s={})=>({...F,border:"none",cursor:"pointer",borderRadius:9,transition:"all .12s",...s});

  return(
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {gameOver&&(
        <div style={{textAlign:"center",padding:"12px 8px",background:"rgba(255,215,0,0.1)",
          border:"2px solid rgba(255,215,0,0.45)",borderRadius:14}}>
          <div style={{...F,fontSize:16,color:"#FFD700",letterSpacing:"0.2em"}}>🏆 GAME OVER</div>
          <div style={{...F,fontSize:28,fontWeight:900,color:"#FFD700"}}>
            {winner==="teamA"?teamA?.name:teamB?.name} WINS
          </div>
          <div style={{display:"flex",gap:7,marginTop:8,justifyContent:"center"}}>
            <button onClick={()=>send("startOvertime")}
              style={Btn({padding:"7px 12px",fontSize:12,background:"rgba(0,232,122,0.12)",
                border:"1.5px solid rgba(0,232,122,0.4)",color:"#00E87A"})}>▶ OVERTIME</button>
            <button onClick={()=>send("fullReset")}
              style={Btn({padding:"7px 12px",fontSize:12,background:"rgba(255,55,55,0.1)",
                border:"1.5px solid rgba(255,55,55,0.3)",color:"#FF7070"})}>↺ NEW GAME</button>
          </div>
        </div>
      )}
      {isOvertime&&!gameOver&&(
        <div style={{textAlign:"center",padding:"5px",background:"rgba(255,215,0,0.07)",
          border:"1px solid rgba(255,215,0,0.22)",borderRadius:8}}>
          <span style={{...F,fontSize:13,color:"#FFD700",letterSpacing:"0.2em"}}>⚡ OVERTIME</span>
        </div>
      )}

      {/* Shot clock */}
      <div style={{background:shotUrg?"linear-gradient(160deg,#1c0505,#0a0a14)":"rgba(0,0,0,0.3)",
        border:`2px solid ${shotUrg?"rgba(255,40,40,0.5)":shotWarn?"rgba(255,165,0,0.35)":"rgba(255,255,255,0.07)"}`,
        borderRadius:16,padding:"12px 12px 9px",boxShadow:shotUrg?"0 0 35px rgba(255,30,30,0.2)":"none",transition:"all .3s"}}>
        <div style={{...F,fontSize:9,letterSpacing:"0.45em",color:"rgba(255,255,255,0.25)",textAlign:"center",marginBottom:2}}>SHOT CLOCK · 12s</div>
        <div style={{textAlign:"center",...F,fontSize:110,fontWeight:900,lineHeight:.85,color:shotColor,
          textShadow:shotUrg?"0 0 45px rgba(255,30,30,0.9)":`0 0 25px ${shotColor}44`}}>{fmtS(shotClockTenths)}</div>
        <div style={{height:2,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden",margin:"5px 0"}}>
          <div style={{height:"100%",width:`${Math.min(100,(shotClockTenths/120)*100)}%`,background:shotColor,borderRadius:2,transition:"width .1s linear"}}/>
        </div>
        <button onClick={()=>send("shotClockToggle")}
          style={Btn({width:"100%",padding:"9px 0",fontSize:15,letterSpacing:"0.1em",marginBottom:5,
            background:shotRunning?"rgba(255,55,55,0.14)":"rgba(0,232,122,0.09)",
            border:shotRunning?"1.5px solid rgba(255,55,55,0.4)":"1.5px solid rgba(0,232,122,0.3)",
            color:shotRunning?"#FF5555":"#00E87A"})}>
          {shotRunning?"⏹ STOP":"▶ START"} <span style={{fontSize:8,opacity:.5}}>[C]</span>
        </button>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:5}}>
          <button onClick={()=>send("shotClockSet",null,12)}
            style={Btn({padding:"10px 0",fontSize:30,color:"#FFD700",background:"rgba(255,215,0,0.09)",border:"1.5px solid rgba(255,215,0,0.35)"})}
          >12 <span style={{fontSize:8,opacity:.5}}>[Z]</span></button>
          <button onClick={()=>send("shotClockSet",null,8)}
            style={Btn({padding:"10px 0",fontSize:30,color:"#FFA500",background:"rgba(255,165,0,0.09)",border:"1.5px solid rgba(255,165,0,0.35)"})}
          >8 <span style={{fontSize:8,opacity:.5}}>[X]</span></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          {[{l:"+1s",v:10},{l:"-1s",v:-10}].map(b=>(
            <button key={b.l} onClick={()=>send("shotClockAdjust",null,b.v)}
              style={Btn({padding:"4px 0",fontSize:10,
                background:b.v>0?"rgba(0,232,122,0.05)":"rgba(255,55,55,0.05)",
                border:b.v>0?"1px solid rgba(0,232,122,0.12)":"1px solid rgba(255,55,55,0.12)",
                color:b.v>0?"rgba(0,232,122,0.6)":"rgba(255,100,100,0.55)"})}>{b.l}</button>
          ))}
        </div>
      </div>

      {/* Game clock */}
      <div style={{background:gameEnd?"rgba(255,0,0,0.25)":"rgba(0,0,0,0.28)",
        border:gameEnd?"2px solid #FF0000":"1px solid rgba(255,215,0,0.14)",
        borderRadius:14,padding:"10px 11px",boxShadow:gameEnd?"0 0 45px rgba(255,0,0,0.35)":"none",transition:"all .3s"}}>
        <div style={{...F,fontSize:8,letterSpacing:"0.45em",color:gameEnd?"#FF9999":"rgba(255,215,0,0.5)",textAlign:"center",marginBottom:3}}>GAME CLOCK · 10 MIN</div>
        <div style={{textAlign:"center",...F,fontSize:clockTenths<=600?54:46,fontWeight:900,lineHeight:1,
          color:gameEnd?"#FF0000":isRunning?"#FFD700":"rgba(255,255,255,0.85)",
          textShadow:gameEnd?"0 0 35px #FF0000":isRunning?"0 0 28px rgba(255,215,0,0.55)":"none",transition:"all .2s"}}>{fmt(clockTenths)}</div>
        <div style={{...F,fontSize:10,letterSpacing:"0.3em",color:isRunning?"rgba(255,215,0,0.55)":"rgba(255,255,255,0.18)",textAlign:"center",marginBottom:5}}>
          {gameOver?"■ GAME OVER":isRunning?"▶ LIVE":"■ PAUSED"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:5}}>
          <button onClick={()=>send("clockToggle")} disabled={gameOver}
            style={Btn({padding:"9px 0",fontSize:14,
              background:isRunning?"rgba(255,55,55,0.14)":"rgba(0,232,122,0.09)",
              border:isRunning?"1.5px solid rgba(255,55,55,0.4)":"1.5px solid rgba(0,232,122,0.3)",
              color:isRunning?"#FF5555":"#00E87A",opacity:gameOver?.3:1})}>
            {isRunning?"⏹ STOP":"▶ START"} <span style={{fontSize:8,opacity:.5}}>[SPC]</span>
          </button>
          <button onClick={()=>send("clockReset")}
            style={Btn({padding:"9px 0",fontSize:14,background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.38)"})}>↺ RESET</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:3}}>
          {[{l:"+1m",v:600},{l:"+10s",v:100},{l:"+1s",v:10},{l:"-1s",v:-10},{l:"-10s",v:-100},{l:"-1m",v:-600}].map(b=>(
            <button key={b.l} onClick={()=>send("clockAdjust",null,b.v)}
              style={Btn({padding:"4px 0",fontSize:9,
                background:b.v>0?"rgba(0,232,122,0.05)":"rgba(255,55,55,0.05)",
                border:b.v>0?"1px solid rgba(0,232,122,0.12)":"1px solid rgba(255,55,55,0.12)",
                color:b.v>0?"rgba(0,232,122,0.6)":"rgba(255,100,100,0.55)"})}>{b.l}</button>
          ))}
        </div>
      </div>

      {/* Horn */}
      <button onClick={onHorn}
        style={Btn({width:"100%",padding:"11px 0",fontSize:17,letterSpacing:"0.1em",
          background:"rgba(255,165,0,0.13)",border:"2px solid rgba(255,165,0,0.45)",color:"#FFA500"})}>
        📢 SOUND HORN <span style={{fontSize:8,opacity:.5}}>[H]</span>
      </button>

      {/* Possession */}
      <div style={{background:"rgba(0,0,0,0.28)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:13,padding:"9px 11px"}}>
        <div style={{...F,fontSize:8,letterSpacing:"0.4em",color:"rgba(255,255,255,0.2)",marginBottom:5}}>POSSESSION</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
          {[
            {label:"◀ HOME",value:"teamA",color:state.teamA.color,active:possession==="teamA"},
            {label:"⊕ JUMP",value:"jump",color:"#FFD700",active:jumpBall},
            {label:"AWAY ▶",value:"teamB",color:state.teamB.color,active:possession==="teamB"},
          ].map(b=>(
            <button key={b.value} onClick={()=>b.value==="jump"?send("jumpBall"):send("possession",null,possession===b.value?null:b.value)}
              style={Btn({padding:"7px 0",fontSize:9,letterSpacing:"0.04em",
                background:b.active?`${b.color}18`:"rgba(255,255,255,0.04)",
                border:b.active?`1.5px solid ${b.color}55`:"1px solid rgba(255,255,255,0.07)",
                color:b.active?b.color:"rgba(255,255,255,0.3)"})}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ScoreboardPage(){
  const [sp]           = useSearchParams();
  const courtId        = (sp.get("court")||"A").toUpperCase();
  const divisionId     = sp.get("division")||"open";
  const divConfig      = DIVISIONS.find(d=>d.id===divisionId)||DIVISIONS[0];
  const [state,setS]   = useState(null);
  const [conn,setConn] = useState(false);
  const prevGC = useRef(null), prevSC = useRef(null);

  const send = useCallback((type,team,value)=>socket.emit("action",{courtId,type,team,value}),[courtId]);

  useEffect(()=>{
    socket.on("connect",()=>setConn(true));
    socket.on("disconnect",()=>setConn(false));
    socket.on("stateUpdate",s=>{if(s)setS(s);});
    socket.emit("joinCourt",courtId);
    return()=>{socket.off("connect");socket.off("disconnect");socket.off("stateUpdate");};
  },[courtId]);

  // Audio on clock expiry
  useEffect(()=>{
    if(!state) return;
    if(prevGC.current!==null&&prevGC.current>0&&state.clockTenths===0) playBuzzer();
    if(prevSC.current!==null&&prevSC.current>0&&state.shotClockTenths===0) playHorn();
    prevGC.current=state.clockTenths; prevSC.current=state.shotClockTenths;
  },[state?.clockTenths,state?.shotClockTenths]);

  // Keyboard shortcuts
  useEffect(()=>{
    const h=e=>{
      if(e.target.tagName==="INPUT") return;
      if(e.code==="Space"){e.preventDefault();send("clockToggle");}
      else if(e.key==="c"||e.key==="C"){e.preventDefault();send("shotClockToggle");}
      else if(e.key==="z"||e.key==="Z"){e.preventDefault();send("shotClockSet",null,12);}
      else if(e.key==="x"||e.key==="X"){e.preventDefault();send("shotClockSet",null,8);}
      else if(e.key==="h"||e.key==="H"){e.preventDefault();playHorn();}
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[send]);

  if(!state) return(
    <div style={{minHeight:"100vh",background:"#050505",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:52}}>🏀</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:"#FFF",letterSpacing:"0.2em"}}>CONNECTING — COURT {courtId}</div>
      {!conn&&<div style={{color:"#FF5555",fontSize:12}}>⚠️ ตรวจสอบว่า server รันอยู่ที่ port 3001</div>}
    </div>
  );

  return(
    <div onClick={unlock} style={{minHeight:"100vh",background:"radial-gradient(ellipse at 25% 0%,#13101e,#080810 55%)",padding:10}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');button,select{font-family:'Bebas Neue',Impact,sans-serif;outline:none;}*{box-sizing:border-box;margin:0;padding:0;}`}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,flexWrap:"wrap",gap:6}}>
        <div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.2em",
            background:`linear-gradient(90deg,${divConfig.color},#FFD700 50%,#00D4FF)`,
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            3x3 BASKETBALL · สนาม {courtId}
          </div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",color:divConfig.color,fontSize:9,letterSpacing:"0.35em"}}>
            {divConfig.icon} รุ่น {divConfig.label} · WIN@21 · SHOT 12s · TO:1
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          {/* Court selector */}
          {COURTS.map(c=>(
            <a key={c} href={`/scoreboard?court=${c}&division=${divisionId}`}
              style={{padding:"3px 9px",borderRadius:7,fontFamily:"'Bebas Neue',sans-serif",fontSize:12,
                background:c===courtId?`${divConfig.color}22`:"rgba(255,255,255,0.04)",
                border:`1px solid ${c===courtId?divConfig.color+"55":"rgba(255,255,255,0.1)"}`,
                color:c===courtId?divConfig.color:"rgba(255,255,255,0.3)",textDecoration:"none"}}>{c}</a>
          ))}
          {/* Division selector */}
          {DIVISIONS.map(d=>(
            <a key={d.id} href={`/scoreboard?court=${courtId}&division=${d.id}`}
              style={{padding:"3px 9px",borderRadius:7,fontFamily:"'Bebas Neue',sans-serif",fontSize:10,
                background:d.id===divisionId?`${d.color}22`:"rgba(255,255,255,0.04)",
                border:`1px solid ${d.id===divisionId?d.color+"55":"rgba(255,255,255,0.08)"}`,
                color:d.id===divisionId?d.color:"rgba(255,255,255,0.25)",textDecoration:"none"}}>{d.label}</a>
          ))}
          {/* TV & Overlay links */}
          <a href={`/tv?court=${courtId}`} target="_blank"
            style={{padding:"3px 9px",borderRadius:7,fontFamily:"'Bebas Neue',sans-serif",fontSize:10,
              background:"rgba(167,139,250,0.1)",border:"1px solid rgba(167,139,250,0.3)",
              color:"#A78BFA",textDecoration:"none"}}>📺 TV</a>
          {/* Status */}
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:100,
            background:conn?"rgba(0,232,122,0.07)":"rgba(255,55,55,0.07)",
            border:`1px solid ${conn?"rgba(0,232,122,0.25)":"rgba(255,55,55,0.25)"}`,
            fontFamily:"'Bebas Neue',sans-serif",fontSize:10,letterSpacing:"0.1em",
            color:conn?"#00E87A":"#FF5555"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:conn?"#00E87A":"#FF5555"}}/>
            {conn?"LIVE":"OFFLINE"}
          </div>
          <button onClick={()=>{if(window.confirm("Reset เกมนี้?"))send("resetGame");}}
            style={{padding:"3px 10px",borderRadius:100,background:"rgba(255,55,55,0.07)",
              border:"1px solid rgba(255,55,55,0.22)",color:"#FF7070",
              fontFamily:"'Bebas Neue',sans-serif",fontSize:10,cursor:"pointer"}}>↺ RESET</button>
        </div>
      </div>

      {/* Tournament Bridge */}
      <TournamentBridge state={state} send={send} divisionId={divisionId} courtId={courtId}/>

      {/* Main 3-column grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 270px 1fr",gap:9,maxWidth:1380,margin:"0 auto"}}>
        <TeamCard team={state.teamA} tKey="teamA" send={send}/>
        <CenterPanel state={state} send={send} onHorn={playHorn}/>
        <TeamCard team={state.teamB} tKey="teamB" send={send}/>
      </div>
    </div>
  );
}
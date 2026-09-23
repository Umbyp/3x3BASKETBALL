/**
 * 🎮 ScoreboardPage — Operator control
 * /scoreboard?court=A&division=open
 * Keyboard: SPACE=clock, C=shot, Z=12s, X=8s, H=horn, D=cycle theme
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { socket } from "../socket.js";
import { DIVISIONS, COURTS, RULES } from "../constants.js";
import TournamentBridge from "../components/scoreboard/TournamentBridge.jsx";
import { useTheme, ThemeSwitcher } from "../theme.jsx";

const audioCtx = typeof window !== "undefined" ? { horn: new Audio("/buzzer.mp3"), buzzer: new Audio("/buzzer.mp3") } : null;
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

function FoulDots({count,theme}){
  const max=RULES.BONUS_FOULS;
  const D=(dim,bright)=>theme.highContrast?bright:dim;
  return(
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
      {Array.from({length:max}).map((_,i)=>{
        const on=i<count, hot=on&&count>=max;
        return <div key={i} style={{width:13,height:13,borderRadius:"50%",
          background:on?(hot?"#FF3333":D("rgba(255,255,255,0.55)","rgba(255,255,255,0.85)")):D("rgba(255,255,255,0.07)","rgba(255,255,255,0.35)"),
          border:`1.5px solid ${on?(hot?"#FF3333":D("rgba(255,255,255,0.6)","rgba(255,255,255,0.9)")):D("rgba(255,255,255,0.1)","rgba(255,255,255,0.45)")}`,
          transition:"all .2s"}}/>;
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

function TeamCard({team,tKey,send,theme}){
  const [editing,setEditing]=useState(false);
  const [input,setInput]=useState(team.name);
  const {color,score,teamFouls,timeouts,name}=team;
  const D=(dim,bright)=>theme.highContrast?bright:dim;
  const save=()=>{send("teamName",tKey,input.toUpperCase());setEditing(false);};
  const F={fontFamily:"'Bebas Neue',Impact,sans-serif"};
  const nl=name.length, ns=nl<=8?26:nl<=13?19:nl<=18?15:11;
  return(
    <div style={{background:theme.cardBg,border:`1px solid ${theme.highContrast?color+"66":color+"22"}`,
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
        {teamFouls>=RULES.BONUS_FOULS&&<span style={{padding:"1px 6px",borderRadius:5,fontSize:9,
          fontWeight:"bold",background:"rgba(255,0,0,0.15)",border:"1px solid rgba(255,0,0,0.35)",
          color:"#FF6666",letterSpacing:"0.05em"}}>BONUS</span>}
      </div>
      {/* Score */}
      <div style={{textAlign:"center",padding:"4px 0"}}>
        <div className="score-value" style={{...F,fontSize:110,fontWeight:900,lineHeight:.85,color,
          textShadow:theme.highContrast?"none":`0 0 50px ${color}44`,
          WebkitTextStroke:theme.highContrast?"1.5px rgba(0,0,0,0.6)":"0px transparent"}}>{score}</div>
      </div>
      {/* Score buttons — FIBA 3x3: 1 pt (inside arc), 2 pt (beyond arc), no 3-pointer */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,padding:"0 12px 10px"}}>
        {[1,2].map(v=>(
          <button key={v} onClick={()=>send("score",tKey,v)}
            style={{...F,fontSize:30,background:D("rgba(255,255,255,0.05)","rgba(255,255,255,0.16)"),border:`1px solid ${D("rgba(255,255,255,0.1)","rgba(255,255,255,0.35)")}`,
              color:D("rgba(255,255,255,0.85)","rgba(255,255,255,0.98)"),padding:"13px 0",borderRadius:9,cursor:"pointer"}}>+{v}</button>
        ))}
        <button onClick={()=>send("score",tKey,-1)}
          style={{...F,fontSize:30,background:D("rgba(255,255,255,0.05)","rgba(255,255,255,0.16)"),border:`1px solid ${D("rgba(255,255,255,0.1)","rgba(255,255,255,0.35)")}`,
            color:D("rgba(255,120,120,0.75)","rgba(255,120,120,0.95)"),padding:"13px 0",borderRadius:9,cursor:"pointer"}}>-1</button>
      </div>
      <div style={{height:1,background:D("rgba(255,255,255,0.05)","rgba(255,255,255,0.2)"),margin:"0 12px"}}/>
      {/* Fouls */}
      <div style={{padding:"10px 12px 8px",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{background:theme.boxBg,borderRadius:10,padding:"9px 10px",
          border:`1px solid ${teamFouls>=RULES.BONUS_FOULS?"rgba(255,40,40,0.3)":D("rgba(255,255,255,0.05)","rgba(255,255,255,0.25)")}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <span style={{...F,fontSize:8,letterSpacing:"0.4em",color:D("rgba(255,255,255,0.25)","rgba(255,255,255,0.8)")}}>TEAM FOULS</span>
            <span style={{...F,fontSize:24,fontWeight:900,color:teamFouls>=RULES.BONUS_FOULS?"#FF3333":D("rgba(255,255,255,0.7)","rgba(255,255,255,0.95)")}}>{teamFouls}</span>
          </div>
          <FoulDots count={teamFouls} theme={theme}/>
          <div style={{display:"flex",gap:5,marginTop:6}}>
            <button onClick={()=>send("teamFoul",tKey,1)}
              style={{flex:1,...F,fontSize:11,background:D("rgba(255,255,255,0.04)","rgba(255,255,255,0.14)"),
                border:`1px solid ${D("rgba(255,255,255,0.08)","rgba(255,255,255,0.3)")}`,color:D("rgba(255,255,255,0.75)","rgba(255,255,255,0.95)"),padding:"5px 0",borderRadius:6,cursor:"pointer"}}>+ FOUL</button>
            <button onClick={()=>send("teamFoul",tKey,-1)} disabled={teamFouls<=0}
              style={{...F,fontSize:11,background:D("rgba(255,255,255,0.04)","rgba(255,255,255,0.12)"),
                border:`1px solid ${D("rgba(255,255,255,0.07)","rgba(255,255,255,0.25)")}`,color:D("rgba(255,255,255,0.25)","rgba(255,255,255,0.7)"),
                padding:"5px 8px",borderRadius:6,cursor:"pointer",opacity:teamFouls<=0?.3:1}}>-1</button>
            <button onClick={()=>send("teamFoulReset",tKey)}
              style={{...F,fontSize:11,background:D("rgba(255,255,255,0.04)","rgba(255,255,255,0.12)"),
                border:`1px solid ${D("rgba(255,255,255,0.07)","rgba(255,255,255,0.25)")}`,color:D("rgba(255,255,255,0.2)","rgba(255,255,255,0.65)"),
                padding:"5px 8px",borderRadius:6,cursor:"pointer"}}>CLR</button>
          </div>
        </div>
        {/* Timeout */}
        <div style={{background:theme.boxBg,borderRadius:10,padding:"9px 10px",
          border:`1px solid ${D("rgba(255,255,255,0.05)","rgba(255,255,255,0.25)")}`,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
            <div>
              <div style={{...F,fontSize:8,letterSpacing:"0.4em",color:D("rgba(255,255,255,0.25)","rgba(255,255,255,0.8)")}}>TIMEOUT</div>
              <div style={{fontSize:7,color:D("rgba(255,255,255,0.12)","rgba(255,255,255,0.55)")}}>3x3: 1 ครั้ง/เกม</div>
            </div>
            <span style={{...F,fontSize:24,fontWeight:900,color:timeouts>0?D("rgba(255,255,255,0.85)","rgba(255,255,255,0.98)"):D("rgba(255,255,255,0.2)","rgba(255,255,255,0.6)")}}>{timeouts}</span>
          </div>
          <div style={{display:"flex",gap:4,justifyContent:"center",marginBottom:6}}>
            {Array.from({length:RULES.MAX_TIMEOUTS}).map((_,i)=>(
              <div key={i} style={{width:12,height:12,borderRadius:"50%",
                background:i<timeouts?D("rgba(255,255,255,0.75)","rgba(255,255,255,0.95)"):D("rgba(255,255,255,0.06)","rgba(255,255,255,0.3)"),
                border:`1.5px solid ${i<timeouts?D("rgba(255,255,255,0.8)","rgba(255,255,255,1)"):D("rgba(255,255,255,0.1)","rgba(255,255,255,0.4)")}`}}/>
            ))}
          </div>
          <div style={{display:"flex",gap:5}}>
            <button onClick={()=>{send("timeout",tKey,-1);playHorn();}}
              disabled={timeouts<=0}
              style={{flex:1,...F,fontSize:11,background:D("rgba(255,255,255,0.05)","rgba(255,255,255,0.16)"),border:`1px solid ${D("rgba(255,255,255,0.1)","rgba(255,255,255,0.35)")}`,
                color:D("rgba(255,255,255,0.85)","rgba(255,255,255,0.98)"),padding:"5px 0",borderRadius:6,cursor:"pointer",opacity:timeouts<=0?.3:1}}>USE T.O.</button>
            <button onClick={()=>send("timeout",tKey,1)} disabled={timeouts>=RULES.MAX_TIMEOUTS}
              style={{...F,fontSize:11,background:D("rgba(255,255,255,0.04)","rgba(255,255,255,0.12)"),
                border:`1px solid ${D("rgba(255,255,255,0.07)","rgba(255,255,255,0.25)")}`,color:D("rgba(255,255,255,0.3)","rgba(255,255,255,0.75)"),
                padding:"5px 8px",borderRadius:6,cursor:"pointer",opacity:timeouts>=RULES.MAX_TIMEOUTS?.3:1}}>+1</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CenterPanel({state,send,onHorn,theme}){
  const {clockTenths,isRunning,shotClockTenths,shotRunning,possession,jumpBall,gameOver,winner,isOvertime,teamA,teamB}=state;
  const D=(dim,bright)=>theme.highContrast?bright:dim;
  const shotSec=shotClockTenths/10, shotUrg=shotSec<=3&&shotClockTenths>0, shotWarn=shotSec<=5&&shotClockTenths>0;
  const shotColor=shotUrg?"#FF3333":shotWarn?"#FFA500":D("rgba(255,255,255,0.85)","rgba(255,255,255,0.98)");
  const gameEnd=clockTenths===0;
  const F={fontFamily:"'Bebas Neue',Impact,sans-serif"};
  const Btn=(s={})=>({...F,border:"none",cursor:"pointer",borderRadius:9,transition:"all .12s",...s});
  const neutralBtn=D("rgba(255,255,255,0.05)","rgba(255,255,255,0.16)");
  const neutralBorder=D("rgba(255,255,255,0.1)","rgba(255,255,255,0.35)");
  const neutralText=D("rgba(255,255,255,0.85)","rgba(255,255,255,0.98)");
  const StatusDot=({on})=>(
    <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",marginRight:8,
      background:on?"#00E87A":D("rgba(255,255,255,0.2)","rgba(255,255,255,0.5)"),
      boxShadow:on?"0 0 6px #00E87A":"none",verticalAlign:"middle"}}/>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
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
      <div style={{background:shotUrg?"linear-gradient(160deg,#1c0505,#0a0a14)":theme.boxBg,
        border:`2px solid ${shotUrg?"rgba(255,40,40,0.5)":shotWarn?"rgba(255,165,0,0.35)":D("rgba(255,255,255,0.07)","rgba(255,255,255,0.3)")}`,
        borderRadius:16,padding:"9px 12px 7px",boxShadow:shotUrg?"0 0 35px rgba(255,30,30,0.2)":"none",transition:"all .3s"}}>
        <div style={{...F,fontSize:9,letterSpacing:"0.45em",color:D("rgba(255,255,255,0.25)","rgba(255,255,255,0.85)"),textAlign:"center",marginBottom:2}}>SHOT CLOCK · 12s</div>
        <div className="shotclock-value" style={{textAlign:"center",...F,fontSize:110,fontWeight:900,lineHeight:.85,color:shotColor,
          textShadow:shotUrg?"0 0 45px rgba(255,30,30,0.9)":(theme.highContrast?"none":`0 0 25px ${shotColor}44`),
          WebkitTextStroke:theme.highContrast?"1.5px rgba(0,0,0,0.6)":"0px transparent"}}>{fmtS(shotClockTenths)}</div>
        <div style={{height:2,background:D("rgba(255,255,255,0.05)","rgba(255,255,255,0.25)"),borderRadius:2,overflow:"hidden",margin:"5px 0"}}>
          <div style={{height:"100%",width:`${Math.min(100,(shotClockTenths/120)*100)}%`,background:shotColor,borderRadius:2,transition:"width .1s linear"}}/>
        </div>
        <button onClick={()=>send("shotClockToggle")}
          style={Btn({width:"100%",padding:"7px 0",fontSize:15,letterSpacing:"0.1em",marginBottom:4,
            background:neutralBtn,border:`1.5px solid ${neutralBorder}`,color:neutralText})}>
          <StatusDot on={shotRunning}/>{shotRunning?"⏹ STOP":"▶ START"} <span style={{fontSize:8,opacity:theme.highContrast?.85:.5}}>[C]</span>
        </button>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:4}}>
          <button onClick={()=>send("shotClockSet",null,12)}
            style={Btn({padding:"6px 0",fontSize:26,color:neutralText,background:neutralBtn,border:`1.5px solid ${neutralBorder}`})}
          >12 <span style={{fontSize:8,opacity:theme.highContrast?.85:.5}}>[Z]</span></button>
          <button onClick={()=>send("shotClockSet",null,8)}
            style={Btn({padding:"6px 0",fontSize:26,color:neutralText,background:neutralBtn,border:`1.5px solid ${neutralBorder}`})}
          >8 <span style={{fontSize:8,opacity:theme.highContrast?.85:.5}}>[X]</span></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          {[{l:"+1s",v:10},{l:"-1s",v:-10}].map(b=>(
            <button key={b.l} onClick={()=>send("shotClockAdjust",null,b.v)}
              style={Btn({padding:"4px 0",fontSize:10,background:neutralBtn,border:`1px solid ${neutralBorder}`,
                color:D("rgba(255,255,255,0.55)","rgba(255,255,255,0.85)")})}>{b.l}</button>
          ))}
        </div>
      </div>

      {/* Game clock */}
      <div style={{background:gameEnd?"rgba(255,0,0,0.25)":theme.boxBg,
        border:gameEnd?"2px solid #FF0000":`1px solid ${D("rgba(255,255,255,0.07)","rgba(255,255,255,0.3)")}`,
        borderRadius:14,padding:"7px 11px",boxShadow:gameEnd?"0 0 45px rgba(255,0,0,0.35)":"none",transition:"all .3s"}}>
        <div style={{...F,fontSize:8,letterSpacing:"0.45em",color:gameEnd?"#FF9999":D("rgba(255,255,255,0.3)","rgba(255,255,255,0.85)"),textAlign:"center",marginBottom:2}}>GAME CLOCK · 10 MIN</div>
        <div className="gameclock-value" style={{textAlign:"center",...F,fontSize:clockTenths<=600?54:46,fontWeight:900,lineHeight:1,
          color:gameEnd?"#FF0000":D("rgba(255,255,255,0.85)","rgba(255,255,255,0.98)"),
          textShadow:gameEnd?"0 0 35px #FF0000":"none",
          WebkitTextStroke:theme.highContrast?"1.5px rgba(0,0,0,0.5)":"0px transparent",transition:"all .2s"}}>{fmt(clockTenths)}</div>
        <div style={{...F,fontSize:10,letterSpacing:"0.3em",color:isRunning?D("rgba(0,232,122,0.55)","rgba(0,232,122,0.9)"):D("rgba(255,255,255,0.18)","rgba(255,255,255,0.7)"),textAlign:"center",marginBottom:4}}>
          {gameOver?"■ GAME OVER":isRunning?"▶ LIVE":"■ PAUSED"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:4}}>
          <button onClick={()=>send("clockToggle")} disabled={gameOver}
            style={Btn({padding:"7px 0",fontSize:14,background:neutralBtn,
              border:`1.5px solid ${neutralBorder}`,color:neutralText,opacity:gameOver?.3:1})}>
            <StatusDot on={isRunning}/>{isRunning?"⏹ STOP":"▶ START"} <span style={{fontSize:8,opacity:theme.highContrast?.85:.5}}>[SPC]</span>
          </button>
          <button onClick={()=>send("clockReset")}
            style={Btn({padding:"7px 0",fontSize:14,background:D("rgba(255,255,255,0.04)","rgba(255,255,255,0.14)"),
              border:`1px solid ${D("rgba(255,255,255,0.09)","rgba(255,255,255,0.3)")}`,color:D("rgba(255,255,255,0.38)","rgba(255,255,255,0.85)")})}>↺ RESET</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:3}}>
          {[{l:"+1m",v:600},{l:"+10s",v:100},{l:"+1s",v:10},{l:"-1s",v:-10},{l:"-10s",v:-100},{l:"-1m",v:-600}].map(b=>(
            <button key={b.l} onClick={()=>send("clockAdjust",null,b.v)}
              style={Btn({padding:"4px 0",fontSize:9,background:neutralBtn,border:`1px solid ${neutralBorder}`,
                color:D("rgba(255,255,255,0.55)","rgba(255,255,255,0.85)")})}>{b.l}</button>
          ))}
        </div>
      </div>

      {/* Horn */}
      <button onClick={onHorn}
        style={Btn({width:"100%",padding:"8px 0",fontSize:17,letterSpacing:"0.1em",
          background:D("rgba(255,255,255,0.05)","rgba(255,255,255,0.16)"),border:`2px solid ${D("rgba(255,255,255,0.12)","rgba(255,255,255,0.4)")}`,color:D("rgba(255,255,255,0.75)","rgba(255,255,255,0.95)")})}>
        📢 SOUND HORN <span style={{fontSize:8,opacity:theme.highContrast?.85:.5}}>[H]</span>
      </button>

      {/* Possession */}
      <div style={{background:D("rgba(0,0,0,0.28)","rgba(0,0,0,0.6)"),border:`1px solid ${D("rgba(255,255,255,0.06)","rgba(255,255,255,0.25)")}`,borderRadius:13,padding:"7px 9px"}}>
        <div style={{...F,fontSize:8,letterSpacing:"0.4em",color:D("rgba(255,255,255,0.2)","rgba(255,255,255,0.75)"),marginBottom:3}}>POSSESSION</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
          {[
            {label:"◀ HOME",value:"teamA",color:state.teamA.color,active:possession==="teamA"},
            {label:"⊕ JUMP",value:"jump",color:"#FFD700",active:jumpBall},
            {label:"AWAY ▶",value:"teamB",color:state.teamB.color,active:possession==="teamB"},
          ].map(b=>(
            <button key={b.value} onClick={()=>b.value==="jump"?send("jumpBall"):send("possession",null,possession===b.value?null:b.value)}
              style={Btn({padding:"5px 0",fontSize:9,letterSpacing:"0.04em",
                background:b.active?`${b.color}18`:D("rgba(255,255,255,0.04)","rgba(255,255,255,0.12)"),
                border:b.active?`1.5px solid ${b.color}55`:`1px solid ${D("rgba(255,255,255,0.07)","rgba(255,255,255,0.25)")}`,
                color:b.active?b.color:D("rgba(255,255,255,0.3)","rgba(255,255,255,0.75)")})}>
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
  const nav            = useNavigate();
  const courtId        = (sp.get("court")||"A").toUpperCase();
  const divisionId     = sp.get("division")||"open";
  const divConfig      = DIVISIONS.find(d=>d.id===divisionId)||DIVISIONS[0];
  const [state,setS]   = useState(null);
  const [conn,setConn] = useState(false);
  const [mobileTab,setMobileTab] = useState("clock"); // "home" | "clock" | "away" — mobile-only view switch
  const [showMore,setShowMore]   = useState(false);   // mobile-only: collapses court/division/theme/reset row
  const { theme, themeId, setThemeId, cycleTheme } = useTheme();
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
      else if(e.key==="d"||e.key==="D"){e.preventDefault();cycleTheme();}
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
    <div onClick={unlock} className="page-root" style={{background:theme.mainBg}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        button,select{font-family:'Bebas Neue',Impact,sans-serif;outline:none;}
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{height:100%;}
        .page-root{min-height:100vh;padding:10px;}
        .page-scroll{display:flex;flex-direction:column;}
        .back-btn{display:inline-flex;align-items:center;gap:7px;min-height:38px;
          padding:8px 16px;border-radius:10px;background:rgba(255,255,255,0.06);
          border:1.5px solid rgba(255,255,255,0.18);color:rgba(255,255,255,0.85);
          font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:0.1em;
          cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;flex-shrink:0;}
        .back-btn:hover,.back-btn:active{background:rgba(255,107,53,0.18);
          border-color:rgba(255,107,53,0.55);color:#FF6B35;}
        .more-toggle{display:none;}
        .more-panel{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
        .mobile-tabs{display:none;}
        .control-grid{display:grid;grid-template-columns:1fr 380px 1fr;gap:9px;
          max-width:1380px;margin:0 auto;width:100%;}
        .pill-btn{display:inline-flex;align-items:center;justify-content:center;}
        @media (max-width:900px){
          .page-root{height:100dvh;overflow:hidden;display:flex;flex-direction:column;padding:8px;}
          .page-scroll{flex:1;min-height:0;}
          .more-toggle{display:inline-flex;align-items:center;justify-content:center;
            min-width:34px;min-height:34px;border-radius:9px;background:rgba(255,255,255,0.06);
            border:1.5px solid rgba(255,255,255,0.18);color:rgba(255,255,255,0.8);
            font-size:16px;cursor:pointer;flex-shrink:0;}
          .more-panel{display:none;margin-top:6px;}
          .more-panel.open{display:flex;}
          .mobile-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0;flex-shrink:0;}
          .mobile-tabs button{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:0.08em;
            padding:9px 0;border-radius:9px;background:rgba(255,255,255,0.05);
            border:1.5px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);cursor:pointer;}
          .mobile-tabs button.active{background:rgba(255,255,255,0.14);border-color:rgba(255,255,255,0.4);color:#FFF;}
          .control-grid{grid-template-columns:1fr;max-width:600px;flex:1;min-height:0;}
          .control-grid>*{display:none !important;overflow-y:auto;min-height:0;}
          .control-grid[data-tab="home"]>*:nth-child(1){display:flex !important;flex-direction:column;}
          .control-grid[data-tab="clock"]>*:nth-child(2){display:block !important;}
          .control-grid[data-tab="away"]>*:nth-child(3){display:flex !important;flex-direction:column;}
          .tournament-wrap{flex-shrink:0;}
          .tournament-wrap[data-tab]:not([data-tab="clock"]){display:none;}
        }
        @media (max-width:600px){
          .back-btn{padding:10px 16px;font-size:15px;}
          .pill-btn{padding:8px 13px !important;font-size:13px !important;min-height:34px;}
          .score-value{font-size:64px !important;}
          .shotclock-value{font-size:64px !important;}
          .gameclock-value{font-size:36px !important;}
        }
      `}</style>

      <div className="page-scroll">
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,flexShrink:0}}>
          <div>
            <button className="back-btn" onClick={()=>nav("/")} aria-label="กลับหน้าหลัก">← กลับหน้าหลัก</button>
            <div style={{marginTop:6,fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.2em",
              color:"rgba(255,255,255,0.92)"}}>
              3x3 BASKETBALL · สนาม {courtId}
            </div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",color:divConfig.color,fontSize:9,letterSpacing:"0.35em"}}>
              {divConfig.icon} รุ่น {divConfig.label} · WIN@21 · SHOT 12s · TO:1
            </div>
          </div>
          {/* Status + more-options toggle (always visible) */}
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:100,
              background:conn?"rgba(0,232,122,0.07)":"rgba(255,55,55,0.07)",
              border:`1px solid ${conn?"rgba(0,232,122,0.25)":"rgba(255,55,55,0.25)"}`,
              fontFamily:"'Bebas Neue',sans-serif",fontSize:10,letterSpacing:"0.1em",
              color:conn?"#00E87A":"#FF5555"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:conn?"#00E87A":"#FF5555"}}/>
              {conn?"LIVE":"OFFLINE"}
            </div>
            <button className="more-toggle" onClick={()=>setShowMore(v=>!v)} aria-label="ตัวเลือกเพิ่มเติม">⋯</button>
          </div>
        </div>

        {/* Court/division/TV/theme/reset — collapsible on mobile */}
        <div className={`more-panel${showMore?" open":""}`}>
          {/* Court selector */}
          {COURTS.map(c=>(
            <a key={c} href={`/scoreboard?court=${c}&division=${divisionId}`} className="pill-btn"
              style={{padding:"3px 9px",borderRadius:7,fontFamily:"'Bebas Neue',sans-serif",fontSize:12,
                background:c===courtId?`${divConfig.color}22`:"rgba(255,255,255,0.04)",
                border:`1px solid ${c===courtId?divConfig.color+"55":"rgba(255,255,255,0.1)"}`,
                color:c===courtId?divConfig.color:"rgba(255,255,255,0.3)",textDecoration:"none"}}>{c}</a>
          ))}
          {/* Division selector */}
          {DIVISIONS.map(d=>(
            <a key={d.id} href={`/scoreboard?court=${courtId}&division=${d.id}`} className="pill-btn"
              style={{padding:"3px 9px",borderRadius:7,fontFamily:"'Bebas Neue',sans-serif",fontSize:10,
                background:d.id===divisionId?`${d.color}22`:"rgba(255,255,255,0.04)",
                border:`1px solid ${d.id===divisionId?d.color+"55":"rgba(255,255,255,0.08)"}`,
                color:d.id===divisionId?d.color:"rgba(255,255,255,0.25)",textDecoration:"none"}}>{d.label}</a>
          ))}
          {/* TV & Overlay links */}
          <a href={`/tv?court=${courtId}`} target="_blank" className="pill-btn"
            style={{padding:"3px 9px",borderRadius:7,fontFamily:"'Bebas Neue',sans-serif",fontSize:10,
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.12)",
              color:"rgba(255,255,255,0.55)",textDecoration:"none"}}>📺 TV</a>
          {/* Theme switcher */}
          <ThemeSwitcher themeId={themeId} setThemeId={setThemeId} />
          <button onClick={()=>{if(window.confirm("Reset เกมนี้?"))send("resetGame");}} className="pill-btn"
            style={{padding:"3px 10px",borderRadius:100,background:"rgba(255,55,55,0.07)",
              border:"1px solid rgba(255,55,55,0.22)",color:"#FF7070",
              fontFamily:"'Bebas Neue',sans-serif",fontSize:10,cursor:"pointer"}}>↺ RESET</button>
        </div>

        {/* Mobile-only tab switch — shows one panel at a time so it fits without scrolling */}
        <div className="mobile-tabs">
          <button className={mobileTab==="home"?"active":""} onClick={()=>setMobileTab("home")}>{state.teamA.name||"HOME"}</button>
          <button className={mobileTab==="clock"?"active":""} onClick={()=>setMobileTab("clock")}>⏱ CLOCK</button>
          <button className={mobileTab==="away"?"active":""} onClick={()=>setMobileTab("away")}>{state.teamB.name||"AWAY"}</button>
        </div>

        {/* Tournament Bridge — on mobile, only shown while the CLOCK tab is active, to save vertical space */}
        <div className="tournament-wrap" data-tab={mobileTab}>
          <TournamentBridge state={state} send={send} divisionId={divisionId} courtId={courtId}/>
        </div>

        {/* Main 3-column grid — desktop shows all three; mobile shows only the active tab */}
        <div className="control-grid" data-tab={mobileTab}>
          <TeamCard team={state.teamA} tKey="teamA" send={send} theme={theme}/>
          <div className="control-center">
            <CenterPanel state={state} send={send} onHorn={playHorn} theme={theme}/>
          </div>
          <TeamCard team={state.teamB} tKey="teamB" send={send} theme={theme}/>
        </div>
      </div>
    </div>
  );
}

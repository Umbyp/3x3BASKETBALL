/**
 * 🎥 OverlayPage — OBS Browser Source
 * URL: /overlay?court=A
 * Size: 1920×1080, Allow Transparency: ON
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { socket } from "../socket.js";

function fmtClock(t) {
  t = Math.max(0,t);
  if (t>600){const s=Math.floor(t/10);return`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
  return`${String(Math.floor(t/10)).padStart(2,"0")}.${t%10}`;
}
function fmtShot(t){t=Math.max(0,t);if(t>120)return String(Math.ceil(t/10));return`${Math.floor(t/10)}.${t%10}`;}

export default function OverlayPage() {
  const [sp]          = useSearchParams();
  const court         = (sp.get("court")||"A").toUpperCase();
  const [state,setS]  = useState(null);

  useEffect(()=>{
    socket.on("stateUpdate",s=>{if(s)setS(s);});
    socket.emit("joinCourt",court);
    return()=>socket.off("stateUpdate");
  },[court]);

  if(!state) return <div style={{background:"transparent",width:1920,height:1080}}/>;

  const {teamA,teamB,clockTenths,shotClockTenths,possession,jumpBall,gameOver,winner,isRunning,isOvertime,shotRunning} = state;
  const shotSec    = shotClockTenths/10;
  const shotUrgent = shotSec<=3&&shotClockTenths>0;
  const shotWarn   = shotSec<=5&&shotClockTenths>0;
  const shotColor  = shotUrgent?"#FF2222":shotWarn?"#FFA500":"#FFD700";
  const gameEnd    = clockTenths===0;
  const B="'Oswald',sans-serif", C="'Barlow Condensed',sans-serif";

  const TeamBox=({team,tKey,flip})=>{
    const poss=possession===tKey, bonus=team.teamFouls>=6;
    const nl=team.name.length, ns=nl<=8?30:nl<=14?22:16;
    return(
      <div style={{display:"flex",flexDirection:flip?"row-reverse":"row",alignItems:"stretch",height:"100%"}}>
        <div style={{width:6,background:team.color,boxShadow:`0 0 12px ${team.color}`}}/>
        <div style={{display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 18px",
          minWidth:200,alignItems:flip?"flex-end":"flex-start"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexDirection:flip?"row-reverse":"row",marginBottom:2}}>
            {poss&&<span style={{fontFamily:B,fontSize:18,color:team.color}}>{flip?"▶":"◀"}</span>}
            <span style={{fontFamily:B,fontSize:ns,fontWeight:700,color:"#FFF",lineHeight:1.1}}>{team.name}</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexDirection:flip?"row-reverse":"row"}}>
            <div style={{display:"flex",gap:3}}>
              {Array.from({length:1}).map((_,i)=>(
                <div key={i} style={{width:18,height:5,borderRadius:3,
                  background:i<team.timeouts?"#FFF":"rgba(255,255,255,0.15)"}}/>
              ))}
            </div>
            <span style={{fontFamily:C,fontSize:13,fontWeight:800,color:"rgba(255,255,255,0.35)",letterSpacing:"0.08em"}}>
              F {team.teamFouls}
            </span>
            {bonus&&<span style={{fontFamily:C,fontSize:12,fontWeight:900,color:"#FF3333"}}>BONUS</span>}
          </div>
        </div>
        <div style={{width:100,display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(0,0,0,0.45)",
          borderLeft:flip?"none":"1px solid rgba(255,255,255,0.04)",
          borderRight:flip?"1px solid rgba(255,255,255,0.04)":"none"}}>
          <span style={{fontFamily:B,fontSize:62,fontWeight:700,color:team.color,lineHeight:1}}>{team.score}</span>
        </div>
      </div>
    );
  };

  return(
    <div style={{width:1920,height:1080,background:"transparent",display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:44}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        {gameOver&&<div style={{marginBottom:8,padding:"8px 30px",background:"rgba(255,215,0,0.92)",
          borderRadius:10,fontFamily:C,fontSize:22,fontWeight:900,color:"#000",letterSpacing:"0.15em"}}>
          🏆 {winner==="teamA"?teamA.name:teamB.name} WINS!
        </div>}
        {isOvertime&&!gameOver&&<div style={{marginBottom:6,padding:"4px 20px",background:"rgba(255,215,0,0.12)",
          border:"1px solid rgba(255,215,0,0.4)",borderRadius:8,
          fontFamily:C,fontSize:14,fontWeight:900,color:"#FFD700",letterSpacing:"0.2em"}}>⚡ OVERTIME</div>}

        <div style={{display:"flex",height:80,background:"rgba(12,14,22,0.96)",
          borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",
          boxShadow:"0 12px 50px rgba(0,0,0,0.8)",overflow:"hidden"}}>
          <TeamBox team={teamA} tKey="teamA" flip={false}/>
          <div style={{width:160,display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",background:"rgba(0,0,0,0.5)",position:"relative"}}>
            {jumpBall&&<div style={{position:"absolute",top:2,fontFamily:C,fontSize:11,fontWeight:900,color:"#FFD700"}}>⊕ JUMP</div>}
            <span style={{fontFamily:B,fontSize:42,fontWeight:700,lineHeight:1,
              color:gameEnd?"#FF2222":isRunning?"#FFD700":"#FFF"}}>
              {fmtClock(clockTenths)}
            </span>
            <span style={{fontFamily:C,fontSize:11,fontWeight:800,
              color:isRunning?"rgba(255,215,0,0.5)":"rgba(255,255,255,0.25)",letterSpacing:"0.1em"}}>
              {gameEnd?"■ END":isRunning?"▶ LIVE":"■ STOP"}
            </span>
          </div>
          <TeamBox team={teamB} tKey="teamB" flip={true}/>
        </div>

        <div style={{marginTop:-1,padding:"4px 22px",
          background:shotUrgent?"rgba(200,0,0,0.93)":"rgba(18,20,30,0.97)",
          borderBottomLeftRadius:10,borderBottomRightRadius:10,
          border:"1px solid rgba(255,255,255,0.08)",borderTop:"none",
          display:"flex",alignItems:"center",gap:10,boxShadow:"0 6px 20px rgba(0,0,0,0.5)"}}>
          <span style={{fontFamily:C,fontSize:14,fontWeight:800,
            color:shotUrgent?"#FFF":"rgba(255,255,255,0.35)",letterSpacing:"0.1em"}}>SHOT</span>
          <span style={{fontFamily:B,fontSize:28,fontWeight:700,lineHeight:1,color:shotColor}}>
            {fmtShot(shotClockTenths)}
          </span>
          <span style={{fontFamily:C,fontSize:11,color:"rgba(255,255,255,0.2)"}}>3x3=12s</span>
        </div>
      </div>
    </div>
  );
}

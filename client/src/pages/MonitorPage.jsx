import { useState, useEffect } from "react";
import { socket } from "../socket.js";
import { COURTS, DIVISIONS, RULES } from "../constants.js";

function fmtClock(t){const s=Math.floor(Math.max(0,t)/10);return`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}

function CourtCard({cid,s}){
  if(!s)return(
    <div className="bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center h-44">
      <div className="text-center"><div className="text-3xl mb-2">🏟️</div>
      <div className="font-bebas text-xl text-gray-600 tracking-widest">สนาม {cid}</div></div>
    </div>
  );
  const live=s.isRunning&&!s.gameOver, shot=Math.ceil(s.shotClockTenths/10), shotUrg=shot<=3&&s.shotClockTenths>0;
  return(
    <div className={`rounded-2xl overflow-hidden border transition-all ${s.gameOver?"border-yellow-500/40 bg-yellow-900/5":live?"border-red-500/30 bg-red-900/5":"border-gray-800 bg-gray-900"}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-black/30">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${s.gameOver?"bg-yellow-400":live?"bg-red-500 animate-pulse":"bg-gray-600"}`}/>
          <span className="font-bebas text-base text-white tracking-widest">สนาม {cid}</span>
        </div>
        <div className="flex gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${s.gameOver?"text-yellow-400 bg-yellow-500/10 border-yellow-500/25":live?"text-red-400 bg-red-500/10 border-red-500/25 animate-pulse":"text-gray-600 border-gray-800"}`}>
            {s.gameOver?"🏆 OVER":live?"● LIVE":"■ PAUSE"}
          </span>
          <a href={`/tv?court=${cid}`} target="_blank" className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20">TV</a>
          <a href={`/scoreboard?court=${cid}`} target="_blank" className="text-[10px] px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20">OP</a>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex-1 text-center">
            <div style={{color:s.teamA.color}} className="font-bebas text-base tracking-wider">{s.teamA.name}</div>
            <div style={{color:s.teamA.color}} className="font-bebas text-5xl font-black leading-none">{s.teamA.score}</div>
            {s.teamA.teamFouls>=RULES.BONUS_F&&<span className="text-[10px] text-red-400 font-bold">BONUS</span>}
          </div>
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <div className={`font-bebas text-xl ${s.clockTenths===0?"text-red-400":s.isRunning?"text-yellow-400":"text-white/60"}`}>{fmtClock(s.clockTenths)}</div>
            {s.gameOver?(
              <div className="font-bebas text-yellow-400 text-sm">🏆 {s.winner==="teamA"?s.teamA.name:s.teamB.name}</div>
            ):(
              <div className={`font-bebas text-base px-2 py-0.5 rounded border ${shotUrg?"text-red-400 bg-red-500/10 border-red-500/30":"text-green-400 bg-green-500/08 border-green-500/20"}`}>
                {shot}s
              </div>
            )}
          </div>
          <div className="flex-1 text-center">
            <div style={{color:s.teamB.color}} className="font-bebas text-base tracking-wider">{s.teamB.name}</div>
            <div style={{color:s.teamB.color}} className="font-bebas text-5xl font-black leading-none">{s.teamB.score}</div>
            {s.teamB.teamFouls>=RULES.BONUS_F&&<span className="text-[10px] text-red-400 font-bold">BONUS</span>}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 border-t border-gray-800 pt-1.5">
          <span>F:<span className={s.teamA.teamFouls>=RULES.BONUS_F?"text-red-400 font-bold":"text-gray-400"}> {s.teamA.teamFouls}</span></span>
          <span>TO: {s.teamA.timeouts} | {s.teamB.timeouts}</span>
          <span>F:<span className={s.teamB.teamFouls>=RULES.BONUS_F?"text-red-400 font-bold":"text-gray-400"}> {s.teamB.teamFouls}</span></span>
        </div>
      </div>
    </div>
  );
}

export default function MonitorPage(){
  const [all,setAll]=useState({});
  const [conn,setConn]=useState(false);
  useEffect(()=>{
    socket.on("connect",()=>setConn(true));
    socket.on("disconnect",()=>setConn(false));
    socket.on("allStates",s=>setAll(s));
    socket.emit("joinMonitor");
    return()=>{socket.off("connect");socket.off("disconnect");socket.off("allStates");};
  },[]);
  const liveCount=Object.values(all).filter(s=>s?.isRunning&&!s?.gameOver).length;
  return(
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-bebas text-3xl text-white tracking-widest">🖥️ COURT MONITOR</h1>
            <p className="text-gray-600 text-xs uppercase tracking-widest">Admin — ดูทุกสนามพร้อมกัน</p>
          </div>
          <div className="flex items-center gap-3">
            {liveCount>0&&<span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-bold animate-pulse">● {liveCount} สนาม LIVE</span>}
            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${conn?"bg-green-500/08 border border-green-500/20 text-green-400":"bg-red-500/08 border border-red-500/20 text-red-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${conn?"bg-green-400":""}`}/>{conn?"CONNECTED":"OFFLINE"}
            </span>
            <a href="/" className="px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400 text-xs hover:bg-gray-700 transition-colors">← Home</a>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {COURTS.map(c=><CourtCard key={c} cid={c} s={all[c]}/>)}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-gray-700 text-xs font-bold uppercase tracking-widest">Tournament:</span>
          {DIVISIONS.map(d=>(
            <a key={d.id} href={`/tournament?division=${d.id}`} target="_blank"
              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:opacity-80"
              style={{borderColor:d.color+"40",color:d.color,background:d.color+"10"}}>
              {d.icon} {d.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

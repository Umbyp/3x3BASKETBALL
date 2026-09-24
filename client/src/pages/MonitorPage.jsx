import { useState, useEffect } from "react";
import { socket } from "../socket.js";
import { COURTS, DIVISIONS, RULES } from "../constants.js";

function fmtClock(t){const s=Math.floor(Math.max(0,t)/10);return`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}

function StatusBadge({ s, live }) {
  if (s?.gameOver) return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 whitespace-nowrap">🏆 จบเกม</span>;
  if (live) return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-red-500/10 border border-red-500/30 text-red-400 animate-pulse whitespace-nowrap">● LIVE</span>;
  return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-white/5 border border-white/10 text-gray-500 whitespace-nowrap">■ พัก</span>;
}

function CourtCard({cid,s}){
  if(!s)return(
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl flex items-center justify-center h-56">
      <div className="text-center"><div className="text-4xl mb-2">🏟️</div>
      <div className="font-bebas text-2xl text-gray-600 tracking-widest">สนาม {cid}</div>
      <div className="text-gray-700 text-xs mt-1">ยังไม่มีการเชื่อมต่อ</div></div>
    </div>
  );
  const live=s.isRunning&&!s.gameOver, shot=Math.ceil(s.shotClockTenths/10), shotUrg=shot<=3&&s.shotClockTenths>0, shotWarn=shot<=5&&s.shotClockTenths>0;
  const gameEnd = s.clockTenths===0;
  return(
    <div className={`rounded-2xl overflow-hidden border transition-all ${s.gameOver?"border-yellow-500/40 bg-yellow-900/5":live?"border-red-500/35 bg-red-900/5":"border-gray-800 bg-gray-900/60"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/30">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${s.gameOver?"bg-yellow-400":live?"bg-red-500 animate-pulse":"bg-gray-600"}`}/>
          <span className="font-bebas text-lg text-white tracking-widest">สนาม {cid}</span>
        </div>
        <StatusBadge s={s} live={live}/>
      </div>

      {/* Score row */}
      <div className="flex items-stretch">
        <div className="flex-1 text-center py-4 px-2 border-r border-white/5">
          <div style={{color:s.teamA.color}} className="font-bebas text-sm tracking-wider truncate px-1">{s.teamA.name}</div>
          <div style={{color:s.teamA.color}} className="font-bebas text-6xl font-black leading-none mt-1">{s.teamA.score}</div>
          {s.teamA.teamFouls>=RULES.BONUS_FOULS&&<span className="inline-block mt-1 text-[10px] text-red-400 font-bold tracking-wide">BONUS</span>}
        </div>

        <div className="flex flex-col items-center justify-center gap-1.5 px-3 min-w-[110px]">
          {s.gameOver ? (
            <div className="text-center">
              <div className="text-xl">🏆</div>
              <div className="font-bebas text-yellow-400 text-sm leading-tight mt-1">{s.winner==="teamA"?s.teamA.name:s.teamB.name}</div>
            </div>
          ):(
            <>
              <div className={`font-bebas text-3xl leading-none ${gameEnd?"text-red-500":s.isRunning?"text-white":"text-white/50"}`}>{fmtClock(s.clockTenths)}</div>
              <div className={`font-bebas text-xl px-2.5 py-0.5 rounded-lg border leading-none ${shotUrg?"text-red-400 bg-red-500/10 border-red-500/35":shotWarn?"text-orange-400 bg-orange-500/10 border-orange-500/30":"text-white/70 bg-white/5 border-white/10"}`}>
                {shot}s
              </div>
            </>
          )}
        </div>

        <div className="flex-1 text-center py-4 px-2 border-l border-white/5">
          <div style={{color:s.teamB.color}} className="font-bebas text-sm tracking-wider truncate px-1">{s.teamB.name}</div>
          <div style={{color:s.teamB.color}} className="font-bebas text-6xl font-black leading-none mt-1">{s.teamB.score}</div>
          {s.teamB.teamFouls>=RULES.BONUS_FOULS&&<span className="inline-block mt-1 text-[10px] text-red-400 font-bold tracking-wide">BONUS</span>}
        </div>
      </div>

      {/* Fouls / timeouts */}
      <div className="flex justify-between text-[11px] text-gray-500 px-4 py-2 border-t border-white/5">
        <span>ฟาวล์ <span className={s.teamA.teamFouls>=RULES.BONUS_FOULS?"text-red-400 font-bold":"text-gray-300 font-bold"}>{s.teamA.teamFouls}</span></span>
        <span>TIMEOUT {s.teamA.timeouts} · {s.teamB.timeouts}</span>
        <span>ฟาวล์ <span className={s.teamB.teamFouls>=RULES.BONUS_FOULS?"text-red-400 font-bold":"text-gray-300 font-bold"}>{s.teamB.teamFouls}</span></span>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 border-t border-white/5">
        <a href={`/scoreboard?court=${cid}`} target="_blank"
          className="flex items-center justify-center gap-2 py-2.5 text-xs font-bold tracking-wide text-white/70 hover:bg-white/5 hover:text-white transition-colors border-r border-white/5">
          🎮 ควบคุม
        </a>
        <a href={`/tv?court=${cid}`} target="_blank"
          className="flex items-center justify-center gap-2 py-2.5 text-xs font-bold tracking-wide text-white/70 hover:bg-white/5 hover:text-white transition-colors">
          📺 TV
        </a>
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
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-4">
            <a href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/15 text-white/80 text-sm font-bebas tracking-wide hover:bg-orange-500/15 hover:border-orange-500/50 hover:text-orange-400 transition-colors">
              ← กลับหน้าหลัก
            </a>
            <div>
              <h1 className="font-bebas text-2xl sm:text-3xl text-white tracking-widest">🖥️ COURT MONITOR</h1>
              <p className="text-gray-600 text-[11px] uppercase tracking-widest">ดูทุกสนามพร้อมกัน</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {liveCount>0&&<span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-bold animate-pulse">● {liveCount} สนาม LIVE</span>}
            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${conn?"bg-green-500/08 border border-green-500/20 text-green-400":"bg-red-500/08 border border-red-500/20 text-red-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${conn?"bg-green-400":"bg-red-400"}`}/>{conn?"CONNECTED":"OFFLINE"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {COURTS.map(c=><CourtCard key={c} cid={c} s={all[c]}/>)}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-gray-700 text-xs font-bold uppercase tracking-widest">ผลการแข่งขัน:</span>
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

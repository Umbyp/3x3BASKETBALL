/**
 * TournamentPage v5 — FIBA-style tournament (see lib/tournament.js for the data model)
 * Public: ตารางคะแนน · เกม · Knockout · ทีม
 * Setup and result corrections live in Tournament Admin (/admin).
 */
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase.js";
import { ref, onValue } from "firebase/database";
import { useDivisions, findDivision } from "../divisions.js";
import { isV2, resolvedGames } from "../lib/tournament.js";
import { StandingsView, GamesView, BracketView, TeamsView } from "../components/tournament/PublicViews.jsx";

export default function TournamentPage() {
  const [sp, setSp]   = useSearchParams();
  const divisions     = useDivisions();
  const divId         = sp.get("division") || divisions[0].id;
  const divCfg        = findDivision(divisions, divId);
  const [tab, setTab]       = useState("standings");
  const [raw, setRaw]       = useState(null);
  const [loading, setLoad]  = useState(true);

  useEffect(() => {
    if (!db) { setLoad(false); return; }
    setLoad(true); setRaw(null);
    return onValue(ref(db, `tournament_data/${divId}`), snap => { setRaw(snap.val()); setLoad(false); },
      () => setLoad(false));
  }, [divId]);

  // Old (pre-v2) data is ignored — the admin sets the division up again
  const data  = isV2(raw) ? raw : null;
  const games = useMemo(() => resolvedGames(data), [data]);
  const real  = games.filter(g => !g.bye);
  const done  = real.filter(g => g.status === "final").length;
  const live  = real.filter(g => g.status === "live").length;
  const prog  = real.length ? Math.round(done / real.length * 100) : 0;

  if (!db) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">⚠️</div>
        <div className="text-xl font-black text-white tracking-widest mb-2">TOURNAMENT SYNC ไม่พร้อมใช้งาน</div>
        <div className="text-sm text-gray-400">ยังไม่ได้ตั้งค่า Firebase (VITE_FIREBASE_* env vars) — หน้านี้ต้องใช้ Firebase เก็บตารางแข่ง/ผลการแข่งขัน</div>
      </div>
    </div>
  );

  const tabs = [["standings", "📊", "Table"], ["games", "📅", "Games"], ["bracket", "⚡", "Bracket"], ["teams", "👥", "Teams"]];

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <style>{`.animate-fade-in{animation:fade-in .25s ease-out}@keyframes fade-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}</style>

      <header className="pt-10 pb-4 px-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4" style={{ borderColor: divCfg.color + "40", background: divCfg.color + "10" }}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${live ? "bg-red-500" : "bg-green-500"}`}/>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: divCfg.color }}>{live ? `⚡ ${live} LIVE NOW` : "🏀 Live Tournament"}</span>
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter">
          3×3 <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(90deg,${divCfg.color},#FFD700)` }}>{divCfg.label.toUpperCase()}</span>
        </h1>
        <div className="flex gap-2 justify-center flex-wrap mt-3">
          {divisions.map(d => (
            <button key={d.id} onClick={() => setSp({ division: d.id })}
              className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
              style={{ borderColor: d.id === divId ? d.color + "55" : "rgba(255,255,255,0.1)", color: d.id === divId ? d.color : "rgba(255,255,255,0.3)", background: d.id === divId ? d.color + "18" : "transparent" }}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>
      </header>

      {real.length > 0 && (
        <div className="max-w-xl mx-auto px-4 mb-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5"><span>Progress</span><span>{done}/{real.length} · {prog}%</span></div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${prog}%`, background: `linear-gradient(90deg,${divCfg.color},#FFD700)` }}/>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-20 bg-[#050505]/90 backdrop-blur border-b border-gray-800 mb-5">
        <div className="max-w-xl mx-auto flex">
          {tabs.map(([v, ic, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold tracking-widest uppercase relative ${tab === v ? "text-orange-400" : "text-gray-600 hover:text-gray-400"}`}>
              {tab === v && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-orange-500"/>}
              {ic} <span className="hidden sm:inline">{l}</span>
              {v === "games" && live > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse absolute top-2 right-2"/>}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4">
        {loading ? <div className="text-center text-gray-500 py-16 font-black tracking-widest">LOADING…</div> : <>
          {!data && (
            <div className="text-center text-sm text-gray-500 py-12 border border-dashed border-gray-800 rounded-2xl">
              รุ่นนี้ยังไม่ได้ตั้งค่าทัวร์นาเมนต์
            </div>
          )}
          {data && tab === "standings" && <StandingsView data={data}/>}
          {data && tab === "games"     && <GamesView games={games}/>}
          {data && tab === "bracket"   && <BracketView games={games}/>}
          {data && tab === "teams"     && <TeamsView data={data}/>}
        </>}
      </main>

      <footer className="text-center py-10">
        <a href={`/admin?division=${divId}`} className="text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:text-gray-400">Admin</a>
        <div className="mt-2"><a href="/" className="text-[10px] text-gray-600 hover:text-gray-400">← Home</a></div>
      </footer>

    </div>
  );
}

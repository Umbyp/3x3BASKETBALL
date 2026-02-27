import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase.js";
import { ref, onValue, update, set } from "firebase/database";
import { DIVISIONS, GROUP_COLORS, DEFAULT_TEAMS, KO_TEMPLATE, generateGroupMatches, getDivision } from "../constants.js";

// ฟังก์ชันตรวจสอบสิทธิ์ Admin
const checkAdmin = pw => pw === (import.meta.env.VITE_ADMIN_PASS || "admin1234");

// ฟังก์ชันคำนวณตารางคะแนน
function calcStandings(teams, matches) {
  if (!teams || !matches) return {};
  const stats = {};
  Object.entries(teams).forEach(([g, ts]) => ts.forEach(t => {
    stats[t] = { team: t, group: g, played: 0, wins: 0, losses: 0, pts: 0, pf: 0, pa: 0 };
  }));
  matches.forEach(m => {
    if (!m.played || m.round !== 1) return;
    const h = stats[m.home], a = stats[m.away]; if (!h || !a) return;
    h.played++; a.played++; h.pf += m.homeScore; h.pa += m.awayScore; a.pf += m.awayScore; a.pa += m.homeScore;
    if (m.homeScore > m.awayScore) { h.wins++; h.pts += 3; a.losses++; a.pts += 1; }
    else if (m.awayScore > m.homeScore) { a.wins++; a.pts += 3; h.losses++; h.pts += 1; }
  });
  const grouped = {};
  Object.keys(teams).forEach(g => {
    grouped[g] = Object.values(stats).filter(s => s.group === g).sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa));
  });
  return grouped;
}

// --- UI Components ---

// ส่วนแสดงนาฬิกานับถอยหลังและสถานะ Live
function NextMatchCountdown({ allMatches, delayMinutes }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const next = useMemo(() => {
    if (!allMatches) return null;
    return allMatches
      .filter(m => !m.played)
      .map(m => {
        const startStr = m.time?.split("-")[0];
        if (!startStr || !m.date) return null;
        const dt = new Date(`${m.date}T${startStr}:00+07:00`);
        dt.setMinutes(dt.getMinutes() + delayMinutes);
        return { ...m, startTime: dt };
      })
      .filter(Boolean)
      .sort((a, b) => a.startTime - b.startTime)[0];
  }, [allMatches, delayMinutes]);

  if (!next) return null;

  const diff = next.startTime - now;
  const isLive = diff <= 0 && diff > -3600000; // Live ถ้าอยู่ในช่วง 1 ชม. จากเวลาเริ่ม

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h > 0 ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gray-900/80 p-5 shadow-2xl mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isLive ? "bg-red-500 animate-pulse" : "bg-green-400"}`} />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {isLive ? "LIVE NOW" : "UPCOMING MATCH"}
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-600">MATCH #{next.id}</span>
      </div>

      <div className="flex items-center justify-around gap-4">
        <div className="flex-1 text-center">
          <div className="text-sm font-bold truncate">{next.home}</div>
        </div>

        <div className="flex flex-col items-center shrink-0">
          {isLive ? (
            <div className="text-2xl font-black text-red-500 animate-pulse tracking-tighter">LIVE</div>
          ) : (
            <div className="text-2xl font-black font-mono text-white">{formatTime(diff)}</div>
          )}
          <div className="text-[9px] text-gray-500 mt-1 uppercase font-bold">Starts at {next.time?.split("-")[0]}</div>
        </div>

        <div className="flex-1 text-center">
          <div className="text-sm font-bold truncate">{next.away}</div>
        </div>
      </div>
    </div>
  );
}

// ส่วนควบคุมการเลื่อนเวลา (เฉพาะ Admin)
function DelayControl({ delay, onSave }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mt-4">
      <h3 className="text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">⏰ แผนผังเวลา (เลื่อนการแข่ง)</h3>
      <div className="flex gap-2 flex-wrap">
        {[0, 10, 20, 30, 45, 60].map(m => (
          <button key={m} onClick={() => onSave(m)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all 
            ${delay === m ? "bg-orange-500 border-orange-400 text-white" : "bg-gray-800 border-gray-700 text-gray-500"}`}>
            {m === 0 ? "ตามตาราง" : `+${m} นาที`}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TournamentPage() {
  const [sp] = useSearchParams();
  const divId = sp.get("division") || "open";
  const division = getDivision(divId);
  const [data, setData] = useState(null);
  const [isAdmin, setAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginPw, setLoginPw] = useState("");

  useEffect(() => {
    const unsub = onValue(ref(db, `tournament/${divId}`), (snap) => {
      const val = snap.val();
      if (val) setData(val);
      else {
        const init = { teams: DEFAULT_TEAMS, groupMatches: generateGroupMatches(DEFAULT_TEAMS), koMatches: KO_TEMPLATE, delayMinutes: 0 };
        set(ref(db, `tournament/${divId}`), init);
      }
    });
    return () => unsub();
  }, [divId]);

  const handleUpdateDelay = (mins) => {
    update(ref(db, `tournament/${divId}`), { delayMinutes: mins });
  };

  if (!data) return <div className="p-10 text-center font-bebas text-white tracking-widest">LOADING...</div>;

  const standings = calcStandings(data.teams, data.groupMatches);
  const allMatches = [...(data.groupMatches || []), ...(data.koMatches || [])];

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 pb-20 font-sans">
      <header className="max-w-2xl mx-auto text-center mb-8">
        <h1 className="font-bebas text-5xl text-white tracking-tighter mb-1">
          {division.label} <span className="text-orange-500">TOURNAMENT</span>
        </h1>
        <div className="flex items-center justify-center gap-2">
          <span className="h-px w-8 bg-gray-800" />
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Live Updates</span>
          <span className="h-px w-8 bg-gray-800" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto space-y-6">
        {/* แสดงผลการแข่งนัดถัดไป */}
        <NextMatchCountdown allMatches={allMatches} delayMinutes={data.delayMinutes || 0} />

        {/* ตารางคะแนน */}
        <div className="space-y-4">
          <h2 className="font-bebas text-2xl tracking-widest text-gray-400">STANDINGS</h2>
          {Object.entries(standings).map(([group, teams]) => (
            <div key={group} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
              <div className={`h-1 bg-gradient-to-r ${GROUP_COLORS[group] || "from-gray-500 to-gray-700"}`} />
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-black/20 text-gray-500 font-black uppercase text-[9px]">
                    <th className="px-4 py-3">Group {group}</th>
                    <th className="px-4 py-3 text-center">W-L</th>
                    <th className="px-4 py-3 text-center">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {teams.map((t, i) => (
                    <tr key={t.team} className={i < 2 ? "bg-orange-500/5" : ""}>
                      <td className="px-4 py-3 font-bold">{t.team}</td>
                      <td className="px-4 py-3 text-center font-mono">{t.wins}-{t.losses}</td>
                      <td className="px-4 py-3 text-center font-black text-orange-400">{t.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {isAdmin && <DelayControl delay={data.delayMinutes || 0} onSave={handleUpdateDelay} />}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-md border-t border-white/5 flex justify-center gap-4">
        <button onClick={() => isAdmin ? setAdmin(false) : setShowLogin(true)} 
          className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
          {isAdmin ? "● Admin Mode" : "Admin Login"}
        </button>
      </footer>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowLogin(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-72" onClick={e => e.stopPropagation()}>
            <h3 className="font-bebas text-xl text-white tracking-widest text-center mb-4">ACCESS</h3>
            <input type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { if (checkAdmin(loginPw)) { setAdmin(true); setShowLogin(false); setLoginPw(""); } else setLoginPw(""); } }}
              placeholder="Passcode" className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-center text-white outline-none mb-3" />
            <button onClick={() => { if (checkAdmin(loginPw)) { setAdmin(true); setShowLogin(false); setLoginPw(""); } else setLoginPw(""); }}
              className="w-full py-2 bg-white text-black font-black text-xs rounded-xl">LOGIN</button>
          </div>
        </div>
      )}
    </div>
  );
}
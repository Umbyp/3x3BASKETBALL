/**
 * TournamentPage v4 — มีสนามแข่ง + แมทช์พร้อมกันหลายสนาม
 * ✅ court field ใน MATCH_SCHEDULE
 * ✅ NextMatchCountdown แสดงทุกสนามที่แข่งพร้อมกัน
 * ✅ MatchCard แสดง badge สนาม
 * ✅ Schedule จัดกลุ่มตามวัน + slot เวลา
 */
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase.js";
import { ref, onValue, update, set } from "firebase/database";
import {
  DIVISIONS, GROUP_COLORS, DEFAULT_TEAMS,
  KO_TEMPLATE, generateGroupMatches, getDivision,
} from "../constants.js";

const checkAdmin = pw => pw === (import.meta.env.VITE_ADMIN_PASS || "admin1234");

// ── ✏️ ตารางเวลา + สนาม ────────────────────────────────────────────────────────
// court: "A" | "B" | "C"  ← แก้ให้ตรงกับสนามจริง
// แมทช์ที่มี date+time เหมือนกันแต่ court ต่างกัน = แข่งพร้อมกัน
const MATCH_SCHEDULE = {
  //  id  matchNo  วันที่              ป้ายวัน                  เวลา            สนาม
  19: { matchNo:  1, date:"2026-02-28", dateLabel:"เสาร์ 28 ก.พ.",    time:"13:00-14:00", court:"A" },
  12: { matchNo:  2, date:"2026-02-28", dateLabel:"เสาร์ 28 ก.พ.",    time:"13:00-14:00", court:"B" },
  18: { matchNo:  3, date:"2026-02-28", dateLabel:"เสาร์ 28 ก.พ.",    time:"14:10-15:10", court:"A" },
   3: { matchNo:  4, date:"2026-02-28", dateLabel:"เสาร์ 28 ก.พ.",    time:"14:10-15:10", court:"B" },
   4: { matchNo:  5, date:"2026-03-01", dateLabel:"อาทิตย์ 1 มี.ค.", time:"13:00-14:00", court:"A" },
   7: { matchNo:  6, date:"2026-03-01", dateLabel:"อาทิตย์ 1 มี.ค.", time:"13:00-14:00", court:"B" },
  13: { matchNo:  7, date:"2026-03-01", dateLabel:"อาทิตย์ 1 มี.ค.", time:"14:10-15:10", court:"A" },
  24: { matchNo:  8, date:"2026-03-01", dateLabel:"อาทิตย์ 1 มี.ค.", time:"14:10-15:10", court:"B" },
  20: { matchNo:  9, date:"2026-03-15", dateLabel:"อาทิตย์ 15 มี.ค.",time:"13:00-14:00", court:"A" },
   2: { matchNo: 10, date:"2026-03-15", dateLabel:"อาทิตย์ 15 มี.ค.",time:"13:00-14:00", court:"B" },
  14: { matchNo: 11, date:"2026-03-15", dateLabel:"อาทิตย์ 15 มี.ค.",time:"14:10-15:10", court:"A" },
   8: { matchNo: 12, date:"2026-03-15", dateLabel:"อาทิตย์ 15 มี.ค.",time:"14:10-15:10", court:"B" },
  16: { matchNo: 13, date:"2026-03-21", dateLabel:"เสาร์ 21 มี.ค.",  time:"13:00-14:00", court:"A" },
  23: { matchNo: 14, date:"2026-03-21", dateLabel:"เสาร์ 21 มี.ค.",  time:"13:00-14:00", court:"B" },
   5: { matchNo: 15, date:"2026-03-21", dateLabel:"เสาร์ 21 มี.ค.",  time:"14:10-15:10", court:"A" },
   9: { matchNo: 16, date:"2026-03-21", dateLabel:"เสาร์ 21 มี.ค.",  time:"14:10-15:10", court:"B" },
  10: { matchNo: 17, date:"2026-03-22", dateLabel:"อาทิตย์ 22 มี.ค.",time:"13:00-14:00", court:"A" },
  21: { matchNo: 18, date:"2026-03-22", dateLabel:"อาทิตย์ 22 มี.ค.",time:"13:00-14:00", court:"B" },
   1: { matchNo: 19, date:"2026-03-22", dateLabel:"อาทิตย์ 22 มี.ค.",time:"14:10-15:10", court:"A" },
  17: { matchNo: 20, date:"2026-03-22", dateLabel:"อาทิตย์ 22 มี.ค.",time:"14:10-15:10", court:"B" },
  22: { matchNo: 21, date:"2026-03-28", dateLabel:"เสาร์ 28 มี.ค.",  time:"13:00-14:00", court:"A" },
  11: { matchNo: 22, date:"2026-03-28", dateLabel:"เสาร์ 28 มี.ค.",  time:"13:00-14:00", court:"B" },
   6: { matchNo: 23, date:"2026-03-28", dateLabel:"เสาร์ 28 มี.ค.",  time:"14:10-15:10", court:"A" },
  15: { matchNo: 24, date:"2026-03-28", dateLabel:"เสาร์ 28 มี.ค.",  time:"14:10-15:10", court:"B" },
 100: { matchNo: 25, date:"2026-03-29", dateLabel:"อาทิตย์ 29 มี.ค.",time:"13:00-14:00", court:"A" },
 101: { matchNo: 26, date:"2026-03-29", dateLabel:"อาทิตย์ 29 มี.ค.",time:"13:00-14:00", court:"B" },
 102: { matchNo: 27, date:"2026-03-29", dateLabel:"อาทิตย์ 29 มี.ค.",time:"14:10-15:10", court:"A" },
 103: { matchNo: 28, date:"2026-03-29", dateLabel:"อาทิตย์ 29 มี.ค.",time:"14:10-15:10", court:"B" },
 200: { matchNo: 29, date:"2026-04-04", dateLabel:"เสาร์ 4 เม.ย.",   time:"16:00-17:00", court:"A" },
 201: { matchNo: 30, date:"2026-04-04", dateLabel:"เสาร์ 4 เม.ย.",   time:"16:00-17:00", court:"B" },
 300: { matchNo: 31, date:"2026-04-05", dateLabel:"อาทิตย์ 5 เม.ย.",time:"16:00-17:00", court:"A" },
 301: { matchNo: 32, date:"2026-04-05", dateLabel:"อาทิตย์ 5 เม.ย.",time:"17:00-18:00", court:"A" },
};

// สีสนาม
const COURT_COLORS = {
  A: { bg:"bg-sky-500/15",    text:"text-sky-400",    border:"border-sky-500/30"    },
  B: { bg:"bg-violet-500/15", text:"text-violet-400", border:"border-violet-500/30" },
  C: { bg:"bg-rose-500/15",   text:"text-rose-400",   border:"border-rose-500/30"   },
};
const courtColor = c => COURT_COLORS[c] || COURT_COLORS.A;

// ── Helpers ───────────────────────────────────────────────────────────────────
function isMatchLive(matchId, now, delayMinutes = 0) {
  const s = MATCH_SCHEDULE[matchId];
  if (!s) return false;
  const [st, en] = s.time.split("-");
  const start = new Date(`${s.date}T${st}:00+07:00`);
  const end   = new Date(`${s.date}T${en}:00+07:00`);
  start.setMinutes(start.getMinutes() + delayMinutes);
  end.setMinutes(end.getMinutes()     + delayMinutes);
  return now >= start && now <= new Date(end.getTime() + 30 * 60000);
}

function getAdjustedTimeLabel(matchId, delayMinutes = 0) {
  const s = MATCH_SCHEDULE[matchId];
  if (!s) return "";
  if (delayMinutes === 0) return s.time;
  const addMin = (t, m) => {
    const [h, mm] = t.split(":").map(Number);
    const tot = h * 60 + mm + m;
    return `${String(Math.floor(tot/60)).padStart(2,"0")}:${String(tot%60).padStart(2,"0")}`;
  };
  const [st, en] = s.time.split("-");
  return `${addMin(st, delayMinutes)}-${addMin(en, delayMinutes)}`;
}

// ── H2H Tiebreaker 3+ ทีม ────────────────────────────────────────────────────
function breakTie(tiedTeams, allMatches) {
  if (tiedTeams.length <= 1) return tiedTeams;
  const h2h = {}, tiedSet = new Set(tiedTeams.map(t => t.team));
  tiedTeams.forEach(t => { h2h[t.team] = { pts:0, pf:0, pa:0 }; });
  allMatches.forEach(m => {
    if (!m.played || m.round !== 1 || !tiedSet.has(m.home) || !tiedSet.has(m.away)) return;
    h2h[m.home].pf += m.homeScore; h2h[m.home].pa += m.awayScore;
    h2h[m.away].pf += m.awayScore; h2h[m.away].pa += m.homeScore;
    const forfeitH = m.homeScore===0 && m.awayScore===20;
    const forfeitA = m.awayScore===0 && m.homeScore===20;
    if      (m.homeScore > m.awayScore) { h2h[m.home].pts+=3; h2h[m.away].pts+=forfeitH?0:1; }
    else if (m.awayScore > m.homeScore) { h2h[m.away].pts+=3; h2h[m.home].pts+=forfeitA?0:1; }
  });
  return [...tiedTeams].sort((a, b) => {
    const ha = h2h[a.team], hb = h2h[b.team];
    if (hb.pts !== ha.pts) return hb.pts - ha.pts;
    const dA = ha.pf-ha.pa, dB = hb.pf-hb.pa;
    if (dA !== dB) return dB - dA;
    return (b.pf-b.pa) - (a.pf-a.pa);
  });
}

function calcStandings(teams, matches) {
  if (!teams || !matches) return {};
  const stats = {};
  Object.entries(teams).forEach(([g, ts]) => ts.forEach(t => {
    stats[t] = { team:t, group:g, played:0, wins:0, losses:0, pts:0, pf:0, pa:0 };
  }));
  matches.forEach(m => {
    if (!m.played || m.round !== 1) return;
    const h = stats[m.home], a = stats[m.away]; if (!h||!a) return;
    h.played++; a.played++; h.pf+=m.homeScore; h.pa+=m.awayScore;
    a.pf+=m.awayScore; a.pa+=m.homeScore;
    const forfeitH = m.homeScore===0 && m.awayScore===20;
    const forfeitA = m.awayScore===0 && m.homeScore===20;
    if      (m.homeScore > m.awayScore) { h.wins++; h.pts+=3; a.losses++; a.pts+=forfeitH?0:1; }
    else if (m.awayScore > m.homeScore) { a.wins++; a.pts+=3; h.losses++; h.pts+=forfeitA?0:1; }
  });
  const grouped = {};
  Object.keys(teams).forEach(g => {
    const sorted = [...teams[g].map(t=>stats[t])].sort((a,b)=>b.pts-a.pts);
    const result = []; let i = 0;
    while (i < sorted.length) {
      let j = i+1;
      while (j < sorted.length && sorted[j].pts === sorted[i].pts) j++;
      result.push(...breakTie(sorted.slice(i,j), matches));
      i = j;
    }
    grouped[g] = result;
  });
  return grouped;
}

function resolveKo(code, standings, resolved) {
  if (!code) return code;
  if (/^[1-4][A-D]$/.test(code)) {
    const r = parseInt(code[0])-1, g = code[1];
    return standings[g]?.[r]?.team || code;
  }
  if (code.includes("-")) {
    const [outcome, label] = code.split("-");
    const m = resolved.find(r => r.shortLabel === label);
    if (!m || !m.played) return code;
    const hw = m.homeScore > m.awayScore;
    return outcome==="W" ? (hw?m.rh:m.ra) : (hw?m.ra:m.rh);
  }
  return code;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

// ── ✅ คืนค่า array ของแมทช์ที่ใกล้ที่สุด (อาจหลายสนามพร้อมกัน) ───────────────
function useNextMatches(matches, delayMinutes = 0) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  const { nexts, earliest, isAnyLive } = useMemo(() => {
    if (!matches?.length) return { nexts:[], earliest:null, isAnyLive:false };

    // แนบ dt และ sched ให้แต่ละแมทช์ที่ยังไม่เล่น
    const withDt = matches
      .filter(m => !m.played)
      .map(m => {
        const s = MATCH_SCHEDULE[m.id]; if (!s) return null;
        const dt = new Date(`${s.date}T${s.time.split("-")[0]}:00+07:00`);
        dt.setMinutes(dt.getMinutes() + delayMinutes);
        return { ...m, _dt: dt, _sched: s };
      })
      .filter(Boolean)
      .sort((a, b) => a._dt - b._dt);

    if (!withDt.length) return { nexts:[], earliest:null, isAnyLive:false };

    const earliestDt = withDt[0]._dt;
    // รวมทุกแมทช์ที่ start เวลาเดียวกัน (±1 นาที) = แข่งพร้อมกัน
    const nexts = withDt.filter(m => Math.abs(m._dt - earliestDt) < 60000);
    const isAnyLive = nexts.some(m => isMatchLive(m.id, now, delayMinutes));

    return { nexts, earliest: earliestDt, isAnyLive };
  }, [matches, delayMinutes, now]);

  const diff    = earliest ? Math.max(0, earliest - now) : 0;
  return {
    nexts, isAnyLive,
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }) {
  const [err, setErr] = useState(false);
  const init = (name||"?").charAt(0).toUpperCase();
  const grads = ["from-orange-600 to-red-800","from-blue-600 to-indigo-800","from-emerald-600 to-teal-800","from-purple-600 to-fuchsia-800","from-amber-500 to-yellow-700"];
  let h = 0; for (const c of (name||"")) h = c.charCodeAt(0)+((h<<5)-h);
  const sz = { sm:"w-8 h-8 text-xs", md:"w-10 h-10 text-sm", lg:"w-14 h-14 text-lg" };
  return (
    <div className={`${sz[size]} rounded-full flex items-center justify-center font-black text-white border border-white/10 shrink-0 overflow-hidden bg-gradient-to-br ${grads[Math.abs(h)%grads.length]}`}>
      {!err ? <img src={`/photo/${(name||"").replace(/\s+/g,"_")}.jpg`} alt="" className="w-full h-full object-cover" onError={()=>setErr(true)}/> : <span>{init}</span>}
    </div>
  );
}

function FlipDigit({ value }) {
  return (
    <div className="relative w-9 h-9 flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-800 border border-white/[0.07] rounded-lg shadow-inner" />
      <div className="absolute left-0 right-0 top-1/2 -translate-y-px h-px bg-black/50 z-10" />
      <span className="relative z-20 text-sm font-black font-mono text-white tabular-nums" style={{textShadow:"0 0 14px rgba(249,115,22,0.5)"}}>
        {String(value).padStart(2,"0")}
      </span>
    </div>
  );
}

// ── ✅ Countdown — รองรับหลายสนามแข่งพร้อมกัน ────────────────────────────────
function NextMatchCountdown({ allMatches, delayMinutes }) {
  const { nexts, days, hours, minutes, seconds, isAnyLive } = useNextMatches(allMatches, delayMinutes);
  if (!nexts.length) return null;

  const sched0 = MATCH_SCHEDULE[nexts[0].id] || {};
  const displayTime = getAdjustedTimeLabel(nexts[0].id, delayMinutes);
  const units = [{label:"วัน",value:days},{label:"ชม.",value:hours},{label:"นาที",value:minutes},{label:"วิ",value:seconds}];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-950/80 shadow-2xl mt-4">
      <div className="absolute -top-6 -left-6 w-32 h-32 bg-orange-600/15 blur-3xl rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-black/30">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isAnyLive?"bg-red-500 shadow-[0_0_8px_#ef4444]":"bg-green-400"}`} />
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
            {isAnyLive ? "กำลังแข่งขัน" : "นัดถัดไป"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* แสดง badge สนามทั้งหมดที่แข่งพร้อมกัน */}
          {nexts.map(m => {
            const s = MATCH_SCHEDULE[m.id]; if (!s) return null;
            const cc = courtColor(s.court);
            return (
              <span key={m.id} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${cc.bg} ${cc.text} ${cc.border}`}>
                สนาม {s.court}
              </span>
            );
          })}
          {delayMinutes > 0 && (
            <span className="px-2 py-0.5 rounded text-[8px] font-black border bg-yellow-500/20 text-yellow-400 border-yellow-500/30">+{delayMinutes}น.</span>
          )}
        </div>
      </div>

      {/* Countdown timer (แสดงครั้งเดียว) */}
      {!isAnyLive && (
        <div className="flex items-center justify-center gap-1 pt-3 pb-1">
          {units.map(({label, value}, i) => (
            <div key={label} className="flex items-end gap-0.5">
              <div className="flex flex-col items-center">
                <FlipDigit value={value} />
                <span className="text-[7px] text-gray-600 font-bold mt-0.5 uppercase">{label}</span>
              </div>
              {i < units.length-1 && <span className="text-gray-700 font-black text-xs pb-4 leading-none">:</span>}
            </div>
          ))}
        </div>
      )}
      {isAnyLive && (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="text-red-400 font-black text-base animate-pulse tracking-widest">⚡ LIVE</span>
        </div>
      )}
      <div className="flex flex-col items-center pb-2">
        <span className="text-[8px] text-gray-600 font-mono">{displayTime}</span>
        <span className="text-[8px] text-gray-500 font-bold">{sched0.dateLabel}</span>
      </div>

      {/* ✅ แสดงแมทช์แต่ละสนามแยกกัน */}
      <div className={`grid gap-px bg-gray-800/50 border-t border-white/[0.05] ${nexts.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {nexts.map(m => {
          const s = MATCH_SCHEDULE[m.id] || {};
          const cc = courtColor(s.court);
          const home = m.rh || m.home, away = m.ra || m.away;
          const gc = m.group ? GROUP_COLORS[m.group] : null;
          const live = isMatchLive(m.id, new Date(), delayMinutes);
          return (
            <div key={m.id} className={`bg-gray-950 px-3 py-2.5 ${live?"bg-red-950/20":""}`}>
              {/* Court badge + group */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${cc.bg} ${cc.text} ${cc.border}`}>
                  สนาม {s.court}
                </span>
                {m.group && gc && <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${gc.badge||""}`}>G{m.group}</span>}
                {m.shortLabel && !m.group && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase border bg-orange-500/20 text-orange-400 border-orange-500/30">{m.shortLabel}</span>}
                {live && <span className="text-[8px] text-red-500 font-black animate-pulse ml-auto">● LIVE</span>}
              </div>
              {/* Teams */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <Avatar name={home} size="sm" />
                  <span className="text-[9px] font-black text-gray-300 uppercase truncate max-w-[60px] text-center leading-tight">{home}</span>
                </div>
                <span className="text-gray-700 text-xs font-black">VS</span>
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <Avatar name={away} size="sm" />
                  <span className="text-[9px] font-black text-gray-300 uppercase truncate max-w-[60px] text-center leading-tight">{away}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Delay Control ─────────────────────────────────────────────────────────────
function DelayControl({ delayMinutes, onSave }) {
  const [input, setInput] = useState(String(delayMinutes));
  const presets = [0, 10, 20, 30, 45, 60];
  const save = val => { const n = parseInt(val); if (!isNaN(n) && n >= 0) onSave(n); };
  return (
    <div className="mt-3 pt-3 border-t border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">⏰ เลื่อนตารางเวลา</span>
        {delayMinutes > 0 && <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[9px] font-black">+{delayMinutes} นาที</span>}
      </div>
      <div className="flex gap-1.5 flex-wrap mb-2">
        {presets.map(p=>(
          <button key={p} onClick={()=>{setInput(String(p));save(p);}}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black border transition-all ${delayMinutes===p?"bg-yellow-500/20 text-yellow-400 border-yellow-500/40":"bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500"}`}>
            {p===0?"ตามกำหนด":`+${p}น.`}
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input type="number" min="0" max="300" value={input} onChange={e=>setInput(e.target.value)}
          className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono outline-none focus:border-yellow-500 text-center"/>
        <span className="text-[9px] text-gray-600">นาที</span>
        <button onClick={()=>save(input)} className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[9px] font-black hover:bg-yellow-500/20 transition-colors">บันทึก</button>
      </div>
    </div>
  );
}

// Toast + AnimatedTab
function Toast({ message, type="success", onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,2500); return()=>clearTimeout(t); },[onClose]);
  const s={success:"bg-emerald-500/10 border-emerald-500/50 text-emerald-400",error:"bg-rose-500/10 border-rose-500/50 text-rose-400",info:"bg-blue-500/10 border-blue-500/50 text-blue-400"};
  return <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full border text-sm font-bold shadow-2xl animate-fade-in ${s[type]}`}>{message}</div>;
}

function AnimatedTab({ active, children }) {
  const [visible, setVisible] = useState(active);
  const [cls, setCls] = useState(active?"opacity-100 translate-y-0":"opacity-0 translate-y-2 pointer-events-none absolute");
  useEffect(()=>{
    if(active){setVisible(true);requestAnimationFrame(()=>requestAnimationFrame(()=>setCls("opacity-100 translate-y-0 transition-all duration-300 ease-out")));}
    else{setCls("opacity-0 translate-y-2 pointer-events-none absolute transition-all duration-150");const t=setTimeout(()=>setVisible(false),150);return()=>clearTimeout(t);}
  },[active]);
  if(!visible&&!active) return null;
  return <div className={`w-full ${cls}`}>{children}</div>;
}

// ── ✅ MatchCard — แสดง court badge ──────────────────────────────────────────
function MatchCard({ m, isAdmin, onEdit, onReset, now, delayMinutes }) {
  const dh = m.rh||m.home, da = m.ra||m.away;
  const hw = m.played && m.homeScore > m.awayScore;
  const aw = m.played && m.awayScore > m.homeScore;
  const gc = m.group ? GROUP_COLORS[m.group] : null;
  const sched = MATCH_SCHEDULE[m.id] || {};
  const cc = courtColor(sched.court);
  const showScore = m.played || (m.homeScore !== null && m.homeScore !== undefined);
  const live = !m.played && (isMatchLive(m.id, now, delayMinutes) || showScore);
  const displayTime = getAdjustedTimeLabel(m.id, delayMinutes) || "";
  const leftBorder = live ? "border-l-red-500" : sched.court ? `border-l-2` : "border-l-gray-700";

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden border-l-4 ${live?"border-l-red-500 shadow-lg shadow-red-900/20":gc?gc.ring||"border-l-orange-500":"border-l-gray-700"}`}>
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50 bg-gray-950/30">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-700 font-mono">#{sched.matchNo||m.id}</span>

          {/* ✅ Court badge */}
          {sched.court && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${cc.bg} ${cc.text} ${cc.border}`}>
              สนาม {sched.court}
            </span>
          )}

          {m.group && gc && <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${gc.badge||""}`}>G{m.group}</span>}
          {m.shortLabel && !m.group && <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase border bg-orange-500/20 text-orange-400 border-orange-500/30">{m.shortLabel}</span>}

          {m.played
            ? <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>จบแล้ว</span>
            : live
              ? <span className="flex items-center gap-1 text-[9px] text-red-400 font-black animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]"/>กำลังแข่ง</span>
              : <span className="text-[9px] text-gray-600">รอแข่ง</span>
          }
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
          {sched.dateLabel && <span className="text-gray-500">{sched.dateLabel}</span>}
          {displayTime && (
            <span className={`px-2 py-0.5 rounded font-bold ${live?"bg-red-500/20 text-red-400 border border-red-500/40":"bg-gray-800 text-gray-300 border border-gray-700"}`}>
              {displayTime}
            </span>
          )}
          {delayMinutes>0 && !m.played && <span className="text-yellow-500/70 font-bold">+{delayMinutes}น.</span>}
        </div>
      </div>

      {/* Match row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-2 flex-1"><Avatar name={dh} size="sm"/><span className={`text-xs font-bold ${hw?"text-white":"text-gray-500"}`}>{dh}</span></div>
        <div className="text-center min-w-[72px]">
          {showScore
            ? <div className="flex items-center justify-center gap-1 tabular-nums">
                <span className={`text-xl font-black ${live?"text-red-400":hw?"text-white":"text-gray-600"}`}>{m.homeScore??0}</span>
                <span className="text-gray-700 px-0.5">:</span>
                <span className={`text-xl font-black ${live?"text-red-400":aw?"text-white":"text-gray-600"}`}>{m.awayScore??0}</span>
              </div>
            : <span className={`text-lg font-black ${live?"text-red-500 animate-pulse":"text-gray-700"}`}>{live?"LIVE":"VS"}</span>
          }
          {live && <div className="text-[8px] text-red-600 font-bold animate-pulse text-center">● LIVE</div>}
          {isAdmin && <div className="flex gap-1 justify-center mt-0.5">
            <button onClick={()=>onEdit({...m,rh:dh,ra:da})} className="text-[9px] text-orange-400 font-bold">{m.played?"✏️":"+ Score"}</button>
            {m.played && <button onClick={()=>onReset(m.id)} className="text-[9px] text-rose-500 font-bold">✕</button>}
          </div>}
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end"><span className={`text-xs font-bold ${aw?"text-white":"text-gray-500"}`}>{da}</span><Avatar name={da} size="sm"/></div>
      </div>
    </div>
  );
}

// ── ScoreModal ────────────────────────────────────────────────────────────────
function ScoreModal({ match, onClose, onSave }) {
  const [h, setH] = useState(match.homeScore??"");
  const [a, setA] = useState(match.awayScore??"");
  const dh = match.rh||match.home, da = match.ra||match.away;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 animate-fade-in" onClick={e=>e.stopPropagation()}>
        <h3 className="text-lg font-black text-white tracking-widest mb-1 text-center uppercase">Update Result</h3>
        {MATCH_SCHEDULE[match.id]?.court && (
          <div className="flex justify-center mb-4">
            {(() => { const cc = courtColor(MATCH_SCHEDULE[match.id].court); return (
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${cc.bg} ${cc.text} ${cc.border}`}>
                สนาม {MATCH_SCHEDULE[match.id].court}
              </span>
            );})()}
          </div>
        )}
        <div className="flex items-center gap-4 mb-6">
          {[{t:dh,v:h,set:setH,side:"home"},{t:da,v:a,set:setA,side:"away"}].map((s,i)=>(
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <Avatar name={s.t} size="lg"/>
              <p className="text-xs text-gray-300 font-bold text-center">{s.t}</p>
              <button onClick={()=>s.side==="home"?[setH(20),setA(0)]:[setH(0),setA(20)]} className="text-[9px] font-black text-emerald-500 uppercase">ชนะบาย 20-0</button>
              <input type="number" value={s.v} onChange={e=>s.set(e.target.value)} autoFocus={i===0}
                className="w-16 h-12 bg-gray-800 border border-gray-700 rounded-lg text-center text-2xl font-black text-white outline-none focus:border-orange-500" placeholder="—"/>
            </div>
          ))}
        </div>
        <button disabled={h===""||a===""} onClick={()=>{if(h!==""&&a!==""){onSave(match.id,parseInt(h),parseInt(a));onClose();}}}
          className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-black uppercase tracking-widest transition-all">Confirm</button>
      </div>
    </div>
  );
}

// ── Standings Tab ─────────────────────────────────────────────────────────────
function Standings({ standings, divCfg }) {
  return (
    <div className="space-y-5">
      {Object.entries(standings).map(([g, teams]) => {
        const gc = GROUP_COLORS[g] || GROUP_COLORS.A;
        const borderColor = g==="A"?"#f59e0b":g==="B"?"#3b82f6":g==="C"?"#10b981":"#a855f7";
        return (
          <div key={g} className="border rounded-2xl overflow-hidden bg-gray-900" style={{borderLeftWidth:4,borderLeftColor:borderColor,borderColor:"rgb(31,41,55)"}}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-base" style={{background:borderColor}}>G{g}</span>
              <span className={`font-black text-sm tracking-widest uppercase ${gc.text||""}`}>Group {g}</span>
              <span className="ml-auto text-xs text-gray-600">อันดับ 1-2 ผ่านรอบ</span>
            </div>
            <table className="w-full">
              <thead><tr className="bg-gray-950/50 border-b border-gray-800">
                {["#","Team","P","W","L","+/-","PTS"].map(h=>(
                  <th key={h} className="px-3 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest text-center first:text-left">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {teams.map((t, i) => {
                  const diff=t.pf-t.pa, q=i<2;
                  return (
                    <tr key={t.team} className={`border-b border-gray-800/30 last:border-0 ${q?"bg-white/[.015]":""}`}>
                      <td className="px-3 py-2.5"><span className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black ${i===0?"bg-yellow-500 text-black":i===1?"bg-gray-500 text-black":"bg-gray-800 text-gray-600"}`}>{i+1}</span></td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Avatar name={t.team} size="sm"/>
                        <div><div className={`text-xs font-bold ${q?"text-white":"text-gray-500"}`}>{t.team}</div>
                          {q&&<div className={`text-[8px] font-black uppercase ${gc.text||"text-orange-400"}`}>✓ Qualified</div>}
                        </div></div></td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500 font-mono">{t.played}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-black text-emerald-400 font-mono">{t.wins}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold text-rose-400 font-mono">{t.losses}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-black font-mono">
                        <span className={diff>0?"text-emerald-400":diff<0?"text-rose-400":"text-gray-600"}>{diff>0?"+":""}{diff}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center"><span className={`text-xl font-black font-mono ${q?gc.text||"text-orange-400":"text-gray-700"}`}>{t.pts}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ── ✅ Schedule Tab — จัดกลุ่มตามวัน แล้วซอยตาม slot เวลา (หลายสนาม) ──────────
function Schedule({ matches, isAdmin, onEdit, onReset, now, delayMinutes }) {
  const [filter, setFilter] = useState("all");

  const enriched = matches
    .map(m => ({
      ...m,
      _sched: MATCH_SCHEDULE[m.id] || {},
      _matchNo: MATCH_SCHEDULE[m.id]?.matchNo || 999,
    }))
    .sort((a, b) => a._matchNo - b._matchNo);

  const liveCount = enriched.filter(m => !m.played && (isMatchLive(m.id, now, delayMinutes) || (m.homeScore !== null && m.homeScore !== undefined))).length;
  const filtered = enriched.filter(m => filter==="played"?m.played:filter==="pending"?!m.played:true);

  // จัดกลุ่มตามวัน → ภายในวันจัดกลุ่มตาม time slot
  const byDate = {};
  filtered.forEach(m => {
    const dk = m._sched.date || "TBD";
    const dl = m._sched.dateLabel || dk;
    if (!byDate[dk]) byDate[dk] = { label:dl, slots:{} };
    const adjustedTime = getAdjustedTimeLabel(m.id, delayMinutes) || m._sched.time || "TBD";
    if (!byDate[dk].slots[adjustedTime]) byDate[dk].slots[adjustedTime] = [];
    byDate[dk].slots[adjustedTime].push(m);
  });

  return (
    <div className="space-y-3">
      {liveCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"/>
          <span className="text-xs font-black text-red-400 uppercase tracking-widest">⚡ กำลังแข่ง {liveCount} นัด / อัปเดตสด</span>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {[["all","ทั้งหมด"],["pending","รอแข่ง"],["played","จบแล้ว"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${filter===v?"bg-orange-500/15 border-orange-500/30 text-orange-400":"border-gray-800 text-gray-600 hover:text-gray-300"}`}>{l}</button>
        ))}
      </div>

      {/* Court legend */}
      <div className="flex gap-3 px-1 flex-wrap">
        {Object.entries(COURT_COLORS).map(([c, cc]) => (
          <div key={c} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${cc.bg.replace("/15","").replace("bg-","bg-").replace("500","400")}`}
              style={{background: c==="A"?"#38bdf8":c==="B"?"#a78bfa":"#fb7185"}}/>
            <span className="text-[10px] text-gray-500 font-bold">สนาม {c}</span>
          </div>
        ))}
      </div>

      {/* ✅ กลุ่มตามวัน → time slot → สนาม */}
      {Object.keys(byDate).sort().map(dk => {
        const { label, slots } = byDate[dk];
        const dayMatches = Object.values(slots).flat();
        const dayLive = dayMatches.some(m => !m.played && (isMatchLive(m.id, now, delayMinutes) || m.homeScore !== null));
        const dayDone = dayMatches.every(m => m.played);
        return (
          <div key={dk} className="space-y-2">
            {/* วัน header */}
            <div className="flex items-center gap-3 sticky top-[57px] z-10 bg-[#050505]/95 backdrop-blur py-1.5">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-black ${dayLive?"bg-red-500/10 border-red-500/30 text-red-400":dayDone?"bg-emerald-500/10 border-emerald-500/20 text-emerald-400":"bg-gray-900 border-gray-800 text-gray-400"}`}>
                {dayLive?"⚡":"📅"} {label}
                {dayDone && <span className="text-[9px]">✓ จบแล้ว</span>}
              </div>
              <span className="text-[9px] text-gray-700 font-mono">{dayMatches.filter(m=>m.played).length}/{dayMatches.length} แมทช์</span>
            </div>

            {/* time slot groups */}
            {Object.keys(slots).sort().map(slotTime => {
              const slotMatches = slots[slotTime];
              const slotLive = slotMatches.some(m => !m.played && (isMatchLive(m.id, now, delayMinutes) || m.homeScore !== null));
              const slotDone = slotMatches.every(m => m.played);
              const multiCourt = slotMatches.length > 1;

              return (
                <div key={slotTime}>
                  {/* time slot label — แสดงเฉพาะถ้ามีหลายสนามพร้อมกัน */}
                  {multiCourt && (
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <div className={`h-px flex-1 ${slotLive?"bg-red-500/30":slotDone?"bg-emerald-500/20":"bg-gray-800"}`}/>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${slotLive?"bg-red-500/10 border-red-500/30 text-red-400":slotDone?"bg-emerald-500/10 border-emerald-500/20 text-emerald-400":"bg-gray-900 border-gray-800 text-gray-500"}`}>
                        {slotTime} · {slotMatches.length} สนามพร้อมกัน
                      </span>
                      <div className={`h-px flex-1 ${slotLive?"bg-red-500/30":slotDone?"bg-emerald-500/20":"bg-gray-800"}`}/>
                    </div>
                  )}
                  <div className="space-y-2">
                    {slotMatches.map(m => (
                      <MatchCard key={m.id} m={m} isAdmin={isAdmin} onEdit={onEdit} onReset={onReset} now={now} delayMinutes={delayMinutes}/>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {filtered.length === 0 && <p className="text-center text-gray-700 py-10 text-sm">ไม่มีแมทช์</p>}
    </div>
  );
}

// ── Bracket Tab ───────────────────────────────────────────────────────────────
function Bracket({ koMatches, isAdmin, onEdit, onReset }) {
  const MC = ({ m }) => {
    if (!m?.id) return <div className="w-44 h-16 bg-gray-800/40 rounded-xl border border-gray-700/30" />;
    const dh=m.rh||m.home, da=m.ra||m.away;
    const hw=m.played&&m.homeScore>m.awayScore, aw=m.played&&m.awayScore>m.homeScore;
    const sched = MATCH_SCHEDULE[m.id] || {};
    const cc = courtColor(sched.court);
    return (
      <div className="w-44 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
        <div className="px-2.5 py-1 flex items-center justify-between border-b border-gray-800 bg-gray-950/50">
          <span className="text-[9px] font-black text-gray-500 uppercase">{m.shortLabel}</span>
          <div className="flex items-center gap-1">
            {sched.court && <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${cc.bg} ${cc.text} ${cc.border}`}>{sched.court}</span>}
            {m.played && <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>}
          </div>
        </div>
        {[{t:dh,s:m.homeScore,w:hw},{t:da,s:m.awayScore,w:aw}].map((r,i)=>(
          <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 ${r.w?"bg-orange-500/10":""} ${i===0?"border-b border-gray-800":""}`}>
            <div className="flex items-center gap-1.5 flex-1 min-w-0"><Avatar name={r.t} size="sm"/><span className={`text-[10px] font-bold truncate ${r.w?"text-white":"text-gray-500"}`}>{r.t}</span></div>
            <span className={`text-xs font-black font-mono ml-1 ${r.w?"text-orange-400":"text-gray-600"}`}>{m.played?r.s:"—"}</span>
          </div>
        ))}
        {isAdmin && <div className="flex border-t border-gray-800">
          <button onClick={()=>onEdit(m)} className="flex-1 py-1 text-[9px] text-orange-400 hover:bg-orange-500/10 transition-colors font-bold">{m.played?"✏️ Edit":"+ Score"}</button>
          {m.played && <button onClick={()=>onReset(m.id)} className="px-2.5 py-1 text-[9px] text-rose-500 hover:bg-rose-500/10 border-l border-gray-800 font-bold">✕</button>}
        </div>}
      </div>
    );
  };
  const qf=koMatches.filter(m=>m.round===2), sf=koMatches.filter(m=>m.round===3), fn=koMatches.filter(m=>m.round===4);
  return (
    <div className="overflow-x-auto pb-6">
      <div className="text-[9px] text-gray-600 text-center mb-2 animate-pulse">← เลื่อนดูสาย →</div>
      <div className="flex items-start gap-8 min-w-max pt-2">
        {qf.length>0&&<div className="flex flex-col gap-4"><p className="text-[9px] font-black text-gray-600 uppercase text-center">QF</p>{qf.map(m=><MC key={m.id} m={m}/>)}</div>}
        {sf.length>0&&<div className={`flex flex-col gap-4 ${qf.length>0?"mt-8":""}`}><p className="text-[9px] font-black text-gray-600 uppercase text-center">SF</p>{sf.map(m=><MC key={m.id} m={m}/>)}</div>}
        {fn.length>0&&<div className={`flex flex-col gap-4 ${sf.length>0?"mt-16":""}`}>
          <p className="text-[9px] font-black text-gray-600 uppercase text-center">FINAL</p>
          {fn.filter(m=>m.shortLabel==="FINAL").map(m=>(<div key={m.id}><p className="text-[9px] text-yellow-500 font-black text-center mb-1 animate-pulse">🏆 Grand Final</p><MC m={m}/></div>))}
          {fn.filter(m=>m.shortLabel==="3rd").map(m=>(<div key={m.id} className="opacity-60 mt-4"><p className="text-[9px] text-gray-600 text-center mb-1">3rd</p><MC m={m}/></div>))}
        </div>}
      </div>
      <div className="mt-5 bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
        <p className="font-black text-white text-xs mb-3 uppercase tracking-wider">🏆 เงินรางวัล</p>
        {[["🥇 ชนะเลิศ","20,000 บาท","text-yellow-300"],["🥈 รองชนะเลิศ 1","9,000 บาท","text-gray-300"],["🥉 รองชนะเลิศ 2","6,000 บาท","text-orange-400"]].map(([r,p,c])=>(
          <div key={r} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
            <span className="text-xs text-gray-400">{r}</span><span className={`font-black text-sm ${c}`}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TournamentPage() {
  const [sp, setSp]        = useSearchParams();
  const divId              = sp.get("division") || "open";
  const divCfg             = getDivision(divId);
  const [tab, setTab]      = useState("standings");
  const [data, setData]    = useState(null);
  const [loading, setLoad] = useState(true);
  const [isAdmin, setAdmin]= useState(false);
  const [showLogin, setLogin] = useState(false);
  const [loginPw, setPw]   = useState("");
  const [modal, setModal]  = useState(null);
  const [toast, setToast]  = useState(null);
  const now = useNow(30000);

  useEffect(() => {
    setLoad(true);
    const r = ref(db, `tournament_data/${divId}`);
    return onValue(r, snap => {
      const d = snap.val();
      if (d) setData(d);
      else {
        const teams = DEFAULT_TEAMS[divId] || DEFAULT_TEAMS.open;
        set(ref(db, `tournament_data/${divId}`), {
          teams, groupMatches: generateGroupMatches(teams),
          koMatches: KO_TEMPLATE[divId] || KO_TEMPLATE.open, delayMinutes: 0,
        });
      }
      setLoad(false);
    });
  }, [divId]);

  const { standings, allMatches, resolvedKo } = useMemo(() => {
    if (!data) return { standings:{}, allMatches:[], resolvedKo:[] };
    const st = calcStandings(data.teams, data.groupMatches || []);
    const resolved = [];
    for (const m of (data.koMatches || [])) {
      resolved.push({ ...m, rh:resolveKo(m.home,st,resolved), ra:resolveKo(m.away,st,resolved) });
    }
    return {
      standings: st,
      allMatches: [...(data.groupMatches||[]).map(m=>({...m,rh:m.home,ra:m.away})), ...resolved],
      resolvedKo: resolved,
    };
  }, [data]);

  const delayMinutes = data?.delayMinutes ?? 0;
  const played   = allMatches.filter(m => m.played).length;
  const prog     = allMatches.length ? Math.round(played/allMatches.length*100) : 0;
  const liveCount= allMatches.filter(m => !m.played && (isMatchLive(m.id, now, delayMinutes) || (m.homeScore !== null && m.homeScore !== undefined))).length;

  const saveScore = (id, h, a) => {
    const isG=id<100, arr=isG?data.groupMatches:data.koMatches, idx=arr.findIndex(m=>m.id===id);
    update(ref(db), {
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/homeScore`]:h,
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/awayScore`]:a,
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/played`]:true,
    }).then(()=>setToast({message:"✅ บันทึกแล้ว",type:"success"}));
  };
  const resetScore = id => {
    const isG=id<100, arr=isG?data.groupMatches:data.koMatches, idx=arr.findIndex(m=>m.id===id);
    update(ref(db), {
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/homeScore`]:null,
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/awayScore`]:null,
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/played`]:false,
    }).then(()=>setToast({message:"🗑️ Reset แล้ว",type:"info"}));
  };
  const saveDelay = mins => {
    update(ref(db),{[`tournament_data/${divId}/delayMinutes`]:mins})
      .then(()=>setToast({message:`⏰ เลื่อน +${mins} นาที`,type:"info"}));
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3" style={{color:divCfg.color}}>{divCfg.icon}</div>
        <div className="text-2xl font-black text-white tracking-widest">LOADING...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <style>{`
        .animate-fade-in{animation:fade-in .25s ease-out}
        @keyframes fade-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
      `}</style>

      <header className="pt-10 pb-4 px-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4"
          style={{borderColor:divCfg.color+"40",background:divCfg.color+"10"}}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${liveCount>0?"bg-red-500":"bg-green-500"}`}/>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{color:divCfg.color}}>
            {liveCount>0?`⚡ ${liveCount} LIVE NOW`:"🏀 Live Tournament"}
          </span>
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter">
          3×3 <span className="text-transparent bg-clip-text" style={{backgroundImage:`linear-gradient(90deg,${divCfg.color},#FFD700)`}}>
            {divCfg.label.toUpperCase()}
          </span>
        </h1>
        <div className="flex gap-2 justify-center flex-wrap mt-3">
          {DIVISIONS.map(d=>(
            <button key={d.id} onClick={()=>{setSp({division:d.id});setTab("standings");}}
              className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
              style={{borderColor:d.id===divId?d.color+"55":"rgba(255,255,255,0.1)",color:d.id===divId?d.color:"rgba(255,255,255,0.3)",background:d.id===divId?d.color+"18":"transparent"}}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>
      </header>

      {/* Progress + Countdown */}
      <div className="max-w-xl mx-auto px-4 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Progress</span>
            <span>{played}/{allMatches.length} · {prog}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{width:`${prog}%`,background:`linear-gradient(90deg,${divCfg.color},#FFD700)`}}/>
          </div>
          <NextMatchCountdown allMatches={allMatches} delayMinutes={delayMinutes}/>
          {isAdmin && (
            <>
              <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20">ADMIN</span>
                <button onClick={()=>setAdmin(false)} className="ml-auto text-[9px] text-gray-500 hover:text-white font-bold">Logout</button>
              </div>
              <DelayControl delayMinutes={delayMinutes} onSave={saveDelay}/>
            </>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-20 bg-[#050505]/90 backdrop-blur border-b border-gray-800 mb-5">
        <div className="max-w-xl mx-auto flex">
          {[["standings","📊","Table"],["schedule","📅","Matches"],["bracket","⚡","Bracket"]].map(([v,ic,l])=>(
            <button key={v} onClick={()=>setTab(v)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold tracking-widest uppercase relative transition-all ${tab===v?"text-orange-400":"text-gray-600 hover:text-gray-400"}`}>
              {tab===v&&<div className="absolute bottom-0 inset-x-0 h-0.5 bg-orange-500"/>}
              {ic} <span className="hidden sm:inline">{l}</span>
              {v==="schedule"&&liveCount>0&&<span className="w-2 h-2 rounded-full bg-red-500 animate-pulse absolute top-2 right-2"/>}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4">
        <AnimatedTab active={tab==="standings"}><Standings standings={standings} divCfg={divCfg}/></AnimatedTab>
        <AnimatedTab active={tab==="schedule"}><Schedule matches={allMatches} isAdmin={isAdmin} onEdit={setModal} onReset={resetScore} now={now} delayMinutes={delayMinutes}/></AnimatedTab>
        <AnimatedTab active={tab==="bracket"}><Bracket koMatches={resolvedKo} isAdmin={isAdmin} onEdit={setModal} onReset={resetScore}/></AnimatedTab>
      </main>

      <footer className="text-center py-10">
        <button onClick={()=>isAdmin?setAdmin(false):setLogin(true)}
          className={`text-[10px] font-bold uppercase tracking-widest ${isAdmin?"text-orange-400":"text-gray-800 hover:text-gray-600 transition-colors"}`}>
          {isAdmin?"● Admin Mode":"Admin"}
        </button>
        <div className="mt-2"><a href="/" className="text-[10px] text-gray-800 hover:text-gray-600">← Home</a></div>
      </footer>

      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={()=>{setLogin(false);setPw("");}}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-72 animate-fade-in" onClick={e=>e.stopPropagation()}>
            <h3 className="text-xl font-black text-white tracking-widest text-center mb-4">ADMIN</h3>
            <input type="password" value={loginPw} onChange={e=>setPw(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){if(checkAdmin(loginPw)){setAdmin(true);setLogin(false);setPw("");}else setPw("");}}}
              autoFocus placeholder="Password"
              className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2.5 text-center text-white outline-none focus:border-orange-500 transition-colors mb-3"/>
            <button onClick={()=>{if(checkAdmin(loginPw)){setAdmin(true);setLogin(false);setPw("");}else setPw("");}}
              className="w-full py-2.5 rounded-xl bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors">Login</button>
          </div>
        </div>
      )}
      {modal && <ScoreModal match={modal} onClose={()=>setModal(null)} onSave={saveScore}/>}
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
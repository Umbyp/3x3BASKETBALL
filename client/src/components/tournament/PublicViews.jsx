import { useState, useMemo } from "react";
import { standings, teamMap, sideName, fmtWhen } from "../../lib/tournament.js";
import { TeamBadge, Segmented, Empty, groupColor } from "./ui.jsx";

// ── Standings (FIBA 3x3: W → H2H → avg points scored) ─────────────────────────
export function StandingsView({ data }) {
  const st = useMemo(() => standings(data), [data]);
  const tm = teamMap(data);
  const groups = Object.keys(st).sort();
  if (!groups.length) return <Empty>ยังไม่ได้แบ่งสาย</Empty>;
  return (
    <div className="space-y-5">
      {groups.map(g => (
        <div key={g} className="border rounded-2xl overflow-hidden bg-gray-900" style={{ borderLeftWidth: 4, borderLeftColor: groupColor(g), borderColor: "rgb(31,41,55)" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
            <span className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-black text-sm" style={{ background: groupColor(g) }}>{g}</span>
            <span className="font-black text-sm tracking-widest uppercase text-white">Group {g}</span>
            <span className="ml-auto text-[10px] text-gray-600">อันดับ 1-2 ผ่านรอบ</span>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-950/50 border-b border-gray-800">
              {["#", "Team", "P", "W", "L", "PTS", "AVG"].map(h => (
                <th key={h} className="px-2 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest text-center first:text-left [&:nth-child(2)]:text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {st[g].map((r, i) => {
                const t = tm[r.id], q = i < 2;
                return (
                  <tr key={r.id} className={`border-b border-gray-800/30 last:border-0 ${q ? "bg-white/[.015]" : ""}`}>
                    <td className="px-2 py-2.5"><span className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black ${i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-gray-500 text-black" : "bg-gray-800 text-gray-600"}`}>{i + 1}</span></td>
                    <td className="px-2 py-2.5"><div className="flex items-center gap-2 min-w-0"><TeamBadge team={t} size={26}/>
                      <span className={`text-xs font-bold truncate ${q ? "text-white" : "text-gray-500"}`}>{t?.name}</span></div></td>
                    <td className="px-2 text-center text-xs text-gray-500 font-mono">{r.played}</td>
                    <td className="px-2 text-center text-sm font-black text-emerald-400 font-mono">{r.wins}</td>
                    <td className="px-2 text-center text-xs font-bold text-rose-400 font-mono">{r.losses}</td>
                    <td className="px-2 text-center text-xs text-gray-300 font-mono">{r.pf}</td>
                    <td className="px-2 text-center text-xs text-gray-500 font-mono">{r.avg.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-[10px] text-gray-600 text-center">เรียงตาม: ชนะ → ผลที่เจอกัน (เสมอ 2 ทีม) → แต้มเฉลี่ยที่ทำได้ (กติกา FIBA 3x3)</p>
    </div>
  );
}

// ── Game card ────────────────────────────────────────────────────────────────
export function GameCard({ g, isAdmin, onEdit }) {
  const { time } = fmtWhen(g.time);
  const final = g.status === "final", live = g.status === "live";
  const homeWon = final && g.homeScore > g.awayScore, awayWon = final && g.awayScore > g.homeScore;
  const Side = ({ side, won }) => {
    const team = side === "home" ? g.homeTeam : g.awayTeam;
    return (
      <div className={`flex items-center gap-2 min-w-0 ${side === "away" ? "flex-row-reverse text-right" : ""}`}>
        <TeamBadge team={team} size={30}/>
        <span className={`text-xs font-bold truncate ${team ? (won || !final ? "text-white" : "text-gray-500") : "text-gray-600 italic"}`}>{sideName(g, side)}</span>
      </div>
    );
  };
  return (
    <div className={`rounded-2xl border bg-gray-900 p-3 ${live ? "border-red-500/50" : "border-gray-800"}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 mb-2">
        <span className="px-1.5 py-0.5 rounded font-black text-black" style={{ background: g.kind === "group" ? groupColor(g.group) : "#e5e7eb" }}>{g.kind === "group" ? g.group : g.label}</span>
        {time && <span className="font-mono text-gray-300">{time}</span>}
        {g.court && <span className="px-1.5 py-0.5 rounded border border-gray-700 text-gray-400">สนาม {g.court}</span>}
        <span className="ml-auto">{live ? <span className="text-red-400 animate-pulse">● LIVE</span> : final ? "FINAL" : ""}</span>
        {isAdmin && (g.homeTeam && g.awayTeam) && <button onClick={() => onEdit(g)} className="text-orange-400 font-black">แก้ผล</button>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Side side="home" won={homeWon}/>
        <div className="font-black font-mono text-lg text-center min-w-[64px]">
          {final || live ? <><span className={homeWon ? "text-white" : "text-gray-500"}>{g.homeScore ?? 0}</span><span className="text-gray-700 mx-1">:</span><span className={awayWon ? "text-white" : "text-gray-500"}>{g.awayScore ?? 0}</span></> : <span className="text-gray-700 text-xs">VS</span>}
        </div>
        <Side side="away" won={awayWon}/>
      </div>
    </div>
  );
}

// ── Games (schedule) ─────────────────────────────────────────────────────────
export function GamesView({ games, isAdmin, onEdit }) {
  const [filter, setFilter] = useState("all");
  const real = games.filter(g => !g.bye);
  const courts = [...new Set(real.map(g => g.court).filter(Boolean))].sort();
  const shown = real.filter(g => filter === "all" || (filter === "live" ? g.status === "live" : filter === "ko" ? g.kind === "ko" : g.court === filter))
    .sort((a, b) => (a.time || "~").localeCompare(b.time || "~") || (a.court || "").localeCompare(b.court || ""));
  if (!real.length) return <Empty>ยังไม่มีตารางแข่ง</Empty>;
  const byDate = {};
  shown.forEach(g => { const d = fmtWhen(g.time).date || "ยังไม่กำหนดเวลา"; (byDate[d] ??= []).push(g); });
  return (
    <div className="space-y-4">
      <Segmented value={filter} onChange={setFilter} options={[["all", "ทั้งหมด"], ["live", "● LIVE"], ...courts.map(c => [c, `สนาม ${c}`]), ["ko", "Knockout"]]}/>
      {Object.entries(byDate).map(([d, list]) => (
        <div key={d} className="space-y-2">
          <div className="text-[11px] font-black text-gray-500 tracking-widest uppercase">{d}</div>
          {list.map(g => <GameCard key={g.id} g={g} isAdmin={isAdmin} onEdit={onEdit}/>)}
        </div>
      ))}
      {!shown.length && <Empty>ไม่มีเกมในตัวกรองนี้</Empty>}
    </div>
  );
}

// ── Bracket ──────────────────────────────────────────────────────────────────
export function BracketView({ games, isAdmin, onEdit }) {
  const ko = games.filter(g => g.kind === "ko" && !g.bye);
  if (!ko.length) return <Empty>ยังไม่มีสาย Knockout (ต้องมีอย่างน้อย 2 กลุ่ม)</Empty>;
  const rounds = [...new Set(ko.map(g => g.round))].sort((a, b) => a - b);
  return (
    <div className="space-y-5">
      {rounds.map(r => {
        const list = ko.filter(g => g.round === r).sort((a, b) => (a.label === "FINAL") - (b.label === "FINAL"));
        return (
          <div key={r} className="space-y-2">
            <div className="text-[11px] font-black text-gray-500 tracking-widest uppercase">{list.some(g => g.label === "FINAL") ? "Final & 3rd place" : list[0].stage}</div>
            {list.map(g => <GameCard key={g.id} g={g} isAdmin={isAdmin} onEdit={onEdit}/>)}
          </div>
        );
      })}
    </div>
  );
}

// ── Teams + rosters ──────────────────────────────────────────────────────────
export function TeamsView({ data }) {
  const teams = data?.teams || [];
  const groupOf = {};
  Object.entries(data?.groups || {}).forEach(([g, ids]) => (ids || []).forEach(id => { groupOf[id] = g; }));
  if (!teams.length) return <Empty>ยังไม่มีทีมในรุ่นนี้</Empty>;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {teams.map(t => (
        <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-3" style={{ borderTopWidth: 3, borderTopColor: t.color }}>
          <div className="flex items-center gap-2.5 mb-2">
            <TeamBadge team={t} size={36}/>
            <div className="min-w-0">
              <div className="text-sm font-black text-white truncate">{t.name}</div>
              <div className="text-[10px] text-gray-500 font-bold">{t.short}{groupOf[t.id] ? ` · Group ${groupOf[t.id]}` : ""}</div>
            </div>
          </div>
          {(t.roster || []).length ? (
            <div className="space-y-0.5">
              {t.roster.map((p, i) => (
                <div key={i} className="flex gap-2 text-xs"><span className="w-7 text-right font-mono font-black text-gray-400">{p.no ? `#${p.no}` : ""}</span><span className="text-gray-300">{p.name}</span></div>
              ))}
            </div>
          ) : <div className="text-[11px] text-gray-600">ยังไม่มีรายชื่อนักกีฬา</div>}
        </div>
      ))}
    </div>
  );
}

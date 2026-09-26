/**
 * Tournament Admin — FIBA-style setup, in order:
 *   รุ่น (divisions) → ทีม + นักกีฬา → แบ่งสาย (snake / pots / manual) → ตารางแข่ง (auto time + court)
 * Everything is saved to tournament_data/{division} through the server; the
 * Scoreboard later just loads a game by id and pulls team data from here.
 */
import { useState, useEffect, useMemo } from "react";
import { COURTS } from "../../constants.js";
import { groupLetters, drawGroups, drawPots, groupsToAssignment } from "../../lib/groupDraw.js";
import { buildGames, scheduleGames, newId, gamesOf, resolvedGames, sideName } from "../../lib/tournament.js";
import { card, h2, inputCls, iconBtn, primaryBtn, TeamBadge, Segmented, Empty, groupColor, GROUP_PALETTE } from "./ui.jsx";

export default function AdminPanel({ data, divCfg, divisions, divId, onSaveDivisions, save }) {
  const [sec, setSec] = useState("teams");
  const teams = data?.teams || [];
  const games = gamesOf(data);
  const steps = [
    ["divisions", "🏷️ รุ่น"],
    ["teams", `👥 ทีม (${teams.length})`],
    ["draw", `🎲 แบ่งสาย${data?.groups ? " ✓" : ""}`],
    ["schedule", `📅 ตารางแข่ง${games.some(g => g.time) ? " ✓" : ""}`],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1.5">
        {steps.map(([v, l]) => (
          <button key={v} onClick={() => setSec(v)}
            className={`py-2.5 rounded-xl text-[11px] font-black border ${sec === v ? "bg-orange-500/15 border-orange-500 text-orange-400" : "bg-gray-900 border-gray-800 text-gray-500"}`}>{l}</button>
        ))}
      </div>
      {sec === "divisions" && <DivisionManager divisions={divisions} currentId={divId} onSave={onSaveDivisions}/>}
      {sec === "teams" && <TeamsEditor key={divId} data={data} divCfg={divCfg} save={save} onDone={() => setSec("draw")}/>}
      {sec === "draw" && <DrawEditor key={divId} data={data} save={save} onDone={() => setSec("schedule")}/>}
      {sec === "schedule" && <ScheduleEditor key={divId} data={data} save={save}/>}
    </div>
  );
}

// ── Divisions ────────────────────────────────────────────────────────────────
function DivisionManager({ divisions, currentId, onSave }) {
  const [local, setLocal] = useState(divisions);
  useEffect(() => { setLocal(divisions); }, [divisions]);
  const set  = (i, f, v) => setLocal(p => p.map((d, j) => j === i ? { ...d, [f]: v } : d));
  const move = (i, dir) => setLocal(p => { const n = [...p]; [n[i], n[i + dir]] = [n[i + dir], n[i]]; return n; });
  const add  = () => setLocal(p => [...p, { id: `d${Date.now().toString(36)}`, label: "", color: GROUP_PALETTE[p.length % GROUP_PALETTE.length], icon: "🏀" }]);
  const del  = i => setLocal(p => p.filter((_, j) => j !== i));
  const removed = divisions.filter(d => !local.some(l => l.id === d.id));
  const valid = local.length > 0 && local.every(d => d.label.trim());
  const doSave = () => {
    if (!valid) return;
    if (removed.length && !window.confirm(`ลบรุ่น ${removed.map(d => d.label).join(", ")} พร้อมทีมและตารางแข่งทั้งหมดของรุ่นนั้น?`)) return;
    onSave(local.map(d => ({ ...d, label: d.label.trim() })), removed.some(d => d.id === currentId));
  };
  return (
    <div className={card}>
      <div className={`${h2} mb-1`}>รุ่นการแข่งขัน</div>
      <p className="text-[11px] text-gray-500 mb-3">เช่น Open ชาย, Women, U18, U15 — แต่ละรุ่นมีทีม สาย และตารางแข่งของตัวเอง</p>
      <div className="space-y-2">
        {local.map((d, i) => (
          <div key={d.id} className="flex gap-1.5 items-center">
            <input type="color" value={d.color} onChange={e => set(i, "color", e.target.value)} className="w-9 h-9 shrink-0 rounded-lg bg-transparent border border-gray-700 cursor-pointer"/>
            <input value={d.icon} onChange={e => set(i, "icon", e.target.value)} maxLength={4} className={`${inputCls} w-12 shrink-0 text-center px-1`}/>
            <input value={d.label} onChange={e => set(i, "label", e.target.value)} maxLength={24} placeholder="ชื่อรุ่น เช่น U18 ชาย" className={`${inputCls} flex-1 min-w-0`}/>
            <button disabled={i === 0} onClick={() => move(i, -1)} className={`${iconBtn} h-9 text-gray-400`}>↑</button>
            <button disabled={i === local.length - 1} onClick={() => move(i, 1)} className={`${iconBtn} h-9 text-gray-400`}>↓</button>
            <button disabled={local.length === 1} onClick={() => del(i)} className={`${iconBtn} h-9 text-rose-500`}>✕</button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 w-full py-2 rounded-lg border border-dashed border-gray-700 text-xs text-gray-500 hover:text-gray-300">+ เพิ่มรุ่น</button>
      {!valid && <p className="mt-2 text-xs text-rose-400 text-center">กรอกชื่อรุ่นให้ครบ</p>}
      <button disabled={!valid} onClick={doSave} className="mt-3 w-full py-2.5 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest disabled:opacity-30">บันทึกรุ่น</button>
    </div>
  );
}

// ── Teams + rosters ──────────────────────────────────────────────────────────
const autoShort = name => (name || "").replace(/[^A-Za-z0-9ก-๙]/g, "").slice(0, 3).toUpperCase();
const mkTeam = (name = "", i = 0) => ({ id: newId("t"), name, short: autoShort(name), color: GROUP_PALETTE[i % GROUP_PALETTE.length], logo: "", roster: [] });

function TeamsEditor({ data, divCfg, save, onDone }) {
  const saved = data?.teams || [];
  const sig = JSON.stringify(saved);
  const [list, setList] = useState(() => structuredClone(saved));
  useEffect(() => { setList(structuredClone(saved)); }, [sig]);
  const [open, setOpen] = useState(null);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);

  const patch = (i, p) => setList(l => l.map((t, j) => j === i ? { ...t, ...p } : t));
  const move = (i, d) => setList(l => { const n = [...l]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const remove = i => setList(l => l.filter((_, j) => j !== i));
  const addBulk = () => {
    const names = bulk.split("\n").map(s => s.trim()).filter(Boolean);
    setList(l => [...l.filter(t => t.name.trim()), ...names.map((n, k) => mkTeam(n.toUpperCase(), l.length + k))]);
    setBulk("");
  };
  const setPlayer = (i, k, p) => patch(i, { roster: list[i].roster.map((x, j) => j === k ? { ...x, ...p } : x) });

  const names = list.map(t => t.name.trim());
  const dupes = names.filter((n, i) => n && names.indexOf(n) !== i);
  const err = names.some(n => !n) ? "กรอกชื่อทีมให้ครบ" : dupes.length ? `ชื่อทีมซ้ำ: ${[...new Set(dupes)].join(", ")}` : null;
  const dirty = JSON.stringify(list) !== sig;
  const inGroups = new Set(Object.values(data?.groups || {}).flat());
  const removedDrawn = saved.filter(t => inGroups.has(t.id) && !list.some(x => x.id === t.id));

  const doSave = async () => {
    if (err) return;
    if (removedDrawn.length && !window.confirm(`ทีม ${removedDrawn.map(t => t.name).join(", ")} ถูกแบ่งสายไปแล้ว — ต้องแบ่งสายและสร้างตารางแข่งใหม่ ยืนยัน?`)) return;
    setBusy(true);
    const ok = await save({ teams: list.map(t => ({ ...t, name: t.name.trim(), short: t.short || autoShort(t.name) })) });
    setBusy(false);
    if (ok && !data?.groups) onDone();
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-center justify-between mb-1">
          <span className={h2}>ทีมในรุ่น <span style={{ color: divCfg.color }}>{divCfg.label}</span></span>
          <span className="text-xs text-gray-500">{list.length} ทีม</span>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">เรียงตามอันดับ/ความแข็ง (บนสุด = ทีมวางอันดับ 1) — ใช้จัดโถตอนแบ่งสาย · กด ▾ เพื่อใส่โลโก้และรายชื่อนักกีฬา</p>
        <div className="space-y-1.5">
          {list.map((t, i) => (
            <div key={t.id} className="rounded-xl border border-gray-800 bg-gray-950/40">
              <div className="flex gap-1.5 items-center p-1.5">
                <span className="w-6 text-center text-xs font-black text-gray-500 shrink-0">{i + 1}</span>
                <input type="color" value={t.color} onChange={e => patch(i, { color: e.target.value })} className="w-8 h-8 shrink-0 rounded-md bg-transparent border border-gray-700 cursor-pointer"/>
                <input value={t.name} onChange={e => patch(i, { name: e.target.value.toUpperCase(), ...(t.short === autoShort(t.name) ? { short: autoShort(e.target.value) } : {}) })}
                  maxLength={40} placeholder="ชื่อทีม" className={`${inputCls} flex-1 min-w-0 py-1.5 ${dupes.includes(t.name.trim()) ? "border-rose-500" : ""}`}/>
                <input value={t.short} onChange={e => patch(i, { short: e.target.value.toUpperCase() })} maxLength={6} placeholder="ย่อ" className={`${inputCls} w-14 shrink-0 px-1.5 py-1.5 text-center`}/>
                <button onClick={() => setOpen(open === t.id ? null : t.id)} className={`${iconBtn} h-8 text-gray-300`}>{open === t.id ? "▴" : "▾"}{t.roster.length ? ` ${t.roster.length}` : ""}</button>
                <button disabled={i === 0} onClick={() => move(i, -1)} className={`${iconBtn} h-8 text-gray-400 hidden sm:block`}>↑</button>
                <button disabled={i === list.length - 1} onClick={() => move(i, 1)} className={`${iconBtn} h-8 text-gray-400 hidden sm:block`}>↓</button>
                <button onClick={() => remove(i)} className={`${iconBtn} h-8 text-rose-500`}>✕</button>
              </div>
              {open === t.id && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-800">
                  <div className="flex gap-2 items-center">
                    <TeamBadge team={t} size={32}/>
                    <input value={t.logo} onChange={e => patch(i, { logo: e.target.value.trim() })} placeholder="ลิงก์โลโก้ (https://…) — ไม่ใส่ก็ได้" className={`${inputCls} flex-1 min-w-0 py-1.5 text-xs`}/>
                  </div>
                  <div className="flex gap-1.5 sm:hidden">
                    <button disabled={i === 0} onClick={() => move(i, -1)} className={`${iconBtn} h-8 flex-1 text-gray-400`}>↑ ขึ้น</button>
                    <button disabled={i === list.length - 1} onClick={() => move(i, 1)} className={`${iconBtn} h-8 flex-1 text-gray-400`}>↓ ลง</button>
                  </div>
                  <div className="text-[11px] font-black text-gray-400 tracking-widest">นักกีฬา</div>
                  {t.roster.map((p, k) => (
                    <div key={k} className="flex gap-1.5">
                      <input value={p.no} onChange={e => setPlayer(i, k, { no: e.target.value.replace(/\D/g, "") })} maxLength={3} placeholder="#" className={`${inputCls} w-14 px-1.5 py-1.5 text-center`}/>
                      <input value={p.name} onChange={e => setPlayer(i, k, { name: e.target.value })} maxLength={40} placeholder="ชื่อนักกีฬา" className={`${inputCls} flex-1 min-w-0 py-1.5`}/>
                      <button onClick={() => patch(i, { roster: t.roster.filter((_, j) => j !== k) })} className={`${iconBtn} text-rose-500`}>✕</button>
                    </div>
                  ))}
                  <button disabled={t.roster.length >= 20} onClick={() => patch(i, { roster: [...t.roster, { no: "", name: "" }] })}
                    className="w-full py-1.5 rounded-lg border border-dashed border-gray-700 text-xs text-gray-500 disabled:opacity-30">+ เพิ่มนักกีฬา</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => setList(l => [...l, mkTeam("", l.length)])} className="mt-2 w-full py-2 rounded-lg border border-dashed border-gray-700 text-xs text-gray-500 hover:text-gray-300">+ เพิ่มทีม</button>
        <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={3} placeholder={"หรือวางหลายทีมพร้อมกัน (บรรทัดละทีม)"} className={`${inputCls} w-full mt-3 resize-y`}/>
        {bulk.trim() && <button onClick={addBulk} className="mt-1.5 w-full py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs font-bold text-gray-300">+ เพิ่มรายชื่อที่วาง</button>}
        {err && <p className="mt-2 text-xs text-rose-400 text-center">{err}</p>}
        <button disabled={!!err || !dirty || busy} onClick={doSave} className={`${primaryBtn} mt-3 bg-orange-600 hover:bg-orange-500`}>
          {busy ? "กำลังบันทึก…" : dirty ? "💾 บันทึกทีม" : "✓ บันทึกแล้ว"}
        </button>
      </div>
    </div>
  );
}

// ── Group draw ───────────────────────────────────────────────────────────────
function DrawEditor({ data, save, onDone }) {
  const teams = data?.teams || [];
  const n = teams.length;
  const savedGroups = data?.groups || null;
  const [G, setG] = useState(() => Math.max(2, Object.keys(savedGroups || {}).length || Math.min(4, Math.floor(n / 3)) || 2));
  const [mode, setMode] = useState("pots");
  const [assign, setAssign] = useState(() => groupsToAssignment(savedGroups || {}));
  const [busy, setBusy] = useState(false);
  const letters = groupLetters(G);
  const maxG = Math.max(2, Math.min(8, Math.floor(n / 2)));

  if (n < 4) return <Empty>ต้องมีอย่างน้อย 4 ทีมก่อนแบ่งสาย — ไปที่แท็บ 👥 ทีม</Empty>;

  const ids = teams.map(t => t.id);
  const run = () => setAssign(groupsToAssignment(mode === "snake" ? drawGroups(ids, G, n) : drawPots(ids, G)));
  const groups = Object.fromEntries(letters.map(l => [l, teams.filter(t => assign[t.id] === l)]));
  const unassigned = teams.filter(t => !letters.includes(assign[t.id]));
  const small = letters.find(l => groups[l].length < 2);
  const err = unassigned.length ? `ยังไม่ได้จัดสาย ${unassigned.length} ทีม` : small ? `สาย ${small} ต้องมีอย่างน้อย 2 ทีม` : null;
  const pot = i => Math.floor(i / G) + 1;
  const hasResults = gamesOf(data).some(g => g.status !== "scheduled" && !g.bye);

  const confirm = async () => {
    if (err) return;
    if (!window.confirm(hasResults ? "มีผลการแข่งขันบันทึกไว้แล้ว — ยืนยันสายใหม่จะล้างตารางแข่งและผลทั้งหมดของรุ่นนี้ ยืนยัน?" : "ยืนยันการแบ่งสาย และสร้างคู่แข่ง (พบกันหมดในสาย + Knockout)?")) return;
    const g = Object.fromEntries(letters.map(l => [l, groups[l].map(t => t.id)]));
    setBusy(true);
    const ok = await save({ groups: g, games: buildGames(g) });
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <span className={h2}>จำนวนสาย</span>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {Array.from({ length: maxG - 1 }, (_, i) => i + 2).map(g => (
            <button key={g} onClick={() => { setG(g); setAssign({}); }}
              className={`w-10 h-10 rounded-lg text-sm font-black border ${g === G ? "bg-orange-500/15 border-orange-500 text-orange-400" : "bg-gray-800 border-gray-700 text-gray-400"}`}>{g}</button>
          ))}
          <span className="text-[11px] text-gray-500">≈ {Math.floor(n / G)}{n % G ? `–${Math.ceil(n / G)}` : ""} ทีม/สาย</span>
        </div>
        <div className="mt-4"><Segmented value={mode} onChange={setMode} options={[["pots", "🎲 จับโถ (Pot)"], ["snake", "🐍 Snake seeding"], ["manual", "✋ เลือกเอง"]]}/></div>
        <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
          {mode === "pots" && `แบ่งทีมเป็นโถละ ${G} ทีมตามอันดับ (โถ 1 = อันดับ 1–${G}) แล้วสุ่มทีละโถ — ทีมโถเดียวกันจะไม่อยู่สายเดียวกัน`}
          {mode === "snake" && `วางตามอันดับแบบงู: A1 B1 C1… แล้วย้อนกลับ …C2 B2 A2 — ไม่มีการสุ่ม`}
          {mode === "manual" && "กดตัวอักษรสายให้แต่ละทีม (กดซ้ำเพื่อยกเลิก) — สุ่มก่อนแล้วมาปรับเองก็ได้"}
        </p>
        {mode !== "manual" ? (
          <button onClick={run} className={`${primaryBtn} mt-3 bg-orange-600 hover:bg-orange-500`}>{mode === "pots" ? "🎲 จับสลาก" : "🐍 วางสาย"}</button>
        ) : (
          <div className="mt-3 space-y-1.5">
            {teams.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-9 text-[10px] font-black text-gray-500">โถ {pot(i)}</span>
                <TeamBadge team={t} size={22}/>
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-white">{t.name}</span>
                <div className="flex gap-1 shrink-0">
                  {letters.map(l => (
                    <button key={l} onClick={() => setAssign(a => ({ ...a, [t.id]: a[t.id] === l ? undefined : l }))}
                      className="w-8 h-8 rounded-lg text-xs font-black border"
                      style={assign[t.id] === l ? { background: groupColor(l), borderColor: groupColor(l), color: "#000" } : { background: "rgb(31,41,55)", borderColor: "rgb(55,65,81)", color: "rgb(156,163,175)" }}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={card}>
        <span className={h2}>ผลการแบ่งสาย</span>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {letters.map(l => (
            <div key={l} className="rounded-xl border border-gray-800 bg-gray-950/60 p-2.5" style={{ borderLeftWidth: 4, borderLeftColor: groupColor(l) }}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-black tracking-widest" style={{ color: groupColor(l) }}>Group {l}</span>
                <span className="text-[10px] text-gray-500">{groups[l].length} ทีม</span>
              </div>
              {groups[l].length ? groups[l].map(t => (
                <div key={t.id} className="flex items-center gap-1.5 py-0.5">
                  <TeamBadge team={t} size={18}/>
                  <span className="text-[11px] font-bold text-gray-200 truncate min-w-0">{t.name}</span>
                  <span className="ml-auto text-[9px] text-gray-600">โถ {pot(teams.indexOf(t))}</span>
                </div>
              )) : <div className="text-[11px] text-gray-600">—</div>}
            </div>
          ))}
        </div>
        {err && <p className="mt-2 text-xs text-rose-400 text-center">{err}</p>}
        <button disabled={!!err || busy} onClick={confirm} className={`${primaryBtn} mt-3 bg-emerald-600 hover:bg-emerald-500`}>
          {busy ? "กำลังบันทึก…" : "✅ ยืนยันสาย + สร้างคู่แข่ง"}
        </button>
      </div>
    </div>
  );
}

// ── Schedule ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

function ScheduleEditor({ data, save }) {
  const saved = gamesOf(data);
  const sig = JSON.stringify(saved.map(g => [g.id, g.time, g.court]));
  const [cfg, setCfg] = useState(() => ({ date: today(), start: "09:00", slotMinutes: 20, courts: COURTS.slice(0, 2), ...(data?.schedule || {}) }));
  const [edits, setEdits] = useState({});
  useEffect(() => { setEdits({}); }, [sig]);
  const [busy, setBusy] = useState(false);
  const view = useMemo(() => resolvedGames(data).filter(g => !g.bye), [data]);

  if (!saved.length) return <Empty>ยังไม่มีคู่แข่ง — แบ่งสายก่อนที่แท็บ 🎲 แบ่งสาย</Empty>;

  const auto = async () => {
    if (!cfg.date || !cfg.courts.length) return;
    if (saved.some(g => g.time) && !window.confirm("จัดเวลา/สนามใหม่ทั้งหมด (ผลการแข่งขันไม่หาย) ยืนยัน?")) return;
    setBusy(true); await save({ games: scheduleGames(saved, cfg), schedule: cfg }); setBusy(false);
  };
  const saveEdits = async () => {
    setBusy(true);
    await save({ games: saved.map(g => ({ ...g, ...(edits[g.id] || {}) })) });
    setBusy(false);
  };
  const edit = (id, p) => setEdits(e => ({ ...e, [id]: { ...(e[id] || {}), ...p } }));
  const val = (g, k) => edits[g.id]?.[k] ?? g[k] ?? "";
  const sorted = [...view].sort((a, b) => (a.time || "~").localeCompare(b.time || "~") || (a.court || "").localeCompare(b.court || ""));

  return (
    <div className="space-y-4">
      <div className={card}>
        <span className={h2}>จัดเวลาและสนามอัตโนมัติ</span>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <label className="text-[11px] text-gray-400">วันที่<input type="date" value={cfg.date} onChange={e => setCfg(c => ({ ...c, date: e.target.value }))} className={`${inputCls} w-full mt-1`}/></label>
          <label className="text-[11px] text-gray-400">เวลาเริ่ม<input type="time" value={cfg.start} onChange={e => setCfg(c => ({ ...c, start: e.target.value }))} className={`${inputCls} w-full mt-1`}/></label>
          <label className="text-[11px] text-gray-400">นาทีต่อนัด (รวมพัก)<input type="number" min={5} max={240} value={cfg.slotMinutes} onChange={e => setCfg(c => ({ ...c, slotMinutes: +e.target.value || 20 }))} className={`${inputCls} w-full mt-1`}/></label>
          <div className="text-[11px] text-gray-400">สนามที่ใช้
            <div className="flex gap-1.5 mt-1">
              {COURTS.map(c => {
                const on = cfg.courts.includes(c);
                return <button key={c} onClick={() => setCfg(x => ({ ...x, courts: on ? x.courts.filter(y => y !== c) : [...x.courts, c].sort() }))}
                  className={`flex-1 h-[38px] rounded-lg text-sm font-black border ${on ? "bg-orange-500/15 border-orange-500 text-orange-400" : "bg-gray-800 border-gray-700 text-gray-500"}`}>{c}</button>;
              })}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">จัดรอบแบ่งกลุ่มให้ทุกสนามแข่งพร้อมกัน เลี่ยงไม่ให้ทีมเดียวกันแข่งติดกัน แล้วต่อด้วย Knockout ทีละรอบ</p>
        <button disabled={busy || !cfg.date || !cfg.courts.length} onClick={auto} className={`${primaryBtn} mt-3 bg-orange-600 hover:bg-orange-500`}>⚡ จัดตารางอัตโนมัติ</button>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between mb-2">
          <span className={h2}>ตารางแข่ง ({sorted.length} เกม)</span>
          <span className="text-[10px] text-gray-500">แก้เวลา/สนามรายเกมได้</span>
        </div>
        <div className="space-y-1.5">
          {sorted.map(g => (
            <div key={g.id} className={`rounded-xl border p-2 ${edits[g.id] ? "border-orange-500/60" : "border-gray-800"} bg-gray-950/40`}>
              <div className="flex items-center gap-1.5 text-[11px] mb-1.5">
                <span className="px-1.5 py-0.5 rounded font-black text-black" style={{ background: g.kind === "group" ? groupColor(g.group) : "#e5e7eb" }}>{g.kind === "group" ? g.group : g.label}</span>
                <span className="font-bold text-gray-200 truncate min-w-0">{sideName(g, "home")} <span className="text-gray-600">vs</span> {sideName(g, "away")}</span>
                {g.status !== "scheduled" && <span className={`ml-auto shrink-0 font-black ${g.status === "live" ? "text-red-400" : "text-emerald-400"}`}>{g.status === "live" ? "LIVE" : `${g.homeScore}–${g.awayScore}`}</span>}
              </div>
              <div className="flex gap-1.5">
                <input type="datetime-local" value={val(g, "time")} onChange={e => edit(g.id, { time: e.target.value })} className={`${inputCls} flex-1 min-w-0 py-1 text-xs`}/>
                <select value={val(g, "court")} onChange={e => edit(g.id, { court: e.target.value })} className={`${inputCls} w-20 py-1 text-xs`}>
                  <option value="">—</option>{COURTS.map(c => <option key={c} value={c}>สนาม {c}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
        {Object.keys(edits).length > 0 && (
          <button disabled={busy} onClick={saveEdits} className={`${primaryBtn} mt-3 bg-emerald-600 hover:bg-emerald-500 sticky bottom-3`}>💾 บันทึกการแก้ไข ({Object.keys(edits).length})</button>
        )}
      </div>
    </div>
  );
}

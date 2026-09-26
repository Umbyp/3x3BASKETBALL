import { useState } from "react";
import { COURTS } from "../../constants.js";
import { scheduleGames, gamesOf, slotLabel } from "../../lib/tournament.js";
import { C, BC, card, label, big, input, Btn, Modal, Empty, Code } from "./theme.jsx";

export const stageLabel = g => g.kind === "group" ? `Pool ${g.group} · กลุ่ม ${g.group}`
  : { QF: "Quarterfinal · รอบ 8 ทีม", SF: "Semifinal · รองชนะเลิศ", R16: "Round of 16 · รอบ 16 ทีม" }[g.stage]
  || (g.label === "3rd" ? "Bronze · ชิงที่ 3" : g.label === "FINAL" ? "Final · ชิงชนะเลิศ" : g.label);

/** View model for one game card (shared by Schedule + Knockout). */
export function gameVM(g, courtStates, divId) {
  const court = Object.entries(courtStates).find(([, s]) => s?.linkedMatch?.division === divId && s.linkedMatch.id === g.id && !s.linkedMatch.final);
  const loadedOn = court?.[0] || null, cs = court?.[1];
  const final = g.status === "final", live = !final && (g.status === "live" || !!loadedOn);
  const ready = !!(g.homeTeam && g.awayTeam);
  const hs = final ? g.homeScore : cs ? cs.teamA.score : g.status === "live" ? g.homeScore : "";
  const as = final ? g.awayScore : cs ? cs.teamB.score : g.status === "live" ? g.awayScore : "";
  return {
    final, live, ready, loadedOn, hs: hs ?? "", as: as ?? "",
    hw: final && g.homeScore > g.awayScore, aw: final && g.awayScore > g.homeScore,
    status: final ? "Final" : live ? "Live" : "Scheduled",
    pill: final ? ["#26262C", C.text, "#26262C"] : live ? [C.red, "#fff", C.red] : ["transparent", C.muted, C.line3],
  };
}

export function Side({ team, code, score, dim, size = 17 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 10, alignItems: "center", opacity: dim ? .5 : 1 }}>
      <Code team={team} size={size} w={52} placeholder={team ? undefined : code}/>
      <span style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: team ? C.text : C.muted }}>{team ? team.name : slotLabel(code)}</span>
      <span style={big(28)}>{score}</span>
    </div>
  );
}

export default function ScheduleScreen({ data, games, divId, courtStates, save, saveResult, loadToCourt, goSeeding }) {
  const [tab, setTab] = useState("all");
  const [edit, setEdit] = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const raw = gamesOf(data);
  if (!raw.length) return <Empty title="No games yet" sub="ยืนยันสายก่อน ระบบจะสร้างคู่แข่งให้อัตโนมัติ" action={<Btn kind="primary" onClick={goSeeding}>Open Seeding & Pools</Btn>}/>;

  const unscheduled = games.some(g => !g.time);
  const courts = (data?.schedule?.courts?.length ? data.schedule.courts : [...new Set(games.map(g => g.court).filter(Boolean))].sort());
  const cols = courts.length ? courts : ["A", "B"];
  const shown = games.filter(g => tab === "all" || (tab === "pool") === (g.kind === "group"));
  const times = [...new Set(shown.map(g => g.time || "—"))].sort((a, b) => (a === "—") - (b === "—") || a.localeCompare(b));
  const byDay = {};
  times.forEach(t => { const d = t === "—" ? "ยังไม่กำหนดเวลา · Unscheduled" : t.slice(0, 10); (byDay[d] ??= []).push(t); });
  const multiDay = Object.keys(byDay).length > 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, background: C.card, border: `1px solid ${C.line2}`, borderRadius: 12, padding: 4 }}>
          {[["all", "All · ทั้งหมด"], ["pool", "Pool · รอบแบ่งกลุ่ม"], ["ko", "Knockout · น็อกเอาต์"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ border: "none", borderRadius: 9, minHeight: 44, padding: "0 18px", fontSize: 14, fontWeight: 600, background: tab === k ? C.orange : "transparent", color: tab === k ? "#111" : C.text }}>{l}</button>
          ))}
        </div>
        <Btn kind={unscheduled ? "primary" : "ghost"} onClick={() => setShowCfg(v => !v)} style={{ marginLeft: "auto" }}>⚡ Auto schedule · จัดเวลาอัตโนมัติ</Btn>
      </div>

      {(showCfg || unscheduled) && <AutoSchedule data={data} raw={raw} save={save} onDone={() => setShowCfg(false)}/>}

      <div className="adm-sched-head" style={{ display: "grid", gridTemplateColumns: `72px repeat(${cols.length},minmax(0,1fr))`, gap: 10, ...label, padding: "0 2px" }}>
        <span>Time</span>{cols.map(c => <span key={c}>Court {c} · สนาม {c}</span>)}
      </div>
      {Object.entries(byDay).map(([day, ts]) => (
        <div key={day} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(multiDay || day.startsWith("ยัง")) && <span style={{ ...label, color: C.orange }}>{day}</span>}
          {ts.map(t => {
            const row = shown.filter(g => (g.time || "—") === t);
            const extra = row.filter(g => !cols.includes(g.court));
            return (
              <div key={t} className="adm-sched-row" style={{ display: "grid", gridTemplateColumns: `72px repeat(${cols.length},minmax(0,1fr))`, gap: 10, alignItems: "stretch" }}>
                <div style={big(26, { paddingTop: 10 })}>{t === "—" ? "—" : t.slice(11)}</div>
                {cols.map((c, ci) => {
                  const g = row.find(x => x.court === c) || (ci < extra.length ? extra[ci] : null);
                  return g ? <GameCard key={c} g={g} vm={gameVM(g, courtStates, divId)} onLoad={() => loadToCourt(g)} onEdit={() => setEdit(g)}/>
                    : <div key={c} className="adm-empty-cell" style={{ border: `1px dashed ${C.line2}`, borderRadius: 14, minHeight: 60 }}/>;
                })}
              </div>
            );
          })}
        </div>
      ))}

      {edit && <GameEditor g={edit} onClose={() => setEdit(null)}
        onSaveSlot={async (time, court) => { if (await save({ games: raw.map(x => (x.id === edit.id ? { ...x, time, court } : x)) })) setEdit(null); }}
        onSaveResult={async (h, a, st) => { if (await saveResult(edit.id, h, a, st)) setEdit(null); }}/>}
    </div>
  );
}

export function GameCard({ g, vm, onLoad, onEdit, compact }) {
  const primary = vm.ready && !vm.final && !vm.loadedOn;
  const lab = vm.final ? "Final" : vm.loadedOn ? `On scoreboard · Court ${vm.loadedOn} →` : vm.ready ? "Load to Scoreboard" : "Waiting for teams";
  return (
    <div style={{ flex: compact ? "none" : 1, minWidth: 0, ...card, borderRadius: 14, border: `1px solid ${vm.live ? C.red : C.line2}`, padding: compact ? 0 : "12px 14px", display: "flex", flexDirection: "column", gap: compact ? 0 : 8, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, ...(compact ? { padding: "6px 10px", background: C.inner2 } : {}) }}>
        <span style={{ fontSize: compact ? 11 : 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <b style={{ color: C.text }}>{g.num}</b> · {compact ? `${g.time ? g.time.slice(11) : "—"} · C${g.court || "?"}` : stageLabel(g)}
        </span>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 999, border: `1px solid ${vm.pill[2]}`, background: vm.pill[0], color: vm.pill[1] }}>{vm.status}</span>
          {onEdit && <button onClick={onEdit} title="แก้เวลา/สนาม/ผล" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.line3}`, background: "transparent", color: C.muted }}>✎</button>}
        </span>
      </div>
      <div style={compact ? { padding: "8px 10px" } : {}}><Side team={g.homeTeam} code={g.home} score={vm.hs} dim={vm.aw} size={compact ? 15 : 17}/></div>
      <div style={compact ? { padding: "8px 10px", borderTop: `1px solid ${C.line2}` } : {}}><Side team={g.awayTeam} code={g.away} score={vm.as} dim={vm.hw} size={compact ? 15 : 17}/></div>
      {(!compact || (vm.ready && !vm.final)) && (
        <button onClick={onLoad} disabled={!vm.ready || vm.final} style={{ border: "none", borderRadius: compact ? 0 : 10, minHeight: compact ? 40 : 44, fontFamily: BC, fontWeight: 800, fontSize: compact ? 15 : 16,
          textTransform: "uppercase", letterSpacing: ".03em", cursor: vm.ready && !vm.final ? "pointer" : "default", ...(compact ? { borderTop: `1px solid ${C.line2}` } : {}),
          background: primary ? C.orange : vm.loadedOn ? C.red : C.inner, color: primary ? "#111" : vm.loadedOn ? "#fff" : C.dim }}>{lab}</button>
      )}
    </div>
  );
}

function AutoSchedule({ data, raw, save, onDone }) {
  const [cfg, setCfg] = useState(() => ({ date: new Date().toISOString().slice(0, 10), start: "10:00", slotMinutes: 20, courts: COURTS.slice(0, 2), ...(data?.schedule || {}) }));
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (raw.some(g => g.time) && !window.confirm("จัดเวลา/สนามใหม่ทั้งหมด (ผลการแข่งขันไม่หาย) ยืนยัน?")) return;
    setBusy(true); const ok = await save({ games: scheduleGames(raw, cfg), schedule: cfg }); setBusy(false);
    if (ok) onDone();
  };
  const lab = { ...label, display: "block", marginBottom: 6 };
  return (
    <div style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={label}>Auto schedule · จัดเวลาและสนามอัตโนมัติ</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <label><span style={lab}>Date · วันที่</span><input type="date" value={cfg.date} onChange={e => setCfg(c => ({ ...c, date: e.target.value }))} style={input}/></label>
        <label><span style={lab}>First game · เริ่ม</span><input type="time" value={cfg.start} onChange={e => setCfg(c => ({ ...c, start: e.target.value }))} style={input}/></label>
        <label><span style={lab}>Slot (min) · นาที/นัด</span><input type="number" min={5} max={240} value={cfg.slotMinutes} onChange={e => setCfg(c => ({ ...c, slotMinutes: +e.target.value || 20 }))} style={input}/></label>
        <div><span style={lab}>Courts · สนาม</span>
          <div style={{ display: "flex", gap: 6 }}>{COURTS.map(c => {
            const on = cfg.courts.includes(c);
            return <button key={c} onClick={() => setCfg(x => ({ ...x, courts: on ? x.courts.filter(y => y !== c) : [...x.courts, c].sort() }))}
              style={{ flex: 1, minHeight: 44, borderRadius: 10, border: `1px solid ${on ? C.orange : C.line3}`, background: on ? C.orange : "transparent", color: on ? "#111" : C.text, fontFamily: BC, fontWeight: 800, fontSize: 18 }}>{c}</button>;
          })}</div>
        </div>
      </div>
      <span style={{ fontSize: 13, color: C.muted }}>ทุกสนามแข่งพร้อมกัน · ทีมเดียวกันไม่แข่งติดกันถ้าเลี่ยงได้ · Knockout เริ่มหลังรอบกลุ่มจบ</span>
      <Btn kind="primary" disabled={busy || !cfg.date || !cfg.courts.length} onClick={run}>{busy ? "Scheduling…" : "Generate schedule · สร้างตารางเวลา"}</Btn>
    </div>
  );
}

function GameEditor({ g, onClose, onSaveSlot, onSaveResult }) {
  const [time, setTime] = useState(g.time || "");
  const [court, setCourt] = useState(g.court || "");
  const [h, setH] = useState(g.status === "final" ? g.homeScore : "");
  const [a, setA] = useState(g.status === "final" ? g.awayScore : "");
  const ready = g.homeTeam && g.awayTeam;
  const valid = h !== "" && a !== "" && +h !== +a;
  const lab = { ...label, display: "block", marginBottom: 6 };
  return (
    <Modal title={`${g.num} · ${g.label}`} onClose={onClose}>
      <span style={lab}>Time & court · เวลาและสนาม</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
        <input type="datetime-local" value={time} onChange={e => setTime(e.target.value)} style={input}/>
        <select value={court} onChange={e => setCourt(e.target.value)} style={input}>
          <option value="">—</option>{COURTS.map(c => <option key={c} value={c}>Court {c}</option>)}
        </select>
      </div>
      <Btn kind="dark" onClick={() => onSaveSlot(time, court)} style={{ width: "100%", marginTop: 10 }}>Save time & court · บันทึก</Btn>

      {ready && <>
        <span style={{ ...lab, marginTop: 24 }}>Result correction · แก้ผลการแข่งขัน</span>
        {[[g.homeTeam, h, setH], [g.awayTeam, a, setA]].map(([t, v, set]) => (
          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "52px 1fr 90px", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <Code team={t} w={52}/><span style={{ fontSize: 14 }}>{t.name}</span>
            <input type="number" min={0} value={v} onChange={e => set(e.target.value)} style={{ ...input, textAlign: "center", fontFamily: BC, fontWeight: 800, fontSize: 22 }}/>
          </div>
        ))}
        {h !== "" && a !== "" && +h === +a && <span style={{ color: C.red, fontSize: 13 }}>3x3 ไม่มีผลเสมอ — ต้องมีผู้ชนะ</span>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
          <Btn kind="danger" onClick={() => { if (window.confirm("ล้างผลเกมนี้ กลับเป็นยังไม่แข่ง?")) onSaveResult(null, null, "scheduled"); }}>Clear result · ล้างผล</Btn>
          <Btn kind="primary" disabled={!valid} onClick={() => onSaveResult(+h, +a, "final")}>Save final · บันทึกผล</Btn>
        </div>
      </>}
    </Modal>
  );
}

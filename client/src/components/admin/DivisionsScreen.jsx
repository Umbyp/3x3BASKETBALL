import { useState, useEffect } from "react";
import { RULES } from "../../constants.js";
import { isV2, gamesOf } from "../../lib/tournament.js";
import { C, BC, card, label, big, input, Btn, Modal } from "./theme.jsx";

const STATUS = {
  Active:       ["#FF6A13", "#111"],
  Completed:    ["#16C47F", "#111"],
  Registration: ["#FFD000", "#111"],
  Draft:        ["#26262C", "#C9C6C0"],
};

export function divisionSummary(data) {
  const d = isV2(data) ? data : null;
  const teams = d?.teams?.length || 0;
  const pools = Object.keys(d?.groups || {}).length;
  const games = gamesOf(d).filter(g => !g.bye);
  const status = !teams ? "Draft" : !games.length ? "Registration" : games.every(g => g.status === "final") ? "Completed" : "Active";
  const ko = games.filter(g => g.kind === "ko" && g.label !== "3rd");
  const firstKo = ko.length ? ko.reduce((a, b) => (a.round <= b.round ? a : b)) : null;
  const koName = !firstKo ? null : { QF: "Quarterfinals", SF: "Semifinals", FINAL: "Final", R16: "Round of 16" }[firstKo.stage] || firstKo.stage;
  const per = pools ? Math.ceil(teams / pools) : 0;
  const format = pools ? `${pools} Pools × ${per} teams${koName ? ` → ${koName} (${pools * 2})` : ""}` : teams ? "ยังไม่ได้แบ่งสาย · Pools not drawn" : "ยังไม่มีทีม · No teams yet";
  return { teams, pools, adv: pools ? 2 : "—", status, format };
}

export default function DivisionsScreen({ divisions, allData, divId, onPick, onSaveDivisions }) {
  const [editing, setEditing] = useState(false);
  const rules = [
    { v: `${RULES.GAME_MINUTES}:00`, en: "Game clock, 1 period", th: "เวลาแข่ง 1 ช่วง" },
    { v: String(RULES.WIN_SCORE), en: "Points to win", th: "ถึงก่อนชนะทันที" },
    { v: `${RULES.SHOT_CLOCK}s`, en: "Shot clock", th: "เวลาครองบอล" },
    { v: "7 / 10", en: "Team foul penalty", th: "ฟาวล์ทีม 7 = 2FT · 10 = 2FT + บอล" },
    { v: String(RULES.MAX_TIMEOUTS), en: "Timeout per team", th: "ขอเวลานอกทีมละ 1 ครั้ง" },
    { v: "OT 2", en: "First to 2 in OT", th: "ต่อเวลา ใครได้ 2 แต้มก่อนชนะ" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 }}>
        {divisions.map(d => {
          const s = divisionSummary(allData[d.id]);
          const active = d.id === divId;
          return (
            <div key={d.id} style={{ ...card, border: `1px solid ${active ? C.orange : C.line2}`, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={big(28, { textTransform: "uppercase" })}>{d.icon} {d.label}</span>
                  <span style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{active ? "กำลังจัดการ · Managing" : " "}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "5px 9px", borderRadius: 999, background: STATUS[s.status][0], color: STATUS[s.status][1] }}>{s.status}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                <Stat v={s.teams} l="Teams · ทีม" color={C.orange}/>
                <Stat v={s.pools} l="Pools · กลุ่ม"/>
                <Stat v={s.adv} l="Advance/Pool"/>
              </div>
              <div style={{ fontSize: 13, color: C.soft, borderTop: `1px solid ${C.line2}`, paddingTop: 12 }}>{s.format}</div>
              <Btn kind={active ? "primary" : "dark"} onClick={() => onPick(d.id)} style={{ fontFamily: BC, fontWeight: 800, fontSize: 18, textTransform: "uppercase" }}>
                Manage division →
              </Btn>
            </div>
          );
        })}
        <button onClick={() => setEditing(true)} style={{ ...card, border: `1px dashed ${C.line3}`, background: "transparent", color: C.muted, minHeight: 220, fontFamily: BC, fontWeight: 700, fontSize: 20, textTransform: "uppercase" }}>
          + Add / edit divisions<br/><span style={{ fontFamily: "inherit", fontSize: 13, textTransform: "none" }}>เพิ่ม / แก้ไขรุ่น</span>
        </button>
      </div>

      <div style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={label}>Game rules · กติกาการแข่งขัน</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {rules.map(r => (
            <div key={r.en} style={{ display: "flex", flexDirection: "column", gap: 2, background: C.inner, borderRadius: 12, padding: 14 }}>
              <span style={big(30, { color: C.yellow })}>{r.v}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{r.en}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{r.th}</span>
            </div>
          ))}
        </div>
      </div>

      {editing && <DivisionEditor divisions={divisions} divId={divId} onClose={() => setEditing(false)} onSave={async (l, rm) => { if (await onSaveDivisions(l, rm)) setEditing(false); }}/>}
    </div>
  );
}

const Stat = ({ v, l, color }) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <span style={big(44, { color })}>{v}</span>
    <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
  </div>
);

function DivisionEditor({ divisions, divId, onClose, onSave }) {
  const [local, setLocal] = useState(divisions);
  useEffect(() => { setLocal(divisions); }, [divisions]);
  const set = (i, f, v) => setLocal(p => p.map((d, j) => (j === i ? { ...d, [f]: v } : d)));
  const move = (i, dir) => setLocal(p => { const n = [...p]; [n[i], n[i + dir]] = [n[i + dir], n[i]]; return n; });
  const removed = divisions.filter(d => !local.some(l => l.id === d.id));
  const valid = local.length > 0 && local.every(d => d.label.trim());
  const save = () => {
    if (!valid) return;
    if (removed.length && !window.confirm(`ลบรุ่น ${removed.map(d => d.label).join(", ")} พร้อมทีมและตารางแข่งทั้งหมดของรุ่นนั้น?`)) return;
    onSave(local.map(d => ({ ...d, label: d.label.trim() })), removed.some(d => d.id === divId));
  };
  const sq = { width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.line3}`, background: C.inner, color: C.text, flexShrink: 0 };
  return (
    <Modal title="Divisions · รุ่นการแข่งขัน" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {local.map((d, i) => (
          <div key={d.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="color" value={d.color} onChange={e => set(i, "color", e.target.value)} style={{ ...sq, padding: 4 }}/>
            <input value={d.icon} onChange={e => set(i, "icon", e.target.value)} maxLength={4} style={{ ...input, width: 56, textAlign: "center", flexShrink: 0 }}/>
            <input value={d.label} onChange={e => set(i, "label", e.target.value)} maxLength={24} placeholder="เช่น Open Men / U18 Boys" style={{ ...input, flex: 1, minWidth: 0 }}/>
            <button disabled={!i} onClick={() => move(i, -1)} style={{ ...sq, opacity: i ? 1 : .3 }}>↑</button>
            <button disabled={i === local.length - 1} onClick={() => move(i, 1)} style={{ ...sq, opacity: i === local.length - 1 ? .3 : 1 }}>↓</button>
            <button disabled={local.length === 1} onClick={() => setLocal(p => p.filter((_, j) => j !== i))} style={{ ...sq, color: C.red }}>✕</button>
          </div>
        ))}
        <Btn kind="ghost" onClick={() => setLocal(p => [...p, { id: `d${Date.now().toString(36)}`, label: "", color: "#FF6A13", icon: "🏀" }])} style={{ borderStyle: "dashed" }}>+ เพิ่มรุ่น · Add division</Btn>
        {!valid && <span style={{ color: C.red, fontSize: 13, textAlign: "center" }}>กรอกชื่อรุ่นให้ครบ</span>}
        <Btn kind="primary" disabled={!valid} onClick={save}>Save divisions · บันทึก</Btn>
      </div>
    </Modal>
  );
}

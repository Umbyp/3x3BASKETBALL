import { useState } from "react";
import { newId } from "../../lib/tournament.js";
import { C, BC, card, label, big, input, Btn, Modal, Empty, fgFor, teamCode, teamPoints } from "./theme.jsx";

const PALETTE = ["#FF6A13","#2F7BFF","#16C4A0","#E63946","#FFD000","#9B5DE5","#00BBF9","#F15BB5","#8AC926","#C9C5BC","#4361EE","#E9A23B","#06D6A0","#EF476F","#7A8CA3","#FF924C"];
const autoShort = name => (name || "").replace(/[^A-Za-z0-9ก-๙]/g, "").slice(0, 3).toUpperCase();

export default function TeamsScreen({ data, save }) {
  const teams = data?.teams || [];
  const [edit, setEdit] = useState(null);   // team being edited (copy) | null
  const [bulk, setBulk] = useState(false);
  const inPools = new Set(Object.values(data?.groups || {}).flat());

  const persist = list => save({ teams: list });
  const saveTeam = async t => {
    const others = teams.filter(x => x.id !== t.id);
    if (others.some(x => x.name.trim() === t.name.trim())) { window.alert(`มีทีมชื่อ "${t.name}" แล้ว`); return; }
    const exists = teams.some(x => x.id === t.id);
    const next = exists ? teams.map(x => (x.id === t.id ? t : x)) : [...teams, t];
    if (await persist(next)) setEdit(null);
  };
  const removeTeam = async t => {
    if (!window.confirm(`ลบทีม ${t.name}?${inPools.has(t.id) ? "\nทีมนี้อยู่ในสายแล้ว — ต้องจัดสายและสร้างตารางใหม่" : ""}`)) return;
    if (await persist(teams.filter(x => x.id !== t.id))) setEdit(null);
  };
  const moveSeed = (t, d) => {
    const i = teams.findIndex(x => x.id === t.id), j = i + d;
    if (j < 0 || j >= teams.length) return;
    const n = [...teams]; [n[i], n[j]] = [n[j], n[i]]; persist(n);
  };
  const sortByPoints = () => {
    if (window.confirm("เรียงลำดับทีมวาง (Seed) ใหม่ตามคะแนนทีม (ผลรวม 3 อันดับแรกของผู้เล่น)?"))
      persist([...teams].sort((a, b) => teamPoints(b) - teamPoints(a)));
  };
  const addBulk = async text => {
    const names = text.split("\n").map(s => s.trim().toUpperCase()).filter(Boolean).filter(n => !teams.some(t => t.name === n));
    const add = [...new Set(names)].map((n, k) => ({ id: newId("t"), name: n, short: autoShort(n), color: PALETTE[(teams.length + k) % PALETTE.length], logo: "", roster: [] }));
    if (await persist([...teams, ...add])) setBulk(false);
  };
  const blank = () => ({ id: newId("t"), name: "", short: "", color: PALETTE[teams.length % PALETTE.length], logo: "", roster: [] });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Btn kind="primary" onClick={() => setEdit(blank())}>+ Add team · เพิ่มทีม</Btn>
        <Btn kind="ghost" onClick={() => setBulk(true)}>Paste list · วางรายชื่อ</Btn>
        <Btn kind="ghost" disabled={teams.length < 2} onClick={sortByPoints}>Sort seeds by points · เรียงตามคะแนน</Btn>
        <span style={{ fontSize: 13, color: C.muted, flex: "1 1 260px" }}>
          {teams.length} teams sorted by seed. Team points = sum of top 3 player ranking points · คะแนนทีม = ผลรวมคะแนน 3 อันดับแรกของผู้เล่น
        </span>
      </div>

      {!teams.length ? <Empty title="No teams yet" sub="เพิ่มทีมทีละทีม หรือวางรายชื่อหลายทีมพร้อมกัน" action={<Btn kind="primary" onClick={() => setBulk(true)}>Paste team list</Btn>}/> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 16 }}>
          {teams.map((t, i) => {
            const fg = fgFor(t.color), players = [...(t.roster || [])].sort((a, b) => (+b.pts || 0) - (+a.pts || 0));
            return (
              <div key={t.id} style={{ ...card, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ background: t.color, color: fg, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end", minWidth: 0 }}>
                    {t.logo && <img src={t.logo} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", background: "#fff" }} onError={e => { e.currentTarget.style.display = "none"; }}/>}
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={big(42, { lineHeight: .9, letterSpacing: ".02em" })}>{teamCode(t)}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em" }}>SEED</span>
                    <span style={big(40)}>{i + 1}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", padding: "6px 0" }}>
                  {players.length ? players.map((p, j) => (
                    <div key={j} style={{ display: "grid", gridTemplateColumns: "38px 1fr auto auto", gap: 8, alignItems: "center", padding: "8px 16px" }}>
                      <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 18, color: C.muted }}>{p.no ? `#${p.no}` : ""}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", padding: "3px 7px", borderRadius: 6,
                        background: j < 3 ? "#2A2A31" : "transparent", color: j < 3 ? C.text : C.muted }}>{j < 3 ? "Starter" : "Sub"}</span>
                      <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 18, minWidth: 34, textAlign: "right" }}>{p.pts || "—"}</span>
                    </div>
                  )) : <span style={{ padding: "14px 16px", fontSize: 13, color: C.dim }}>ยังไม่มีรายชื่อนักกีฬา · No roster</span>}
                </div>
                <div style={{ marginTop: "auto", borderTop: `1px solid ${C.line2}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: C.muted }}>Team points · คะแนนทีม</span>
                  <span style={big(30, { color: C.orange })}>{teamPoints(t)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "44px 44px 1fr", gap: 6, padding: "0 12px 12px" }}>
                  <SmallBtn disabled={i === 0} onClick={() => moveSeed(t, -1)} title="Seed ขึ้น">↑</SmallBtn>
                  <SmallBtn disabled={i === teams.length - 1} onClick={() => moveSeed(t, 1)} title="Seed ลง">↓</SmallBtn>
                  <SmallBtn onClick={() => setEdit(structuredClone(t))} wide>✎ Edit · แก้ไขทีม / นักกีฬา</SmallBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edit && <TeamEditor team={edit} isNew={!teams.some(t => t.id === edit.id)} onClose={() => setEdit(null)} onSave={saveTeam} onDelete={removeTeam}/>}
      {bulk && <BulkAdd onClose={() => setBulk(false)} onAdd={addBulk}/>}
    </div>
  );
}

const SmallBtn = ({ wide, children, ...p }) => (
  <button {...p} style={{ minWidth: 44, height: 44, padding: wide ? "0 12px" : 0, borderRadius: 10, border: `1px solid ${C.line3}`, background: C.inner, color: C.text,
    fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", opacity: p.disabled ? .3 : 1 }}>{children}</button>
);

function TeamEditor({ team, isNew, onClose, onSave, onDelete }) {
  const [t, setT] = useState(() => ({ ...team, roster: team.roster.map(p => ({ pts: 0, ...p })) }));
  const set = p => setT(x => ({ ...x, ...p }));
  const setP = (k, p) => set({ roster: t.roster.map((x, j) => (j === k ? { ...x, ...p } : x)) });
  const valid = t.name.trim();
  const lab = { ...label, display: "block", marginBottom: 6 };
  return (
    <Modal title={isNew ? "New team · ทีมใหม่" : "Edit team · แก้ไขทีม"} onClose={onClose} width={620}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 64px", gap: 10 }}>
        <label><span style={lab}>Team name · ชื่อทีม</span>
          <input autoFocus value={t.name} maxLength={40} onChange={e => set({ name: e.target.value.toUpperCase(), ...(t.short === autoShort(t.name) || !t.short ? { short: autoShort(e.target.value) } : {}) })} style={input}/></label>
        <label><span style={lab}>Code · ย่อ</span>
          <input value={t.short} maxLength={4} onChange={e => set({ short: e.target.value.toUpperCase() })} style={{ ...input, textAlign: "center", fontFamily: BC, fontWeight: 800, fontSize: 18 }}/></label>
        <label><span style={lab}>Color</span>
          <input type="color" value={t.color} onChange={e => set({ color: e.target.value })} style={{ ...input, padding: 4 }}/></label>
      </div>
      <label style={{ display: "block", marginTop: 12 }}><span style={lab}>Logo URL (optional) · ลิงก์โลโก้</span>
        <input value={t.logo} onChange={e => set({ logo: e.target.value.trim() })} placeholder="https://…" style={input}/></label>

      <div style={{ ...label, marginTop: 20, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <span>Roster · นักกีฬา ({t.roster.length})</span><span>Ranking pts</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {t.roster.map((p, k) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "64px 1fr 90px 44px", gap: 6 }}>
            <input value={p.no} placeholder="#" maxLength={3} onChange={e => setP(k, { no: e.target.value.replace(/\D/g, "") })} style={{ ...input, textAlign: "center" }}/>
            <input value={p.name} placeholder="ชื่อนักกีฬา" maxLength={40} onChange={e => setP(k, { name: e.target.value })} style={input}/>
            <input value={p.pts || ""} placeholder="0" inputMode="numeric" onChange={e => setP(k, { pts: +e.target.value.replace(/\D/g, "").slice(0, 4) || 0 })} style={{ ...input, textAlign: "right" }}/>
            <button onClick={() => set({ roster: t.roster.filter((_, j) => j !== k) })} style={{ borderRadius: 10, border: `1px solid ${C.line3}`, background: "transparent", color: C.red }}>✕</button>
          </div>
        ))}
        <Btn kind="ghost" disabled={t.roster.length >= 20} onClick={() => set({ roster: [...t.roster, { no: "", name: "", pts: 0 }] })} style={{ borderStyle: "dashed" }}>+ Add player · เพิ่มนักกีฬา</Btn>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {!isNew && <Btn kind="danger" onClick={() => onDelete(team)}>Delete · ลบทีม</Btn>}
        <Btn kind="primary" disabled={!valid} style={{ flex: 1 }}
          onClick={() => onSave({ ...t, name: t.name.trim(), short: t.short || autoShort(t.name), roster: t.roster.filter(p => p.name.trim()) })}>Save team · บันทึก</Btn>
      </div>
    </Modal>
  );
}

function BulkAdd({ onClose, onAdd }) {
  const [text, setText] = useState("");
  return (
    <Modal title="Paste team list · วางรายชื่อทีม" onClose={onClose}>
      <p style={{ color: C.muted, fontSize: 13, marginTop: 0 }}>บรรทัดละ 1 ทีม เรียงตามอันดับทีมวาง (บนสุด = Seed 1) · ชื่อซ้ำจะถูกข้าม</p>
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={10} placeholder={"BANGKOK HOOPERS\nCHIANG MAI PEAKS\n…"} style={{ ...input, resize: "vertical" }}/>
      <Btn kind="primary" disabled={!text.trim()} onClick={() => onAdd(text)} style={{ width: "100%", marginTop: 12 }}>Add teams · เพิ่ม</Btn>
    </Modal>
  );
}

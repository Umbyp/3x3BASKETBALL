import { useState, useRef, useMemo } from "react";
import { groupLetters, drawGroups, drawPots } from "../../lib/groupDraw.js";
import { buildGames, gamesOf } from "../../lib/tournament.js";
import { C, BC, card, label, big, Btn, Empty, Code, teamPoints } from "./theme.jsx";

const toSlots = (groups, letters, size) =>
  Object.fromEntries(letters.map(l => [l, Array.from({ length: size }, (_, i) => groups?.[l]?.[i] ?? null)]));

export default function SeedingScreen({ data, save, goTeams, goSchedule }) {
  const teams = data?.teams || [];
  const n = teams.length;
  const saved = data?.groups || null;
  const [G, setG] = useState(() => Object.keys(saved || {}).length || Math.max(2, Math.min(8, Math.round(n / 4))));
  const letters = groupLetters(G);
  const size = Math.max(2, Math.ceil(n / G));
  const [pools, setPools] = useState(() => toSlots(saved, letters, size));
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);
  const tmap = useMemo(() => Object.fromEntries(teams.map((t, i) => [t.id, { ...t, seed: i + 1 }])), [teams]);

  if (n < 4) return <Empty title="Need at least 4 teams" sub="เพิ่มทีมอย่างน้อย 4 ทีมก่อนจัดสาย" action={<Btn kind="primary" onClick={goTeams}>Go to Teams</Btn>}/>;

  const setCount = g => { setG(g); setPools(toSlots({}, groupLetters(g), Math.max(2, Math.ceil(n / g)))); setSel(null); };
  const fill = groups => { setPools(toSlots(groups, letters, size)); setSel(null); };
  const ids = teams.map(t => t.id);
  const loc = {};
  letters.forEach(l => pools[l].forEach((id, i) => { if (id) loc[id] = l + (i + 1); }));
  const placed = Object.keys(loc).length;

  const move = (id, P, i) => setPools(s => {
    const p = Object.fromEntries(letters.map(k => [k, [...s[k]]]));
    let src = null; letters.forEach(k => p[k].forEach((x, j) => { if (x === id) src = [k, j]; }));
    const tgt = p[P][i]; p[P][i] = id;
    if (src && !(src[0] === P && src[1] === i)) p[src[0]][src[1]] = tgt;
    return p;
  });
  const unassign = id => setPools(s => Object.fromEntries(letters.map(k => [k, s[k].map(x => (x === id ? null : x))])));
  const tapSlot = (P, i) => {
    const id = pools[P][i];
    if (sel) { if (sel === id) setSel(null); else { move(sel, P, i); setSel(null); } }
    else if (id) setSel(id);
  };

  const compact = Object.fromEntries(letters.map(l => [l, pools[l].filter(Boolean)]));
  const small = letters.find(l => compact[l].length < 2);
  const err = placed < n ? `ยังไม่ได้วาง ${n - placed} ทีม · ${n - placed} teams unplaced` : small ? `Pool ${small} ต้องมีอย่างน้อย 2 ทีม` : null;
  const dirty = JSON.stringify(compact) !== JSON.stringify(Object.fromEntries(letters.map(l => [l, saved?.[l] || []])));
  const hasResults = gamesOf(data).some(g => !g.bye && g.status !== "scheduled");

  const confirm = async () => {
    if (err) return;
    if (!window.confirm(hasResults ? "มีผลการแข่งขันแล้ว — ยืนยันสายใหม่จะล้างตารางแข่งและผลทั้งหมดของรุ่นนี้ ยืนยัน?"
      : "ยืนยันสาย และสร้างคู่แข่ง (พบกันหมดในกลุ่ม + Knockout)?\nConfirm pools and create games?")) return;
    setBusy(true);
    const ok = await save({ groups: compact, games: buildGames(compact) });
    setBusy(false);
    if (ok) goSchedule();
  };

  const chip = on => ({ width: 48, height: 48, borderRadius: 10, border: `1px solid ${on ? C.orange : C.line3}`, background: on ? C.orange : "transparent", color: on ? "#111" : C.text, fontFamily: BC, fontWeight: 800, fontSize: 20 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={label}>Pools</span>
        {Array.from({ length: Math.max(1, Math.min(8, Math.floor(n / 2)) - 1) }, (_, i) => i + 2).map(g => (
          <button key={g} onClick={() => setCount(g)} style={chip(g === G)}>{g}</button>
        ))}
        <span style={{ fontSize: 13, color: C.muted }}>{G} pools × {size} slots</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Btn kind="primary" onClick={() => fill(drawGroups(ids, G, n))} style={{ minHeight: 52, fontSize: 20 }}>Auto Seed · Serpentine</Btn>
        <Btn kind="dark" onClick={() => fill(drawPots(ids, G))} style={{ minHeight: 52 }}>🎲 Pot draw · จับโถ</Btn>
        <Btn kind="ghost" onClick={() => fill({})} style={{ minHeight: 52 }}>Clear pools · ล้าง</Btn>
        <span style={{ fontSize: 13, color: C.muted }}>Drag, or tap two teams to swap · ลากวาง หรือแตะ 2 ทีมเพื่อสลับ</span>
        <span style={{ marginLeft: "auto", fontFamily: BC, fontWeight: 700, fontSize: 20 }}>{placed}/{n} <span style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: C.muted }}>placed</span></span>
      </div>

      <div className="adm-seed-grid" style={{ display: "grid", gridTemplateColumns: "minmax(260px,330px) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (drag.current) unassign(drag.current); drag.current = null; }}
          style={{ ...card, padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px", ...label }}><span>Seed · Team</span><span>Pts · Pool</span></div>
          {teams.map((t, i) => {
            const s = sel === t.id;
            return (
              <div key={t.id} draggable onDragStart={e => { drag.current = t.id; e.dataTransfer.setData("text/plain", t.id); }}
                onClick={() => setSel(s ? null : t.id)}
                style={{ display: "grid", gridTemplateColumns: "26px 48px 1fr auto 38px", gap: 8, alignItems: "center", padding: "7px 8px", borderRadius: 10, minHeight: 44, cursor: "grab",
                  background: s ? "#2A2410" : "transparent", outline: `2px solid ${s ? C.yellow : "transparent"}`, outlineOffset: -2 }}>
                <span style={big(20, { color: C.orange })}>{i + 1}</span>
                <Code team={t} size={15} w={48}/>
                <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                <span style={{ fontFamily: BC, fontWeight: 600, fontSize: 16, color: C.muted }}>{teamPoints(t) || ""}</span>
                <span style={{ fontFamily: BC, fontWeight: 800, fontSize: 16, textAlign: "center", borderRadius: 6, padding: "2px 0",
                  background: loc[t.id] ? "#2A2A31" : "transparent", color: loc[t.id] ? C.yellow : C.dim }}>{loc[t.id] || "—"}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16 }}>
          {letters.map(P => (
            <div key={P} style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={big(30, { textTransform: "uppercase" })}>Pool {P}</span>
                <span style={{ fontSize: 12, color: C.muted }}>Σ {pools[P].reduce((a, id) => a + (id ? teamPoints(tmap[id]) : 0), 0)} pts</span>
              </div>
              {pools[P].map((id, i) => {
                const t = id && tmap[id], s = id && sel === id;
                return (
                  <div key={i} draggable={!!id}
                    onDragStart={e => { if (!id) return; drag.current = id; e.dataTransfer.setData("text/plain", id); }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (drag.current) move(drag.current, P, i); drag.current = null; }}
                    onClick={() => tapSlot(P, i)}
                    style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 8, alignItems: "center", minHeight: 56, borderRadius: 12, padding: "6px 10px", cursor: "pointer",
                      background: t ? C.inner : sel ? "rgba(255,208,0,.06)" : "transparent", border: `2px ${t ? "solid" : "dashed"} ${s ? C.yellow : t ? C.inner : C.line3}` }}>
                    <span style={{ fontFamily: BC, fontWeight: 800, fontSize: 18, color: C.muted }}>{P}{i + 1}</span>
                    {t ? (
                      <div style={{ display: "grid", gridTemplateColumns: "48px 1fr auto", gap: 8, alignItems: "center", minWidth: 0 }}>
                        <Code team={t} size={16}/>
                        <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                        <span style={{ fontSize: 11, color: C.muted }}>S{t.seed}</span>
                      </div>
                    ) : <span style={{ fontSize: 12, color: C.dim }}>Drop team here · วางทีม</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", position: "sticky", bottom: 12, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
        <span style={{ flex: "1 1 260px", fontSize: 13, color: err ? "#ff7b73" : C.muted }}>
          {err || (dirty ? "พร้อมยืนยัน — จะสร้างคู่แข่งพบกันหมดในกลุ่ม + สาย Knockout · Ready to confirm" : "✓ สายนี้บันทึกแล้ว · Pools saved")}
        </span>
        <Btn kind="primary" disabled={!!err || busy || !dirty} onClick={confirm} style={{ minHeight: 52 }}>
          {busy ? "Saving…" : "Confirm pools & create games →"}
        </Btn>
      </div>
    </div>
  );
}

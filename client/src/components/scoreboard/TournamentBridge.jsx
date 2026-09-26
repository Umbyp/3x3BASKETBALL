/**
 * Tournament bridge on the Scoreboard — FIBA-style "pick the match, the board
 * sets itself up": choosing a scheduled match resets the game, loads both team
 * names and links this court to the match (court state `linkedMatch`, so every
 * device and a page refresh agree). Scores of the linked match then sync to
 * the tournament automatically; "จบการแข่งขัน" records the final result.
 */
import { useState, useEffect, useMemo } from "react";
import { db } from "../../firebase.js";
import { ref, onValue, update } from "firebase/database";
import { useDivisions, findDivision } from "../../divisions.js";
import { resolveTournament, isPendingSlot } from "../../lib/standings.js";

function useTournamentData(divId) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!db || !divId) { setData(null); return; }
    setData(null);
    return onValue(ref(db, `tournament_data/${divId}`), snap => setData(snap.val()));
  }, [divId]);
  return data;
}

/** Flat, operator-friendly match list with real team names and a short label. */
function matchList(data) {
  const { groupMatches, koMatches } = resolveTournament(data, { strict: true });
  const perGroup = {};
  const grp = groupMatches.map(m => {
    perGroup[m.group] = (perGroup[m.group] || 0) + 1;
    return { ...m, kind: "group", label: `Group ${m.group} · นัด ${perGroup[m.group]}` };
  });
  const ko = koMatches
    .filter(m => m.away != null) // byes aren't real games
    .map(m => ({ ...m, kind: "ko", label: m.shortLabel || "KO" }));
  return [...grp, ...ko].map(m => ({ ...m, pending: isPendingSlot(m.rh) || isPendingSlot(m.ra) }));
}

const F = { fontFamily: "'Barlow Condensed',sans-serif" };

export default function TournamentBridge({ state, send, divisionId, courtId }) {
  const divisions = useDivisions();
  const linked = state.linkedMatch || null;
  const [div, setDiv] = useState(linked?.division || divisionId);
  const [open, setOpen] = useState(false);
  const [showPlayed, setShowPlayed] = useState(false);
  const [status, setStatus] = useState(null); // "live" | "saved" | "error"

  // Follow the linked match's division when another device links a match
  useEffect(() => { if (linked?.division) setDiv(linked.division); }, [linked?.division]);

  const listData   = useTournamentData(div);
  const linkedData = useTournamentData(linked?.division === div ? null : linked?.division);
  const linkedSrc  = linked?.division === div ? listData : linkedData;

  const matches = useMemo(() => matchList(listData), [listData]);
  const sel = useMemo(() => linked && matchList(linkedSrc).find(m => m.id === linked.id) || null, [linkedSrc, linked?.id, linked?.division]);
  const divCfg = findDivision(divisions, div);

  const push = async finished => {
    if (!sel || !linkedSrc || !db) return;
    const key = sel.kind === "group" ? "groupMatches" : "koMatches";
    const idx = (linkedSrc[key] || []).findIndex(m => m.id === sel.id);
    if (idx === -1) { setStatus("error"); return; }
    const base = `tournament_data/${linked.division}/${key}/${idx}`;
    try {
      await update(ref(db), {
        [`${base}/homeScore`]: state.teamA.score,
        [`${base}/awayScore`]: state.teamB.score,
        [`${base}/played`]: finished,
        [`${base}/court`]: courtId,
      });
      setStatus(finished ? "saved" : "live");
    } catch { setStatus("error"); }
  };

  // Live score sync — stops once the match is recorded as finished
  useEffect(() => {
    if (!sel || sel.played) return;
    const t = setTimeout(() => push(false), 800);
    return () => clearTimeout(t);
  }, [state.teamA.score, state.teamB.score, sel?.id, sel?.played]);

  const pick = m => {
    const inProgress = state.teamA.score || state.teamB.score || state.isRunning;
    if (!window.confirm(`เริ่มนัด ${m.label}\n${m.rh}  vs  ${m.ra}\n\n${inProgress ? "คะแนนและเวลาของเกมปัจจุบันจะถูกรีเซ็ต — " : ""}ยืนยัน?`)) return;
    send("resetGame");
    send("teamName", "teamA", m.rh);
    send("teamName", "teamB", m.ra);
    send("linkMatch", null, { division: div, id: m.id, label: `${findDivision(divisions, div).label} · ${m.label}` });
    setStatus(null); setOpen(false);
  };
  const finish = () => {
    if (!window.confirm(`บันทึกผลจบการแข่งขัน\n${state.teamA.name} ${state.teamA.score} — ${state.teamB.score} ${state.teamB.name}\nยืนยัน?`)) return;
    push(true);
  };
  const unlink = () => { if (window.confirm("ยกเลิกการผูกนัดนี้? (คะแนนจะไม่ส่งไปตารางแข่งอีก)")) send("linkMatch", null, null); };

  const shell = { background: "#10131c", border: `1px solid ${divCfg.color}40`, borderRadius: 14, overflow: "hidden", marginBottom: 10 };

  if (!db) return (
    <div style={{ ...shell, borderColor: "#1f2433", padding: "10px 14px", fontSize: 14, color: "#6c7388", ...F }}>
      🏆 TOURNAMENT ไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า Firebase) — คะแนน/นาฬิกาใช้งานปกติ
    </div>
  );

  const visible = matches.filter(m => showPlayed || !m.played);

  return (
    <div style={shell}>
      {/* Header — what this court is playing right now */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: `${divCfg.color}10`, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18 }}>🏆</span>
        {sel ? (
          <div style={{ flex: 1, minWidth: 0, ...F }}>
            <div style={{ fontSize: 13, letterSpacing: ".15em", color: divCfg.color, fontWeight: 700 }}>
              กำลังแข่ง · {linked.label}{sel.played ? " · ✅ บันทึกผลแล้ว" : ""}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f5f8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {sel.rh} <span style={{ color: "#6c7388" }}>vs</span> {sel.ra}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: "#9aa1b4", ...F }}>
            {linked ? "นัดที่ผูกไว้ไม่พบในตารางแข่ง" : "ยังไม่ได้เลือกนัด — กดปุ่ม เลือกนัด เพื่อใส่ชื่อทีมอัตโนมัติ"}
          </div>
        )}
        {status === "live" && <span style={{ ...F, fontSize: 13, color: "#ffb020" }}>📡 SYNC</span>}
        {status === "saved" && <span style={{ ...F, fontSize: 13, color: "#4fe39a" }}>✅ บันทึกแล้ว</span>}
        {status === "error" && <span style={{ ...F, fontSize: 13, color: "#ff7b7b" }}>❌ ส่งผลไม่สำเร็จ</span>}
        {sel && !sel.played && (
          <button onClick={finish} style={btn("#3a2328", "#1a1216", "#ff7b7b")}>🏁 จบการแข่งขัน</button>
        )}
        {linked && <button onClick={unlink} style={btn("#262b3a", "#161a24", "#9aa1b4")}>ยกเลิกผูก</button>}
        <button onClick={() => setOpen(true)} style={btn(divCfg.color, `${divCfg.color}22`, divCfg.color)}>
          {sel ? "เปลี่ยนนัด" : "📋 เลือกนัด"}
        </button>
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(4,5,8,.8)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: "min(980px,96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column",
          background: "#10131c", border: "1px solid #262b3a", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #1f2433" }}>
            <span style={{ ...F, fontSize: 24, fontWeight: 800, letterSpacing: ".1em", color: "#f4f5f8" }}>📋 เลือกนัดที่จะแข่ง · สนาม {courtId}</span>
            <button onClick={() => setOpen(false)} style={{ ...btn("#262b3a", "#161a24", "#e8eaf0"), width: 44 }}>✕</button>
          </div>
          <div style={{ padding: "12px 18px 18px", overflowY: "auto" }}>
          <p style={{ ...F, fontSize: 15, color: "#7a8194", margin: "0 0 10px" }}>
            กดเลือกนัด → ระบบรีเซ็ตเกม ใส่ชื่อทีมทั้งสองฝั่ง และส่งคะแนนเข้าตารางแข่งให้อัตโนมัติ
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            {divisions.map(d => (
              <button key={d.id} onClick={() => setDiv(d.id)} style={{
                ...btn(d.id === div ? d.color : "#262b3a", d.id === div ? `${d.color}22` : "#161a24", d.id === div ? d.color : "#9aa1b4"),
              }}>{d.icon} {d.label}</button>
            ))}
            <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#7a8194", ...F }}>
              <input type="checkbox" checked={showPlayed} onChange={e => setShowPlayed(e.target.checked)}/> แสดงนัดที่แข่งแล้ว
            </label>
          </div>

          {!listData ? (
            <div style={{ color: "#6c7388", fontSize: 14, ...F }}>กำลังโหลดตารางแข่ง…</div>
          ) : !visible.length ? (
            <div style={{ color: "#6c7388", fontSize: 14, ...F }}>ไม่มีนัดที่รอแข่งในรุ่นนี้</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 8 }}>
              {visible.map(m => {
                const isSel = linked?.division === div && linked?.id === m.id;
                const disabled = m.pending || isSel;
                return (
                  <button key={m.id} disabled={disabled} onClick={() => pick(m)} style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 12, cursor: disabled ? "default" : "pointer",
                    border: `1px solid ${isSel ? divCfg.color : "#262b3a"}`, background: isSel ? `${divCfg.color}18` : "#161a24",
                    opacity: m.pending ? 0.45 : 1, ...F,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, letterSpacing: ".12em", color: "#7a8194", fontWeight: 700 }}>
                      <span>{m.label}</span>
                      <span>{isSel ? "● กำลังแข่ง" : m.played ? `✓ ${m.homeScore}–${m.awayScore}` : m.pending ? "รอผลรอบก่อน" : m.court ? `สนาม ${m.court}` : ""}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#f4f5f8", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.rh} <span style={{ color: "#6c7388", fontWeight: 600 }}>vs</span> {m.ra}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

function btn(border, bg, color) {
  return { height: 38, padding: "0 12px", borderRadius: 10, border: `1px solid ${border}`, background: bg, color,
    fontSize: 15, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Barlow Condensed',sans-serif" };
}

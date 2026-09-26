/**
 * Tournament bridge on the Scoreboard (FIBA-style): the Scoreboard doesn't own
 * team data — it only knows which game this court is playing. Picking a game
 * sends "loadGame" and the server resets the board and pulls team names and
 * colours from the tournament; score changes then flow back to that game, and
 * "จบการแข่งขัน" records it as final (standings update automatically).
 */
import { useState, useEffect, useMemo } from "react";
import { db } from "../../firebase.js";
import { ref, onValue } from "firebase/database";
import socket from "../../socket.js";
import { useDivisions, findDivision } from "../../divisions.js";
import { isV2, resolvedGames, sideName, fmtWhen } from "../../lib/tournament.js";

function useTournamentData(divId) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    if (!db || !divId) { setData(undefined); return; }
    setData(undefined);
    return onValue(ref(db, `tournament_data/${divId}`), snap => setData(snap.val()), () => setData(null));
  }, [divId]);
  return data;
}

const F = { fontFamily: "'Barlow Condensed',sans-serif" };
const GROUP_COLORS = ["#f59e0b","#3b82f6","#10b981","#a855f7","#ec4899","#14b8a6","#eab308","#f43f5e"];

export default function TournamentBridge({ state, send, divisionId, courtId }) {
  const divisions = useDivisions();
  const linked = state.linkedMatch || null;
  const [div, setDiv] = useState(linked?.division || divisionId);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("court"); // court | all | done
  const [err, setErr] = useState(null);

  useEffect(() => { if (linked?.division) setDiv(linked.division); }, [linked?.division]);
  useEffect(() => {
    const h = e => { if (e?.type === "loadGame") setErr(e.message); };
    socket.on("actionError", h);
    return () => socket.off("actionError", h);
  }, []);

  const data = useTournamentData(div);
  const games = useMemo(() => (isV2(data) ? resolvedGames(data).filter(g => !g.bye) : []), [data]);
  const cur = linked && linked.division === div ? games.find(g => g.id === linked.id) : null;
  const divCfg = findDivision(divisions, div);

  const list = games
    .filter(g => scope === "done" ? g.status === "final" : g.status !== "final")
    .filter(g => scope !== "court" || !g.court || g.court === courtId)
    .sort((a, b) => (a.time || "~").localeCompare(b.time || "~") || (a.court || "").localeCompare(b.court || ""));

  const pick = g => {
    const inProgress = state.teamA.score || state.teamB.score || state.isRunning;
    const busyElsewhere = g.status === "live" && g.court && g.court !== courtId;
    if (!window.confirm(`โหลดเกม ${g.label}\n${g.homeTeam.name}  vs  ${g.awayTeam.name}\n\n${busyElsewhere ? `⚠️ เกมนี้กำลังแข่งอยู่ที่สนาม ${g.court}\n` : ""}${inProgress ? "คะแนนและเวลาของเกมปัจจุบันจะถูกรีเซ็ต\n" : ""}ยืนยัน?`)) return;
    setErr(null);
    send("loadGame", null, { division: div, gameId: g.id });
    setOpen(false);
  };
  const finish = () => {
    if (state.teamA.score === state.teamB.score) { window.alert("คะแนนเสมอ — 3x3 ต้องมีผู้ชนะ (ต่อเวลา) ก่อนจบเกม"); return; }
    if (window.confirm(`บันทึกผลจบการแข่งขัน\n${state.teamA.name} ${state.teamA.score} — ${state.teamB.score} ${state.teamB.name}\nยืนยัน?`)) send("finishGame");
  };
  const unlink = () => { if (window.confirm("ยกเลิกการผูกเกมนี้? (คะแนนจะไม่ส่งไปตารางแข่งอีก)")) send("unlinkGame"); };

  const shell = { background: "#10131c", border: `1px solid ${divCfg.color}40`, borderRadius: 14, overflow: "hidden", marginBottom: 10 };
  if (!db) return (
    <div style={{ ...shell, borderColor: "#1f2433", padding: "10px 14px", fontSize: 14, color: "#6c7388", ...F }}>
      🏆 TOURNAMENT ไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า Firebase) — คะแนน/นาฬิกาใช้งานปกติ
    </div>
  );

  return (
    <div style={shell}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: `${divCfg.color}10`, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18 }}>🏆</span>
        <div style={{ flex: 1, minWidth: 0, ...F }}>
          {linked ? <>
            <div style={{ fontSize: 13, letterSpacing: ".15em", color: divCfg.color, fontWeight: 700 }}>
              {linked.final ? "✅ บันทึกผลแล้ว" : "● กำลังแข่ง"} · {linked.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f5f8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {state.teamA.name} <span style={{ color: "#6c7388" }}>vs</span> {state.teamB.name}
            </div>
          </> : (
            <div style={{ fontSize: 18, fontWeight: 700, color: "#9aa1b4" }}>ยังไม่ได้เลือกเกม — กด โหลดเกม เพื่อดึงทีมจากตารางแข่ง</div>
          )}
          {err && <div style={{ fontSize: 13, color: "#ff7b7b" }}>❌ โหลดเกมไม่สำเร็จ: {err}</div>}
        </div>
        {linked && !linked.final && <button onClick={finish} style={btn("#3a2328", "#1a1216", "#ff7b7b")}>🏁 จบการแข่งขัน</button>}
        {linked && <button onClick={unlink} style={btn("#262b3a", "#161a24", "#9aa1b4")}>{linked.final ? "ปิดเกม" : "ยกเลิกผูก"}</button>}
        <button onClick={() => setOpen(true)} style={btn(divCfg.color, `${divCfg.color}22`, divCfg.color)}>{linked ? "เปลี่ยนเกม" : "📋 โหลดเกม"}</button>
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(4,5,8,.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(980px,96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", background: "#10131c", border: "1px solid #262b3a", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #1f2433" }}>
              <span style={{ ...F, fontSize: 24, fontWeight: 800, letterSpacing: ".1em", color: "#f4f5f8" }}>📋 โหลดเกม · สนาม {courtId}</span>
              <button onClick={() => setOpen(false)} style={{ ...btn("#262b3a", "#161a24", "#e8eaf0"), width: 44 }}>✕</button>
            </div>
            <div style={{ padding: "12px 18px 18px", overflowY: "auto" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {divisions.map(d => (
                  <button key={d.id} onClick={() => setDiv(d.id)} style={btn(d.id === div ? d.color : "#262b3a", d.id === div ? `${d.color}22` : "#161a24", d.id === div ? d.color : "#9aa1b4")}>{d.icon} {d.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[["court", `สนาม ${courtId}`], ["all", "ทุกสนาม"], ["done", "แข่งแล้ว"]].map(([v, l]) => (
                  <button key={v} onClick={() => setScope(v)} style={btn(scope === v ? "#e8eaf0" : "#262b3a", scope === v ? "#262b3a" : "#161a24", scope === v ? "#f4f5f8" : "#7a8194")}>{l}</button>
                ))}
              </div>
              {data === undefined ? <Note>กำลังโหลดตารางแข่ง…</Note>
                : !isV2(data) ? <Note>รุ่นนี้ยังไม่ได้ตั้งค่าทัวร์นาเมนต์ (Tournament Admin)</Note>
                : !list.length ? <Note>{scope === "court" ? `ไม่มีเกมที่รอแข่งในสนาม ${courtId} — ลองดู "ทุกสนาม"` : "ไม่มีเกม"}</Note>
                : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 8 }}>
                    {list.map(g => {
                      const ready = g.homeTeam && g.awayTeam, isCur = cur?.id === g.id;
                      const { date, time } = fmtWhen(g.time);
                      const tag = g.kind === "group" ? GROUP_COLORS[g.group.charCodeAt(0) - 65] : "#e5e7eb";
                      return (
                        <button key={g.id} disabled={!ready || isCur} onClick={() => pick(g)} style={{
                          textAlign: "left", padding: "10px 12px", borderRadius: 12, cursor: ready && !isCur ? "pointer" : "default",
                          border: `1px solid ${isCur ? divCfg.color : g.status === "live" ? "#7a2a2a" : "#262b3a"}`,
                          background: isCur ? `${divCfg.color}18` : "#161a24", opacity: ready ? 1 : 0.45, ...F,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#7a8194" }}>
                            <span style={{ padding: "0 6px", borderRadius: 4, background: tag, color: "#000", fontWeight: 800 }}>{g.kind === "group" ? g.group : g.label}</span>
                            <span style={{ color: "#c8ccd6" }}>{time || "—"}</span>{date && <span>{date}</span>}
                            {g.court && <span>· สนาม {g.court}</span>}
                            <span style={{ marginLeft: "auto" }}>
                              {isCur ? "● สนามนี้" : g.status === "live" ? <span style={{ color: "#ff7b7b" }}>● LIVE</span> : g.status === "final" ? `${g.homeScore}–${g.awayScore}` : !ready ? "รอผลรอบก่อน" : ""}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 18, fontWeight: 800, color: "#f4f5f8", marginTop: 4, minWidth: 0 }}>
                            <Dot c={g.homeTeam?.color}/><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sideName(g, "home")}</span>
                            <span style={{ color: "#6c7388", fontWeight: 600, flex: "none" }}>vs</span>
                            <Dot c={g.awayTeam?.color}/><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sideName(g, "away")}</span>
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

const Dot = ({ c }) => <span style={{ width: 10, height: 10, borderRadius: "50%", background: c || "#4b5563", flex: "none" }}/>;
const Note = ({ children }) => <div style={{ color: "#6c7388", fontSize: 15, padding: "20px 0", textAlign: "center", ...F }}>{children}</div>;

function btn(border, bg, color) {
  return { height: 38, padding: "0 12px", borderRadius: 10, border: `1px solid ${border}`, background: bg, color,
    fontSize: 15, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Barlow Condensed',sans-serif" };
}

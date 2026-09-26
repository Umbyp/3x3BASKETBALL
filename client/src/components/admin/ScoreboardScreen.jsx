/**
 * Scoreboard inside Tournament Admin — drives the *real* court on the server
 * (same state as /scoreboard, TV and overlay), for the game loaded on it.
 */
import { useEffect } from "react";
import { useGameState } from "../../pages/useGameState.js";
import { COURTS, RULES } from "../../constants.js";
import { C, BC, card, label, big, Btn, Empty, fgFor, teamCode } from "./theme.jsx";
import { stageLabel } from "./ScheduleScreen.jsx";

const fmtClock = t => { const s = Math.max(0, t) / 10; if (s >= 60) { const c = Math.ceil(s); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, "0")}`; } return s.toFixed(1); };

export default function ScoreboardScreen({ courtId, setCourtId, courtStates, divId, data, games, goSchedule, goStandings }) {
  const { state: raw, send } = useGameState(courtId);
  const s = raw?.courtId === courtId ? raw : null;
  const link = s?.linkedMatch && s.linkedMatch.division === divId ? s.linkedMatch : null;
  const g = link ? games.find(x => x.id === link.id) : null;
  const teamOf = side => (side === "a" ? g?.homeTeam : g?.awayTeam) || null;

  const running = !!s?.isRunning;
  const toggleRun = () => {
    if (!s || s.gameOver) return;
    send("clockToggle");
    if (!running && !s.shotRunning && s.shotClockTenths > 0) send("shotClockToggle");
    if (running && s.shotRunning) send("shotClockToggle");
  };
  useEffect(() => {
    const kd = e => { if (e.code === "Space" && e.target.tagName !== "INPUT") { e.preventDefault(); toggleRun(); } };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  });

  const courtChips = (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {COURTS.map(c => {
        const cs = courtStates[c], on = c === courtId, lm = cs?.linkedMatch;
        return (
          <button key={c} onClick={() => setCourtId(c)} style={{ minHeight: 44, padding: "0 14px", borderRadius: 10, border: `1px solid ${on ? C.orange : C.line3}`,
            background: on ? C.orange : "transparent", color: on ? "#111" : C.text, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            Court {c}
            {cs?.isRunning && <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.red }}/>}
            {lm && !cs?.isRunning && <span style={{ fontSize: 11, opacity: .8 }}>{lm.final ? "✓" : "●"}</span>}
          </button>
        );
      })}
      <a href={`/scoreboard?court=${courtId}&division=${divId}`} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", alignSelf: "center", fontSize: 13 }}>Open operator screen ↗</a>
    </div>
  );

  if (!s) return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{courtChips}<Empty title="Connecting…" sub={`กำลังเชื่อมต่อสนาม ${courtId}`}/></div>;
  if (!link) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {courtChips}
      <Empty title="No game loaded" sub={`สนาม ${courtId} ยังไม่ได้โหลดเกม — เลือกเกมจากตารางแข่ง แล้วกด Load to Scoreboard`}
        action={<Btn kind="primary" onClick={goSchedule} style={{ minHeight: 52, fontSize: 20 }}>Open schedule</Btn>}/>
    </div>
  );

  const A = s.teamA, B = s.teamB;
  const timeUp = s.clockTenths === 0 && !s.isOvertime;
  const winner = s.gameOver ? s.winner : timeUp && A.score !== B.score ? (A.score > B.score ? "teamA" : "teamB") : null;
  const isFinal = !!winner;
  const needOT = timeUp && A.score === B.score && !s.gameOver;
  const saved = !!link.final;

  let alert = null;
  const fouls = [[A, "teamA"], [B, "teamB"]].sort((x, y) => y[0].teamFouls - x[0].teamFouls)[0];
  if (needOT) alert = ["Overtime", "เสมอเมื่อหมดเวลา — ต่อเวลา ใครได้ 2 แต้มก่อนชนะ", "warn"];
  else if (!isFinal && s.shotClockTenths === 0 && s.clockTenths > 0 && s.showShotClock !== false) alert = ["Shot clock violation", `หมดเวลา ${RULES.SHOT_CLOCK} วินาที — เปลี่ยนการครอบครองบอล`, "danger"];
  else if (!isFinal && fouls[0].teamFouls >= 10) alert = [`${codeOf(fouls[0], teamOf(fouls[1] === "teamA" ? "a" : "b"))} — ${fouls[0].teamFouls} team fouls`, "ฟาวล์ทีมครบ 10 · ฟรีโธรว์ 2 ลูก + ครอบครองบอล", "danger"];
  else if (!isFinal && fouls[0].teamFouls >= 7) alert = [`${codeOf(fouls[0], teamOf(fouls[1] === "teamA" ? "a" : "b"))} — ${fouls[0].teamFouls} team fouls`, "ฟาวล์ทีมครบ 7 · ฝ่ายตรงข้ามได้ฟรีโธรว์ 2 ลูก", "warn"];
  const tone = { danger: [C.red, "#fff"], warn: [C.yellow, "#111"], info: [C.text, "#111"] };

  const side = (t, key, team) => {
    const f = t.teamFouls, color = t.color, fg = fgFor(color), won = winner === key;
    return (
      <div style={{ gridArea: key === "teamA" ? "h" : "a", ...card, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ background: color, color: fg, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={big(40)}>{codeOf(t, team)}</span>
          <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team?.name || t.name}</span>
        </div>
        <div style={{ ...big("clamp(110px,15vw,190px)", { lineHeight: .9 }), textAlign: "center", padding: "18px 0 6px", fontVariantNumeric: "tabular-nums", color: won ? C.orange : C.text }}>{t.score}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "6px 18px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px 8px" }}>
            <span style={label}>Fouls · ฟาวล์ทีม</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 6,
                background: f >= 10 ? C.red : f >= 7 ? C.orange : C.line2, color: f >= 7 ? "#111" : C.muted }}>{f >= 10 ? "2FT + Ball" : f >= 7 ? "Bonus 2FT" : "Normal"}</span>
              <span style={big(30, { color: f >= 10 ? C.red : f >= 7 ? C.orange : C.text })}>{f}</span>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 4 }}>
            {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ height: 8, borderRadius: 4, background: i < f ? (i >= 9 ? C.red : i >= 6 ? C.orange : C.text) : "#2A2A31" }}/>)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 18px" }}>
          <button disabled={isFinal} onClick={() => send("score", key, 1)} style={bigBtn(C.yellow)}>+1</button>
          <button disabled={isFinal} onClick={() => send("score", key, 2)} style={bigBtn(C.orange)}>+2</button>
          <button onClick={() => send("teamFoul", key, 1)} style={midBtn()}>+ Foul</button>
          <button disabled={t.timeouts <= 0} onClick={() => send("timeout", key, -1)}
            style={{ ...midBtn(), border: `2px solid ${t.timeouts > 0 ? C.yellow : "#2A2A31"}`, background: "transparent", color: t.timeouts > 0 ? C.yellow : C.dim }}>
            {t.timeouts > 0 ? `Timeout (${t.timeouts})` : "Timeout used"}</button>
          <button disabled={isFinal} onClick={() => send("ftMade", key, 1)} style={{ ...midBtn(), color: "#4fe39a" }}>FT ✓ +1</button>
          <button onClick={() => send("ftMiss", key, 1)} style={{ ...midBtn(), color: "#ff8a80" }}>FT ✗ · {t.ftMade || 0}/{t.ftAtt || 0}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 18px 18px" }}>
          <span style={label}>Roster · รายชื่อ</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 6 }}>
            {(team?.roster || []).map((p, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6, alignItems: "center", borderRadius: 10, minHeight: 44, padding: "6px 10px", background: C.inner }}>
                <span style={{ fontFamily: BC, fontWeight: 800, fontSize: 18 }}>{p.no ? `#${p.no}` : ""}</span>
                <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              </div>
            ))}
            {!(team?.roster || []).length && <span style={{ fontSize: 12, color: C.dim }}>—</span>}
          </div>
        </div>
      </div>
    );
  };

  const shotOff = s.showShotClock === false || (!s.isOvertime && s.clockTenths < s.shotClockTenths);
  const wTeam = winner === "teamA" ? A : winner === "teamB" ? B : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {courtChips}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, color: C.muted }}>{g ? `${g.num} · ${stageLabel(g)} · ${g.time ? g.time.slice(11) : "—"} · Court ${courtId}` : link.label}</span>
        <span style={{ fontSize: 13, color: C.muted }}>Space = start/stop · Game to <b style={{ color: C.text }}>{RULES.WIN_SCORE}</b></span>
      </div>
      {alert && (
        <div style={{ borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: tone[alert[2]][0], color: tone[alert[2]][1] }}>
          <span style={big(30, { textTransform: "uppercase" })}>{alert[0]}</span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{alert[1]}</span>
        </div>
      )}
      <div className="adm-sb-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) clamp(210px,24vw,330px) minmax(0,1fr)", gridTemplateAreas: "'h c a'", gap: 12 }}>
        {side(A, "teamA", teamOf("a"))}
        <div style={{ gridArea: "c", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...card, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={label}>{s.isOvertime ? "Overtime · ต่อเวลา" : "Game clock · เวลาแข่ง"}</span>
            <span style={big("clamp(64px,8vw,104px)", { lineHeight: .95, fontVariantNumeric: "tabular-nums", color: s.isOvertime ? C.yellow : s.clockTenths < 600 ? C.red : C.text })}>{fmtClock(s.clockTenths)}</span>
          </div>
          <div style={{ background: "#000", border: `1px solid ${C.line2}`, borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={label}>Shot clock · {RULES.SHOT_CLOCK} วินาที</span>
            <span style={big("clamp(110px,13vw,170px)", { lineHeight: .9, fontVariantNumeric: "tabular-nums", color: shotOff ? C.line3 : s.shotClockTenths <= 50 ? C.red : C.yellow })}>
              {shotOff ? "—" : Math.ceil(Math.max(0, s.shotClockTenths) / 10)}</span>
          </div>
          {!isFinal && !needOT && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={toggleRun} style={{ border: "none", borderRadius: 14, minHeight: 84, ...big(36, { textTransform: "uppercase" }), background: running ? C.red : C.green, color: running ? "#fff" : "#0B0B0C" }}>
                {running ? "Stop · หยุด" : "Start · เริ่ม"}</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={() => send("shotClockSet", null, RULES.SHOT_CLOCK)} style={{ border: `2px solid ${C.yellow}`, borderRadius: 12, minHeight: 60, background: "transparent", color: C.yellow, ...big(22, { textTransform: "uppercase" }) }}>Reset {RULES.SHOT_CLOCK}</button>
                <button onClick={() => send("undo")} disabled={!(s.history || []).length} style={{ ...midBtn(), minHeight: 60, ...big(22, { textTransform: "uppercase" }), opacity: (s.history || []).length ? 1 : .4 }}>↶ Undo</button>
              </div>
            </div>
          )}
          {needOT && (
            <div style={{ background: C.yellow, color: "#111", borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
              <span style={big(28, { textTransform: "uppercase" })}>Tied · เสมอ</span>
              <button onClick={() => send("startOvertime")} style={{ border: "none", borderRadius: 10, minHeight: 52, padding: "0 20px", background: "#111", color: C.yellow, fontWeight: 700, fontSize: 15 }}>Start overtime · เริ่มต่อเวลา</button>
            </div>
          )}
          {isFinal && (
            <div style={{ background: C.orange, color: "#111", borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
              <span style={big(48, { textTransform: "uppercase" })}>Final{s.isOvertime ? " · OT" : ""}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{wTeam ? `${wTeam.name} win ${Math.max(A.score, B.score)}–${Math.min(A.score, B.score)}` : ""}</span>
              {!saved ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", marginTop: 6 }}>
                  <button onClick={() => send("undo")} style={finBtn(false)}>↶ Undo</button>
                  <button onClick={() => { if (window.confirm(`บันทึกผล ${A.name} ${A.score} – ${B.score} ${B.name}?`)) send("finishGame"); }} style={finBtn(true)}>Confirm result</button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", marginTop: 6 }}>
                  <button onClick={goStandings} style={finBtn(true)}>Standings</button>
                  <button onClick={goSchedule} style={finBtn(false)}>Next game</button>
                </div>
              )}
            </div>
          )}
        </div>
        {side(B, "teamB", teamOf("b"))}
      </div>
    </div>
  );
}

const codeOf = (t, team) => team ? teamCode(team) : (t.name || "").slice(0, 3).toUpperCase();
const bigBtn = bg => ({ border: "none", borderRadius: 14, minHeight: 108, background: bg, color: "#111", fontFamily: BC, fontWeight: 800, fontSize: "clamp(40px,5vw,60px)", lineHeight: 1 });
const midBtn = () => ({ border: `1px solid ${C.line3}`, borderRadius: 12, minHeight: 56, background: C.inner, color: C.text, fontFamily: BC, fontWeight: 700, fontSize: 18, textTransform: "uppercase" });
const finBtn = solid => ({ border: solid ? "none" : "2px solid #111", borderRadius: 10, minHeight: 52, background: solid ? "#111" : "transparent", color: solid ? C.orange : "#111", fontWeight: 700, fontSize: 14 });

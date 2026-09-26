/**
 * 🗂️ AdminPage — Tournament Admin (FIBA-style), /admin?division=<id>
 * Layout from the "Tournament Admin" Claude Design file: sidebar with
 * Divisions · Teams · Seeding & Pools · Schedule · Scoreboard · Standings · Knockout.
 * All writes go through the server (/admin/* + socket actions); Firebase is read-only here.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase.js";
import { ref, onValue } from "firebase/database";
import socket, { SERVER_URL } from "../socket.js";
import { COURTS } from "../constants.js";
import { useDivisions, findDivision } from "../divisions.js";
import { isV2, resolvedGames } from "../lib/tournament.js";
import { C, BC, TH, big, input, Btn } from "../components/admin/theme.jsx";
import DivisionsScreen, { divisionSummary } from "../components/admin/DivisionsScreen.jsx";
import TeamsScreen from "../components/admin/TeamsScreen.jsx";
import SeedingScreen from "../components/admin/SeedingScreen.jsx";
import ScheduleScreen, { gameVM } from "../components/admin/ScheduleScreen.jsx";
import ScoreboardScreen from "../components/admin/ScoreboardScreen.jsx";
import { StandingsScreen, KnockoutScreen } from "../components/admin/ResultsScreens.jsx";

const NAV = [
  ["divisions", "Divisions", "รุ่นการแข่งขัน"], ["teams", "Teams", "ทีม"], ["seeding", "Seeding & Pools", "จัดสาย / กลุ่ม"],
  ["schedule", "Schedule", "ตารางแข่ง"], ["scoreboard", "Scoreboard", "กระดานคะแนน"], ["standings", "Standings", "ตารางคะแนน"],
  ["bracket", "Knockout", "รอบน็อกเอาต์"],
];
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const sess  = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} } };

function useAllTournaments(ids) {
  const [all, setAll] = useState({});
  const key = ids.join("|");
  useEffect(() => {
    if (!db) return;
    const offs = ids.map(id => onValue(ref(db, `tournament_data/${id}`), snap => setAll(a => ({ ...a, [id]: snap.val() })), () => setAll(a => ({ ...a, [id]: null }))));
    return () => offs.forEach(f => f());
  }, [key]);
  return all;
}
function useCourtStates() {
  const [all, setAll] = useState({});
  useEffect(() => {
    const join = () => socket.emit("joinMonitor");
    const on = s => setAll(s || {});
    socket.on("connect", join); socket.on("allStates", on);
    if (socket.connected) join();
    return () => { socket.off("connect", join); socket.off("allStates", on); };
  }, []);
  return all;
}

export default function AdminPage() {
  const [sp, setSp] = useSearchParams();
  const divisions = useDivisions();
  const divId = sp.get("division") || store.get("bk3x3.division") || divisions[0].id;
  const divCfg = findDivision(divisions, divId);
  const [screen, setScreen] = useState(() => store.get("bk3x3.screen") || "divisions");
  const [token, setToken] = useState(() => sess.get("bk3x3.token"));
  const [courtId, setCourtId] = useState(COURTS[0]);
  const [toast, setToast] = useState(null);

  const allData = useAllTournaments(divisions.map(d => d.id));
  const courtStates = useCourtStates();
  const raw = allData[divId];
  const data = isV2(raw) ? raw : null;
  const games = useMemo(() => resolvedGames(data).filter(g => !g.bye)
    .sort((a, b) => (a.time || "~").localeCompare(b.time || "~") || (a.court || "").localeCompare(b.court || ""))
    .map((g, i) => ({ ...g, num: `#${i + 1}` })), [data]);

  const go = k => { setScreen(k); store.set("bk3x3.screen", k); window.scrollTo(0, 0); };
  const pickDivision = id => { setSp({ division: id }); store.set("bk3x3.division", id); go("teams"); };
  const flash = (message, type = "ok") => { setToast({ message, type }); setTimeout(() => setToast(null), 2600); };
  const setTok = t => { setToken(t); sess.set("bk3x3.token", t); };

  const adminPost = useCallback(async (path, body) => {
    try {
      const res = await fetch(`${SERVER_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.status === 401) { setTok(null); flash("หมดเวลา login — กรุณาเข้าสู่ระบบใหม่", "err"); return false; }
      if (!res.ok) { const e = await res.json().catch(() => ({})); flash(`❌ ${e.error || "บันทึกไม่สำเร็จ"}`, "err"); return false; }
      return true;
    } catch { flash("❌ เชื่อมต่อ server ไม่ได้", "err"); return false; }
  }, [token]);
  const save = async partial => { const ok = await adminPost(`/admin/tournament/${divId}/save`, partial); if (ok) flash("✅ Saved · บันทึกแล้ว"); return ok; };
  const saveResult = async (id, homeScore, awayScore, status) => { const ok = await adminPost(`/admin/tournament/${divId}/game/${id}`, { homeScore, awayScore, status }); if (ok) flash("✅ Result saved · บันทึกผลแล้ว"); return ok; };
  const saveDivisions = async (list, currentRemoved) => {
    const ok = await adminPost(`/admin/divisions`, { divisions: list });
    if (ok) { flash("✅ Divisions saved"); if (currentRemoved) setSp({ division: list[0].id }); }
    return ok;
  };

  const loadToCourt = g => {
    const vm = gameVM(g, courtStates, divId);
    if (vm.loadedOn) { setCourtId(vm.loadedOn); go("scoreboard"); return; }
    if (!vm.ready || vm.final) return;
    if (!g.court) { flash("กำหนดสนามของเกมนี้ก่อน (กด ✎) · Set a court first", "err"); return; }
    const cs = courtStates[g.court], busy = cs?.linkedMatch && !cs.linkedMatch.final && (cs.teamA.score || cs.teamB.score || cs.isRunning);
    if (!window.confirm(`Load ${g.num} ${g.homeTeam.name} vs ${g.awayTeam.name} to Court ${g.court}?${busy ? `\n\n⚠️ สนาม ${g.court} มีเกม ${cs.linkedMatch.label} ค้างอยู่ — คะแนนจะถูกรีเซ็ต` : ""}`)) return;
    socket.emit("action", { courtId: g.court, type: "loadGame", value: { division: divId, gameId: g.id } });
    setCourtId(g.court); go("scoreboard");
  };
  useEffect(() => {
    const h = e => { if (e?.type === "loadGame") flash(`❌ โหลดเกมไม่สำเร็จ: ${e.message}`, "err"); };
    socket.on("actionError", h); return () => socket.off("actionError", h);
  }, []);

  if (!db) return <Center><span style={big(30)}>TOURNAMENT SYNC ไม่พร้อมใช้งาน</span><span style={{ color: C.muted }}>ยังไม่ได้ตั้งค่า Firebase (VITE_FIREBASE_* env vars)</span></Center>;
  if (!token) return <Login onToken={setTok}/>;

  const poolGames = games.filter(g => g.kind === "group"), poolDone = poolGames.filter(g => g.status === "final").length;
  const anyLive = Object.values(courtStates).some(s => s?.linkedMatch && !s.linkedMatch.final && s.isRunning);
  const sum = divisionSummary(raw);
  const cur = Math.max(0, NAV.findIndex(n => n[0] === screen)), [, titleEn, titleTh] = NAV[cur];

  return (
    <div className="adm-root" style={{ display: "grid", gridTemplateColumns: "212px minmax(0,1fr)", minHeight: "100vh", background: C.bg, color: C.text, fontFamily: TH }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap');
        body{margin:0;background:${C.bg}} .adm-root *{box-sizing:border-box} .adm-root button{font-family:inherit;touch-action:manipulation}
        .adm-root a{color:${C.orange}} .adm-root a:hover{color:${C.yellow}}
        @media (max-width: 900px){
          .adm-root{grid-template-columns:minmax(0,1fr) !important} .adm-root>*{min-width:0}
          .adm-side{position:static !important;height:auto !important;flex-direction:row !important;flex-wrap:wrap;align-items:center;border-right:none !important;border-bottom:1px solid ${C.line}}
          .adm-side nav{flex-direction:row !important;overflow-x:auto;width:100%;min-width:0;padding-bottom:4px} .adm-side nav button{min-width:132px}
          .adm-side .adm-divcard{margin-top:0 !important;flex:1}
          .adm-seed-grid{grid-template-columns:1fr !important}
          .adm-sb-grid{grid-template-columns:1fr 1fr !important;grid-template-areas:'c c' 'h a' !important}
        }
        @media (max-width: 640px){
          .adm-sched-head{display:none !important} .adm-sched-row{grid-template-columns:1fr !important} .adm-empty-cell{display:none}
          .adm-sb-grid{grid-template-columns:1fr !important;grid-template-areas:'c' 'h' 'a' !important}
        }
      `}</style>

      <aside className="adm-side" style={{ background: C.side, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", padding: "18px 12px", gap: 18, position: "sticky", top: 0, height: "100vh" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px", textDecoration: "none", color: C.text }}>
          <div style={{ width: 44, height: 44, background: C.orange, color: "#111", display: "grid", placeItems: "center", fontFamily: BC, fontWeight: 800, fontSize: 22, borderRadius: 8, transform: "skewX(-8deg)" }}>3×3</div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontFamily: BC, fontWeight: 800, fontSize: 18, letterSpacing: ".02em", textTransform: "uppercase" }}>Basketball</span>
            <span style={{ fontSize: 11, color: C.muted }}>Tournament Admin</span>
          </div>
        </a>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map(([k, en, th], i) => {
            const on = k === screen;
            return (
              <button key={k} onClick={() => go(k)} style={{ display: "grid", gridTemplateColumns: "26px 1fr auto", alignItems: "center", gap: 8, textAlign: "left", border: "none", borderRadius: 10,
                padding: 10, minHeight: 52, background: on ? C.orange : "transparent", color: on ? "#111" : C.text }}>
                <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 14, opacity: .7 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                  <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 18, textTransform: "uppercase", letterSpacing: ".02em" }}>{en}</span>
                  <span style={{ fontSize: 11, color: on ? "#3A1A05" : C.muted }}>{th}</span>
                </span>
                {k === "scoreboard" && anyLive && <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.red, boxShadow: "0 0 0 3px rgba(255,59,48,.25)" }}/>}
              </button>
            );
          })}
        </nav>
        <button className="adm-divcard" onClick={() => go("divisions")} style={{ marginTop: "auto", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 4, textAlign: "left", color: C.text }}>
          <span style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted, fontWeight: 600 }}>Division · เปลี่ยน ▸</span>
          <span style={{ fontFamily: BC, fontWeight: 800, fontSize: 20, textTransform: "uppercase" }}>{divCfg.icon} {divCfg.label}</span>
          <span style={{ fontSize: 12, color: C.muted }}>{sum.teams} ทีม · {sum.pools} Pools · {sum.status}</span>
        </button>
      </aside>

      <main style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, padding: "22px 28px 16px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: C.orange, fontWeight: 700 }}>{String(cur + 1).padStart(2, "0")} / Tournament Admin · {divCfg.label}</span>
            <h1 style={{ margin: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 12, rowGap: 2, fontFamily: BC, fontWeight: 800, fontSize: 44, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: ".01em" }}>
              <span>{titleEn}</span><span style={{ fontFamily: TH, fontWeight: 500, fontSize: 20, lineHeight: 1.4, color: C.muted, textTransform: "none", letterSpacing: 0, whiteSpace: "nowrap" }}>{titleTh}</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {poolGames.length > 0 && <span style={{ fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}>Pool games <b style={{ color: C.text }}>{poolDone}/{poolGames.length}</b> final</span>}
            <a href={`/tournament?division=${divId}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Public page ↗</a>
            <Btn kind="ghost" onClick={() => setTok(null)} style={{ minHeight: 44 }}>Logout</Btn>
          </div>
        </header>

        <div style={{ padding: "24px 28px 40px", flex: 1, minWidth: 0 }}>
          {raw && !data && screen !== "divisions" && (
            <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(255,208,0,.1)", border: `1px solid ${C.yellow}55`, color: C.yellow, fontSize: 13 }}>
              รุ่นนี้มีข้อมูลรูปแบบเก่า — ระบบจะไม่ใช้ข้อมูลเดิม เริ่มเพิ่มทีมใหม่ได้เลย (บันทึกครั้งแรกจะแทนที่ข้อมูลเก่า)
            </div>
          )}
          {screen === "divisions" && <DivisionsScreen divisions={divisions} allData={allData} divId={divId} onPick={pickDivision} onSaveDivisions={saveDivisions}/>}
          {screen === "teams" && <TeamsScreen key={divId} data={data} save={save}/>}
          {screen === "seeding" && <SeedingScreen key={divId + (data?.teams?.length || 0)} data={data} save={save} goTeams={() => go("teams")} goSchedule={() => go("schedule")}/>}
          {screen === "schedule" && <ScheduleScreen data={data} games={games} divId={divId} courtStates={courtStates} save={save} saveResult={saveResult} loadToCourt={loadToCourt} goSeeding={() => go("seeding")}/>}
          {screen === "scoreboard" && <ScoreboardScreen courtId={courtId} setCourtId={setCourtId} courtStates={courtStates} divId={divId} data={data} games={games} goSchedule={() => go("schedule")} goStandings={() => go("standings")}/>}
          {screen === "standings" && <StandingsScreen data={data}/>}
          {screen === "bracket" && <KnockoutScreen data={data} games={games} divId={divId} courtStates={courtStates} loadToCourt={loadToCourt} poolDone={poolDone} poolTotal={poolGames.length}/>}
        </div>
      </main>

      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 90, padding: "12px 22px", borderRadius: 999, fontWeight: 700, fontSize: 14,
        background: toast.type === "err" ? "#2a1212" : "#10261b", border: `1px solid ${toast.type === "err" ? C.red : C.green}`, color: toast.type === "err" ? "#ff8a80" : "#4fe39a" }}>{toast.message}</div>}
    </div>
  );
}

const Center = ({ children }) => (
  <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center", fontFamily: TH }}>{children}</div>
);

function Login({ onToken }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState(false), [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${SERVER_URL}/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      if (res.ok) { onToken((await res.json()).token); return; }
    } catch {}
    setBusy(false); setErr(true); setPw("");
  };
  return (
    <Center>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=IBM+Plex+Sans+Thai:wght@400;600&display=swap');body{margin:0;background:${C.bg}}`}</style>
      <div style={{ width: 64, height: 64, background: C.orange, color: "#111", display: "grid", placeItems: "center", fontFamily: BC, fontWeight: 800, fontSize: 30, borderRadius: 10, transform: "skewX(-8deg)" }}>3×3</div>
      <span style={big(40, { textTransform: "uppercase" })}>Tournament Admin</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(320px,100%)" }}>
        <input type="password" autoFocus value={pw} onChange={e => { setPw(e.target.value); setErr(false); }} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Admin password" style={{ ...input, textAlign: "center", fontSize: 16 }}/>
        {err && <span style={{ color: "#ff8a80", fontSize: 13 }}>รหัสผ่านไม่ถูกต้อง หรือเชื่อมต่อเซิร์ฟเวอร์ไม่ได้</span>}
        <Btn kind="primary" disabled={!pw || busy} onClick={submit} style={{ minHeight: 52, fontSize: 20 }}>{busy ? "…" : "Login"}</Btn>
        <a href="/" style={{ fontSize: 13, marginTop: 6 }}>← Home</a>
      </div>
    </Center>
  );
}

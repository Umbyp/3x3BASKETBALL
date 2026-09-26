/**
 * TournamentPage v5 — FIBA-style tournament (see lib/tournament.js for the data model)
 * Public: ตารางคะแนน · เกม · Knockout · ทีม
 * Admin:  รุ่น → ทีม + นักกีฬา → แบ่งสาย → ตารางแข่ง, and result corrections.
 * All admin writes go through the server (/admin/*); Firebase is read-only here.
 */
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase.js";
import { ref, onValue } from "firebase/database";
import { useDivisions, findDivision } from "../divisions.js";
import { SERVER_URL } from "../socket.js";
import { isV2, resolvedGames, sideName } from "../lib/tournament.js";
import { StandingsView, GamesView, BracketView, TeamsView } from "../components/tournament/PublicViews.jsx";
import AdminPanel from "../components/tournament/AdminPanel.jsx";
import { Toast } from "../components/tournament/ui.jsx";

async function adminLogin(password) {
  try {
    const res = await fetch(`${SERVER_URL}/admin/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
    });
    if (!res.ok) return null;
    return (await res.json()).token;
  } catch { return null; }
}

function ResultModal({ game, onClose, onSave }) {
  const [h, setH] = useState(game.homeScore ?? "");
  const [a, setA] = useState(game.awayScore ?? "");
  const valid = h !== "" && a !== "" && +h !== +a;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-black text-white tracking-widest text-center mb-4">{game.label}</h3>
        {[["home", h, setH], ["away", a, setA]].map(([side, v, set]) => (
          <div key={side} className="flex items-center gap-3 mb-3">
            <span className="flex-1 text-sm font-bold text-gray-200 truncate">{sideName(game, side)}</span>
            <input type="number" min={0} value={v} onChange={e => set(e.target.value)} autoFocus={side === "home"}
              className="w-20 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-center text-xl font-black text-white outline-none focus:border-orange-500"/>
          </div>
        ))}
        {h !== "" && a !== "" && +h === +a && <p className="text-[11px] text-rose-400 text-center mb-2">3x3 ไม่มีผลเสมอ — ต้องมีผู้ชนะ</p>}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button onClick={() => { if (window.confirm("ล้างผลเกมนี้ กลับเป็นยังไม่แข่ง?")) onSave(null, null, "scheduled"); }}
            className="py-2.5 rounded-xl border border-rose-500/40 text-rose-400 text-xs font-black">ล้างผล</button>
          <button disabled={!valid} onClick={() => onSave(+h, +a, "final")}
            className="py-2.5 rounded-xl bg-white text-black text-xs font-black disabled:opacity-30">บันทึกผล (FINAL)</button>
        </div>
      </div>
    </div>
  );
}

export default function TournamentPage() {
  const [sp, setSp]   = useSearchParams();
  const divisions     = useDivisions();
  const divId         = sp.get("division") || divisions[0].id;
  const divCfg        = findDivision(divisions, divId);
  const fromAdminLink = sp.get("admin") === "1";

  const [tab, setTab]       = useState("standings");
  const [raw, setRaw]       = useState(null);
  const [loading, setLoad]  = useState(true);
  const [token, setToken]   = useState(null);
  const [showLogin, setLogin] = useState(fromAdminLink);
  const [pw, setPw]         = useState("");
  const [loginErr, setLoginErr] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast]   = useState(null);
  const isAdmin = !!token;

  useEffect(() => {
    if (!db) { setLoad(false); return; }
    setLoad(true); setRaw(null);
    return onValue(ref(db, `tournament_data/${divId}`), snap => { setRaw(snap.val()); setLoad(false); },
      () => setLoad(false));
  }, [divId]);

  // Old (pre-v2) data is ignored — the admin sets the division up again
  const data  = isV2(raw) ? raw : null;
  const games = useMemo(() => resolvedGames(data), [data]);
  const real  = games.filter(g => !g.bye);
  const done  = real.filter(g => g.status === "final").length;
  const live  = real.filter(g => g.status === "live").length;
  const prog  = real.length ? Math.round(done / real.length * 100) : 0;

  const adminPost = async (path, body) => {
    try {
      const res = await fetch(`${SERVER_URL}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
      });
      if (res.status === 401) { setToken(null); setLogin(true); setToast({ message: "หมดเวลา login — กรุณาเข้าสู่ระบบใหม่", type: "error" }); return false; }
      if (!res.ok) { const e = await res.json().catch(() => ({})); setToast({ message: `❌ ${e.error || "บันทึกไม่สำเร็จ"}`, type: "error" }); return false; }
      return true;
    } catch { setToast({ message: "❌ เชื่อมต่อ server ไม่ได้", type: "error" }); return false; }
  };
  const save = async partial => {
    const ok = await adminPost(`/admin/tournament/${divId}/save`, partial);
    if (ok) setToast({ message: "✅ บันทึกแล้ว", type: "success" });
    return ok;
  };
  const saveDivisions = async (list, currentRemoved) => {
    const ok = await adminPost(`/admin/divisions`, { divisions: list });
    if (ok) { setToast({ message: "✅ บันทึกรุ่นแล้ว", type: "success" }); if (currentRemoved) setSp({ division: list[0].id }); }
  };
  const saveResult = async (homeScore, awayScore, status) => {
    const ok = await adminPost(`/admin/tournament/${divId}/game/${editing.id}`, { homeScore, awayScore, status });
    if (ok) { setToast({ message: status === "final" ? "✅ บันทึกผลแล้ว" : "🗑️ ล้างผลแล้ว", type: "success" }); setEditing(null); }
  };
  const doLogin = async () => {
    const t = await adminLogin(pw);
    setPw("");
    if (!t) { setLoginErr(true); return; }
    setToken(t); setLogin(false); setLoginErr(false);
    if (fromAdminLink) setTab("admin");
  };
  const logout = () => { setToken(null); if (tab === "admin") setTab("standings"); };

  if (!db) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">⚠️</div>
        <div className="text-xl font-black text-white tracking-widest mb-2">TOURNAMENT SYNC ไม่พร้อมใช้งาน</div>
        <div className="text-sm text-gray-400">ยังไม่ได้ตั้งค่า Firebase (VITE_FIREBASE_* env vars) — หน้านี้ต้องใช้ Firebase เก็บตารางแข่ง/ผลการแข่งขัน</div>
      </div>
    </div>
  );

  const tabs = [["standings", "📊", "Table"], ["games", "📅", "Games"], ["bracket", "⚡", "Bracket"], ["teams", "👥", "Teams"], ...(isAdmin ? [["admin", "⚙️", "Admin"]] : [])];

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <style>{`.animate-fade-in{animation:fade-in .25s ease-out}@keyframes fade-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}</style>

      <header className="pt-10 pb-4 px-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4" style={{ borderColor: divCfg.color + "40", background: divCfg.color + "10" }}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${live ? "bg-red-500" : "bg-green-500"}`}/>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: divCfg.color }}>{live ? `⚡ ${live} LIVE NOW` : "🏀 Live Tournament"}</span>
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter">
          3×3 <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(90deg,${divCfg.color},#FFD700)` }}>{divCfg.label.toUpperCase()}</span>
        </h1>
        <div className="flex gap-2 justify-center flex-wrap mt-3">
          {divisions.map(d => (
            <button key={d.id} onClick={() => setSp({ division: d.id, ...(fromAdminLink ? { admin: "1" } : {}) })}
              className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
              style={{ borderColor: d.id === divId ? d.color + "55" : "rgba(255,255,255,0.1)", color: d.id === divId ? d.color : "rgba(255,255,255,0.3)", background: d.id === divId ? d.color + "18" : "transparent" }}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>
      </header>

      {real.length > 0 && (
        <div className="max-w-xl mx-auto px-4 mb-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5"><span>Progress</span><span>{done}/{real.length} · {prog}%</span></div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${prog}%`, background: `linear-gradient(90deg,${divCfg.color},#FFD700)` }}/>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-20 bg-[#050505]/90 backdrop-blur border-b border-gray-800 mb-5">
        <div className="max-w-xl mx-auto flex">
          {tabs.map(([v, ic, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold tracking-widest uppercase relative ${tab === v ? "text-orange-400" : "text-gray-600 hover:text-gray-400"}`}>
              {tab === v && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-orange-500"/>}
              {ic} <span className="hidden sm:inline">{l}</span>
              {v === "games" && live > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse absolute top-2 right-2"/>}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4">
        {loading ? <div className="text-center text-gray-500 py-16 font-black tracking-widest">LOADING…</div> : <>
          {!data && tab !== "admin" && (
            <div className="text-center text-sm text-gray-500 py-12 border border-dashed border-gray-800 rounded-2xl">
              รุ่นนี้ยังไม่ได้ตั้งค่าทัวร์นาเมนต์{isAdmin ? " — ไปที่แท็บ ⚙️ Admin" : ""}
            </div>
          )}
          {data && tab === "standings" && <StandingsView data={data}/>}
          {data && tab === "games"     && <GamesView games={games} isAdmin={isAdmin} onEdit={setEditing}/>}
          {data && tab === "bracket"   && <BracketView games={games} isAdmin={isAdmin} onEdit={setEditing}/>}
          {data && tab === "teams"     && <TeamsView data={data}/>}
          {isAdmin && tab === "admin"  && (
            <AdminPanel data={data} divCfg={divCfg} divisions={divisions} divId={divId} onSaveDivisions={saveDivisions} save={save}/>
          )}
        </>}
      </main>

      <footer className="text-center py-10">
        <button onClick={() => isAdmin ? logout() : setLogin(true)}
          className={`text-[10px] font-bold uppercase tracking-widest ${isAdmin ? "text-orange-400" : "text-gray-600 hover:text-gray-400"}`}>
          {isAdmin ? "● Admin Mode · Logout" : "Admin"}
        </button>
        <div className="mt-2"><a href="/" className="text-[10px] text-gray-600 hover:text-gray-400">← Home</a></div>
      </footer>

      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => { setLogin(false); setPw(""); setLoginErr(false); }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-72 animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-white tracking-widest text-center mb-4">ADMIN</h3>
            <input type="password" value={pw} onChange={e => { setPw(e.target.value); setLoginErr(false); }} onKeyDown={e => { if (e.key === "Enter") doLogin(); }}
              autoFocus placeholder="Password" className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2.5 text-center text-white outline-none focus:border-orange-500 mb-3"/>
            {loginErr && <p className="text-rose-400 text-[11px] text-center mb-3">รหัสผ่านไม่ถูกต้อง หรือเชื่อมต่อเซิร์ฟเวอร์ไม่ได้</p>}
            <button onClick={doLogin} className="w-full py-2.5 rounded-xl bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-gray-200">Login</button>
          </div>
        </div>
      )}
      {editing && <ResultModal game={editing} onClose={() => setEditing(null)} onSave={saveResult}/>}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase.js";
import { ref, onValue, update, set } from "firebase/database";
import { DIVISIONS, GROUP_COLORS, DEFAULT_TEAMS, KO_TEMPLATE, generateGroupMatches, getDivision } from "../constants.js";

const checkAdmin = pw => pw===(import.meta.env.VITE_ADMIN_PASS||"admin1234");

function calcStandings(teams,matches) {
  if(!teams||!matches) return {};
  const stats={};
  Object.entries(teams).forEach(([g,ts])=>ts.forEach(t=>{stats[t]={team:t,group:g,played:0,wins:0,losses:0,pts:0,pf:0,pa:0};}));
  matches.forEach(m=>{
    if(!m.played||m.round!==1) return;
    const h=stats[m.home],a=stats[m.away]; if(!h||!a) return;
    h.played++;a.played++;h.pf+=m.homeScore;h.pa+=m.awayScore;a.pf+=m.awayScore;a.pa+=m.homeScore;
    if(m.homeScore>m.awayScore){h.wins++;h.pts+=3;a.losses++;a.pts+=1;}
    else if(m.awayScore>m.homeScore){a.wins++;a.pts+=3;h.losses++;h.pts+=1;}
  });
  const grouped={};
  Object.keys(teams).forEach(g=>{grouped[g]=teams[g].map(t=>stats[t]).sort((a,b)=>{
    if(b.pts!==a.pts) return b.pts-a.pts;
    const h2h=matches.find(m=>m.played&&m.round===1&&((m.home===a.team&&m.away===b.team)||(m.home===b.team&&m.away===a.team)));
    if(h2h){const as=h2h.home===a.team?h2h.homeScore:h2h.awayScore,bs=h2h.home===b.team?h2h.homeScore:h2h.awayScore;if(as!==bs)return bs-as;}
    return(b.pf-b.pa)-(a.pf-a.pa);
  });});
  return grouped;
}

function resolveKo(code,standings,resolved) {
  if(!code) return code;
  if(/^[1-4][A-D]$/.test(code)){ const r=parseInt(code[0])-1,g=code[1]; return standings[g]?.[r]?.team||code; }
  if(code.includes("-")){
    const[outcome,label]=code.split("-");
    const m=resolved.find(r=>r.shortLabel===label);
    if(!m||!m.played) return code;
    const hw=m.homeScore>m.awayScore;
    return outcome==="W"?(hw?m.rh:m.ra):(hw?m.ra:m.rh);
  }
  return code;
}

function Avatar({ name, size="md" }) {
  const [err,setErr]=useState(false);
  const init=(name||"?").charAt(0).toUpperCase();
  const grads=["from-orange-600 to-red-800","from-blue-600 to-indigo-800","from-emerald-600 to-teal-800","from-purple-600 to-fuchsia-800","from-amber-500 to-yellow-700"];
  let h=0; for(const c of (name||""))h=c.charCodeAt(0)+((h<<5)-h);
  const sz={sm:"w-8 h-8 text-xs",md:"w-10 h-10 text-sm",lg:"w-14 h-14 text-lg"};
  return (
    <div className={`${sz[size]} rounded-full flex items-center justify-center font-black text-white border border-white/10 shrink-0 overflow-hidden bg-gradient-to-br ${grads[Math.abs(h)%grads.length]}`}>
      {!err?<img src={`/photo/${(name||"").replace(/\s+/g,"_")}.jpg`} alt="" className="w-full h-full object-cover" onError={()=>setErr(true)}/>:<span>{init}</span>}
    </div>
  );
}

function ScoreModal({ match, onClose, onSave }) {
  const [h,setH]=useState(match.homeScore??""),[a,setA]=useState(match.awayScore??"");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 animate-fade-in" onClick={e=>e.stopPropagation()}>
        <h3 className="font-bebas text-lg text-white tracking-widest mb-5 text-center">UPDATE RESULT</h3>
        <div className="flex items-center gap-4 mb-6">
          {[{team:match.rh||match.home,v:h,set:setH,auto:true},{team:match.ra||match.away,v:a,set:setA}].map((t,i)=>(
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <Avatar name={t.team} size="lg" />
              <p className="text-xs text-gray-300 font-bold text-center">{t.team}</p>
              <input type="number" value={t.v} onChange={e=>t.set(e.target.value)} autoFocus={t.auto}
                className="w-16 h-12 bg-gray-800 border border-gray-700 rounded-lg text-center text-2xl font-black text-white outline-none focus:border-orange-500" placeholder="—" />
            </div>
          ))}
        </div>
        <button disabled={h===""||a===""} onClick={()=>{if(h!==""&&a!==""){onSave(match.id,parseInt(h),parseInt(a));onClose();}}}
          className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-black uppercase tracking-widest transition-all">
          Confirm
        </button>
      </div>
    </div>
  );
}

// Standings tab
function Standings({ standings }) {
  return (
    <div className="space-y-5">
      {Object.entries(standings).map(([g,teams])=>{
        const gc=GROUP_COLORS[g]||GROUP_COLORS.A;
        const borderColor=g==="A"?"#f59e0b":g==="B"?"#3b82f6":g==="C"?"#10b981":"#a855f7";
        return (
          <div key={g} className="border rounded-2xl overflow-hidden bg-gray-900" style={{ borderLeftWidth:4,borderLeftColor:borderColor,borderColor:"rgb(31,41,55)" }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-base`} style={{ background:borderColor }}>G{g}</span>
              <span className={`font-black text-sm tracking-widest uppercase ${gc.text}`}>Group {g}</span>
              <span className="ml-auto text-xs text-gray-600">อันดับ 1-2 ผ่านรอบ</span>
            </div>
            <table className="w-full">
              <thead><tr className="bg-gray-950/50 border-b border-gray-800">
                {["#","Team","P","W","L","+/-","PTS"].map(h=><th key={h} className="px-3 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest text-center first:text-left">{h}</th>)}
              </tr></thead>
              <tbody>
                {teams.map((t,i)=>{
                  const diff=t.pf-t.pa,q=i<2;
                  return (
                    <tr key={t.team} className={`border-b border-gray-800/30 last:border-0 ${q?"bg-white/[.015]":""}`}>
                      <td className="px-3 py-2.5"><span className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black ${i===0?"bg-yellow-500 text-black":i===1?"bg-gray-500 text-black":"bg-gray-800 text-gray-600"}`}>{i+1}</span></td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Avatar name={t.team} size="sm"/><div><div className={`text-xs font-bold ${q?"text-white":"text-gray-500"}`}>{t.team}</div>{q&&<div className={`text-[8px] font-black uppercase ${gc.text}`}>✓ Qualified</div>}</div></div></td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500 font-mono">{t.played}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-black text-emerald-400 font-mono">{t.wins}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold text-rose-400 font-mono">{t.losses}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-black font-mono"><span className={diff>0?"text-emerald-400":diff<0?"text-rose-400":"text-gray-600"}>{diff>0?"+":""}{diff}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className={`text-xl font-black font-mono ${q?gc.text:"text-gray-700"}`}>{t.pts}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// Schedule tab
function Schedule({ matches, isAdmin, onEdit, onReset }) {
  const [filter,setFilter]=useState("all");
  const items=matches.filter(m=>filter==="played"?m.played:filter==="pending"?!m.played:true);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[["all","ทั้งหมด"],["pending","รอแข่ง"],["played","จบแล้ว"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${filter===v?"bg-orange-500/15 border-orange-500/30 text-orange-400":"border-gray-800 text-gray-600 hover:text-gray-300"}`}>{l}</button>
        ))}
      </div>
      <div className="space-y-2">
        {items.map(m=>{
          const dh=m.rh||m.home,da=m.ra||m.away,hw=m.played&&m.homeScore>m.awayScore,aw=m.played&&m.awayScore>m.homeScore;
          const gc=m.group?GROUP_COLORS[m.group]:null;
          return (
            <div key={m.id} className={`bg-gray-900 border rounded-xl overflow-hidden border-l-4 ${m.played?"border-l-emerald-600":"border-l-orange-500"}`}>
              <div className="flex items-center justify-between px-3 py-1 border-b border-gray-800/50 bg-gray-950/30">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-700 font-mono">#{m.id}</span>
                  {m.group&&<span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${gc?.bg} ${gc?.text} ${gc?.border}`}>G{m.group}</span>}
                  {m.shortLabel&&!m.group&&<span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase border bg-orange-500/20 text-orange-400 border-orange-500/30">{m.shortLabel}</span>}
                  {m.court&&<span className="text-[9px] text-gray-700">สนาม {m.court}</span>}
                </div>
                <span className={`text-[9px] font-bold ${m.played?"text-emerald-400":"text-gray-700"}`}>{m.played?"✓ จบ":"รอ"}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex items-center gap-2 flex-1"><Avatar name={dh} size="sm"/><span className={`text-xs font-bold ${hw?"text-white":"text-gray-500"}`}>{dh}</span></div>
                <div className="text-center min-w-[56px]">
                  {m.played?<span className="text-white font-black font-mono">{m.homeScore}:{m.awayScore}</span>:<span className="text-gray-700 font-black text-xs">VS</span>}
                  {isAdmin&&<div className="flex gap-1 justify-center mt-0.5">
                    <button onClick={()=>onEdit({...m,rh:dh,ra:da})} className="text-[9px] text-orange-400 font-bold">{m.played?"✏️":"+ Score"}</button>
                    {m.played&&<button onClick={()=>onReset(m.id)} className="text-[9px] text-rose-500 font-bold">✕</button>}
                  </div>}
                </div>
                <div className="flex items-center gap-2 flex-1 justify-end"><span className={`text-xs font-bold ${aw?"text-white":"text-gray-500"}`}>{da}</span><Avatar name={da} size="sm"/></div>
              </div>
            </div>
          );
        })}
        {items.length===0&&<p className="text-center text-gray-700 py-10 text-sm">ไม่มีแมทช์</p>}
      </div>
    </div>
  );
}

// Bracket tab
function Bracket({ koMatches, isAdmin, onEdit, onReset }) {
  const MC = ({m})=>{
    if(!m?.id) return <div className="w-44 h-16 bg-gray-800/40 rounded-xl border border-gray-700/30" />;
    const dh=m.rh||m.home,da=m.ra||m.away,hw=m.played&&m.homeScore>m.awayScore,aw=m.played&&m.awayScore>m.homeScore;
    return (
      <div className="w-44 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
        <div className="px-2.5 py-1 flex justify-between border-b border-gray-800 bg-gray-950/50">
          <span className="text-[9px] font-black text-gray-500 uppercase">{m.shortLabel}</span>
          {m.played&&<span className="w-1.5 h-1.5 rounded-full bg-green-500 self-center" />}
        </div>
        {[{t:dh,s:m.homeScore,w:hw},{t:da,s:m.awayScore,w:aw}].map((r,i)=>(
          <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 ${r.w?"bg-orange-500/10":""} ${i===0?"border-b border-gray-800":""}`}>
            <div className="flex items-center gap-1.5 flex-1 min-w-0"><Avatar name={r.t} size="sm"/><span className={`text-[10px] font-bold truncate ${r.w?"text-white":"text-gray-500"}`}>{r.t}</span></div>
            <span className={`text-xs font-black font-mono ml-1 ${r.w?"text-orange-400":"text-gray-600"}`}>{m.played?r.s:"—"}</span>
          </div>
        ))}
        {isAdmin&&<div className="flex border-t border-gray-800">
          <button onClick={()=>onEdit(m)} className="flex-1 py-1 text-[9px] text-orange-400 hover:bg-orange-500/10 transition-colors font-bold">{m.played?"✏️ Edit":"+ Score"}</button>
          {m.played&&<button onClick={()=>onReset(m.id)} className="px-2.5 py-1 text-[9px] text-rose-500 hover:bg-rose-500/10 border-l border-gray-800 font-bold">✕</button>}
        </div>}
      </div>
    );
  };
  const qf=koMatches.filter(m=>m.round===2),sf=koMatches.filter(m=>m.round===3),fn=koMatches.filter(m=>m.round===4);
  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex items-start gap-8 min-w-max pt-2">
        {qf.length>0&&<div className="flex flex-col gap-4"><p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center">QF</p>{qf.map(m=><MC key={m.id} m={m}/>)}</div>}
        {sf.length>0&&<div className={`flex flex-col gap-4 ${qf.length>0?"mt-8":""}`}><p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center">SF</p>{sf.map(m=><MC key={m.id} m={m}/>)}</div>}
        {fn.length>0&&<div className={`flex flex-col gap-4 ${sf.length>0?"mt-16":""}`}>
          <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center">FINAL</p>
          {fn.filter(m=>m.shortLabel==="FINAL").map(m=>(<div key={m.id}><p className="text-[9px] text-yellow-500 font-black text-center mb-1 animate-pulse-dot">🏆 Final</p><MC m={m}/></div>))}
          {fn.filter(m=>m.shortLabel==="3rd").map(m=>(<div key={m.id} className="opacity-60"><p className="text-[9px] text-gray-600 text-center mb-1">3rd</p><MC m={m}/></div>))}
        </div>}
      </div>
    </div>
  );
}

export default function TournamentPage() {
  const [sp,setSp]=useSearchParams();
  const divId=sp.get("division")||"open";
  const divCfg=getDivision(divId);
  const [tab,setTab]=useState("standings");
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [isAdmin,setAdmin]=useState(false);
  const [showLogin,setShowLogin]=useState(false);
  const [loginPw,setLoginPw]=useState("");
  const [modal,setModal]=useState(null);

  useEffect(()=>{
    setLoading(true);
    const r=ref(db,`tournament_data/${divId}`);
    return onValue(r,snap=>{
      const d=snap.val();
      if(d) setData(d);
      else {
        const teams=DEFAULT_TEAMS[divId]||DEFAULT_TEAMS.open;
        set(ref(db,`tournament_data/${divId}`),{ teams, groupMatches:generateGroupMatches(teams), koMatches:KO_TEMPLATE[divId]||KO_TEMPLATE.open });
      }
      setLoading(false);
    });
  },[divId]);

  const { standings, allMatches, resolvedKo } = useMemo(()=>{
    if(!data) return{standings:{},allMatches:[],resolvedKo:[]};
    const st=calcStandings(data.teams,data.groupMatches||[]);
    const resolved=[];
    for(const m of (data.koMatches||[])){
      const rh=resolveKo(m.home,st,resolved),ra=resolveKo(m.away,st,resolved);
      resolved.push({...m,rh,ra});
    }
    return { standings:st, allMatches:[...(data.groupMatches||[]).map(m=>({...m,rh:m.home,ra:m.away})),...resolved], resolvedKo:resolved };
  },[data]);

  const saveScore=(id,h,a)=>{
    const isG=id<100,arr=isG?data.groupMatches:data.koMatches,idx=arr.findIndex(m=>m.id===id);
    update(ref(db),{
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/homeScore`]:h,
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/awayScore`]:a,
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/played`]:true,
    });
  };
  const resetScore=(id)=>{
    const isG=id<100,arr=isG?data.groupMatches:data.koMatches,idx=arr.findIndex(m=>m.id===id);
    update(ref(db),{
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/homeScore`]:null,
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/awayScore`]:null,
      [`tournament_data/${divId}/${isG?"groupMatches":"koMatches"}/${idx}/played`]:false,
    });
  };

  const played=allMatches.filter(m=>m.played).length;
  const prog=allMatches.length?Math.round(played/allMatches.length*100):0;

  if(loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-center"><div className="text-4xl mb-3" style={{color:divCfg.color}}>{divCfg.icon}</div><div className="font-bebas text-2xl text-white tracking-widest">LOADING...</div></div></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <style>{`.animate-fade-in{animation:fade-in .25s ease-out}@keyframes fade-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}</style>

      <header className="pt-10 pb-4 px-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4" style={{borderColor:divCfg.color+"40",background:divCfg.color+"10"}}>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{color:divCfg.color}}>🏀 Live Tournament</span>
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter">
          3×3 <span className="text-transparent bg-clip-text" style={{backgroundImage:`linear-gradient(90deg,${divCfg.color},#FFD700)`}}>{divCfg.label.toUpperCase()}</span>
        </h1>
        <div className="flex gap-2 justify-center flex-wrap mt-3">
          {DIVISIONS.map(d=>(
            <button key={d.id} onClick={()=>{setSp({division:d.id});setTab("standings");}}
              className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
              style={{borderColor:d.id===divId?d.color+"55":"rgba(255,255,255,0.1)",color:d.id===divId?d.color:"rgba(255,255,255,0.3)",background:d.id===divId?d.color+"18":"transparent"}}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5"><span>Progress</span><span>{played}/{allMatches.length} · {prog}%</span></div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{width:`${prog}%`,background:`linear-gradient(90deg,${divCfg.color},#FFD700)`}} />
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-20 bg-[#050505]/90 backdrop-blur border-b border-gray-800 mb-5">
        <div className="max-w-xl mx-auto flex">
          {[["standings","📊","Table"],["schedule","📅","Matches"],["bracket","⚡","Bracket"]].map(([v,ic,l])=>(
            <button key={v} onClick={()=>setTab(v)} className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold tracking-widest uppercase relative transition-all ${tab===v?"text-orange-400":"text-gray-600 hover:text-gray-400"}`}>
              {tab===v&&<div className="absolute bottom-0 inset-x-0 h-0.5 bg-orange-500"/>}
              {ic} <span className="hidden sm:inline">{l}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4">
        {tab==="standings" && <Standings standings={standings}/>}
        {tab==="schedule"  && <Schedule matches={allMatches} isAdmin={isAdmin} onEdit={setModal} onReset={resetScore}/>}
        {tab==="bracket"   && <Bracket koMatches={resolvedKo} isAdmin={isAdmin} onEdit={setModal} onReset={resetScore}/>}
      </main>

      <footer className="text-center py-10">
        <button onClick={()=>isAdmin?setAdmin(false):setShowLogin(true)}
          className={`text-[10px] font-bold uppercase tracking-widest ${isAdmin?"text-orange-400":"text-gray-800 hover:text-gray-600 transition-colors"}`}>
          {isAdmin?"● Admin Mode":"Admin"}
        </button>
        <div className="mt-2"><a href="/" className="text-[10px] text-gray-800 hover:text-gray-600">← Home</a></div>
      </footer>

      {showLogin&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={()=>setShowLogin(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-72 animate-fade-in" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bebas text-xl text-white tracking-widest text-center mb-4">ADMIN</h3>
            <input type="password" value={loginPw} onChange={e=>setLoginPw(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){if(checkAdmin(loginPw)){setAdmin(true);setShowLogin(false);setLoginPw("");}else setLoginPw("");}}}
              autoFocus placeholder="Password"
              className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2.5 text-center text-white outline-none focus:border-orange-500 transition-colors mb-3"/>
            <button onClick={()=>{if(checkAdmin(loginPw)){setAdmin(true);setShowLogin(false);setLoginPw("");}else setLoginPw("");}}
              className="w-full py-2.5 rounded-xl bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors">Login</button>
          </div>
        </div>
      )}
      {modal&&<ScoreModal match={modal} onClose={()=>setModal(null)} onSave={saveScore}/>}
    </div>
  );
}

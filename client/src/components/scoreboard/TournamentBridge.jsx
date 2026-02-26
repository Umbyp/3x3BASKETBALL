import { useState, useEffect, useMemo } from "react";
import { db } from "../../firebase.js";
import { ref, onValue, update } from "firebase/database";
import { DIVISIONS } from "../../constants.js";

export default function TournamentBridge({ state, send, divisionId, courtId }) {
  const [data,    setData]    = useState(null);
  const [selId,   setSelId]   = useState(null);
  const [status,  setStatus]  = useState(null); // "saving"|"saved"|"live"|"error"
  const [open,    setOpen]    = useState(false);

  const divConfig = DIVISIONS.find(d=>d.id===divisionId)||DIVISIONS[0];

  useEffect(()=>{
    const r = ref(db, `tournament_data/${divisionId}`);
    return onValue(r, snap => { if(snap.val()) setData(snap.val()); });
  },[divisionId]);

  const allMatches = useMemo(()=>{
    if(!data) return [];
    return [...(data.groupMatches||[]), ...(data.koMatches||[])];
  },[data]);

  const sel = useMemo(()=>allMatches.find(m=>m.id===selId)||null,[allMatches,selId]);

  const push = async(finished)=>{
    if(!sel||!data) return;
    setStatus("saving");
    try{
      const isGrp = sel.id < 100;
      const arr   = isGrp ? data.groupMatches : data.koMatches;
      const idx   = arr.findIndex(m=>m.id===sel.id);
      if(idx===-1) throw new Error("not found");
      await update(ref(db),{
        [`tournament_data/${divisionId}/${isGrp?"groupMatches":"koMatches"}/${idx}/homeScore`]: state.teamA.score,
        [`tournament_data/${divisionId}/${isGrp?"groupMatches":"koMatches"}/${idx}/awayScore`]: state.teamB.score,
        [`tournament_data/${divisionId}/${isGrp?"groupMatches":"koMatches"}/${idx}/played`]:    finished,
        [`tournament_data/${divisionId}/${isGrp?"groupMatches":"koMatches"}/${idx}/court`]:     courtId,
      });
      setStatus(finished?"saved":"live");
      setTimeout(()=>setStatus(null),3000);
    }catch(e){ setStatus("error"); }
  };

  // Auto sync on score change
  useEffect(()=>{
    if(!sel) return;
    const t=setTimeout(()=>push(false),800);
    return()=>clearTimeout(t);
  },[state.teamA.score, state.teamB.score, sel?.id]);

  const pickMatch=(id)=>{
    const m=allMatches.find(x=>x.id===id); if(!m) return;
    setSelId(id); setStatus(null);
    send("teamName","teamA",(m.home||"HOME").toUpperCase());
    send("teamName","teamB",(m.away||"AWAY").toUpperCase());
  };

  const S={fontFamily:"'Bebas Neue',Impact,sans-serif"};
  const grpMatches = allMatches.filter(m=>m.round===1);
  const koMatches  = allMatches.filter(m=>m.round>1);

  return(
    <div style={{background:"linear-gradient(160deg,#0d0d20,#08080f)",
      border:`1px solid ${divConfig.color}28`,borderRadius:14,overflow:"hidden",marginBottom:10}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"8px 14px",cursor:"pointer",background:`${divConfig.color}08`,
        borderBottom:open?"1px solid rgba(255,255,255,0.06)":"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14}}>🏆</span>
          <span style={{...S,fontSize:13,letterSpacing:"0.15em",color:divConfig.color}}>TOURNAMENT SYNC · {divConfig.label.toUpperCase()}</span>
          {sel&&<span style={{padding:"1px 6px",borderRadius:20,background:`${divConfig.color}18`,
            border:`1px solid ${divConfig.color}35`,...S,fontSize:9,color:divConfig.color}}>#{sel.id}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {status==="saved"&&<span style={{...S,fontSize:10,color:"#00E87A"}}>✅ จบเกม</span>}
          {status==="live"&&<span style={{...S,fontSize:10,color:"#FFA500"}}>📡 Auto</span>}
          {status==="saving"&&<span style={{...S,fontSize:10,color:"#888"}}>⏳</span>}
          {status==="error"&&<span style={{...S,fontSize:10,color:"#FF5555"}}>❌</span>}
          <span style={{color:"rgba(255,255,255,0.3)",fontSize:11}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&(
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
          <select value={selId||""} onChange={e=>pickMatch(Number(e.target.value))}
            style={{width:"100%",background:"#0a0a15",border:`1px solid ${divConfig.color}35`,
              borderRadius:8,color:selId?divConfig.color:"rgba(255,255,255,0.3)",
              padding:"7px 10px",...S,fontSize:11,outline:"none",cursor:"pointer"}}>
            <option value="">— เลือกนัดที่กำลังแข่ง —</option>
            {grpMatches.length>0&&<optgroup label="รอบกลุ่ม">
              {grpMatches.map(m=><option key={m.id} value={m.id}>#{m.id} {m.home} vs {m.away}{m.played?" ✓":""}</option>)}
            </optgroup>}
            {koMatches.length>0&&<optgroup label="Knockout">
              {koMatches.map(m=><option key={m.id} value={m.id}>{m.shortLabel||"KO"} {m.home} vs {m.away}{m.played?" ✓":""}</option>)}
            </optgroup>}
          </select>
          {sel&&(
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1,padding:"8px 10px",background:"rgba(0,232,122,0.07)",
                border:"1px solid rgba(0,232,122,0.2)",borderRadius:8,fontSize:10,color:"rgba(255,255,255,0.4)"}}>
                <div style={{...S,fontSize:12,color:"#00E87A",marginBottom:2}}>📡 AUTO-SYNC</div>
                {state.teamA.score} — {state.teamB.score}
              </div>
              <button onClick={()=>{if(window.confirm("ยืนยันจบการแข่งขัน?"))push(true);}}
                disabled={sel.played}
                style={{flex:1,padding:"8px 10px",background:sel.played?"rgba(255,255,255,0.03)":"rgba(255,55,55,0.12)",
                  border:`1.5px solid ${sel.played?"rgba(255,255,255,0.06)":"rgba(255,55,55,0.4)"}`,
                  borderRadius:8,color:sel.played?"rgba(255,255,255,0.2)":"#FF5555",
                  cursor:sel.played?"not-allowed":"pointer",...S,fontSize:11,letterSpacing:"0.08em"}}>
                {sel.played?"✅ จบแล้ว":"🏁 จบการแข่งขัน"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

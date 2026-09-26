import { useMemo } from "react";
import { standings, teamMap, groupComplete, gamesOf } from "../../lib/tournament.js";
import { C, card, label, big, Empty, Code, fgFor, teamCode } from "./theme.jsx";
import { GameCard, gameVM } from "./ScheduleScreen.jsx";

export function StandingsScreen({ data }) {
  const st = useMemo(() => standings(data), [data]);
  const tm = teamMap(data);
  const pools = Object.keys(st).sort();
  if (!pools.length) return <Empty title="No pools yet" sub="ยังไม่ได้แบ่งสาย"/>;
  const cols = "30px minmax(0,1fr) 34px 34px 52px 44px";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, color: C.muted, flexWrap: "wrap" }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(255,106,19,.22)", border: `1px solid ${C.orange}` }}/>
        Top 2 per pool advance · 2 อันดับแรกเข้ารอบ. Tiebreak (FIBA 3x3): wins → head-to-head (2 teams) → avg points scored.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(420px,100%),1fr))", gap: 16 }}>
        {pools.map(P => {
          const gs = gamesOf(data).filter(g => g.kind === "group" && g.group === P);
          const played = gs.filter(g => g.status === "final").length, complete = groupComplete(data, P);
          return (
            <div key={P} style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={big(30, { textTransform: "uppercase" })}>Pool {P}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: complete ? C.orange : C.muted }}>{complete ? "Complete · จบรอบ" : `${played} of ${gs.length} played`}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6, ...label, letterSpacing: ".1em", padding: "4px 8px" }}>
                <span>#</span><span>Team</span><span style={{ textAlign: "center" }}>W</span><span style={{ textAlign: "center" }}>L</span><span style={{ textAlign: "center" }}>Win%</span><span style={{ textAlign: "right" }}>PTS</span>
              </div>
              {st[P].map((r, i) => {
                const q = i < 2, t = tm[r.id];
                return (
                  <div key={r.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center", padding: 8, borderRadius: 10, minHeight: 48,
                    background: q ? "rgba(255,106,19,.14)" : "transparent", border: `1px solid ${q ? "rgba(255,106,19,.45)" : "transparent"}` }}>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", ...big(16), background: q ? C.orange : C.line2, color: q ? "#111" : C.muted }}>{i + 1}</span>
                    <span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                      <Code team={t} size={15} w={46}/>
                      <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t?.name}</span>
                      {q && <span style={{ fontSize: 10, fontWeight: 800, color: C.orange }}>{complete ? "Q" : "PROJ"}</span>}
                    </span>
                    <span style={big(22, { textAlign: "center" })}>{r.wins}</span>
                    <span style={big(22, { textAlign: "center", fontWeight: 700, color: C.muted })}>{r.losses}</span>
                    <span style={big(20, { textAlign: "center", fontWeight: 700 })}>{r.played ? `${Math.round(r.wins / r.played * 100)}%` : "—"}</span>
                    <span style={big(22, { textAlign: "right" })}>{r.pf}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ROUND_TITLES = { R16: ["Round of 16", "รอบ 16 ทีม"], QF: ["Quarterfinals", "รอบ 8 ทีม"], SF: ["Semifinals", "รองชนะเลิศ"], FINAL: ["Final", "ชิงชนะเลิศ"] };

export function KnockoutScreen({ data, games, divId, courtStates, loadToCourt, poolDone, poolTotal }) {
  const ko = games.filter(g => g.kind === "ko");
  if (!ko.length) return <Empty title="No knockout yet" sub="ต้องมีอย่างน้อย 2 กลุ่ม และยืนยันสายก่อน"/>;
  const rounds = [...new Set(ko.filter(g => g.label !== "3rd").map(g => g.round))].sort((a, b) => a - b);
  const cols = rounds.map(r => {
    const ms = ko.filter(g => g.round === r && g.label !== "3rd");
    const key = ms.some(g => g.label === "FINAL") ? "FINAL" : ms[0].stage;
    return { title: ROUND_TITLES[key] || [key, ""], matches: ms };
  });
  const bronze = ko.filter(g => g.label === "3rd");
  const fin = ko.find(g => g.label === "FINAL");
  const champ = fin?.status === "final" ? (fin.homeScore > fin.awayScore ? fin.homeTeam : fin.awayTeam) : null;
  const card_ = g => <GameCard key={g.id} g={g} vm={gameVM(g, courtStates, divId)} onLoad={() => loadToCourt(g)} compact/>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <span style={{ fontSize: 13, color: C.muted }}>Pool stage: {poolDone}/{poolTotal} games final. Qualified teams fill the bracket automatically when each pool finishes · ทีมเข้ารอบจะไหลเข้าสายอัตโนมัติ</span>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length + 1},minmax(220px,1fr))`, gap: 22, minWidth: (cols.length + 1) * 240 }}>
          {cols.map(col => (
            <div key={col.title[0]} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Head en={col.title[0]} th={col.title[1]}/>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", flex: 1, minHeight: Math.max(300, cols[0].matches.length * 150), gap: 14 }}>
                {col.matches.map(card_)}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Head en="Champion" th="แชมป์"/>
            <div style={{ borderRadius: 16, padding: 22, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start",
              background: champ?.color || C.inner, color: champ ? fgFor(champ.color) : C.muted, marginTop: 40 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase" }}>Winner · ผู้ชนะ</span>
              <span style={big(64, { lineHeight: .9 })}>{champ ? teamCode(champ) : "TBD"}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{champ ? champ.name : "รอผลนัดชิง"}</span>
            </div>
            {bronze.length > 0 && <>
              <div style={{ marginTop: 24 }}><Head en="3rd place" th="ชิงอันดับ 3"/></div>
              {bronze.map(card_)}
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}

const Head = ({ en, th }) => (
  <div style={{ display: "flex", flexDirection: "column", borderBottom: `2px solid ${C.line2}`, paddingBottom: 8 }}>
    <span style={big(22, { textTransform: "uppercase" })}>{en}</span>
    <span style={{ fontSize: 12, color: C.muted }}>{th}</span>
  </div>
);

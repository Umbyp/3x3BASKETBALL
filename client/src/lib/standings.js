/**
 * Pure standings / knockout resolution shared by the Tournament page and the
 * Scoreboard's tournament bridge (so both show the same team names).
 */

// ── H2H Tiebreaker 3+ ทีม ────────────────────────────────────────────────────
function breakTie(tiedTeams, allMatches) {
  if (tiedTeams.length <= 1) return tiedTeams;
  const h2h = {}, tiedSet = new Set(tiedTeams.map(t => t.team));
  tiedTeams.forEach(t => { h2h[t.team] = { pts:0, pf:0, pa:0 }; });
  allMatches.forEach(m => {
    if (!m.played || m.round !== 1 || !tiedSet.has(m.home) || !tiedSet.has(m.away)) return;
    h2h[m.home].pf += m.homeScore; h2h[m.home].pa += m.awayScore;
    h2h[m.away].pf += m.awayScore; h2h[m.away].pa += m.homeScore;
    const forfeitH = m.homeScore===0 && m.awayScore===20;
    const forfeitA = m.awayScore===0 && m.homeScore===20;
    if      (m.homeScore > m.awayScore) { h2h[m.home].pts+=3; h2h[m.away].pts+=forfeitH?0:1; }
    else if (m.awayScore > m.homeScore) { h2h[m.away].pts+=3; h2h[m.home].pts+=forfeitA?0:1; }
  });
  return [...tiedTeams].sort((a, b) => {
    const ha = h2h[a.team], hb = h2h[b.team];
    if (hb.pts !== ha.pts) return hb.pts - ha.pts;
    const dA = ha.pf-ha.pa, dB = hb.pf-hb.pa;
    if (dA !== dB) return dB - dA;
    return (b.pf-b.pa) - (a.pf-a.pa);
  });
}

export function calcStandings(teams, matches) {
  if (!teams || !matches) return {};
  const stats = {};
  Object.entries(teams).forEach(([g, ts]) => ts.forEach(t => {
    stats[t] = { team:t, group:g, played:0, wins:0, losses:0, pts:0, pf:0, pa:0 };
  }));
  matches.forEach(m => {
    if (!m.played || m.round !== 1) return;
    const h = stats[m.home], a = stats[m.away]; if (!h||!a) return;
    h.played++; a.played++; h.pf+=m.homeScore; h.pa+=m.awayScore;
    a.pf+=m.awayScore; a.pa+=m.homeScore;
    const forfeitH = m.homeScore===0 && m.awayScore===20;
    const forfeitA = m.awayScore===0 && m.homeScore===20;
    if      (m.homeScore > m.awayScore) { h.wins++; h.pts+=3; a.losses++; a.pts+=forfeitH?0:1; }
    else if (m.awayScore > m.homeScore) { a.wins++; a.pts+=3; h.losses++; h.pts+=forfeitA?0:1; }
  });
  const grouped = {};
  Object.keys(teams).forEach(g => {
    const sorted = [...teams[g].map(t=>stats[t])].sort((a,b)=>b.pts-a.pts);
    const result = []; let i = 0;
    while (i < sorted.length) {
      let j = i+1;
      while (j < sorted.length && sorted[j].pts === sorted[i].pts) j++;
      result.push(...breakTie(sorted.slice(i,j), matches));
      i = j;
    }
    grouped[g] = result;
  });
  return grouped;
}

export function resolveKo(code, standings, resolved) {
  if (!code) return code;
  const rankMatch = /^([12])(.+)$/.exec(code);
  if (rankMatch) {
    const r = parseInt(rankMatch[1])-1, g = rankMatch[2];
    return standings[g]?.[r]?.team || code;
  }
  if (code.includes("-")) {
    const [outcome, label] = code.split("-");
    const m = resolved.find(r => r.shortLabel === label);
    if (!m || !m.played) return code;
    const hw = m.homeScore > m.awayScore;
    return outcome==="W" ? (hw?m.rh:m.ra) : (hw?m.ra:m.rh);
  }
  return code;
}

/**
 * Group matches as-is + knockout matches with rh/ra resolved to real team names.
 * `strict`: a group-rank slot ("1A") only resolves once every match in that
 * group is played — the operator must never start a knockout game with a
 * provisional qualifier.
 */
export function resolveTournament(data, { strict = false } = {}) {
  if (!data) return { standings: {}, groupMatches: [], koMatches: [] };
  const gm = data.groupMatches || [];
  const standings = calcStandings(data.teams, gm);
  const groupDone = g => gm.filter(m => m.group === g).every(m => m.played);
  const res = (code, done) => {
    const rank = /^([12])(.+)$/.exec(code || "");
    if (strict && rank && !groupDone(rank[2])) return code;
    return resolveKo(code, standings, done);
  };
  const koMatches = [];
  for (const m of (data.koMatches || [])) koMatches.push({ ...m, rh: res(m.home, koMatches), ra: res(m.away, koMatches) });
  return { standings, groupMatches: (data.groupMatches || []).map(m => ({ ...m, rh: m.home, ra: m.away })), koMatches };
}

/** A knockout slot that hasn't resolved to a team yet ("1A", "W-SF1") */
export const isPendingSlot = name => !name || /^[12][A-Z]+$/.test(name) || /^[WL]-/.test(name);

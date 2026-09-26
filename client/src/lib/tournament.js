/**
 * Tournament model (v2) — FIBA-style single source of truth, shared by the
 * Tournament page, the Scoreboard bridge and the server. Pure, no Firebase/React.
 *
 * tournament_data/{division} = {
 *   version: 2,
 *   teams:  [{ id, name, short, color, logo, roster: [{ no, name }] }]   // array order = seed
 *   groups: { A: [teamId, …], B: [...] },
 *   games:  [{ id, kind: "group"|"ko", group?, round, label, home, away,
 *              court, time: "YYYY-MM-DDTHH:MM", homeScore, awayScore,
 *              status: "scheduled"|"live"|"final", bye? }]
 *   schedule: { date, start, slotMinutes, courts: ["A","B"] }
 * }
 * Group games reference team ids. Knockout games reference slot codes —
 * "1A" (winner of group A), "2B", "W-SF1" / "L-SF1" — resolved at read time.
 */
import { generateKoBracket } from "./bracketGen.js";

export const newId = prefix => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const isV2 = data => data?.version === 2;
export const teamMap = data => Object.fromEntries((data?.teams || []).map(t => [t.id, t]));
export const gamesOf = data => (Array.isArray(data?.games) ? data.games : Object.values(data?.games || {})).filter(Boolean);

// ── Round robin (circle method) ────────────────────────────────────────────────
/** @returns {Array<Array<[string,string]>>} rounds of pairings; odd counts get a bye each round */
export function roundRobin(ids) {
  const list = [...ids];
  if (list.length % 2) list.push(null);
  const n = list.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()); // rotate everyone except the first
  }
  return rounds;
}

/** Group games (round robin) + knockout bracket, unscheduled. */
export function buildGames(groups) {
  const games = [];
  let n = 0;
  Object.keys(groups).sort().forEach(g => {
    roundRobin(groups[g]).forEach((pairs, r) => pairs.forEach(([home, away]) => {
      games.push({ id: `g${++n}`, kind: "group", group: g, round: r + 1, label: `Group ${g} · R${r + 1}`,
        home, away, court: "", time: "", homeScore: null, awayScore: null, status: "scheduled" });
    }));
  });
  // bracketGen only looks at group keys — slot codes "1A"/"2B" feed the bracket
  generateKoBracket(Object.fromEntries(Object.keys(groups).map(g => [g, []]))).forEach(m => {
    games.push({ id: `k${m.shortLabel}`, kind: "ko", round: m.round, label: m.shortLabel, stage: m.stageLabel,
      home: m.home, away: m.away, court: "", time: "", homeScore: m.homeScore, awayScore: m.awayScore,
      status: m.played ? "final" : "scheduled", ...(m.away == null ? { bye: true } : {}) });
  });
  return games;
}

// ── Scheduling ─────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, "0");
export function slotTime(date, start, minutesFromStart) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = start.split(":").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi) + minutesFromStart * 60000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/**
 * Assigns time + court to every game. Group games are interleaved across
 * groups round by round, filling all courts each slot while avoiding a team
 * playing two slots in a row when another game can go instead. Each knockout
 * round starts in a fresh slot after the previous one.
 */
export function scheduleGames(games, { date, start, slotMinutes, courts }) {
  const C = Math.max(1, courts.length);
  const out = games.map(g => ({ ...g }));
  const queue = out.filter(g => g.kind === "group").sort((a, b) => a.round - b.round || a.group.localeCompare(b.group));
  let slot = 0, prevTeams = new Set();
  while (queue.length) {
    const now = [], busy = new Set();
    const fits = (g, strict) => !busy.has(g.home) && !busy.has(g.away) && (!strict || (!prevTeams.has(g.home) && !prevTeams.has(g.away)));
    for (const strict of [true, false]) {
      for (let i = 0; i < queue.length && now.length < C; i++) {
        if (fits(queue[i], strict)) { const [g] = queue.splice(i, 1); busy.add(g.home); busy.add(g.away); now.push(g); i--; }
      }
    }
    now.forEach((g, i) => { g.time = slotTime(date, start, slot * slotMinutes); g.court = courts[i] || ""; });
    prevTeams = busy; slot++;
  }
  const koRounds = [...new Set(out.filter(g => g.kind === "ko" && !g.bye).map(g => g.round))].sort((a, b) => a - b);
  koRounds.forEach(r => {
    // 3rd-place game goes before the final in the same round
    const games_ = out.filter(g => g.kind === "ko" && !g.bye && g.round === r).sort((a, b) => (b.label === "3rd") - (a.label === "3rd"));
    for (let i = 0; i < games_.length; i++) {
      if (i && i % C === 0) slot++;
      games_[i].time = slotTime(date, start, slot * slotMinutes); games_[i].court = courts[i % C] || "";
    }
    slot++;
  });
  return out;
}

// ── Standings (FIBA 3x3) ───────────────────────────────────────────────────────
// 1) wins  2) head-to-head when exactly two teams are tied  3) average points
// scored per game  4) seed. Forfeit losses score 0 for the team that forfeited.
export function standings(data) {
  const games = gamesOf(data).filter(g => g.kind === "group");
  const seed = Object.fromEntries((data?.teams || []).map((t, i) => [t.id, i]));
  const out = {};
  Object.entries(data?.groups || {}).forEach(([g, ids]) => {
    const rows = Object.fromEntries((ids || []).map(id => [id, { id, played: 0, wins: 0, losses: 0, pf: 0, pa: 0 }]));
    const gg = games.filter(m => m.group === g && m.status === "final");
    gg.forEach(m => {
      const h = rows[m.home], a = rows[m.away]; if (!h || !a) return;
      h.played++; a.played++; h.pf += m.homeScore; h.pa += m.awayScore; a.pf += m.awayScore; a.pa += m.homeScore;
      if (m.homeScore > m.awayScore) { h.wins++; a.losses++; } else if (m.awayScore > m.homeScore) { a.wins++; h.losses++; }
    });
    const list = Object.values(rows).map(r => ({ ...r, avg: r.played ? r.pf / r.played : 0 }));
    const h2h = (x, y) => {
      const m = gg.find(m => (m.home === x.id && m.away === y.id) || (m.home === y.id && m.away === x.id));
      if (!m) return 0;
      const xWon = (m.home === x.id) === (m.homeScore > m.awayScore);
      return xWon ? -1 : 1;
    };
    list.sort((x, y) => y.wins - x.wins);
    const sorted = [];
    for (let i = 0; i < list.length;) {
      let j = i + 1; while (j < list.length && list[j].wins === list[i].wins) j++;
      const tied = list.slice(i, j);
      tied.sort((x, y) => (tied.length === 2 && h2h(x, y)) || (y.avg - x.avg) || (seed[x.id] - seed[y.id]));
      sorted.push(...tied); i = j;
    }
    out[g] = sorted;
  });
  return out;
}

export const groupComplete = (data, g) => {
  const gg = gamesOf(data).filter(m => m.kind === "group" && m.group === g);
  return gg.length > 0 && gg.every(m => m.status === "final");
};

/**
 * Resolves a game side to a team id, or null while it's still undecided.
 * Slot codes only resolve once their source is final — nobody starts a
 * knockout game with a provisional qualifier.
 */
export function resolveSide(data, code, st = standings(data)) {
  if (!code) return null;
  if (teamMap(data)[code]) return code;
  const rank = /^([12])([A-Z]+)$/.exec(code);
  if (rank) return groupComplete(data, rank[2]) ? st[rank[2]]?.[+rank[1] - 1]?.id ?? null : null;
  const ref = /^([WL])-(.+)$/.exec(code);
  if (ref) {
    const src = gamesOf(data).find(g => g.kind === "ko" && g.label === ref[2]);
    if (!src || src.status !== "final") return null;
    const h = resolveSide(data, src.home, st), a = src.bye ? null : resolveSide(data, src.away, st);
    if (src.bye) return ref[1] === "W" ? h : null;
    const homeWon = src.homeScore > src.awayScore;
    return ref[1] === "W" ? (homeWon ? h : a) : (homeWon ? a : h);
  }
  return null;
}

/** Human label for an unresolved slot code. */
export function slotLabel(code) {
  const rank = /^([12])([A-Z]+)$/.exec(code || "");
  if (rank) return `อันดับ ${rank[1]} กลุ่ม ${rank[2]}`;
  const ref = /^([WL])-(.+)$/.exec(code || "");
  if (ref) return `${ref[1] === "W" ? "ผู้ชนะ" : "ผู้แพ้"} ${ref[2]}`;
  return code || "—";
}

/** Games with resolved team objects attached: { ...game, homeTeam, awayTeam } (null = undecided). */
export function resolvedGames(data) {
  const st = standings(data), tm = teamMap(data);
  return gamesOf(data).map(g => {
    const h = resolveSide(data, g.home, st), a = g.bye ? null : resolveSide(data, g.away, st);
    return { ...g, homeTeam: h ? tm[h] : null, awayTeam: a ? tm[a] : null };
  });
}

export const sideName = (g, side) => (side === "home" ? g.homeTeam : g.awayTeam)?.name || slotLabel(side === "home" ? g.home : g.away);

/** "2026-10-01T10:00" → { date: "1 ต.ค.", time: "10:00" } */
const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
export function fmtWhen(iso) {
  if (!iso) return { date: "", time: "" };
  const [d, t] = iso.split("T"); const [, m, dd] = d.split("-").map(Number);
  return { date: `${dd} ${TH_MONTHS[m - 1]}`, time: t || "" };
}

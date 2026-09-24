/**
 * Pure, framework-free knockout-bracket generation.
 * Given a `teams` config ({ groupLetter: [teamNames] }), auto-generates a
 * single-elimination Knockout bracket referencing group standings by
 * slot-code ("1A","2C", same convention TournamentPage.jsx already resolves
 * at render time), including byes when the qualifier count isn't a clean
 * power of 2. No Firebase/React dependency — safe to unit test standalone.
 *
 * Convention: top 2 finishers of every group qualify. Bracket size is
 * therefore driven only by the number of groups (qualifiers = 2 * groups),
 * padded up to the next power of 2 with byes handed to the best seeds.
 */

export function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Standard recursive single-elim seeding order, e.g. seedOrder(8) => [1,8,4,5,2,7,3,6]. */
export function seedOrder(n) {
  let seeds = [1];
  while (seeds.length < n) {
    const m = seeds.length * 2;
    const next = [];
    seeds.forEach(s => { next.push(s); next.push(m + 1 - s); });
    seeds = next;
  }
  return seeds;
}

const STAGE_NAMES = { 2:"SF", 4:"QF", 8:"R16", 16:"R32", 32:"R64" };
const stageNameForRound = matchesInRound => STAGE_NAMES[matchesInRound] || `R${matchesInRound*2}`;

/**
 * @param {Record<string,string[]>} teams
 * @returns {Array} KO match objects, same shape as the old hand-written KO_TEMPLATE:
 *   { id, round, shortLabel, stageLabel, home, away, homeScore, awayScore, played }
 *   `home`/`away` hold slot-codes ("1A") or back-references ("W-SF1") — resolved
 *   to real team names later by TournamentPage.jsx's resolveKo, unchanged.
 *   A bye is represented as a pre-played match with `away:null` so the existing
 *   win/loss resolution logic picks the qualifying side up automatically.
 */
export function generateKoBracket(teams) {
  const groups = Object.keys(teams || {}).sort();
  const G = groups.length;
  if (G < 2) return []; // not enough groups for a knockout stage

  // Rank-1 finishers first (best seeds), then rank-2 finishers with the group
  // order rotated so a rank-2 seed never faces its own group's rank-1 in round 1.
  const rank1 = groups.map(g => `1${g}`);
  const offset = Math.max(1, Math.floor(G / 2));
  const rank2 = groups.map((_, i) => `2${groups[(i + offset) % G]}`);
  const qualifiers = [...rank1, ...rank2];
  const Q = qualifiers.length;

  const bracketSize = nextPowerOf2(Q);
  const order = seedOrder(bracketSize);
  const seedCode = seed => (seed <= Q ? qualifiers[seed - 1] : null); // null = phantom/bye

  // Build round-1 pairs from the seed order, then repair any same-group
  // real-vs-real pairing (the rotation above avoids most cases, but a few
  // small/edge group counts — e.g. exactly 2 groups — can still clash) by
  // swapping with another pair until no same-group pair remains.
  const groupOf = code => code.slice(1);
  const numPairs = bracketSize / 2;
  const pairs = [];
  for (let i = 0; i < numPairs; i++) pairs.push([seedCode(order[2*i]), seedCode(order[2*i+1])]);
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    if (a == null || b == null || groupOf(a) !== groupOf(b)) continue;
    for (let j = 0; j < pairs.length; j++) {
      if (j === i) continue;
      const [c, d] = pairs[j];
      if (c != null && groupOf(a) !== groupOf(c) && (d == null || groupOf(b) !== groupOf(d))) {
        pairs[i] = [a, c]; pairs[j] = [d, b]; break;
      }
      if (d != null && groupOf(a) !== groupOf(d) && (c == null || groupOf(b) !== groupOf(c))) {
        pairs[i] = [a, d]; pairs[j] = [c, b]; break;
      }
    }
  }

  const totalRounds = Math.log2(bracketSize);
  const matches = [];
  let nextId = 1000;
  let inputs = pairs.flat();
  let semiLosers = null;

  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound = inputs.length / 2;
    const isFinalRound = matchesInRound === 1;
    const isSemiRound = matchesInRound === 2;
    const stage = isFinalRound ? "FINAL" : stageNameForRound(matchesInRound);
    const winners = [], losers = [];

    for (let i = 0; i < matchesInRound; i++) {
      const home = inputs[2*i], away = inputs[2*i+1];
      const isBye = home == null || away == null;
      const label = isFinalRound ? "FINAL" : `${stage}${i+1}`;
      matches.push({
        id: nextId++, round: r+1, shortLabel: label, stageLabel: stage,
        home: home ?? away, away: isBye ? null : away,
        homeScore: isBye ? 1 : null, awayScore: isBye ? 0 : null, played: isBye,
      });
      winners.push(`W-${label}`);
      losers.push(`L-${label}`);
    }

    if (isSemiRound) semiLosers = losers;
    inputs = winners;
  }

  if (semiLosers && semiLosers.length === 2) {
    const finalMatch = matches.find(m => m.shortLabel === "FINAL");
    matches.push({
      id: nextId++, round: finalMatch ? finalMatch.round : totalRounds+1,
      shortLabel: "3rd", stageLabel: "3rd",
      home: semiLosers[0], away: semiLosers[1],
      homeScore: null, awayScore: null, played: false,
    });
  }

  return matches;
}

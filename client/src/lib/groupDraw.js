/**
 * Pure, framework-free group draw helpers (FIBA-style).
 *
 * Teams come in as a single list ordered by seed (index 0 = strongest).
 * Groups are filled in serpentine ("snake") order — A,B,C,D,D,C,B,A,A,B,… —
 * which keeps group sizes within one of each other and spreads the seeds so
 * no two of the top `groupCount` seeds ever share a group.
 */

export const groupLetters = count =>
  Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));

/** Group index (0-based) for the i-th slot of a serpentine fill across G groups. */
export function snakeGroupIndex(i, G) {
  const pass = Math.floor(i / G), pos = i % G;
  return pass % 2 === 0 ? pos : G - 1 - pos;
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Seeded random draw: the first `seedCount` teams keep their ranked snake
 * positions; everyone else is shuffled into the remaining slots.
 * @param {string[]} teams  ordered by seed
 * @param {number} groupCount
 * @param {number} seedCount  0 = fully random
 * @param {() => number} rng  injectable for tests
 * @returns {Record<string,string[]>} e.g. { A:[...], B:[...] }
 */
export function drawGroups(teams, groupCount, seedCount = groupCount, rng = Math.random) {
  const letters = groupLetters(groupCount);
  const out = Object.fromEntries(letters.map(l => [l, []]));
  const seeds = teams.slice(0, seedCount);
  const rest = shuffle(teams.slice(seedCount), rng);
  [...seeds, ...rest].forEach((t, i) => out[letters[snakeGroupIndex(i, groupCount)]].push(t));
  return out;
}

/** { team: "A" } assignment map → { A:[...], B:[...] }, keeping `teams` order within a group. */
export function assignmentToGroups(teams, assignment, groupCount) {
  const out = Object.fromEntries(groupLetters(groupCount).map(l => [l, []]));
  teams.forEach(t => { const g = assignment[t]; if (out[g]) out[g].push(t); });
  return out;
}

/** { A:[...], B:[...] } → { team: "A" } */
export function groupsToAssignment(groups) {
  const a = {};
  Object.entries(groups || {}).forEach(([g, ts]) => (ts || []).forEach(t => { a[t] = g; }));
  return a;
}

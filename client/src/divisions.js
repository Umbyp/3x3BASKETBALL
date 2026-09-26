/**
 * Divisions (รุ่นการแข่งขัน) — admin-editable list stored at Firebase
 * `tournament_divisions` (written only by the server's Admin SDK, see
 * POST /admin/divisions). Falls back to the built-in DIVISIONS constant
 * when Firebase isn't configured, the path is empty, or reads are denied,
 * so every page keeps working before the first admin edit.
 */
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "./firebase.js";
import { DIVISIONS } from "./constants.js";

function normalize(val) {
  const list = Array.isArray(val) ? val : Object.values(val || {});
  return list.filter(d => d && typeof d.id === "string" && d.id);
}

export function useDivisions() {
  const [divisions, setDivisions] = useState(DIVISIONS);
  useEffect(() => {
    if (!db) return;
    return onValue(ref(db, "tournament_divisions"),
      snap => { const l = normalize(snap.val()); setDivisions(l.length ? l : DIVISIONS); },
      () => setDivisions(DIVISIONS));
  }, []);
  return divisions;
}

/** Look up a division by id; unknown ids get a neutral placeholder instead of silently becoming another division. */
export function findDivision(divisions, id) {
  return divisions.find(d => d.id === id)
    || (id ? { id, label: id, color: "#8a91a6", icon: "🏀" } : divisions[0] || DIVISIONS[0]);
}

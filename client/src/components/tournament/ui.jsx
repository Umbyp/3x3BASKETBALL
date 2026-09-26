import { useState } from "react";

export const GROUP_PALETTE = ["#f59e0b","#3b82f6","#10b981","#a855f7","#ec4899","#14b8a6","#eab308","#f43f5e"];
export const groupColor = g => GROUP_PALETTE[(g || "A").charCodeAt(0) - 65] || GROUP_PALETTE[0];

/** Team logo if set, otherwise a colour disc with the short name. */
export function TeamBadge({ team, size = 28 }) {
  const [err, setErr] = useState(false);
  const color = team?.color || "#4b5563";
  const txt = (team?.short || team?.name || "?").slice(0, 3);
  return (
    <span className="shrink-0 rounded-full flex items-center justify-center font-black overflow-hidden border border-white/10"
      style={{ width: size, height: size, background: color, color: "#000", fontSize: size * 0.34 }}>
      {team?.logo && !err ? <img src={team.logo} alt="" className="w-full h-full object-cover bg-white" onError={() => setErr(true)}/> : txt}
    </span>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-3 py-2 rounded-lg text-xs font-black border ${v === value ? "bg-orange-500/15 border-orange-500 text-orange-400" : "bg-gray-800 border-gray-700 text-gray-400"}`}>{l}</button>
      ))}
    </div>
  );
}

export const Empty = ({ children }) => (
  <div className="text-center text-sm text-gray-500 py-12 border border-dashed border-gray-800 rounded-2xl">{children}</div>
);

import { useState, useEffect } from "react";

export const GROUP_PALETTE = ["#f59e0b","#3b82f6","#10b981","#a855f7","#ec4899","#14b8a6","#eab308","#f43f5e"];
export const groupColor = g => GROUP_PALETTE[(g || "A").charCodeAt(0) - 65] || GROUP_PALETTE[0];

export const card     = "bg-gray-900 border border-gray-800 rounded-2xl p-4";
export const h2       = "font-black text-white tracking-widest text-sm";
export const inputCls = "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500";
export const iconBtn  = "px-2.5 rounded-lg bg-gray-800 border border-gray-700 text-xs font-bold disabled:opacity-25";
export const primaryBtn = "w-full py-3 rounded-xl text-white text-sm font-black tracking-widest disabled:opacity-30 transition-colors";

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

export function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  const s = { success: "bg-emerald-500/10 border-emerald-500/50 text-emerald-400", error: "bg-rose-500/10 border-rose-500/50 text-rose-400", info: "bg-blue-500/10 border-blue-500/50 text-blue-400" };
  return <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full border text-sm font-bold shadow-2xl animate-fade-in ${s[type]}`}>{message}</div>;
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

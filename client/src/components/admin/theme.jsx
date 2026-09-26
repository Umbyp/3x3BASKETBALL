/**
 * Tournament Admin design tokens + small shared pieces
 * (from the "Tournament Admin" Claude Design file).
 */
export const C = {
  bg: "#0D0D0F", side: "#0A0A0B", card: "#16161A", inner: "#1E1E23", inner2: "#1B1B20",
  line: "#1F1F24", line2: "#26262C", line3: "#3A3A42",
  text: "#F4F2EE", muted: "#9A98A0", dim: "#6E6C74", soft: "#C9C6C0",
  orange: "#FF6A13", yellow: "#FFD000", red: "#FF3B30", green: "#16C47F",
};
export const BC = "'Barlow Condensed',sans-serif";
export const TH = "'IBM Plex Sans Thai',sans-serif";

export const fgFor = hex => {
  const n = parseInt((hex || "#888888").slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#FFFFFF";
};
export const teamCode = t => (t?.short || t?.name || "?").slice(0, 4).toUpperCase();
/** FIBA 3x3 team points = sum of the top 3 players' ranking points */
export const teamPoints = t => (t?.roster || []).map(p => +p.pts || 0).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);

export const card = { background: C.card, border: `1px solid ${C.line2}`, borderRadius: 16 };
export const label = { fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted, fontWeight: 600 };
export const big = (size, extra) => ({ fontFamily: BC, fontWeight: 800, fontSize: size, lineHeight: 1, ...extra });
export const input = {
  background: C.inner, border: `1px solid ${C.line3}`, borderRadius: 10, color: C.text, padding: "10px 12px",
  fontSize: 14, fontFamily: TH, outline: "none", minHeight: 44, width: "100%",
};

export function Btn({ kind = "ghost", children, style, ...p }) {
  const k = {
    primary: { border: "none", background: C.orange, color: "#111", fontFamily: BC, fontWeight: 800, fontSize: 18, textTransform: "uppercase" },
    ghost:   { border: `1px solid ${C.line3}`, background: "transparent", color: C.text, fontSize: 14, fontWeight: 600 },
    dark:    { border: `1px solid ${C.line3}`, background: C.inner, color: C.text, fontSize: 14, fontWeight: 600 },
    danger:  { border: `1px solid ${C.red}66`, background: "transparent", color: "#ff7b73", fontSize: 14, fontWeight: 600 },
  }[kind];
  return <button {...p} style={{ borderRadius: 12, minHeight: 48, padding: "0 18px", opacity: p.disabled ? .4 : 1, cursor: p.disabled ? "default" : "pointer", ...k, ...style }}>{children}</button>;
}

/** Coloured team code chip */
export function Code({ team, size = 16, w = 48, placeholder }) {
  const color = team?.color || C.line2, fg = team ? fgFor(team.color) : C.muted;
  return (
    <span style={{ background: color, color: fg, fontFamily: BC, fontWeight: 800, fontSize: size, textAlign: "center", borderRadius: 6,
      padding: "3px 4px", width: w, flexShrink: 0, display: "inline-block", overflow: "hidden", whiteSpace: "nowrap" }}>
      {team ? teamCode(team) : placeholder || "TBD"}
    </span>
  );
}

export function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: `min(${width}px,100%)`, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.line2}` }}>
          <span style={big(26, { textTransform: "uppercase" })}>{title}</span>
          <button onClick={onClose} style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.line3}`, background: "transparent", color: C.text, fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: 20, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

export const Empty = ({ title, sub, action }) => (
  <div style={{ ...card, border: `1px dashed ${C.line3}`, padding: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
    <span style={big(32, { textTransform: "uppercase" })}>{title}</span>
    {sub && <span style={{ color: C.muted }}>{sub}</span>}
    {action}
  </div>
);

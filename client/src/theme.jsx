/**
 * Shared visual themes for TvPage / ScoreboardPage / OverlayPage.
 * Each theme covers a different real-world situation:
 *  - night:  indoor dark gym / evening (default, original look)
 *  - day:    outdoor direct sunlight / bright venue — max contrast
 *  - arena:  bright indoor arena with colorful branding
 *  - sunset: outdoor dusk / warm ambient light
 */
import { useState, useEffect } from "react";

export const THEMES = {
  night: {
    id: "night", label: "🌙 Night", swatch: "#8B7FD4", highContrast: false,
    mainBg: "radial-gradient(ellipse at 50% 0%, #0e0818 0%, #050505 60%)",
    cardBg: "linear-gradient(160deg,#0d0d1b,#080810)",
    panelBg: "rgba(0,0,0,0.55)", panelBorder: "rgba(255,255,255,0.05)",
    boxBg: "rgba(0,0,0,0.2)",
    overlayBg: "rgba(12,14,22,0.96)", overlayBorder: "rgba(255,255,255,0.08)",
  },
  day: {
    id: "day", label: "☀ Day", swatch: "#FFD700", highContrast: true,
    mainBg: "#000",
    cardBg: "#000",
    panelBg: "rgba(0,0,0,0.85)", panelBorder: "rgba(255,255,255,0.25)",
    boxBg: "rgba(0,0,0,0.5)",
    overlayBg: "rgba(0,0,0,0.97)", overlayBorder: "rgba(255,255,255,0.3)",
  },
  arena: {
    id: "arena", label: "🏟 Arena", swatch: "#3B82F6", highContrast: true,
    mainBg: "radial-gradient(ellipse at 50% 0%, #0a1a33 0%, #030712 65%)",
    cardBg: "linear-gradient(160deg,#0a1830,#050a18)",
    panelBg: "rgba(6,16,36,0.7)", panelBorder: "rgba(96,165,250,0.25)",
    boxBg: "rgba(4,12,28,0.55)",
    overlayBg: "rgba(8,16,32,0.97)", overlayBorder: "rgba(96,165,250,0.3)",
  },
  sunset: {
    id: "sunset", label: "🌇 Sunset", swatch: "#FF6B35", highContrast: false,
    mainBg: "radial-gradient(ellipse at 50% 0%, #2a1206 0%, #150a08 60%)",
    cardBg: "linear-gradient(160deg,#241006,#130a06)",
    panelBg: "rgba(35,14,6,0.6)", panelBorder: "rgba(255,140,60,0.2)",
    boxBg: "rgba(28,11,5,0.5)",
    overlayBg: "rgba(28,14,8,0.97)", overlayBorder: "rgba(255,140,60,0.25)",
  },
};

export const THEME_ORDER = ["night", "day", "arena", "sunset"];
export const THEME_KEY = "b3x3_theme";

export function useTheme() {
  const [themeId, setThemeId] = useState(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return THEMES[v] ? v : "night";
    } catch { return "night"; }
  });

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, themeId); } catch {}
  }, [themeId]);

  const cycleTheme = () => setThemeId(id => {
    const i = THEME_ORDER.indexOf(id);
    return THEME_ORDER[(i + 1) % THEME_ORDER.length];
  });

  return { theme: THEMES[themeId], themeId, setThemeId, cycleTheme };
}

/** Compact swatch-row picker for TvPage/ScoreboardPage headers. */
export function ThemeSwitcher({ themeId, setThemeId }) {
  const [open, setOpen] = useState(false);
  const theme = THEMES[themeId];
  return (
    <div style={{ position: "relative" }}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: "pointer",
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 800,
        padding: "3px 10px", borderRadius: 8,
        background: `${theme.swatch}22`, border: `1px solid ${theme.swatch}66`,
        color: theme.swatch, letterSpacing: "0.1em" }}>
        {theme.label} <span style={{ opacity: .6, fontSize: 9 }}>[D]</span>
      </div>
      {open && (
        <div onMouseLeave={() => setOpen(false)} style={{
          position: "absolute", top: 30, right: 0, zIndex: 100,
          background: "#111", border: "1px solid #333", borderRadius: 12,
          padding: 8, display: "flex", gap: 6,
        }}>
          {THEME_ORDER.map(id => (
            <button key={id} onClick={() => { setThemeId(id); setOpen(false); }}
              title={THEMES[id].label}
              style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer",
                background: THEMES[id].swatch,
                border: id === themeId ? "2px solid #FFF" : "2px solid transparent" }} />
          ))}
        </div>
      )}
    </div>
  );
}

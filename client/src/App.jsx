import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage       from "./pages/HomePage.jsx";
import ScoreboardPage from "./pages/ScoreboardPage.jsx";
import TvPage         from "./pages/TvPage.jsx";
import OverlayPage    from "./pages/OverlayPage.jsx";
import TournamentPage from "./pages/TournamentPage.jsx";
import MonitorPage    from "./pages/MonitorPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<HomePage />} />
        <Route path="/scoreboard" element={<ScoreboardPage />} />
        <Route path="/tv"         element={<TvPage />} />
        <Route path="/overlay"    element={<OverlayPage />} />
        <Route path="/tournament" element={<TournamentPage />} />
        <Route path="/monitor"    element={<MonitorPage />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

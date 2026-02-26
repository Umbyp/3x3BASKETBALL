import { useNavigate } from "react-router-dom";
import { COURTS, DIVISIONS } from "../constants.js";

export default function HomePage() {
  const nav = useNavigate();
  const go  = (path, p={}) => nav(`${path}?${new URLSearchParams(p)}`);

  const Card = ({title, color, children}) => (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 style={{color}} className="font-bebas text-lg tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <h1 className="font-bebas text-5xl text-white tracking-widest">🏀 3x3 BASKETBALL</h1>
        <p className="text-gray-600 text-xs uppercase tracking-widest mt-1">Tournament Management System</p>
      </div>

      <div className="w-full max-w-2xl grid gap-4">
        <Card title="🎮 SCOREBOARD — Operator" color="#FF6B35">
          {DIVISIONS.map(d => (
            <div key={d.id} className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 w-16 shrink-0">{d.icon} {d.label}</span>
              <div className="flex gap-2 flex-wrap">
                {COURTS.map(c => (
                  <button key={c} onClick={() => go("/scoreboard",{court:c,division:d.id})}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:scale-105"
                    style={{borderColor:d.color+"44",color:d.color,background:d.color+"12"}}>
                    สนาม {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card title="📺 TV DISPLAY — หน้าจอโทรทัศน์" color="#A78BFA">
            <div className="flex flex-col gap-2">
              {COURTS.map(c => (
                <button key={c} onClick={() => go("/tv",{court:c})}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 transition-all">
                  📺 สนาม {c}
                </button>
              ))}
            </div>
          </Card>
          <Card title="🎥 OBS OVERLAY" color="#34D399">
            <div className="flex flex-col gap-2">
              {COURTS.map(c => (
                <button key={c} onClick={() => go("/overlay",{court:c})}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-all">
                  🎥 สนาม {c}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card title="🏆 TOURNAMENT — สาธารณะ" color="#60A5FA">
            <div className="flex flex-wrap gap-2">
              {DIVISIONS.map(d => (
                <button key={d.id} onClick={() => go("/tournament",{division:d.id})}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                  style={{borderColor:d.color+"44",color:d.color,background:d.color+"12"}}>
                  {d.icon} {d.label}
                </button>
              ))}
            </div>
          </Card>
          <Card title="🖥️ MONITOR — Admin" color="#F472B6">
            <button onClick={() => nav("/monitor")}
              className="w-full py-2 rounded-lg text-xs font-bold bg-pink-500/10 border border-pink-500/25 text-pink-400 hover:bg-pink-500/20 transition-all">
              ดูทุกสนามพร้อมกัน
            </button>
          </Card>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 font-mono text-xs text-gray-500 space-y-1">
          <div className="text-gray-600 font-bold uppercase tracking-widest text-[10px] mb-2">📋 URLs</div>
          <div><span className="text-orange-400">/scoreboard</span>?court=A&division=open</div>
          <div><span className="text-purple-400">/tv</span>?court=A  <span className="text-gray-700">← หน้าจอโทรทัศน์ 1920×1080</span></div>
          <div><span className="text-green-400">/overlay</span>?court=A  <span className="text-gray-700">← OBS Browser Source</span></div>
          <div><span className="text-blue-400">/tournament</span>?division=open</div>
          <div><span className="text-pink-400">/monitor</span></div>
        </div>
      </div>
    </div>
  );
}

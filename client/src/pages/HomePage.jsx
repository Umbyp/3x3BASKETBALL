import { useNavigate } from "react-router-dom";
import { COURTS, DIVISIONS } from "../constants.js";

export default function HomePage() {
  const nav = useNavigate();
  const go = (path, p = {}) => nav(`${path}?${new URLSearchParams(p)}`);

  const Card = ({ title, color, icon, children, description }) => (
    <div className="relative group overflow-hidden bg-gray-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 transition-all duration-300 hover:border-white/20 hover:bg-gray-900/60 shadow-xl">
      {/* Background Glow Effect */}
      <div 
        className="absolute -right-8 -top-8 w-24 h-24 blur-[50px] opacity-20 transition-all group-hover:opacity-40" 
        style={{ backgroundColor: color }}
      />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{ color }} className="font-bebas text-2xl tracking-[0.15em] leading-none uppercase">
              {title}
            </h2>
            {description && <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-tighter">{description}</p>}
          </div>
          <span className="text-xl opacity-50">{icon}</span>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 p-6 md:p-12 font-sans selection:bg-orange-500/30">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <header className="text-center space-y-2">
          <div className="inline-block px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/5 mb-4">
             <span className="text-[10px] font-bold tracking-[0.3em] text-orange-500 uppercase">Live Production Suite</span>
          </div>
          <h1 className="font-bebas text-6xl md:text-8xl text-white tracking-tighter italic italic-outline">
            3x3 <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">BASKETBALL</span>
          </h1>
          <p className="text-gray-500 text-sm font-light tracking-[0.4em] uppercase">Tournament Management</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Main Operator Section */}
          <div className="md:col-span-8">
            <Card title="Scoreboard Operator" color="#FF6B35" icon="🎮" description="Main controller for match scoring">
              <div className="space-y-4 mt-6">
                {DIVISIONS.map(d => (
                  <div key={d.id} className="bg-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 border border-white/5">
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <span className="text-xl">{d.icon}</span>
                      <span className="text-xs font-bold tracking-widest uppercase">{d.label}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {COURTS.map(c => (
                        <button 
                          key={c} 
                          onClick={() => go("/scoreboard", { court: c, division: d.id })}
                          className="px-4 py-2 rounded-lg text-xs font-black transition-all active:scale-95 border border-white/10 hover:border-white/40"
                          style={{ backgroundColor: `${d.color}15`, color: d.color }}
                        >
                          COURT {c}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Sidebar - Monitor & Tournament */}
          <div className="md:col-span-4 space-y-6">
             <Card title="Admin Monitor" color="#F472B6" icon="🖥️">
                <button onClick={() => nav("/monitor")}
                  className="group w-full py-4 rounded-xl text-sm font-bold bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500 hover:text-white transition-all duration-300">
                  OPEN MASTER VIEW
                </button>
             </Card>

             <Card title="Public Results" color="#60A5FA" icon="🏆">
                <div className="grid grid-cols-1 gap-2">
                  {DIVISIONS.map(d => (
                    <button key={d.id} onClick={() => go("/tournament", { division: d.id })}
                      className="flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-bold border border-white/5 bg-white/5 hover:bg-white/10 transition-all uppercase tracking-widest">
                      <span>{d.icon} {d.label}</span>
                      <span className="opacity-30">→</span>
                    </button>
                  ))}
                </div>
             </Card>
          </div>

          {/* Broadcast Section */}
          <div className="md:col-span-6">
            <Card title="TV Display" color="#A78BFA" icon="📺" description="For 1920x1080 Stadium Screens">
              <div className="grid grid-cols-2 gap-3 mt-4">
                {COURTS.map(c => (
                  <button key={c} onClick={() => go("/tv", { court: c })}
                    className="py-3 rounded-xl text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-600 hover:text-white transition-all">
                    COURT {c}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="md:col-span-6">
            <Card title="OBS Overlays" color="#34D399" icon="🎥" description="Browser source for live streaming">
              <div className="grid grid-cols-2 gap-3 mt-4">
                {COURTS.map(c => (
                  <button key={c} onClick={() => go("/overlay", { court: c })}
                    className="py-3 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all">
                    COURT {c}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Footer info */}
        <footer className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
            <div className="space-y-1">
               <p className="text-[10px] font-mono tracking-tighter">NETWORK STATUS: <span className="text-green-500">CONNECTED</span></p>
               <p className="text-[10px] font-mono tracking-tighter">LOCAL IP: 192.168.1.105</p>
            </div>
            <div className="flex gap-4 items-center">
               <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
               <p className="text-[10px] font-bold tracking-[0.2em] uppercase">Ready for Broadcast</p>
            </div>
        </footer>
      </div>
    </div>
  );
}
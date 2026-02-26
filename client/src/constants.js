export const DIVISIONS = [
  { id:"open",  label:"Open",   color:"#FF6B35", icon:"🏀" },
  { id:"women", label:"Women",  color:"#FF1493", icon:"👩" },
  { id:"u18",   label:"U18",    color:"#00D4FF", icon:"⚡" },
  { id:"u15",   label:"U15",    color:"#00E87A", icon:"🌟" },
];
export const COURTS = ["A","B","C"];
export const RULES = { GAME_MINUTES:10, WIN_SCORE:21, SHOT_CLOCK:12, MAX_TIMEOUTS:1, BONUS_FOULS:6, OT_MINUTES:5 };
export const GROUP_COLORS = {
  A:{ text:"text-amber-400",   bg:"bg-amber-500/20",   border:"border-amber-500/30"   },
  B:{ text:"text-blue-400",    bg:"bg-blue-500/20",    border:"border-blue-500/30"    },
  C:{ text:"text-emerald-400", bg:"bg-emerald-500/20", border:"border-emerald-500/30" },
  D:{ text:"text-purple-400",  bg:"bg-purple-500/20",  border:"border-purple-500/30"  },
};
export const DEFAULT_TEAMS = {
  open:  { A:["TEAM A1","TEAM A2","TEAM A3","TEAM A4"], B:["TEAM B1","TEAM B2","TEAM B3","TEAM B4"], C:["TEAM C1","TEAM C2","TEAM C3","TEAM C4"], D:["TEAM D1","TEAM D2","TEAM D3","TEAM D4"] },
  women: { A:["TEAM A1","TEAM A2","TEAM A3","TEAM A4"], B:["TEAM B1","TEAM B2","TEAM B3","TEAM B4"] },
  u18:   { A:["TEAM A1","TEAM A2","TEAM A3","TEAM A4"], B:["TEAM B1","TEAM B2","TEAM B3","TEAM B4"] },
  u15:   { A:["TEAM A1","TEAM A2","TEAM A3","TEAM A4"], B:["TEAM B1","TEAM B2","TEAM B3","TEAM B4"] },
};
export const KO_TEMPLATE = {
  open:[
    {id:100,round:2,shortLabel:"QF1",home:"1A",away:"2C",homeScore:null,awayScore:null,played:false},
    {id:101,round:2,shortLabel:"QF2",home:"1D",away:"2B",homeScore:null,awayScore:null,played:false},
    {id:102,round:2,shortLabel:"QF3",home:"1B",away:"2D",homeScore:null,awayScore:null,played:false},
    {id:103,round:2,shortLabel:"QF4",home:"1C",away:"2A",homeScore:null,awayScore:null,played:false},
    {id:200,round:3,shortLabel:"SF1",home:"W-QF1",away:"W-QF2",homeScore:null,awayScore:null,played:false},
    {id:201,round:3,shortLabel:"SF2",home:"W-QF3",away:"W-QF4",homeScore:null,awayScore:null,played:false},
    {id:300,round:4,shortLabel:"3rd",home:"L-SF1",away:"L-SF2",homeScore:null,awayScore:null,played:false},
    {id:301,round:4,shortLabel:"FINAL",home:"W-SF1",away:"W-SF2",homeScore:null,awayScore:null,played:false},
  ],
  women:[
    {id:200,round:3,shortLabel:"SF1",home:"1A",away:"2B",homeScore:null,awayScore:null,played:false},
    {id:201,round:3,shortLabel:"SF2",home:"1B",away:"2A",homeScore:null,awayScore:null,played:false},
    {id:300,round:4,shortLabel:"3rd",home:"L-SF1",away:"L-SF2",homeScore:null,awayScore:null,played:false},
    {id:301,round:4,shortLabel:"FINAL",home:"W-SF1",away:"W-SF2",homeScore:null,awayScore:null,played:false},
  ],
  u18:[
    {id:200,round:3,shortLabel:"SF1",home:"1A",away:"2B",homeScore:null,awayScore:null,played:false},
    {id:201,round:3,shortLabel:"SF2",home:"1B",away:"2A",homeScore:null,awayScore:null,played:false},
    {id:301,round:4,shortLabel:"FINAL",home:"W-SF1",away:"W-SF2",homeScore:null,awayScore:null,played:false},
  ],
  u15:[
    {id:200,round:3,shortLabel:"SF1",home:"1A",away:"2B",homeScore:null,awayScore:null,played:false},
    {id:201,round:3,shortLabel:"SF2",home:"1B",away:"2A",homeScore:null,awayScore:null,played:false},
    {id:301,round:4,shortLabel:"FINAL",home:"W-SF1",away:"W-SF2",homeScore:null,awayScore:null,played:false},
  ],
};
export const getDivision = id => DIVISIONS.find(d=>d.id===id)||DIVISIONS[0];
export function generateGroupMatches(teams) {
  const m=[]; let id=1;
  Object.entries(teams).forEach(([g,ts])=>{
    for(let i=0;i<ts.length;i++) for(let j=i+1;j<ts.length;j++)
      m.push({id:id++,round:1,group:g,home:ts[i],away:ts[j],homeScore:null,awayScore:null,played:false,court:null,time:""});
  });
  return m;
}

import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/App.tsx', import.meta.url)
let source = readFileSync(path, 'utf8')

const replace = (from, to, label) => {
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`Home period transform failed: ${label}`)
  source = source.replace(from, to)
}

replace(
  "const [homePeriod,setHomePeriod]=useState<HomePeriod>(()=>{const v=localStorage.getItem('spenza-home-period');return v==='todate'?'daily':v&&['daily','monthly','yearly','custom'].includes(v)?v as HomePeriod:'daily'})",
  "const [homePeriod,setHomePeriod]=useState<HomePeriod>(()=>{const v=localStorage.getItem('spenza-home-period');return v==='todate'||v==='yearly'?'daily':v&&['daily','monthly','custom'].includes(v)?v as HomePeriod:'daily'})",
  'saved period migration'
)
replace(
  "const inHomePeriod=(txDate:string)=>{if(homePeriod==='daily')return txDate<=homeDate;if(homePeriod==='custom')return txDate===homeDate;if(homePeriod==='monthly')return txDate.slice(0,7)===homeDate.slice(0,7);return txDate.slice(0,4)===homeDate.slice(0,4)}",
  "const inHomePeriod=(txDate:string)=>{if(homePeriod==='custom')return txDate===homeDate;if(homePeriod==='daily')return txDate.slice(0,7)===homeDate.slice(0,7);return txDate.slice(0,4)===homeDate.slice(0,4)}",
  'period calculation'
)
replace(
  "const shiftHomePeriod=(direction:number)=>{const d=new Date(`${homeDate}T12:00:00`);if(homePeriod==='daily'||homePeriod==='custom')d.setDate(d.getDate()+direction);else if(homePeriod==='monthly')d.setMonth(d.getMonth()+direction);else d.setFullYear(d.getFullYear()+direction);setHomeDate(d.toISOString().slice(0,10))}",
  "const shiftHomePeriod=(direction:number)=>{const d=new Date(`${homeDate}T12:00:00`);if(homePeriod==='custom')d.setDate(d.getDate()+direction);else if(homePeriod==='daily')d.setMonth(d.getMonth()+direction);else d.setFullYear(d.getFullYear()+direction);setHomeDate(d.toISOString().slice(0,10))}",
  'period navigation'
)
replace(
  "const homePeriodLabel=homePeriod==='daily'?`Through ${new Date(`${homeDate}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`:homePeriod==='custom'?new Date(`${homeDate}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):homePeriod==='monthly'?new Date(`${homeDate.slice(0,7)}-01T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'}):homeDate.slice(0,4)",
  "const homePeriodLabel=homePeriod==='custom'?new Date(`${homeDate}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):homePeriod==='daily'?new Date(`${homeDate.slice(0,7)}-01T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'}):homeDate.slice(0,4)",
  'period label'
)
replace(
  "{(['daily','monthly','yearly'] as InsightPeriod[]).map(p=><button key={p} className={homePeriod===p?'selected':''} onClick={()=>setHomePeriod(p)}>{p}</button>)}",
  "{(['daily','monthly'] as InsightPeriod[]).map(p=><button key={p} className={homePeriod===p?'selected':''} onClick={()=>setHomePeriod(p)}>{p}</button>)}",
  'Home period buttons'
)
replace(
  "setInsightPeriod(homePeriod==='monthly'||homePeriod==='yearly'?homePeriod:'daily')",
  "setInsightPeriod(homePeriod==='monthly'?'yearly':homePeriod==='daily'?'monthly':'daily')",
  'Home to Insights mapping'
)

// Keep the Insights page period selector consistent with Home:
// Daily = selected month, Monthly = selected year, Calendar = exact selected date.
replace(
  "{(['daily','monthly','yearly'] as InsightPeriod[]).map(p=><button key={p} className={insightPeriod===p?'selected':''} onClick={()=>setInsightPeriod(p)}>{p}</button>)}",
  "{(['monthly','yearly'] as InsightPeriod[]).map(p=><button key={p} className={(p==='monthly'&&insightPeriod==='monthly')||(p==='yearly'&&insightPeriod==='yearly')?'selected':''} onClick={()=>setInsightPeriod(p)}>{p==='monthly'?'daily':'monthly'}</button>)}<button className={`calendarFilterButton ${insightPeriod==='daily'?'selected':''}`} onClick={()=>setInsightPeriod('daily')}><span>Calendar</span></button>",
  'Insights period buttons'
)

writeFileSync(path, source)
console.log('Applied period update: Home and Insights both use Daily=month, Monthly=year, Calendar=exact date')

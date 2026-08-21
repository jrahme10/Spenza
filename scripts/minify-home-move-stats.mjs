import { readFileSync, writeFileSync } from 'node:fs'

const path=new URL('../src/App.tsx',import.meta.url)
let source=readFileSync(path,'utf8')

// Home paging only. The standalone Transactions page is intentionally removed.
if(!source.includes('const [homeRecentLimit,setHomeRecentLimit]')){
 const statePattern=/^(\s*)const \[collapsedActivityGroups,setCollapsedActivityGroups\]=useState<Set<string>>\([^\n]+\)$/m
 if(!statePattern.test(source)) throw new Error('Dashboard transform failed: state insertion point not found')
 source=source.replace(statePattern,(line,indent)=>`${line}\n${indent}const [homeRecentLimit,setHomeRecentLimit]=useState<number>(12)`)
}

if(!source.includes('spenzaInfiniteScroll')){
 const effectAnchor=` useEffect(()=>{localStorage.setItem('spenza-insight-category',insightCategory)},[insightCategory])`
 const infiniteEffect=`\n useEffect(()=>{const spenzaInfiniteScroll=()=>{if(window.innerHeight+window.scrollY<document.documentElement.scrollHeight-420)return;if(tab==='Home')setHomeRecentLimit(v=>v+12)};window.addEventListener('scroll',spenzaInfiniteScroll,{passive:true});return()=>window.removeEventListener('scroll',spenzaInfiniteScroll)},[tab])`
 if(!source.includes(effectAnchor)) throw new Error('Dashboard transform failed: infinite scroll effect insertion point not found')
 source=source.replace(effectAnchor,effectAnchor+infiniteEffect)
}

const toolbar=`   {data.wallets.length?<div className="insightSelectors homeAccountSelector compactHomeAccount"><label>Account<select value={homeWallet?.id||''} onChange={e=>{setHomeWalletId(e.target.value);setHomeRecentLimit(12)}}>{data.wallets.map(w=><option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label><button className="homeAccountsIcon" aria-label="Open accounts" title="Accounts" onClick={()=>setTab('Wallets')}><WalletCards/></button><div className="filters refFilters periodFilters homePeriodFilters"><button className={homePeriod==='daily'?'selected':''} onClick={()=>{setHomePeriod('daily');setHomeRecentLimit(12)}}><CalendarDays size={15}/><span>Daily</span></button><button className={homePeriod==='monthly'?'selected':''} onClick={()=>{setHomePeriod('monthly');setHomeRecentLimit(12)}}><CalendarRange size={15}/><span>Monthly</span></button><button className={\`calendarFilterButton \${homePeriod==='custom'?'selected':''}\`} onClick={()=>setHomeCalendarOpen(true)}><CalendarClock size={15}/><span>Calendar</span></button></div></div>:<button type="button" className="homeEmptyWalletCta" onClick={addWallet}><span className="homeEmptyWalletIcon"><Plus size={22}/></span><span><b>Add your first wallet</b><small>Create an account to start tracking income and expenses.</small></span></button>}`
const originalControls=/   <div className="filters refFilters periodFilters homePeriodFilters">[^\n]*<\/div>\n   \{data\.wallets\.length&&<div className="insightSelectors homeAccountSelector">[^\n]*<\/div>\}/
if(originalControls.test(source)) source=source.replace(originalControls,toolbar)
const compactControls=/   \{data\.wallets\.length(?:&&|\?)<div className="insightSelectors homeAccountSelector compactHomeAccount">[^\n]*/
if(compactControls.test(source)) source=source.replace(compactControls,toolbar)
if(!source.includes('compactHomeAccount')) throw new Error('Dashboard transform failed: compact Home toolbar was not created')

const lucideImport=/import \{([^}]+)\} from 'lucide-react'/
source=source.replace(lucideImport,(match,names)=>{const list=names.split(',').map(x=>x.trim()).filter(Boolean);for(const icon of ['CalendarDays','CalendarRange'])if(!list.includes(icon))list.push(icon);return `import { ${list.join(', ')} } from 'lucide-react'`})

source=source.replace(/\n   <div className="accountSummary homeAvailableAmount">[^\n]*<\/div>/,'')
source=source.replace(/\n   <div className="refSectionHead"><h2>Accounts<\/h2><button onClick=\{\(\)=>setTab\('Wallets'\)\}>See All<\/button><\/div>\n   \{data\.wallets\.length\?<div className="accountRail">[^\n]*\}/,'')
const overviewStart=source.indexOf(`   <div className="refSectionHead"><h2>{homePeriodLabel} Overview</h2>`)
const recentStart=source.indexOf(`   <section className="activity homeActivity">`,overviewStart)
if(overviewStart>=0&&recentStart>overviewStart) source=source.slice(0,overviewStart)+source.slice(recentStart)

const oldRecent=`   <section className="activity homeActivity"><div className="refSectionHead"><h2>Recent Transactions</h2><button onClick={openAllActivity}>See All</button></div>{homePeriodTx.length?homePeriodTx.map(t=><TxRow t={t} key={t.id}/>):<div className="empty compact">No transactions for this account and period.</div>}</section>`
const newRecent=`   <section className="activity homeActivity"><div className="refSectionHead"><h2>Recent Transactions</h2></div>{homePeriodTx.length?<>{homePeriod==='daily'?Object.entries(homePeriodTx.slice(0,homeRecentLimit).reduce((groups,tx)=>{(groups[tx.date]??=[]).push(tx);return groups},{} as Record<string,Transaction[]>)).sort(([a],[b])=>b.localeCompare(a)).map(([day,items])=><section className="homeDayGroup" key={day}><div className="homeDayHeader">{new Date(day+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>{items.map(t=><TxRow t={t} key={t.id}/>)}</section>):homePeriodTx.slice(0,homeRecentLimit).map(t=><TxRow t={t} key={t.id}/>)}</>:<div className="empty compact">No transactions for this account and period.</div>}</section>`
if(source.includes(oldRecent)) source=source.replace(oldRecent,newRecent)
else if(source.includes('homeDayGroup')) source=source.replace(/   <section className="activity homeActivity">[^\n]*<\/section>/,newRecent)
else throw new Error('Dashboard transform failed: Home Recent Transactions block not found')

source=source.replace(/\n  \{tab==='Activity'&&<section className="page refPage">[^\n]*<\/section>\}/,'')
source=source.replace(`[['Home',Home],['Activity',CreditCard],['Add',Plus],['Bills',CalendarClock],['Insights',BarChart3],['Settings',Settings]]`,`[['Home',Home],['Bills',CalendarClock],['Add',Plus],['Insights',BarChart3],['Settings',Settings]]`)
source=source.replace(`if(label==='Activity')setActivityWalletId(null);setTab(label)`,`setTab(label)`)
source=source.replace(` const openWalletActivity=(id:string)=>{setActivityWalletId(id);setTab('Activity')}`,` const openWalletActivity=(id:string)=>{setHomeWalletId(id);setHomeRecentLimit(12);setTab('Home')}`)
source=source.replace(` const openAllActivity=()=>{setActivityWalletId(null);setTab('Activity')}`,` const openAllActivity=()=>{setTab('Home')}`)

// Insights is for statistics/charts. Remove the large Expenses, Income, Transactions and Transfers Out metric cards.
source=source.replace(/<div className="activitySummary homeCashflowSummary insightCashflowSummary">[^\n]*?<\/div>/g,'')
source=source.replace(/<div className="insightGrid refInsightGrid">[^\n]*?<\/div>/g,'')

writeFileSync(path,source)
console.log('Removed standalone Transactions page and Insights summary metric cards')

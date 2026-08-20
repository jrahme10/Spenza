import { readFileSync, writeFileSync } from 'node:fs'

const path=new URL('../src/App.tsx',import.meta.url)
let source=readFileSync(path,'utf8')

const stateAnchor=` const [collapsedActivityGroups,setCollapsedActivityGroups]=useState<Set<string>>(new Set())`
if(source.includes(stateAnchor)&&!source.includes('homeRecentLimit,setHomeRecentLimit')) source=source.replace(stateAnchor,`${stateAnchor}\n const [homeRecentLimit,setHomeRecentLimit]=useState(12)`)

const toolbar=`   {data.wallets.length&&<div className="insightSelectors homeAccountSelector compactHomeAccount"><label>Account<select value={homeWallet?.id||''} onChange={e=>{setHomeWalletId(e.target.value);setHomeRecentLimit(12)}}>{data.wallets.map(w=><option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label><button className="homeAccountsIcon" aria-label="Open accounts" title="Accounts" onClick={()=>setTab('Wallets')}><WalletCards/></button><div className="filters refFilters periodFilters homePeriodFilters"><button className={homePeriod==='daily'?'selected':''} onClick={()=>{setHomePeriod('daily');setHomeRecentLimit(12)}}><CalendarDays size={15}/><span>Daily</span></button><button className={homePeriod==='monthly'?'selected':''} onClick={()=>{setHomePeriod('monthly');setHomeRecentLimit(12)}}><CalendarRange size={15}/><span>Monthly</span></button><button className={\`calendarFilterButton \${homePeriod==='custom'?'selected':''}\`} onClick={()=>setHomeCalendarOpen(true)}><CalendarClock size={15}/><span>Calendar</span></button></div></div>}`
const originalControls=/   <div className="filters refFilters periodFilters homePeriodFilters">[^\n]*<\/div>\n   \{data\.wallets\.length&&<div className="insightSelectors homeAccountSelector">[^\n]*<\/div>\}/
if(originalControls.test(source)) source=source.replace(originalControls,toolbar)
const compactControls=/   \{data\.wallets\.length&&<div className="insightSelectors homeAccountSelector compactHomeAccount">[^\n]*<\/div><\/div>\}/
if(compactControls.test(source)) source=source.replace(compactControls,toolbar)
if(!source.includes('compactHomeAccount')) throw new Error('Dashboard transform failed: compact Home toolbar was not created')

const lucideImport=/import \{([^}]+)\} from 'lucide-react'/
source=source.replace(lucideImport,(match,names)=>{
 const list=names.split(',').map(x=>x.trim()).filter(Boolean)
 for(const icon of ['CalendarDays','CalendarRange']) if(!list.includes(icon)) list.push(icon)
 return `import { ${list.join(', ')} } from 'lucide-react'`
})

source=source.replace(/\n   <div className="accountSummary homeAvailableAmount">[^\n]*<\/div>/,'')
source=source.replace(/\n   <div className="refSectionHead"><h2>Accounts<\/h2><button onClick=\{\(\)=>setTab\('Wallets'\)\}>See All<\/button><\/div>\n   \{data\.wallets\.length\?<div className="accountRail">[^\n]*\}/,'')

const overviewStart=source.indexOf(`   <div className="refSectionHead"><h2>{homePeriodLabel} Overview</h2>`)
const recentStart=source.indexOf(`   <section className="activity homeActivity">`,overviewStart)
if(overviewStart>=0&&recentStart>overviewStart) source=source.slice(0,overviewStart)+source.slice(recentStart)

const oldRecent=`   <section className="activity homeActivity"><div className="refSectionHead"><h2>Recent Transactions</h2><button onClick={openAllActivity}>See All</button></div>{homePeriodTx.length?homePeriodTx.map(t=><TxRow t={t} key={t.id}/>):<div className="empty compact">No transactions for this account and period.</div>}</section>`
// Avoid nested JS template interpolation here: the transform itself is a template string.
const newRecent=`   <section className="activity homeActivity"><div className="refSectionHead"><h2>Recent Transactions</h2><button onClick={openAllActivity}>See All</button></div>{homePeriodTx.length?<>{homePeriod==='daily'?Object.entries(homePeriodTx.slice().sort(newestTransactionFirst).slice(0,homeRecentLimit).reduce((groups,tx)=>{(groups[tx.date]??=[]).push(tx);return groups},{} as Record<string,Transaction[]>)).sort(([a],[b])=>b.localeCompare(a)).map(([day,items])=><section className="homeDayGroup" key={day}><div className="homeDayHeader">{new Date(day+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>{items.map(t=><TxRow t={t} key={t.id}/>)}</section>):homePeriodTx.slice().sort(newestTransactionFirst).slice(0,homeRecentLimit).map(t=><TxRow t={t} key={t.id}/>)}{homePeriodTx.length>homeRecentLimit&&<button className="homeLoadMore" onClick={()=>setHomeRecentLimit(v=>v+12)}>Load more</button>}</>:<div className="empty compact">No transactions for this account and period.</div>}</section>`
if(source.includes(oldRecent)) source=source.replace(oldRecent,newRecent)
else if(!source.includes('homeLoadMore')) throw new Error('Dashboard transform failed: Home Recent Transactions block not found')

const insightGrid=`{insightWallet&&<><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
const insightSummary=`{insightWallet&&<><div className="activitySummary homeCashflowSummary insightCashflowSummary"><article><span>Income</span><strong style={{color:'#4aa8ff'}}>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Exp.</span><strong style={{color:'#ff5f68'}}>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Net</span><strong>{money(insightIncome-insightExpenses,insightWallet.currency)}</strong></article></div><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
if(!source.includes('insightCashflowSummary')){
 if(!source.includes(insightGrid)) throw new Error('Dashboard transform failed: Insights grid not found')
 source=source.replace(insightGrid,insightSummary)
}

writeFileSync(path,source)
console.log('Applied Home icons, centered filters, daily grouping, and Recent Transactions load more')

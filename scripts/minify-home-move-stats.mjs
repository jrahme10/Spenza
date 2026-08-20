import { readFileSync, writeFileSync } from 'node:fs'

const path=new URL('../src/App.tsx',import.meta.url)
let source=readFileSync(path,'utf8')

// Paging state for lightweight Home and Transactions rendering.
if(!source.includes('const [homeRecentLimit,setHomeRecentLimit]')){
 const statePattern=/^(\s*)const \[collapsedActivityGroups,setCollapsedActivityGroups\]=useState<Set<string>>\([^\n]+\)$/m
 if(!statePattern.test(source)) throw new Error('Dashboard transform failed: state insertion point not found')
 source=source.replace(statePattern,(line,indent)=>`${line}\n${indent}const [homeRecentLimit,setHomeRecentLimit]=useState<number>(12)\n${indent}const [activityRecentLimit,setActivityRecentLimit]=useState<number>(20)`)
}else if(!source.includes('const [activityRecentLimit,setActivityRecentLimit]')){
 source=source.replace(/^(\s*)const \[homeRecentLimit,setHomeRecentLimit\]=useState<number>\(12\)$/m,(line,indent)=>`${line}\n${indent}const [activityRecentLimit,setActivityRecentLimit]=useState<number>(20)`)
}

// Automatically reveal another page when the user approaches the bottom.
if(!source.includes('spenzaInfiniteScroll')){
 const effectAnchor=` useEffect(()=>{localStorage.setItem('spenza-insight-category',insightCategory)},[insightCategory])`
 const infiniteEffect=`\n useEffect(()=>{const spenzaInfiniteScroll=()=>{if(window.innerHeight+window.scrollY<document.documentElement.scrollHeight-420)return;if(tab==='Home')setHomeRecentLimit(v=>v+12);else if(tab==='Activity')setActivityRecentLimit(v=>v+20)};window.addEventListener('scroll',spenzaInfiniteScroll,{passive:true});return()=>window.removeEventListener('scroll',spenzaInfiniteScroll)},[tab])`
 if(!source.includes(effectAnchor)) throw new Error('Dashboard transform failed: infinite scroll effect insertion point not found')
 source=source.replace(effectAnchor,effectAnchor+infiniteEffect)
}

const toolbar=`   {data.wallets.length&&<div className="insightSelectors homeAccountSelector compactHomeAccount"><label>Account<select value={homeWallet?.id||''} onChange={e=>{setHomeWalletId(e.target.value);setHomeRecentLimit(12)}}>{data.wallets.map(w=><option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label><button className="homeAccountsIcon" aria-label="Open accounts" title="Accounts" onClick={()=>setTab('Wallets')}><WalletCards/></button><div className="filters refFilters periodFilters homePeriodFilters"><button className={homePeriod==='daily'?'selected':''} onClick={()=>{setHomePeriod('daily');setHomeRecentLimit(12)}}><CalendarDays size={15}/><span>Daily</span></button><button className={homePeriod==='monthly'?'selected':''} onClick={()=>{setHomePeriod('monthly');setHomeRecentLimit(12)}}><CalendarRange size={15}/><span>Monthly</span></button><button className={\`calendarFilterButton \${homePeriod==='custom'?'selected':''}\`} onClick={()=>setHomeCalendarOpen(true)}><CalendarClock size={15}/><span>Calendar</span></button></div></div>}`
const originalControls=/   <div className="filters refFilters periodFilters homePeriodFilters">[^\n]*<\/div>\n   \{data\.wallets\.length&&<div className="insightSelectors homeAccountSelector">[^\n]*<\/div>\}/
if(originalControls.test(source)) source=source.replace(originalControls,toolbar)
const compactControls=/   \{data\.wallets\.length&&<div className="insightSelectors homeAccountSelector compactHomeAccount">[^\n]*<\/div><\/div>\}/
if(compactControls.test(source)) source=source.replace(compactControls,toolbar)
if(!source.includes('compactHomeAccount')) throw new Error('Dashboard transform failed: compact Home toolbar was not created')

const lucideImport=/import \{([^}]+)\} from 'lucide-react'/
source=source.replace(lucideImport,(match,names)=>{const list=names.split(',').map(x=>x.trim()).filter(Boolean);for(const icon of ['CalendarDays','CalendarRange'])if(!list.includes(icon))list.push(icon);return `import { ${list.join(', ')} } from 'lucide-react'`})

source=source.replace(/\n   <div className="accountSummary homeAvailableAmount">[^\n]*<\/div>/,'')
source=source.replace(/\n   <div className="refSectionHead"><h2>Accounts<\/h2><button onClick=\{\(\)=>setTab\('Wallets'\)\}>See All<\/button><\/div>\n   \{data\.wallets\.length\?<div className="accountRail">[^\n]*\}/,'')
const overviewStart=source.indexOf(`   <div className="refSectionHead"><h2>{homePeriodLabel} Overview</h2>`)
const recentStart=source.indexOf(`   <section className="activity homeActivity">`,overviewStart)
if(overviewStart>=0&&recentStart>overviewStart) source=source.slice(0,overviewStart)+source.slice(recentStart)

// Home: group Daily results by day and automatically reveal more on scroll.
const oldRecent=`   <section className="activity homeActivity"><div className="refSectionHead"><h2>Recent Transactions</h2><button onClick={openAllActivity}>See All</button></div>{homePeriodTx.length?homePeriodTx.map(t=><TxRow t={t} key={t.id}/>):<div className="empty compact">No transactions for this account and period.</div>}</section>`
const newRecent=`   <section className="activity homeActivity"><div className="refSectionHead"><h2>Recent Transactions</h2><button onClick={openAllActivity}>See All</button></div>{homePeriodTx.length?<>{homePeriod==='daily'?Object.entries(homePeriodTx.slice(0,homeRecentLimit).reduce((groups,tx)=>{(groups[tx.date]??=[]).push(tx);return groups},{} as Record<string,Transaction[]>)).sort(([a],[b])=>b.localeCompare(a)).map(([day,items])=><section className="homeDayGroup" key={day}><div className="homeDayHeader">{new Date(day+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>{items.map(t=><TxRow t={t} key={t.id}/>)}</section>):homePeriodTx.slice(0,homeRecentLimit).map(t=><TxRow t={t} key={t.id}/>)}</>:<div className="empty compact">No transactions for this account and period.</div>}</section>`
if(source.includes(oldRecent)) source=source.replace(oldRecent,newRecent)
else if(source.includes('homeLoadMore')) source=source.replace(/   <section className="activity homeActivity">[^\n]*<\/section>/,newRecent)
else if(!source.includes('homeDayGroup')) throw new Error('Dashboard transform failed: Home Recent Transactions block not found')

// Transactions page: only render the current window, then expand automatically near page bottom.
const groupsAnchor=` const activityGroups=activityTransactions.reduce<Record<string,Transaction[]>>((acc,t)=>{(acc[t.date]??=[]).push(t);return acc},{})\n const activityMonthGroups=activityTransactions.reduce<Record<string,Transaction[]>>((acc,t)=>{const key=t.date.slice(0,7);(acc[key]??=[]).push(t);return acc},{})\n const activityYearGroups=activityTransactions.reduce<Record<string,Record<string,Transaction[]>>>((years,t)=>{const year=t.date.slice(0,4);const month=t.date.slice(0,7);((years[year]??={})[month]??=[]).push(t);return years},{})`
const limitedGroups=` const visibleActivityTransactions=activityTransactions.slice(0,activityRecentLimit)\n const activityGroups=visibleActivityTransactions.reduce<Record<string,Transaction[]>>((acc,t)=>{(acc[t.date]??=[]).push(t);return acc},{})\n const activityMonthGroups=visibleActivityTransactions.reduce<Record<string,Transaction[]>>((acc,t)=>{const key=t.date.slice(0,7);(acc[key]??=[]).push(t);return acc},{})\n const activityYearGroups=visibleActivityTransactions.reduce<Record<string,Record<string,Transaction[]>>>((years,t)=>{const year=t.date.slice(0,4);const month=t.date.slice(0,7);((years[year]??={})[month]??=[]).push(t);return years},{})`
if(source.includes(groupsAnchor)) source=source.replace(groupsAnchor,limitedGroups)
else if(!source.includes('visibleActivityTransactions')) throw new Error('Dashboard transform failed: Transactions grouping insertion point not found')

const insightGrid=`{insightWallet&&<><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
const insightSummary=`{insightWallet&&<><div className="activitySummary homeCashflowSummary insightCashflowSummary"><article><span>Income</span><strong style={{color:'#4aa8ff'}}>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Exp.</span><strong style={{color:'#ff5f68'}}>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Net</span><strong>{money(insightIncome-insightExpenses,insightWallet.currency)}</strong></article></div><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
if(!source.includes('insightCashflowSummary')){if(!source.includes(insightGrid))throw new Error('Dashboard transform failed: Insights grid not found');source=source.replace(insightGrid,insightSummary)}

writeFileSync(path,source)
console.log('Applied automatic infinite scroll to Home and Transactions')

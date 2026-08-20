import { readFileSync, writeFileSync } from 'node:fs'

const path=new URL('../src/App.tsx',import.meta.url)
let source=readFileSync(path,'utf8')

const toolbar=`   {data.wallets.length&&<div className="insightSelectors homeAccountSelector compactHomeAccount"><label>Account<select value={homeWallet?.id||''} onChange={e=>setHomeWalletId(e.target.value)}>{data.wallets.map(w=><option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label><button className="homeAccountsIcon" aria-label="Open accounts" title="Accounts" onClick={()=>setTab('Wallets')}><WalletCards/></button><div className="filters refFilters periodFilters homePeriodFilters"><button className={homePeriod==='daily'?'selected':''} onClick={()=>setHomePeriod('daily')}>Daily</button><button className={homePeriod==='monthly'?'selected':''} onClick={()=>setHomePeriod('monthly')}>Monthly</button><button className={\`calendarFilterButton \${homePeriod==='custom'?'selected':''}\`} onClick={()=>setHomeCalendarOpen(true)}><CalendarClock size={12}/>Calendar</button></div></div>}`

const originalControls=/   <div className="filters refFilters periodFilters homePeriodFilters">[^\n]*<\/div>\n   \{data\.wallets\.length&&<div className="insightSelectors homeAccountSelector">[^\n]*<\/div>\}/
if(originalControls.test(source)) source=source.replace(originalControls,toolbar)
const compactControls=/   \{data\.wallets\.length&&<div className="insightSelectors homeAccountSelector compactHomeAccount">[^\n]*<\/div><\/div>\}/
if(compactControls.test(source)) source=source.replace(compactControls,toolbar)
if(!source.includes('compactHomeAccount')) throw new Error('Dashboard transform failed: compact Home toolbar was not created')

source=source.replace(/\n   <div className="accountSummary homeAvailableAmount">[^\n]*<\/div>/,'')
source=source.replace(/\n   <div className="refSectionHead"><h2>Accounts<\/h2><button onClick=\{\(\)=>setTab\('Wallets'\)\}>See All<\/button><\/div>\n   \{data\.wallets\.length\?<div className="accountRail">[^\n]*\}/,'')

const overviewStart=source.indexOf(`   <div className="refSectionHead"><h2>{homePeriodLabel} Overview</h2>`)
const recentStart=source.indexOf(`   <section className="activity homeActivity">`,overviewStart)
if(overviewStart>=0&&recentStart>overviewStart) source=source.slice(0,overviewStart)+source.slice(recentStart)

const insightGrid=`{insightWallet&&<><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
const insightSummary=`{insightWallet&&<><div className="activitySummary homeCashflowSummary insightCashflowSummary"><article><span>Income</span><strong style={{color:'#4aa8ff'}}>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Exp.</span><strong style={{color:'#ff5f68'}}>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Net</span><strong>{money(insightIncome-insightExpenses,insightWallet.currency)}</strong></article></div><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
if(!source.includes('insightCashflowSummary')){
 if(!source.includes(insightGrid)) throw new Error('Dashboard transform failed: Insights grid not found')
 source=source.replace(insightGrid,insightSummary)
}

writeFileSync(path,source)
console.log('Applied approved Home layout: account, wallet, Daily, Monthly, Calendar; statistics remain in Insights')

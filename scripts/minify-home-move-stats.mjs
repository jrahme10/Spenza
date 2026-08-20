import { readFileSync, writeFileSync } from 'node:fs'

const path=new URL('../src/App.tsx',import.meta.url)
let source=readFileSync(path,'utf8')
const replace=(from,to,label)=>{if(source.includes(to))return;if(!source.includes(from))throw new Error(`Dashboard transform failed: ${label}`);source=source.replace(from,to)}

// Keep exactly one Home control row: account dropdown -> wallet -> Daily / Monthly / Calendar.
const standalonePeriod=`   <div className="filters refFilters periodFilters homePeriodFilters">{(['daily','monthly','yearly'] as InsightPeriod[]).map(p=><button key={p} className={homePeriod===p?'selected':''} onClick={()=>setHomePeriod(p)}>{p}</button>)}<label className={\`calendarFilterButton \${homePeriod==='custom'?'selected':''}\`}><CalendarClock size={12}/><span>Calendar</span><input type="date" value={homeDate} onChange={e=>{setHomeDate(e.target.value);setHomePeriod('custom')}}/></label></div>\n`
const account=`   {data.wallets.length&&<div className="insightSelectors homeAccountSelector"><label>Account<select value={homeWallet?.id||''} onChange={e=>setHomeWalletId(e.target.value)}>{data.wallets.map(w=><option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label></div>}`
const toolbar=`   {data.wallets.length&&<div className="insightSelectors homeAccountSelector compactHomeAccount"><label>Account<select value={homeWallet?.id||''} onChange={e=>setHomeWalletId(e.target.value)}>{data.wallets.map(w=><option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label><button className="homeAccountsIcon" aria-label="Open accounts" title="Accounts" onClick={()=>setTab('Wallets')}><WalletCards/></button><div className="filters refFilters periodFilters homePeriodFilters"><button className={homePeriod==='daily'?'selected':''} onClick={()=>setHomePeriod('daily')}>Daily</button><button className={homePeriod==='monthly'?'selected':''} onClick={()=>setHomePeriod('monthly')}>Monthly</button><label className={\`calendarFilterButton \${homePeriod==='custom'?'selected':''}\`}><CalendarClock size={12}/><span>Calendar</span><input type="date" value={homeDate} onChange={e=>{setHomeDate(e.target.value);setHomePeriod('custom')}}/></label></div></div>}`
const oldToolbarStart=`   {data.wallets.length&&<div className="insightSelectors homeAccountSelector compactHomeAccount">`

// If an earlier transform already made a compact toolbar, replace that entire element with the final one.
const compactStart=source.indexOf(oldToolbarStart)
if(compactStart>=0){
 const end=source.indexOf(`</div></div>}`,compactStart)
 if(end>=0)source=source.slice(0,compactStart)+toolbar+source.slice(end+13)
}else if(source.includes(account))source=source.replace(account,toolbar)

// Remove any standalone duplicate Home period selector left above/below the compact toolbar.
let first=source.indexOf(standalonePeriod)
while(first>=0){source=source.slice(0,first)+source.slice(first+standalonePeriod.length);first=source.indexOf(standalonePeriod)}

const accountsStart=`   <div className="refSectionHead"><h2>Accounts</h2><button onClick={()=>setTab('Wallets')}>See All</button></div>\n   {data.wallets.length?<div className="accountRail">{data.wallets.slice(0,4).map((w,i)=><button className={\`accountTile accountTone\${i%4}\${homeWallet?.id===w.id?' selectedAccount':''}\`} key={w.id} onClick={()=>setHomeWalletId(w.id)}><div><b>{w.name}</b><span>{w.currency}</span></div><strong>{money(walletBalance(w.id),w.currency)}</strong></button>)}</div>:<button className="emptyWalletCta" onClick={addWallet}><WalletCards/><span><b>Create your first wallet</b><small>Add cash, bank, or card balances before recording expenses.</small></span></button>}\n`
if(source.includes(accountsStart))source=source.replace(accountsStart,'')

const overviewStart=source.indexOf(`   <div className="refSectionHead"><h2>{homePeriodLabel} Overview</h2>`)
const recentStart=source.indexOf(`   <section className="activity homeActivity">`,overviewStart)
if(overviewStart>=0&&recentStart>overviewStart)source=source.slice(0,overviewStart)+source.slice(recentStart)

const insightMarker=`{insightWallet&&<><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
const insightReplacement=`{insightWallet&&<><div className="activitySummary homeCashflowSummary insightCashflowSummary"><article><span>Income</span><strong style={{color:'#4aa8ff'}}>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Exp.</span><strong style={{color:'#ff5f68'}}>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Net</span><strong>{money(insightIncome-insightExpenses,insightWallet.currency)}</strong></article></div><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
if(source.includes(insightMarker))source=source.replace(insightMarker,insightReplacement)

writeFileSync(path,source)
console.log('Applied final Home production layout with one period selector')

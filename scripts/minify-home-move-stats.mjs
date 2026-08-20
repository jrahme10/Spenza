import { readFileSync, writeFileSync } from 'node:fs'

const path=new URL('../src/App.tsx',import.meta.url)
let source=readFileSync(path,'utf8')
const replace=(from,to,label)=>{if(source.includes(to))return;if(!source.includes(from))throw new Error(`Dashboard transform failed: ${label}`);source=source.replace(from,to)}

// Replace the large Accounts rail on Home with a compact wallet icon beside the account selector.
replace(
`   {data.wallets.length&&<div className="insightSelectors homeAccountSelector"><label>Account<select value={homeWallet?.id||''} onChange={e=>setHomeWalletId(e.target.value)}>{data.wallets.map(w=><option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label></div>}`,
`   {data.wallets.length&&<div className="insightSelectors homeAccountSelector compactHomeAccount"><label>Account<select value={homeWallet?.id||''} onChange={e=>setHomeWalletId(e.target.value)}>{data.wallets.map(w=><option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label><button className="homeAccountsIcon" aria-label="Open accounts" title="Accounts" onClick={()=>setTab('Wallets')}><WalletCards/></button></div>}`,
'compact account control')

const accountsStart=`   <div className="refSectionHead"><h2>Accounts</h2><button onClick={()=>setTab('Wallets')}>See All</button></div>\n   {data.wallets.length?<div className="accountRail">{data.wallets.slice(0,4).map((w,i)=><button className={\`accountTile accountTone\${i%4}\${homeWallet?.id===w.id?' selectedAccount':''}\`} key={w.id} onClick={()=>setHomeWalletId(w.id)}><div><b>{w.name}</b><span>{w.currency}</span></div><strong>{money(walletBalance(w.id),w.currency)}</strong></button>)}</div>:<button className="emptyWalletCta" onClick={addWallet}><WalletCards/><span><b>Create your first wallet</b><small>Add cash, bank, or card balances before recording expenses.</small></span></button>}\n`
if(source.includes(accountsStart))source=source.replace(accountsStart,'')

// Remove statistics from Home. They belong in Insights.
const overviewStart=source.indexOf(`   <div className="refSectionHead"><h2>{homePeriodLabel} Overview</h2>`)
const recentStart=source.indexOf(`   <section className="activity homeActivity">`,overviewStart)
if(overviewStart>=0&&recentStart>overviewStart)source=source.slice(0,overviewStart)+source.slice(recentStart)

// Add the visual statistics to Insights, using the existing Insights-filtered values.
const insightMarker=`{insightWallet&&<><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
const insightReplacement=`{insightWallet&&<><div className="activitySummary homeCashflowSummary insightCashflowSummary"><article><span>Income</span><strong style={{color:'#4aa8ff'}}>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Exp.</span><strong style={{color:'#ff5f68'}}>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Net</span><strong>{money(insightIncome-insightExpenses,insightWallet.currency)}</strong></article></div><div className="insightGrid refInsightGrid"><article><span>Expenses</span><strong>{money(insightExpenses,insightWallet.currency)}</strong></article><article><span>Income</span><strong>{money(insightIncome,insightWallet.currency)}</strong></article><article><span>Transactions</span><strong>{insightTransactions.length}</strong></article><article><span>Transfers Out</span><strong>{money(insightTransfers,insightWallet.currency)}</strong></article></div>`
replace(insightMarker,insightReplacement,'Insights summary')

writeFileSync(path,source)
console.log('Minified Home account/statistics sections and moved summary statistics to Insights')

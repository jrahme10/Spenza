import {readFileSync,writeFileSync} from 'node:fs'
const path=new URL('../src/App.tsx',import.meta.url)
let s=readFileSync(path,'utf8')
const importLine=`import BudgetPlanner from './components/BudgetPlanner'`
if(!s.includes(importLine)){
 const anchor=`import TransactionCalendar from './components/TransactionCalendar'`
 if(!s.includes(anchor))throw new Error('Budget planner transform failed: import anchor not found')
 s=s.replace(anchor,`${anchor}\n${importLine}`)
}
if(!s.includes('<BudgetPlanner ')){
 const anchor=`<div className="insightSelectors"><label>Account<select value={insightWalletId} onChange={e=>setInsightWalletId(e.target.value)}>{data.wallets.map(w=><option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label><label>Category<select value={insightCategory} onChange={e=>setInsightCategory(e.target.value)}><option value="all">All categories</option>{data.categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label></div>`
 if(!s.includes(anchor))throw new Error('Budget planner transform failed: Insights selector anchor not found')
 s=s.replace(anchor,`${anchor}<BudgetPlanner wallet={insightWallet} transactions={data.transactions} categories={data.categories} date={insightDate}/>`)
}
writeFileSync(path,s)
console.log('Added wallet monthly budgets to Insights')

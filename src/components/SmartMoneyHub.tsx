import { useMemo, useState } from 'react'
import { Brain, CalendarClock, Crown, FileText, Send, Sparkles, TrendingDown, TrendingUp, Users } from 'lucide-react'
import type { Transaction, Wallet } from '../lib/db'

type Props = { wallet?: Wallet; transactions: Transaction[]; date: string }
const fmt = (n: number, c: 'USD' | 'LBP') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'LBP' ? 0 : 2 }).format(n)
const monthKey = (d: string) => d.slice(0, 7)
const prevMonth = (d: string) => { const x = new Date(`${d.slice(0, 7)}-01T12:00:00`); x.setMonth(x.getMonth() - 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const merchant = (t: Transaction) => (t.title || t.note || t.category || 'Transaction').trim()

export default function SmartMoneyHub({ wallet, transactions, date }: Props) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [proOpen, setProOpen] = useState(false)
  const stats = useMemo(() => {
    if (!wallet) return null
    const current = monthKey(date), previous = prevMonth(date)
    const own = transactions.filter(t => t.walletId === wallet.id)
    const expenses = own.filter(t => t.type === 'expense' && monthKey(t.date) === current)
    const prevExpenses = own.filter(t => t.type === 'expense' && monthKey(t.date) === previous)
    const income = own.filter(t => t.type === 'income' && monthKey(t.date) === current).reduce((s,t) => s+t.amount,0)
    const spent = expenses.reduce((s,t) => s+t.amount,0)
    const prevSpent = prevExpenses.reduce((s,t) => s+t.amount,0)
    const byCat = new Map<string, number>()
    expenses.forEach(t => byCat.set(t.category, (byCat.get(t.category)||0)+t.amount))
    const top = [...byCat.entries()].sort((a,b)=>b[1]-a[1])
    const daysInMonth = new Date(Number(current.slice(0,4)), Number(current.slice(5,7)), 0).getDate()
    const elapsedDays = Math.max(1, Math.min(daysInMonth, current === monthKey(new Date().toISOString().slice(0,10)) ? Number(new Date().toISOString().slice(8,10)) : daysInMonth))
    const dailyAverage = spent / elapsedDays
    const forecast = dailyAverage * daysInMonth
    const groups = new Map<string, Transaction[]>()
    own.filter(t=>t.type==='expense').forEach(t=>{ const k=merchant(t).toLowerCase(); groups.set(k,[...(groups.get(k)||[]),t]) })
    const recurring = [...groups.entries()].map(([name,items])=>({name,items:items.sort((a,b)=>a.date.localeCompare(b.date))}))
      .filter(g=>g.items.length>=2).filter(g=>{const a=g.items[g.items.length-2],b=g.items[g.items.length-1];const days=Math.abs((new Date(b.date).getTime()-new Date(a.date).getTime())/86400000);return days>=25&&days<=35}).slice(0,4)
    return {current,spent,prevSpent,income,net:income-spent,top,expenses,recurring,dailyAverage,forecast,daysInMonth,elapsedDays}
  }, [wallet, transactions, date])
  if (!wallet || !stats) return null
  const delta = stats.prevSpent ? ((stats.spent-stats.prevSpent)/stats.prevSpent)*100 : 0
  const ask = () => {
    const q=question.trim().toLowerCase()
    if(!q)return
    let text='Try asking about spending, income, your top category, monthly forecast, recurring payments, or savings.'
    if(/spend|spent|expense|expenses|صرف/.test(q)) text=`You spent ${fmt(stats.spent,wallet.currency)} this month${stats.prevSpent ? `, ${Math.abs(delta).toFixed(0)}% ${delta>0?'more':'less'} than last month` : ''}.`
    else if(/income|salary|دخل/.test(q)) text=`Income this month is ${fmt(stats.income,wallet.currency)} and your net cash flow is ${fmt(stats.net,wallet.currency)}.`
    else if(/top|category|categories|most|where|وين/.test(q)) text=stats.top.length ? `Your top spending categories are: ${stats.top.slice(0,3).map(([n,v])=>`${n} (${fmt(v,wallet.currency)})`).join(', ')}.` : 'There are no expense categories to compare this month.'
    else if(/save|saving|reduce|وفّر|وفر/.test(q)) text=stats.top.length ? `Your biggest saving opportunity is ${stats.top[0][0]}. Cutting it by 10% would save around ${fmt(stats.top[0][1]*0.1,wallet.currency)} based on this month’s spending.` : 'Add more expenses and I’ll identify your strongest saving opportunity.'
    else if(/forecast|predict|end of month|month end|آخر الشهر/.test(q)) text=`At your current pace, you may spend about ${fmt(stats.forecast,wallet.currency)} by the end of the month. That estimate uses ${stats.elapsedDays} elapsed days and is not a guaranteed prediction.`
    else if(/average|daily|per day|معدل/.test(q)) text=`Your average spending is ${fmt(stats.dailyAverage,wallet.currency)} per day so far this month.`
    else if(/recurring|subscription|monthly payment/.test(q)) text=stats.recurring.length ? `Possible recurring payments: ${stats.recurring.map(r=>merchant(r.items[r.items.length-1])).join(', ')}. Please verify these; they are detected from similar transaction names and dates.` : 'I couldn’t identify likely monthly recurring expenses yet.'
    setAnswer(text);setQuestion('')
  }
  return <section className="smartMoneyHub">
    <div className="smartMoneyTitle"><span><Sparkles size={16}/> Smart Money Coach</span><small>{wallet.name} · Private on-device analysis</small></div>
    <div className="smartInsightGrid">
      <article><div className="smartIcon">{delta<=0?<TrendingDown/>:<TrendingUp/>}</div><b>{stats.prevSpent?`${Math.abs(delta).toFixed(0)}% ${delta<=0?'less':'more'}`:'First month'}</b><small>spending vs last month</small></article>
      <article><div className="smartIcon"><Brain/></div><b>{stats.top[0]?.[0]||'No data yet'}</b><small>{stats.top[0]? `${fmt(stats.top[0][1],wallet.currency)} · top category`:'Start adding expenses'}</small></article>
    </div>
    <article className="moneyReport"><header><span><FileText size={16}/> Monthly Money Report</span><b>{new Date(`${stats.current}-01T12:00:00`).toLocaleDateString('en-US',{month:'long'})}</b></header><div><span><small>Income</small><b>{fmt(stats.income,wallet.currency)}</b></span><span><small>Expenses</small><b>{fmt(stats.spent,wallet.currency)}</b></span><span><small>Net</small><b>{fmt(stats.net,wallet.currency)}</b></span></div></article>
    <article className="moneyReport"><header><span><TrendingUp size={16}/> Spending pace</span><b>{stats.elapsedDays}/{stats.daysInMonth} days</b></header><div><span><small>Daily average</small><b>{fmt(stats.dailyAverage,wallet.currency)}</b></span><span><small>Month-end estimate</small><b>{fmt(stats.forecast,wallet.currency)}</b></span></div><small className="coachDisclaimer">Estimate based on spending so far; future spending may vary.</small></article>
    {stats.top.length>0&&<article className="recurringCard"><header><span><Brain size={16}/> Top spending categories</span></header>{stats.top.slice(0,4).map(([name,value])=><div key={name}><span>{name}</span><b>{fmt(value,wallet.currency)}</b></div>)}</article>}
    {stats.recurring.length>0&&<article className="recurringCard"><header><span><CalendarClock size={16}/> Possible recurring expenses</span></header>{stats.recurring.map(r=><div key={r.name}><span>{merchant(r.items[r.items.length-1])}</span><b>{fmt(r.items[r.items.length-1].amount,wallet.currency)} / month</b></div>)}<small className="coachDisclaimer">Detected from similar names and dates. Check before treating these as subscriptions.</small></article>}
    <article className="askSpenza"><header><span><Brain size={16}/> Ask Spenza</span><small>Rule-based · no external AI or API cost</small></header>{answer&&<div className="askAnswer">{answer}</div>}<div><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')ask()}} placeholder="Ask about your spending..." /><button onClick={ask} aria-label="Ask"><Send size={17}/></button></div><div className="askChips"><button onClick={()=>setQuestion('How much did I spend?')}>Spending</button><button onClick={()=>setQuestion('Where can I save?')}>Save money</button><button onClick={()=>setQuestion('Forecast my month end spending')}>Forecast</button><button onClick={()=>setQuestion('Show my top categories')}>Top categories</button></div></article>
    <div className="growthCards"><button onClick={()=>setProOpen(true)}><Crown/><span><b>Spenza Pro</b><small>Smart Scan · advanced insights · automation</small></span></button><button onClick={()=>setProOpen(true)}><Users/><span><b>Family & Shared</b><small>Shared household money, coming with Pro</small></span></button></div>
    {proOpen&&<div className="proBackdrop" onClick={()=>setProOpen(false)}><section className="proSheet" onClick={e=>e.stopPropagation()}><div className="proHandle"/><Crown className="proCrown"/><h2>Spenza Pro</h2><p>Your money, with less work.</p><ul><li>Unlimited Smart Receipt Scan</li><li>Advanced money insights</li><li>Recurring expense intelligence</li><li>Ask Spenza</li><li>Family & shared wallets</li></ul><div className="proPrices"><button><b>$14.99</b><small>per year · Best value</small></button><button><b>$1.99</b><small>per month</small></button></div><button className="proTrial" onClick={()=>setProOpen(false)}>Pro billing foundation ready</button><small className="proNote">Payments are not charged until a store/payment provider is connected.</small></section></div>}
  </section>
}

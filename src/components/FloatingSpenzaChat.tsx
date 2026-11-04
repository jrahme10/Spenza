import { useMemo, useState } from 'react'
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import type { Transaction, Wallet } from '../lib/db'
import { getSupabaseClient } from '../lib/supabaseClient'

type Props = { wallet?: Wallet; transactions: Transaction[]; date: string }
type Message = { role: 'user' | 'assistant'; text: string }
const monthKey = (d: string) => d.slice(0, 7)
const previousMonth = (d: string) => { const x = new Date(`${d.slice(0, 7)}-01T12:00:00`); x.setMonth(x.getMonth() - 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const merchant = (t: Transaction) => (t.title || t.note || t.category || 'Transaction').trim()

export default function FloatingSpenzaChat({ wallet, transactions, date }: Props) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const context = useMemo(() => {
    if (!wallet) return {}
    const current = monthKey(date), previous = previousMonth(date)
    const own = transactions.filter(t => t.walletId === wallet.id)
    const expenses = own.filter(t => t.type === 'expense' && monthKey(t.date) === current)
    const prev = own.filter(t => t.type === 'expense' && monthKey(t.date) === previous)
    const income = own.filter(t => t.type === 'income' && monthKey(t.date) === current).reduce((s,t) => s+t.amount,0)
    const spent = expenses.reduce((s,t) => s+t.amount,0)
    const categories = new Map<string, number>()
    expenses.forEach(t => categories.set(t.category,(categories.get(t.category)||0)+t.amount))
    const days = new Date(Number(current.slice(0,4)),Number(current.slice(5,7)),0).getDate()
    const elapsed = Math.max(1,Math.min(days,current===monthKey(new Date().toISOString().slice(0,10))?Number(new Date().toISOString().slice(8,10)):days))
    const groups = new Map<string,Transaction[]>()
    own.filter(t=>t.type==='expense').forEach(t=>{const k=merchant(t).toLowerCase();groups.set(k,[...(groups.get(k)||[]),t])})
    const recurring = [...groups.values()].filter(items=>items.length>=2).filter(items=>{const a=items[items.length-2],b=items[items.length-1];const gap=Math.abs((new Date(b.date).getTime()-new Date(a.date).getTime())/86400000);return gap>=25&&gap<=35}).slice(0,4).map(items=>({name:merchant(items[items.length-1]),amount:items[items.length-1].amount}))
    return {currency:wallet.currency,month:current,spent,previousMonthSpent:prev.reduce((s,t)=>s+t.amount,0),income,net:income-spent,dailyAverage:spent/elapsed,monthEndEstimate:spent/elapsed*days,topCategories:[...categories.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amount])=>({name,amount})),possibleRecurring:recurring}
  },[wallet,transactions,date])
  const send = async () => {
    const q=question.trim(); if(!q||asking)return
    const supabase=getSupabaseClient()
    if(!supabase){setError('Sign in and connect Spenza Cloud to use Spenza Coach.');return}
    setMessages(m=>[...m,{role:'user',text:q}]);setQuestion('');setAsking(true);setError('')
    try {
      const {data,error:invokeError}=await supabase.functions.invoke('finance-ai',{body:{question:q,context}})
      if(invokeError)throw invokeError
      if(typeof data?.answer!=='string'||!data.answer)throw new Error(data?.error||'Unexpected assistant response.')
      setMessages(m=>[...m,{role:'assistant',text:data.answer}])
    } catch(e) {
      const msg=e instanceof Error?e.message:'Could not reach Spenza Coach.'
      const status=Number((e as {context?:{status?:number}})?.context?.status||0)
      setError(status===429||msg.includes('429')?'Free daily limit reached or Gemini is temporarily busy. Try again later.':msg)
    } finally {setAsking(false)}
  }
  return <>
    <button className="spenzaAiLauncher" onClick={()=>setOpen(true)} aria-label="Open Spenza AI chat"><Sparkles size={21}/><span>Ask Spenza</span></button>
    {open&&<div className="spenzaChatBackdrop" onClick={()=>setOpen(false)}><section className="spenzaChatWindow" role="dialog" aria-modal="true" aria-label="Spenza Coach" onClick={e=>e.stopPropagation()}>
      <header className="spenzaChatHeader"><div className="spenzaChatAvatar"><Bot size={20}/></div><div><b>Spenza Coach</b><small>Personal finance assistant · Free</small></div><button onClick={()=>setOpen(false)} aria-label="Close chat"><X size={20}/></button></header>
      <div className="spenzaChatMessages">{messages.length===0&&<div className="spenzaChatWelcome"><div className="spenzaChatWelcomeIcon"><Sparkles size={22}/></div><h2>Hi! I'm Spenza Coach</h2><p>Ask about spending, budgets, income, savings, or monthly trends.</p><div className="spenzaChatSuggestions">{['How much did I spend this month?','Where can I save money?','What are my top spending categories?'].map(p=><button key={p} onClick={()=>setQuestion(p)}>{p}</button>)}</div></div>}{messages.map((m,i)=><div className={`spenzaChatMessage ${m.role}`} key={i}><span>{m.text}</span></div>)}{asking&&<div className="spenzaChatTyping">Spenza is thinking…</div>}{error&&<div className="spenzaChatError" role="status">{error}</div>}</div>
      <form className="spenzaChatComposer" onSubmit={e=>{e.preventDefault();void send()}}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about your money..." maxLength={500} disabled={asking}/><button type="submit" disabled={!question.trim()||asking} aria-label="Send message"><Send size={18}/></button></form><p className="spenzaChatFootnote">Finance questions only · Cannot change your transactions</p>
    </section></div>}
  </>
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Send, Sparkles, X, ArrowRight, ReceiptText, Mic, MicOff } from 'lucide-react'
import type { Transaction, Wallet, Currency, TransactionType } from '../lib/db'
import { getSupabaseClient } from '../lib/supabaseClient'

export type ChatTransactionDraft = {
  type: Exclude<TransactionType, 'transfer'>
  amount: number
  currency: Currency
  title: string
  category: string
  date: string
  note: string
}
type Props = {
  wallet?: Wallet
  transactions: Transaction[]
  date: string
  categories: string[]
  onReviewTransaction: (draft: ChatTransactionDraft) => boolean
}
type Message = { role: 'user' | 'assistant'; text: string; draft?: ChatTransactionDraft }
type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
const monthKey = (d: string) => d.slice(0, 7)
const previousMonth = (d: string) => { const x = new Date(`${d.slice(0, 7)}-01T12:00:00`); x.setMonth(x.getMonth() - 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const merchant = (t: Transaction) => (t.title || t.note || t.category || 'Transaction').trim()
const formatAmount = (amount: number, currency: Currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'LBP' ? 0 : 2 }).format(amount)

export default function FloatingSpenzaChat({ wallet, transactions, date, categories, onReviewTransaction }: Props) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [listening, setListening] = useState(false)
  const [speechLanguage, setSpeechLanguage] = useState<'en-US' | 'ar-LB'>('en-US')
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  useEffect(() => () => recognition.current?.stop(), [])
  const toggleRecording = () => {
    if (listening) { recognition.current?.stop(); setListening(false); return }
    const browser = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition
    if (!Recognition) { setVoiceError('Voice input is not supported in this browser. You can still type or use your phone keyboard dictation.'); return }
    try {
      setVoiceError('')
      const recorder = new Recognition()
      recorder.lang = speechLanguage
      recorder.continuous = true
      recorder.interimResults = false
      recorder.onresult = event => {
        const transcript = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim()
        if (transcript) setQuestion(current => current.trim() ? current.trim() + ' ' + transcript : transcript)
      }
      recorder.onerror = event => {
        setListening(false)
        setVoiceError(event.error === 'not-allowed' ? 'Microphone permission denied. Allow microphone access and try again.' : 'Could not recognize your speech. Please try again.')
      }
      recorder.onend = () => setListening(false)
      recognition.current = recorder
      setListening(true)
      recorder.start()
    } catch { setListening(false); setVoiceError('Could not start the microphone. Please try again.') }
  }
  const context = useMemo(() => {
    if (!wallet) return {}
    const current = monthKey(date), previous = previousMonth(date)
    const own = transactions.filter(t => t.walletId === wallet.id)
    const expenses = own.filter(t => t.type === 'expense' && monthKey(t.date) === current)
    const prev = own.filter(t => t.type === 'expense' && monthKey(t.date) === previous)
    const income = own.filter(t => t.type === 'income' && monthKey(t.date) === current).reduce((s,t) => s+t.amount,0)
    const spent = expenses.reduce((s,t) => s+t.amount,0)
    const categoryTotals = new Map<string, number>()
    expenses.forEach(t => categoryTotals.set(t.category,(categoryTotals.get(t.category)||0)+t.amount))
    const days = new Date(Number(current.slice(0,4)),Number(current.slice(5,7)),0).getDate()
    const elapsed = Math.max(1,Math.min(days,current===monthKey(date)?Number(date.slice(8,10)):days))
    const groups = new Map<string,Transaction[]>()
    own.filter(t=>t.type==='expense').forEach(t=>{const k=merchant(t).toLowerCase();groups.set(k,[...(groups.get(k)||[]),t])})
    const recurring = [...groups.values()].filter(items=>items.length>=2).filter(items=>{const a=items[items.length-2],b=items[items.length-1];const gap=Math.abs((new Date(b.date).getTime()-new Date(a.date).getTime())/86400000);return gap>=25&&gap<=35}).slice(0,4).map(items=>({name:merchant(items[items.length-1]),amount:items[items.length-1].amount}))
    return {currency:wallet.currency,month:current,spent,previousMonthSpent:prev.reduce((s,t)=>s+t.amount,0),income,net:income-spent,dailyAverage:spent/elapsed,monthEndEstimate:spent/elapsed*days,topCategories:[...categoryTotals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amount])=>({name,amount})),possibleRecurring:recurring}
  },[wallet,transactions,date])
  const send = async () => {
    const q=question.trim(); if(!q||asking)return
    const supabase=getSupabaseClient()
    if(!supabase){setError('Sign in and connect Spenza Cloud to use Spenza Coach.');return}
    setMessages(m=>[...m,{role:'user',text:q}]);setQuestion('');setAsking(true);setError('')
    try {
      const {data,error:invokeError}=await supabase.functions.invoke('finance-ai',{body:{question:q,context,categories,defaultCurrency:wallet?.currency || 'USD',today:date}})
      if(invokeError)throw invokeError
      if(typeof data?.answer!=='string'||!data.answer)throw new Error(data?.error||'Unexpected assistant response.')
      const draft = data?.action === 'create_transaction' && data?.transaction ? data.transaction as ChatTransactionDraft : undefined
      setMessages(m=>[...m,{role:'assistant',text:data.answer,draft}])
    } catch(e) {
      const msg=e instanceof Error?e.message:'Could not reach Spenza Coach.'
      const status=Number((e as {context?:{status?:number}})?.context?.status||0)
      setError(status===429||msg.includes('429')?'Free daily limit reached or Gemini is temporarily busy. Try again later.':msg)
    } finally {setAsking(false)}
  }
  const closeChat = () => { recognition.current?.stop(); setListening(false); setOpen(false) }
  const reviewDraft = (draft: ChatTransactionDraft) => {
    if (onReviewTransaction(draft)) setOpen(false)
  }
  return <>
    <button className="spenzaAiLauncher" onClick={()=>setOpen(true)} aria-label="Open Spenza AI chat"><Sparkles size={21}/></button>
    {open&&<div className="spenzaChatBackdrop" onClick={closeChat}><section className="spenzaChatWindow" role="dialog" aria-modal="true" aria-label="Spenza Coach" onClick={e=>e.stopPropagation()}>
      <header className="spenzaChatHeader"><div className="spenzaChatAvatar"><Bot size={20}/></div><div><b>Spenza Coach</b><small>Personal finance assistant · Free</small></div><button onClick={closeChat} aria-label="Close chat"><X size={20}/></button></header>
      <div className="spenzaChatMessages">{messages.length===0&&<div className="spenzaChatWelcome"><div className="spenzaChatWelcomeIcon"><Sparkles size={22}/></div><h2>Hi! I'm Spenza Coach</h2><p>Ask about spending, budgets, income, savings — or add a transaction by chatting.</p><div className="spenzaChatSuggestions">{['I spent $12 on lunch','I received $500 salary','How much did I spend this month?'].map(p=><button key={p} onClick={()=>setQuestion(p)}>{p}</button>)}</div></div>}{messages.map((m,i)=><div className="spenzaChatMessageGroup" key={i}><div className={`spenzaChatMessage ${m.role}`}><span>{m.text}</span></div>{m.draft&&<div className="spenzaChatDraft"><div className="spenzaChatDraftHead"><ReceiptText size={17}/><b>Transaction draft</b><span>{m.draft.type}</span></div><strong>{formatAmount(m.draft.amount,m.draft.currency)}</strong><p>{m.draft.title} · {m.draft.category}</p><small>{m.draft.date}{m.draft.note ? ` · ${m.draft.note}` : ''}</small><button onClick={()=>reviewDraft(m.draft!)}>Review & continue <ArrowRight size={16}/></button></div>}</div>)}{asking&&<div className="spenzaChatTyping">Spenza is thinking…</div>}{error&&<div className="spenzaChatError" role="status">{error}</div>}</div>
      <form className="spenzaChatComposer" onSubmit={e=>{e.preventDefault();void send()}}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Type or speak your message..." maxLength={500} disabled={asking}/><select className="spenzaChatLanguage" aria-label="Voice input language" value={speechLanguage} onChange={e=>setSpeechLanguage(e.target.value as 'en-US'|'ar-LB')} disabled={listening}><option value="en-US">EN</option><option value="ar-LB">AR</option></select><button type="button" className={listening?'spenzaChatMic listening':'spenzaChatMic'} onClick={toggleRecording} aria-label={listening?'Stop voice recording':'Start voice recording'} aria-pressed={listening}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button><button type="submit" disabled={!question.trim()||asking} aria-label="Send message"><Send size={18}/></button></form>{voiceError&&<p className="spenzaChatVoiceError" role="status">{voiceError}</p>}{listening&&<p className="spenzaChatRecording" role="status">Listening… speak now, then tap the microphone to stop.</p>}<p className="spenzaChatFootnote">AI prepares a draft — you review and save it. Nothing is saved automatically.</p>
    </section></div>}
  </>
}

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
  wallets: Wallet[]
  transactions: Transaction[]
  date: string
  categories: string[]
  onReviewTransaction: (draft: ChatTransactionDraft) => boolean
}
type Message = { role: 'user' | 'assistant'; text: string; draft?: ChatTransactionDraft }
const monthKey = (d: string) => d.slice(0, 7)
const previousMonth = (d: string) => { const x = new Date(`${d.slice(0, 7)}-01T12:00:00`); x.setMonth(x.getMonth() - 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const merchant = (t: Transaction) => (t.title || t.note || t.category || 'Transaction').trim()
const formatAmount = (amount: number, currency: Currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'LBP' ? 0 : 2 }).format(amount)

export default function FloatingSpenzaChat({ wallet, wallets, transactions, date, categories, onReviewTransaction }: Props) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const mediaStream = useRef<MediaStream | null>(null)
  const audioChunks = useRef<BlobPart[]>([])
  const recordingTimer = useRef<number | null>(null)
  const discardRecording = useRef(false)

  useEffect(() => () => {
    discardRecording.current = true
    if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current)
    recorder.current?.stop()
    mediaStream.current?.getTracks().forEach(track => track.stop())
  }, [])

  const transcribeRecording = async (blob: Blob) => {
    if (!blob.size) { setVoiceError('No audio was captured. Please try again.'); return }
    if (blob.size > 4 * 1024 * 1024) { setVoiceError('Recording is too large. Please record a shorter message.'); return }
    setTranscribing(true)
    setVoiceError('')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the recording.'))
        reader.onerror = () => reject(new Error('Could not read the recording.'))
        reader.readAsDataURL(blob)
      })
      const audioBase64 = dataUrl.split(',')[1]
      const supabase = getSupabaseClient()
      if (!supabase) throw new Error('Sign in and connect Spenza Cloud to use voice input.')
      const { data, error: invokeError } = await supabase.functions.invoke('finance-ai', {
        body: { action: 'transcribe', audioBase64, mimeType: blob.type.startsWith('audio/mp4') ? 'audio/m4a' : blob.type.split(';')[0] || 'audio/webm' },
      })
      if (invokeError) throw invokeError
      const transcript = typeof data?.transcript === 'string' ? data.transcript.trim() : ''
      if (!transcript) throw new Error(data?.error || 'No speech was detected. Please try again.')
      setQuestion(current => current.trim() ? current.trim() + ' ' + transcript : transcript)
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : 'Could not transcribe your recording. Please try again.')
    } finally {
      setTranscribing(false)
    }
  }

  const toggleRecording = async () => {
    if (listening) {
      recorder.current?.stop()
      setListening(false)
      if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current)
      recordingTimer.current = null
      return
    }
    if (transcribing || asking) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Audio recording is not supported in this browser. You can still type your message.')
      return
    }
    try {
      setVoiceError('')
      discardRecording.current = false
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStream.current = stream
      audioChunks.current = []
      const supportedTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg;codecs=opus']
      const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type))
      const activeRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorder.current = activeRecorder
      activeRecorder.ondataavailable = event => { if (event.data.size) audioChunks.current.push(event.data) }
      activeRecorder.onerror = () => setVoiceError('Recording failed. Please try again.')
      activeRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        mediaStream.current = null
        recorder.current = null
        setListening(false)
        if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current)
        recordingTimer.current = null
        const blob = new Blob(audioChunks.current, { type: activeRecorder.mimeType || 'audio/webm' })
        audioChunks.current = []
        if (!discardRecording.current) void transcribeRecording(blob)
      }
      activeRecorder.start(1000)
      setListening(true)
      recordingTimer.current = window.setTimeout(() => {
        if (activeRecorder.state === 'recording') activeRecorder.stop()
      }, 45000)
    } catch (e) {
      mediaStream.current?.getTracks().forEach(track => track.stop())
      mediaStream.current = null
      setListening(false)
      const name = (e as { name?: string })?.name
      setVoiceError(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Microphone permission denied. Allow microphone access and try again.'
        : 'Could not start the microphone. Please try again.')
    }
  }
  const context = useMemo(() => {
    const current = monthKey(date), previous = previousMonth(date)
    const walletCurrencies = new Map(wallets.map(item => [item.id, item.currency]))
    const currencyOf = (transaction: Transaction): Currency => walletCurrencies.get(transaction.walletId) || (wallet?.id === transaction.walletId ? wallet.currency : 'USD')
    const sumByCurrency = (items: Transaction[]) => {
      const totals = new Map<Currency, number>()
      items.forEach(item => {
        const currency = currencyOf(item)
        totals.set(currency, (totals.get(currency) || 0) + item.amount)
      })
      return [...totals.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * (currency === 'LBP' ? 1 : 100)) / (currency === 'LBP' ? 1 : 100) }))
    }
    const currentMonthTransactions = transactions.filter(item => monthKey(item.date) === current)
    const previousMonthTransactions = transactions.filter(item => monthKey(item.date) === previous)
    const expenses = currentMonthTransactions.filter(item => item.type === 'expense')
    const previousExpenses = previousMonthTransactions.filter(item => item.type === 'expense')
    const incomes = currentMonthTransactions.filter(item => item.type === 'income')
    const spentByCurrency = sumByCurrency(expenses)
    const previousMonthSpentByCurrency = sumByCurrency(previousExpenses)
    const incomeByCurrency = sumByCurrency(incomes)
    const netByCurrency = [...new Set([...spentByCurrency, ...incomeByCurrency].map(item => item.currency))].map(currency => ({
      currency,
      amount: (incomeByCurrency.find(item => item.currency === currency)?.amount || 0) - (spentByCurrency.find(item => item.currency === currency)?.amount || 0),
    }))
    const categoryTotals = new Map<string, number>()
    expenses.forEach(item => {
      const key = currencyOf(item) + ':' + item.category
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + item.amount)
    })
    const days = new Date(Number(current.slice(0,4)), Number(current.slice(5,7)), 0).getDate()
    const elapsed = Math.max(1, Math.min(days, current === monthKey(date) ? Number(date.slice(8,10)) : days))
    const dailyAverageByCurrency = spentByCurrency.map(item => ({ currency: item.currency, amount: item.amount / elapsed }))
    const monthEndEstimateByCurrency = spentByCurrency.map(item => ({ currency: item.currency, amount: item.amount / elapsed * days }))
    const recurringGroups = new Map<string, Transaction[]>()
    transactions.filter(item => item.type === 'expense').forEach(item => {
      const key = currencyOf(item) + ':' + merchant(item).toLowerCase()
      recurringGroups.set(key, [...(recurringGroups.get(key) || []), item])
    })
    const possibleRecurring = [...recurringGroups.entries()].filter(([, items]) => items.length >= 2).filter(([, items]) => {
      const sorted = [...items].sort((a,b) => a.date.localeCompare(b.date))
      const a = sorted[sorted.length - 2], b = sorted[sorted.length - 1]
      const gap = Math.abs((new Date(b.date).getTime() - new Date(a.date).getTime()) / 86400000)
      return gap >= 25 && gap <= 35
    }).slice(0,4).map(([key, items]) => ({
      name: merchant(items[items.length - 1]),
      currency: key.split(':')[0],
      amount: items[items.length - 1].amount,
    }))
    return {
      scope: 'all wallets',
      walletCount: wallets.length,
      month: current,
      spentByCurrency,
      previousMonthSpentByCurrency,
      incomeByCurrency,
      netByCurrency,
      dailyAverageByCurrency,
      monthEndEstimateByCurrency,
      topCategories: [...categoryTotals.entries()].sort((a,b) => b[1] - a[1]).slice(0,5).map(([key, amount]) => {
        const separator = key.indexOf(':')
        return { currency: key.slice(0, separator), name: key.slice(separator + 1), amount }
      }),
      possibleRecurring,
    }
  }, [wallet, wallets, transactions, date])
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
  const closeChat = () => {
    discardRecording.current = true
    if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current)
    recordingTimer.current = null
    recorder.current?.stop()
    mediaStream.current?.getTracks().forEach(track => track.stop())
    mediaStream.current = null
    setListening(false)
    setOpen(false)
  }
  const reviewDraft = (draft: ChatTransactionDraft) => {
    if (onReviewTransaction(draft)) setOpen(false)
  }
  return <>
    <button className="spenzaAiLauncher" onClick={()=>setOpen(true)} aria-label="Open Spenza AI chat"><Sparkles size={21}/></button>
    {open&&<div className="spenzaChatBackdrop" onClick={closeChat}><section className="spenzaChatWindow" role="dialog" aria-modal="true" aria-label="Spenza Coach" onClick={e=>e.stopPropagation()}>
      <header className="spenzaChatHeader"><div className="spenzaChatAvatar"><Bot size={20}/></div><div><b>Spenza Coach</b><small>Personal finance assistant · Free</small></div><button onClick={closeChat} aria-label="Close chat"><X size={20}/></button></header>
      <div className="spenzaChatMessages">{messages.length===0&&<div className="spenzaChatWelcome"><div className="spenzaChatWelcomeIcon"><Sparkles size={22}/></div><h2>Hi! I'm Spenza Coach</h2><p>Ask about spending, budgets, income, savings — or add a transaction by chatting.</p><div className="spenzaChatSuggestions">{['I spent $12 on lunch','I received $500 salary','How much did I spend this month?'].map(p=><button key={p} onClick={()=>setQuestion(p)}>{p}</button>)}</div></div>}{messages.map((m,i)=><div className="spenzaChatMessageGroup" key={i}><div className={`spenzaChatMessage ${m.role}`}><span>{m.text}</span></div>{m.draft&&<div className="spenzaChatDraft"><div className="spenzaChatDraftHead"><ReceiptText size={17}/><b>Transaction draft</b><span>{m.draft.type}</span></div><strong>{formatAmount(m.draft.amount,m.draft.currency)}</strong><p>{m.draft.title} · {m.draft.category}</p><small>{m.draft.date}{m.draft.note ? ` · ${m.draft.note}` : ''}</small><button onClick={()=>reviewDraft(m.draft!)}>Review & continue <ArrowRight size={16}/></button></div>}</div>)}{asking&&<div className="spenzaChatTyping">Spenza is thinking…</div>}{error&&<div className="spenzaChatError" role="status">{error}</div>}</div>
      <form className="spenzaChatComposer" onSubmit={e=>{e.preventDefault();void send()}}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Type or speak your message..." maxLength={1200} disabled={asking||transcribing}/><button type="button" className={listening?'spenzaChatMic listening':'spenzaChatMic'} onClick={toggleRecording} disabled={asking||transcribing} aria-label={listening?'Stop voice recording':'Start voice recording'} aria-pressed={listening}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button><button type="submit" disabled={!question.trim()||asking||transcribing} aria-label="Send message"><Send size={18}/></button></form>{voiceError&&<p className="spenzaChatVoiceError" role="status">{voiceError}</p>}{listening&&<p className="spenzaChatRecording" role="status">Recording… tap the microphone to finish (45-second limit).</p>}{transcribing&&<p className="spenzaChatRecording" role="status">Detecting language and transcribing…</p>}<p className="spenzaChatFootnote">AI prepares a draft — you review and save it. Nothing is saved automatically.</p>
    </section></div>}
  </>
}

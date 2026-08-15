import { useMemo, useState } from 'react'
import { CalendarClock, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Bill, BillRecurrence, BillReminder, Currency, SpenzaData, Transaction, uid } from '../lib/db'

type Props = {
  data: SpenzaData
  setData: React.Dispatch<React.SetStateAction<SpenzaData>>
}

type BillForm = {
  id?: string
  name: string
  amount: string
  walletId: string
  category: string
  dueDate: string
  recurrence: BillRecurrence
  reminderDays: BillReminder
  note: string
}

const today = () => new Date().toISOString().slice(0, 10)
const money = (n:number,c:Currency) => new Intl.NumberFormat('en-US',{style:'currency',currency:c,maximumFractionDigits:c==='LBP'?0:2}).format(n)

function nextDueDate(date:string, recurrence:BillRecurrence){
  if(recurrence==='once') return date
  const d=new Date(`${date}T12:00:00`)
  if(recurrence==='monthly') d.setMonth(d.getMonth()+1)
  else d.setFullYear(d.getFullYear()+1)
  return d.toISOString().slice(0,10)
}

export default function BillsManager({data,setData}:Props){
  const [form,setForm]=useState<BillForm|null>(null)
  const [filter,setFilter]=useState<'all'|'upcoming'|'overdue'>('all')

  const sorted=useMemo(()=>[...data.bills].sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),[data.bills])
  const visible=sorted.filter(b=>filter==='all'||(filter==='overdue'?b.dueDate<today():b.dueDate>=today()))

  const openNew=()=>setForm({name:'',amount:'',walletId:data.wallets[0]?.id||'',category:data.categories.includes('Bills')?'Bills':data.categories[0]||'Other',dueDate:today(),recurrence:'monthly',reminderDays:3,note:''})
  const openEdit=(b:Bill)=>setForm({id:b.id,name:b.name,amount:String(b.amount),walletId:b.walletId,category:b.category,dueDate:b.dueDate,recurrence:b.recurrence,reminderDays:b.reminderDays,note:b.note||''})
  const save=()=>{
    if(!form) return
    const amount=Number(form.amount)
    if(!form.name.trim()||!form.walletId||!amount||amount<=0||!form.dueDate) return
    const now=new Date().toISOString()
    const existing=data.bills.find(b=>b.id===form.id)
    const bill:Bill={id:form.id||uid(),name:form.name.trim(),amount,walletId:form.walletId,category:form.category,dueDate:form.dueDate,recurrence:form.recurrence,reminderDays:form.reminderDays,note:form.note.trim()||undefined,lastPaidDate:existing?.lastPaidDate,createdAt:existing?.createdAt||now,updatedAt:now}
    setData(d=>({...d,bills:form.id?d.bills.map(b=>b.id===form.id?bill:b):[...d.bills,bill]}))
    setForm(null)
  }
  const remove=(id:string)=>{if(!window.confirm('Delete this bill?'))return;setData(d=>({...d,bills:d.bills.filter(b=>b.id!==id)}))}
  const markPaid=(bill:Bill)=>{
    const wallet=data.wallets.find(w=>w.id===bill.walletId)
    if(!wallet) return
    const paidDate=today()
    const now=new Date().toISOString()
    const tx:Transaction={id:uid(),type:'expense',title:bill.name,category:bill.category,amount:bill.amount,walletId:bill.walletId,date:paidDate,note:bill.note?`${bill.note} · Paid from Bills`:'Paid from Bills',createdAt:now,updatedAt:now}
    setData(d=>({...d,transactions:[tx,...d.transactions],bills:d.bills.map(b=>b.id!==bill.id?b:{...b,lastPaidDate:paidDate,dueDate:b.recurrence==='once'?b.dueDate:nextDueDate(b.dueDate,b.recurrence),updatedAt:now})}))
  }

  return <section className="page refPage billsPage">
    <div className="centerPageHead withAction"><h1>Bills</h1><button className="iconAdd" onClick={openNew}><Plus/></button></div>
    <div className="filters refFilters billsFilters"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>All</button><button className={filter==='upcoming'?'selected':''} onClick={()=>setFilter('upcoming')}>Upcoming</button><button className={filter==='overdue'?'selected':''} onClick={()=>setFilter('overdue')}>Overdue</button></div>
    {!data.wallets.length&&<div className="empty">Create an account before adding bills.</div>}
    {visible.length?<div className="billsList">{visible.map(b=>{const w=data.wallets.find(x=>x.id===b.walletId);const overdue=b.dueDate<today();return <article className={`billCard ${overdue?'overdue':''}`} key={b.id}><div className="billIcon"><CalendarClock/></div><div className="billMain"><div className="billTitleRow"><b>{b.name}</b><span className={overdue?'billStatus overdueText':'billStatus'}>{overdue?'Overdue':'Due'} {new Date(`${b.dueDate}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div><strong>{money(b.amount,w?.currency||'USD')}</strong><small>{w?.name||'Missing account'} · {b.category} · {b.recurrence==='once'?'One-time':b.recurrence} · Reminder {b.reminderDays===0?'same day':`${b.reminderDays}d before`}</small></div><div className="billActions"><button className="billPaid" onClick={()=>markPaid(b)} title="Mark paid"><Check/></button><button onClick={()=>openEdit(b)} title="Edit"><Pencil/></button><button onClick={()=>remove(b.id)} title="Delete"><Trash2/></button></div></article>})}</div>:data.wallets.length?<div className="empty">No bills in this view.</div>:null}

    {form&&<div className="overlay" onClick={()=>setForm(null)}><div className="sheet refSheet billSheet" onClick={e=>e.stopPropagation()}><div className="sheetTop"><div><span className="eyebrow">{form.id?'EDIT':'NEW'} BILL</span><h2>{form.id?'Edit Bill':'Add Bill'}</h2></div><button className="close" onClick={()=>setForm(null)}><X/></button></div><label>Bill name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Rent, Internet, Electricity..." autoFocus/></label><label>Amount<input className="amountInput" type="number" inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00"/></label><label>Account<select value={form.walletId} onChange={e=>setForm({...form,walletId:e.target.value})}><option value="">Select Account</option>{data.wallets.map(w=><option value={w.id} key={w.id}>{w.name} ({w.currency})</option>)}</select></label><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{data.categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Due date<input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label><label>Repeat<select value={form.recurrence} onChange={e=>setForm({...form,recurrence:e.target.value as BillRecurrence})}><option value="once">One-time</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label>Reminder<select value={form.reminderDays} onChange={e=>setForm({...form,reminderDays:Number(e.target.value) as BillReminder})}><option value={0}>On due date</option><option value={1}>1 day before</option><option value={3}>3 days before</option><option value={7}>1 week before</option></select></label><label>Note<input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Optional note"/></label><button className="primary" onClick={save}>{form.id?'Save Bill':'Create Bill'}</button></div></div>}
  </section>
}

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pencil, Trash2 } from 'lucide-react'
import { Currency, Transaction, Wallet } from '../lib/db'

const money=(n:number,c:Currency|'USD'='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c,maximumFractionDigits:c==='LBP'?0:2}).format(n)

type Props={
 transaction:Transaction
 wallets:Wallet[]
 onEdit:(transaction:Transaction)=>void
 onRemove:(id:string)=>void
}

export default function TransactionRow({transaction:t,wallets,onEdit,onRemove}:Props){
 const wallet=wallets.find(x=>x.id===t.walletId)
 const sign=t.type==='income'?'+':t.type==='expense'?'-':'−'
 const photos=t.noteImages?.length||0
 return <div className={`tx ${t.type}`}>
  <div className={`txIcon ${t.type}`}>{t.type==='income'?<ArrowDownLeft/>:t.type==='transfer'?<ArrowLeftRight/>:<ArrowUpRight/>}</div>
  <div className="txMain"><b>{t.title}</b><span>{t.note?`${t.note} · `:''}{wallet?.name||'No wallet'}{photos?` · 📷 ${photos}`:''}</span></div>
  <div className="txAmount"><strong className={t.type==='income'?'positive':''}>{sign}{money(t.amount,wallet?.currency||'USD')}</strong><small>{t.date}</small></div>
  <div className="txActions"><button onClick={()=>onEdit(t)}><Pencil/></button><button onClick={()=>onRemove(t.id)}><Trash2/></button></div>
 </div>
}

import { useMemo, useState } from 'react'
import { BarChart3, Bell, CreditCard, Home, Plus, Search, Settings, Sparkles, WalletCards } from 'lucide-react'

type Tx={id:number;name:string;category:string;amount:number;date:string;icon:string}
const seed:Tx[]=[
{id:1,name:'Whole Foods',category:'Groceries',amount:-86.42,date:'Today',icon:'🛒'},
{id:2,name:'Salary',category:'Income',amount:4200,date:'Today',icon:'💼'},
{id:3,name:'Netflix',category:'Entertainment',amount:-15.49,date:'Yesterday',icon:'🎬'},
{id:4,name:'Uber',category:'Transport',amount:-24.80,date:'Yesterday',icon:'🚕'},
{id:5,name:'Coffee House',category:'Dining',amount:-8.70,date:'Aug 12',icon:'☕'},
]
export default function App(){
 const [tab,setTab]=useState('Home'); const [txs,setTxs]=useState(seed); const [open,setOpen]=useState(false); const [name,setName]=useState(''); const [amount,setAmount]=useState('')
 const spent=useMemo(()=>Math.abs(txs.filter(x=>x.amount<0).reduce((a,b)=>a+b.amount,0)),[txs]); const income=txs.filter(x=>x.amount>0).reduce((a,b)=>a+b.amount,0); const balance=12480+income-spent
 const add=()=>{const n=Number(amount);if(!name||!n)return;setTxs([{id:Date.now(),name,category:'Other',amount:-Math.abs(n),date:'Today',icon:'✨'},...txs]);setName('');setAmount('');setOpen(false)}
 return <div className="shell"><main className="phone">
  <header><div><span className="eyebrow">GOOD MORNING</span><h1>My finances</h1></div><button className="round"><Bell size={19}/></button></header>
  <section className="hero"><div className="heroTop"><span>Total balance</span><span className="pill">● Synced</span></div><strong>${balance.toLocaleString(undefined,{minimumFractionDigits:2})}</strong><div className="heroStats"><div><small>Income</small><b>+${income.toLocaleString()}</b></div><div><small>Spent</small><b>-${spent.toFixed(2)}</b></div></div></section>
  <section className="quick"><button onClick={()=>setOpen(true)}><i><Plus/></i><span>Add expense</span></button><button><i><WalletCards/></i><span>Wallets</span></button><button><i><BarChart3/></i><span>Insights</span></button><button><i><Sparkles/></i><span>Ask Spenza</span></button></section>
  <section className="budget"><div className="row"><div><span className="eyebrow">MONTHLY BUDGET</span><h2>$1,840 <small>of $3,000</small></h2></div><b>61%</b></div><div className="track"><span style={{width:'61%'}}/></div><p>$1,160 remaining · 16 days left</p></section>
  <section className="activity"><div className="sectionHead"><h2>Recent activity</h2><button><Search size={18}/></button></div>{txs.map(t=><div className="tx" key={t.id}><div className="txIcon">{t.icon}</div><div className="txMain"><b>{t.name}</b><span>{t.category} · {t.date}</span></div><strong className={t.amount>0?'positive':''}>{t.amount>0?'+':'-'}${Math.abs(t.amount).toFixed(2)}</strong></div>)}</section>
  <nav>{[['Home',Home],['Activity',CreditCard],['Add',Plus],['Insights',BarChart3],['Settings',Settings]].map(([label,Icon]:any)=><button key={label} className={tab===label?'active':label==='Add'?'addNav':''} onClick={()=>label==='Add'?setOpen(true):setTab(label)}><Icon size={20}/><span>{label}</span></button>)}</nav>
  {open&&<div className="overlay" onClick={()=>setOpen(false)}><div className="sheet" onClick={e=>e.stopPropagation()}><div className="handle"/><span className="eyebrow">NEW TRANSACTION</span><h2>Add an expense</h2><label>Description<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Dinner"/></label><label>Amount<input value={amount} onChange={e=>setAmount(e.target.value)} type="number" placeholder="0.00"/></label><button className="primary" onClick={add}>Save expense</button></div></div>}
 </main></div>
}

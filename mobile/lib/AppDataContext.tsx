import React,{createContext,useContext,useEffect,useMemo,useState} from 'react'
import { loadData, saveData } from './storage'
import type { Bill,Currency,SpenzaMobileData,SyncChange,SyncEntityType,Transaction,Wallet } from './types'
import { defaultData } from './types'

type AddWalletInput={name:string;currency:Currency;openingBalance:number}
type AddTransactionInput=Omit<Transaction,'id'|'createdAt'|'updatedAt'>
type UpsertBillInput=Omit<Bill,'createdAt'|'updatedAt'> & {createdAt?:string;updatedAt?:string}

type AppDataContextValue={
 data:SpenzaMobileData
 ready:boolean
 addWallet:(input:AddWalletInput)=>Promise<Wallet>
 updateWallet:(wallet:Wallet)=>Promise<void>
 deleteWallet:(id:string)=>Promise<void>
 setDefaultWallet:(id?:string)=>Promise<void>
 addTransaction:(input:AddTransactionInput)=>Promise<Transaction>
 updateTransaction:(transaction:Transaction)=>Promise<void>
 deleteTransaction:(id:string)=>Promise<void>
 addCategory:(name:string)=>Promise<void>
 deleteCategory:(name:string)=>Promise<void>
 setRate:(rate:number)=>Promise<void>
 upsertBill:(input:UpsertBillInput)=>Promise<Bill>
 deleteBill:(id:string)=>Promise<void>
 markBillPaid:(id:string)=>Promise<void>
 skipBill:(id:string)=>Promise<void>
 resetData:()=>Promise<void>
 replaceData:(next:SpenzaMobileData)=>Promise<void>
 walletBalance:(wallet:Wallet)=>number
 convert:(value:number,from:Currency,to:Currency)=>number
 pairRate:(from:Currency,to:Currency)=>number
}

const Context=createContext<AppDataContextValue|null>(null)
const uid=()=>`${Date.now()}-${Math.random().toString(16).slice(2)}`
const today=()=>new Date().toISOString().slice(0,10)
function nextDueDate(date:string,recurrence:Bill['recurrence']){
 if(recurrence==='once')return date
 const [year,month,day]=date.split('-').map(Number)
 const d=new Date(year,month-1,day,12)
 if(recurrence==='monthly')d.setMonth(d.getMonth()+1)
 else d.setFullYear(d.getFullYear()+1)
 return d.toISOString().slice(0,10)
}

function queueChange(data:SpenzaMobileData,entityType:SyncEntityType,entityId:string,operation:SyncChange['operation'],changedAt:string):SpenzaMobileData{
 const key=`${entityType}:${entityId}`
 const pending=data.sync.pendingChanges.filter(c=>`${c.entityType}:${c.entityId}`!==key)
 return {...data,sync:{...data.sync,pendingChanges:[...pending,{entityType,entityId,operation,changedAt}]}}
}

export function AppDataProvider({children}:{children:React.ReactNode}){
 const [data,setData]=useState<SpenzaMobileData>(defaultData)
 const [ready,setReady]=useState(false)
 useEffect(()=>{loadData().then(value=>{setData(value);setReady(true)})},[])

 const commit=async(next:SpenzaMobileData)=>{setData(next);await saveData(next)}
 const replaceData=async(next:SpenzaMobileData)=>commit(next)
 const rate=data.usdToLbpRate||89500
 const convert=(value:number,from:Currency,to:Currency)=>from===to?value:from==='USD'?value*rate:value/rate
 const normalize=(value:number,currency:Currency)=>currency==='LBP'?Math.round(value):Math.round(value*100)/100
 const pairRate=(from:Currency,to:Currency)=>from===to?1:from==='USD'?rate:1/rate

 const addWallet=async(input:AddWalletInput)=>{
  const now=new Date().toISOString()
  const wallet:Wallet={id:uid(),...input,createdAt:now,updatedAt:now}
  let next:SpenzaMobileData={...data,wallets:[...data.wallets,wallet],defaultWalletId:data.defaultWalletId||wallet.id}
  next=queueChange(next,'wallet',wallet.id,'upsert',now)
  await commit(next);return wallet
 }
 const updateWallet=async(wallet:Wallet)=>{
  const existing=data.wallets.find(w=>w.id===wallet.id);if(!existing)return
  const now=new Date().toISOString()
  const oldCurrency=existing.currency
  const newCurrency=wallet.currency
  let transactions=data.transactions
  if(oldCurrency!==newCurrency){
   const currencyFor=(id?:string)=>id===wallet.id?newCurrency:data.wallets.find(w=>w.id===id)?.currency
   transactions=data.transactions.map(t=>{
    if(t.walletId!==wallet.id&&t.toWalletId!==wallet.id)return t
    if(t.type!=='transfer')return {...t,amount:normalize(convert(t.amount,oldCurrency,newCurrency),newCurrency),updatedAt:now}
    const sourceBefore=t.walletId===wallet.id?oldCurrency:(data.wallets.find(w=>w.id===t.walletId)?.currency||oldCurrency)
    const sourceAfter=t.walletId===wallet.id?newCurrency:sourceBefore
    const destinationAfter=t.toWalletId===wallet.id?newCurrency:(currencyFor(t.toWalletId)||sourceAfter)
    return {...t,amount:t.walletId===wallet.id?normalize(convert(t.amount,oldCurrency,newCurrency),newCurrency):t.amount,exchangeRate:pairRate(sourceAfter,destinationAfter),updatedAt:now}
   })
  }
  const updated={...wallet,updatedAt:now}
  let next:SpenzaMobileData={...data,wallets:data.wallets.map(w=>w.id===wallet.id?updated:w),transactions}
  next=queueChange(next,'wallet',wallet.id,'upsert',now)
  for(const t of transactions){if(t.updatedAt===now)next=queueChange(next,'transaction',t.id,'upsert',now)}
  await commit(next)
 }
 const deleteWallet=async(id:string)=>{
  const now=new Date().toISOString()
  const affectedTransactions=data.transactions.filter(t=>t.walletId===id||t.toWalletId===id)
  const affectedBills=data.bills.filter(b=>b.walletId===id)
  let next:SpenzaMobileData={...data,wallets:data.wallets.filter(w=>w.id!==id),transactions:data.transactions.filter(t=>t.walletId!==id&&t.toWalletId!==id),bills:data.bills.filter(b=>b.walletId!==id),defaultWalletId:data.defaultWalletId===id?undefined:data.defaultWalletId}
  next=queueChange(next,'wallet',id,'delete',now)
  for(const t of affectedTransactions)next=queueChange(next,'transaction',t.id,'delete',now)
  for(const b of affectedBills)next=queueChange(next,'bill',b.id,'delete',now)
  await commit(next)
 }
 const setDefaultWallet=async(id?:string)=>commit({...data,defaultWalletId:id})
 const addTransaction=async(input:AddTransactionInput)=>{
  const now=new Date().toISOString()
  const transaction:Transaction={...input,id:uid(),createdAt:now,updatedAt:now}
  let next:SpenzaMobileData={...data,transactions:[transaction,...data.transactions]}
  next=queueChange(next,'transaction',transaction.id,'upsert',now)
  await commit(next);return transaction
 }
 const updateTransaction=async(transaction:Transaction)=>{
  const now=new Date().toISOString()
  const updated={...transaction,updatedAt:now}
  let next:SpenzaMobileData={...data,transactions:data.transactions.map(t=>t.id===transaction.id?updated:t)}
  next=queueChange(next,'transaction',transaction.id,'upsert',now)
  await commit(next)
 }
 const deleteTransaction=async(id:string)=>{
  const now=new Date().toISOString()
  let next:SpenzaMobileData={...data,transactions:data.transactions.filter(t=>t.id!==id)}
  next=queueChange(next,'transaction',id,'delete',now)
  await commit(next)
 }
 const addCategory=async(name:string)=>{
  const value=name.trim();if(!value||data.categories.some(c=>c.toLowerCase()===value.toLowerCase()))return
  await commit({...data,categories:[...data.categories,value]})
 }
 const deleteCategory=async(name:string)=>{
  if(data.transactions.some(t=>t.category===name)||data.bills.some(b=>b.category===name))return
  await commit({...data,categories:data.categories.filter(c=>c!==name)})
 }
 const setRate=async(value:number)=>{if(value>0)await commit({...data,usdToLbpRate:value})}
 const upsertBill=async(input:UpsertBillInput)=>{
  const now=new Date().toISOString()
  const existing=data.bills.find(b=>b.id===input.id)
  const bill:Bill={...input,createdAt:input.createdAt||existing?.createdAt||now,updatedAt:now}
  let next:SpenzaMobileData={...data,bills:existing?data.bills.map(b=>b.id===bill.id?bill:b):[...data.bills,bill]}
  next=queueChange(next,'bill',bill.id,'upsert',now)
  await commit(next)
  return bill
 }
 const deleteBill=async(id:string)=>{
  const now=new Date().toISOString()
  let next:SpenzaMobileData={...data,bills:data.bills.filter(b=>b.id!==id)}
  next=queueChange(next,'bill',id,'delete',now)
  await commit(next)
 }
 const markBillPaid=async(id:string)=>{
  const bill=data.bills.find(b=>b.id===id),wallet=bill&&data.wallets.find(w=>w.id===bill.walletId)
  if(!bill||!wallet)return
  if(bill.recurrence==='once'&&bill.lastPaidDate)return
  const now=new Date().toISOString()
  const tx:Transaction={id:uid(),type:'expense',title:bill.name,category:bill.category,amount:bill.amount,walletId:bill.walletId,date:today(),note:bill.note?`${bill.note} · Paid from Bills`:'Paid from Bills',createdAt:now,updatedAt:now}
  const updated:Bill={...bill,lastPaidDate:today(),dueDate:bill.recurrence==='once'?bill.dueDate:nextDueDate(bill.dueDate,bill.recurrence),updatedAt:now}
  let next:SpenzaMobileData={...data,transactions:[tx,...data.transactions],bills:data.bills.map(b=>b.id===id?updated:b)}
  next=queueChange(next,'transaction',tx.id,'upsert',now)
  next=queueChange(next,'bill',updated.id,'upsert',now)
  await commit(next)
 }
 const skipBill=async(id:string)=>{
  const bill=data.bills.find(b=>b.id===id);if(!bill||bill.recurrence==='once')return
  const now=new Date().toISOString()
  const updated={...bill,dueDate:nextDueDate(bill.dueDate,bill.recurrence),updatedAt:now}
  let next:SpenzaMobileData={...data,bills:data.bills.map(b=>b.id===id?updated:b)}
  next=queueChange(next,'bill',updated.id,'upsert',now)
  await commit(next)
 }
 const resetData=async()=>commit(defaultData)
 const walletBalance=(wallet:Wallet)=>data.transactions.reduce((balance,t)=>{
   if(t.type==='income'&&t.walletId===wallet.id)return balance+t.amount
   if(t.type==='expense'&&t.walletId===wallet.id)return balance-t.amount
   if(t.type==='transfer'){
    if(t.walletId===wallet.id)return balance-t.amount
    if(t.toWalletId===wallet.id)return balance+(t.exchangeRate?t.amount*t.exchangeRate:t.amount)
   }
   return balance
  },wallet.openingBalance)
 const value=useMemo<AppDataContextValue>(()=>({data,ready,addWallet,updateWallet,deleteWallet,setDefaultWallet,addTransaction,updateTransaction,deleteTransaction,addCategory,deleteCategory,setRate,upsertBill,deleteBill,markBillPaid,skipBill,resetData,replaceData,walletBalance,convert,pairRate}),[data,ready])
 return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useAppData(){const value=useContext(Context);if(!value)throw new Error('useAppData must be used inside AppDataProvider');return value}

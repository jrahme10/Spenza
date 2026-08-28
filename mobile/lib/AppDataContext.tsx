import React,{createContext,useContext,useEffect,useMemo,useState} from 'react'
import { loadData, saveData } from './storage'
import type { Bill,Currency,SpenzaMobileData,Transaction,Wallet } from './types'
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
 walletBalance:(wallet:Wallet)=>number
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

export function AppDataProvider({children}:{children:React.ReactNode}){
 const [data,setData]=useState<SpenzaMobileData>(defaultData)
 const [ready,setReady]=useState(false)
 useEffect(()=>{loadData().then(value=>{setData(value);setReady(true)})},[])

 const commit=async(next:SpenzaMobileData)=>{setData(next);await saveData(next)}
 const addWallet=async(input:AddWalletInput)=>{
  const now=new Date().toISOString()
  const wallet:Wallet={id:uid(),...input,createdAt:now,updatedAt:now}
  const next={...data,wallets:[...data.wallets,wallet],defaultWalletId:data.defaultWalletId||wallet.id}
  await commit(next);return wallet
 }
 const updateWallet=async(wallet:Wallet)=>{
  await commit({...data,wallets:data.wallets.map(w=>w.id===wallet.id?{...wallet,updatedAt:new Date().toISOString()}:w)})
 }
 const deleteWallet=async(id:string)=>{
  const next={...data,wallets:data.wallets.filter(w=>w.id!==id),transactions:data.transactions.filter(t=>t.walletId!==id&&t.toWalletId!==id),bills:data.bills.filter(b=>b.walletId!==id),defaultWalletId:data.defaultWalletId===id?undefined:data.defaultWalletId}
  await commit(next)
 }
 const setDefaultWallet=async(id?:string)=>commit({...data,defaultWalletId:id})
 const addTransaction=async(input:AddTransactionInput)=>{
  const now=new Date().toISOString()
  const transaction:Transaction={...input,id:uid(),createdAt:now,updatedAt:now}
  await commit({...data,transactions:[transaction,...data.transactions]});return transaction
 }
 const updateTransaction=async(transaction:Transaction)=>commit({...data,transactions:data.transactions.map(t=>t.id===transaction.id?{...transaction,updatedAt:new Date().toISOString()}:t)})
 const deleteTransaction=async(id:string)=>commit({...data,transactions:data.transactions.filter(t=>t.id!==id)})
 const addCategory=async(name:string)=>{
  const value=name.trim();if(!value||data.categories.some(c=>c.toLowerCase()===value.toLowerCase()))return
  await commit({...data,categories:[...data.categories,value]})
 }
 const deleteCategory=async(name:string)=>{
  if(data.transactions.some(t=>t.category===name)||data.bills.some(b=>b.category===name))return
  await commit({...data,categories:data.categories.filter(c=>c!==name)})
 }
 const setRate=async(rate:number)=>{if(rate>0)await commit({...data,usdToLbpRate:rate})}
 const upsertBill=async(input:UpsertBillInput)=>{
  const now=new Date().toISOString()
  const existing=data.bills.find(b=>b.id===input.id)
  const bill:Bill={...input,createdAt:input.createdAt||existing?.createdAt||now,updatedAt:now}
  await commit({...data,bills:existing?data.bills.map(b=>b.id===bill.id?bill:b):[...data.bills,bill]})
  return bill
 }
 const deleteBill=async(id:string)=>commit({...data,bills:data.bills.filter(b=>b.id!==id)})
 const markBillPaid=async(id:string)=>{
  const bill=data.bills.find(b=>b.id===id),wallet=bill&&data.wallets.find(w=>w.id===bill.walletId)
  if(!bill||!wallet)return
  if(bill.recurrence==='once'&&bill.lastPaidDate)return
  const now=new Date().toISOString()
  const tx:Transaction={id:uid(),type:'expense',title:bill.name,category:bill.category,amount:bill.amount,walletId:bill.walletId,date:today(),note:bill.note?`${bill.note} · Paid from Bills`:'Paid from Bills',createdAt:now,updatedAt:now}
  const updated:Bill={...bill,lastPaidDate:today(),dueDate:bill.recurrence==='once'?bill.dueDate:nextDueDate(bill.dueDate,bill.recurrence),updatedAt:now}
  await commit({...data,transactions:[tx,...data.transactions],bills:data.bills.map(b=>b.id===id?updated:b)})
 }
 const skipBill=async(id:string)=>{
  const bill=data.bills.find(b=>b.id===id);if(!bill||bill.recurrence==='once')return
  const updated={...bill,dueDate:nextDueDate(bill.dueDate,bill.recurrence),updatedAt:new Date().toISOString()}
  await commit({...data,bills:data.bills.map(b=>b.id===id?updated:b)})
 }
 const resetData=async()=>commit(defaultData)
 const walletBalance=(wallet:Wallet)=>{
  let balance=wallet.openingBalance
  for(const t of data.transactions){
   if(t.walletId===wallet.id){if(t.type==='income')balance+=t.amount;else balance-=t.amount}
   if(t.type==='transfer'&&t.toWalletId===wallet.id)balance+=t.exchangeRate?t.amount*t.exchangeRate:t.amount
  }
  return balance
 }
 const value=useMemo<AppDataContextValue>(()=>({data,ready,addWallet,updateWallet,deleteWallet,setDefaultWallet,addTransaction,updateTransaction,deleteTransaction,addCategory,deleteCategory,setRate,upsertBill,deleteBill,markBillPaid,skipBill,resetData,walletBalance}),[data,ready])
 return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useAppData(){const value=useContext(Context);if(!value)throw new Error('useAppData must be used inside AppDataProvider');return value}

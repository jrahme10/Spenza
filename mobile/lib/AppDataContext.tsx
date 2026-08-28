import React,{createContext,useContext,useEffect,useMemo,useState} from 'react'
import { loadData, saveData } from './storage'
import type { Currency,SpenzaMobileData,Transaction,Wallet } from './types'
import { defaultData } from './types'

type AddWalletInput={name:string;currency:Currency;openingBalance:number}
type AddTransactionInput=Omit<Transaction,'id'|'createdAt'|'updatedAt'>

type AppDataContextValue={
 data:SpenzaMobileData
 ready:boolean
 addWallet:(input:AddWalletInput)=>Promise<Wallet>
 deleteWallet:(id:string)=>Promise<void>
 setDefaultWallet:(id?:string)=>Promise<void>
 addTransaction:(input:AddTransactionInput)=>Promise<Transaction>
 deleteTransaction:(id:string)=>Promise<void>
 addCategory:(name:string)=>Promise<void>
 setRate:(rate:number)=>Promise<void>
 walletBalance:(wallet:Wallet)=>number
}

const Context=createContext<AppDataContextValue|null>(null)
const uid=()=>`${Date.now()}-${Math.random().toString(16).slice(2)}`

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
 const deleteTransaction=async(id:string)=>commit({...data,transactions:data.transactions.filter(t=>t.id!==id)})
 const addCategory=async(name:string)=>{
  const value=name.trim();if(!value||data.categories.some(c=>c.toLowerCase()===value.toLowerCase()))return
  await commit({...data,categories:[...data.categories,value]})
 }
 const setRate=async(rate:number)=>{if(rate>0)await commit({...data,usdToLbpRate:rate})}
 const walletBalance=(wallet:Wallet)=>{
  let balance=wallet.openingBalance
  for(const t of data.transactions){
   if(t.walletId===wallet.id){if(t.type==='income')balance+=t.amount;else balance-=t.amount}
   if(t.type==='transfer'&&t.toWalletId===wallet.id)balance+=t.exchangeRate?t.amount*t.exchangeRate:t.amount
  }
  return balance
 }
 const value=useMemo<AppDataContextValue>(()=>({data,ready,addWallet,deleteWallet,setDefaultWallet,addTransaction,deleteTransaction,addCategory,setRate,walletBalance}),[data,ready])
 return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useAppData(){const value=useContext(Context);if(!value)throw new Error('useAppData must be used inside AppDataProvider');return value}

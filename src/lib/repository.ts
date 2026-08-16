import { Bill, loadData, saveData, SpenzaData, SyncEntityType, SyncTombstone, Transaction, Wallet } from './db'

function now(){return new Date().toISOString()}

function withoutTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string):SpenzaData{
  return {...data,sync:{...data.sync,tombstones:data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId))}}
}

function withTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string,deletedAt=now()):SpenzaData{
  const tombstone:SyncTombstone={entityType,entityId,deletedAt}
  const others=data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId))
  return {...data,sync:{...data.sync,tombstones:[tombstone,...others]}}
}

export interface SpenzaRepository {
  getSnapshot():Promise<SpenzaData>
  replaceSnapshot(data:SpenzaData):Promise<void>
  upsertWallet(wallet:Wallet):Promise<SpenzaData>
  upsertWalletAndTransactions(wallet:Wallet,transactions:Transaction[]):Promise<SpenzaData>
  deleteWallet(id:string):Promise<SpenzaData>
  upsertTransaction(transaction:Transaction):Promise<SpenzaData>
  deleteTransaction(id:string):Promise<SpenzaData>
  upsertBill(bill:Bill):Promise<SpenzaData>
  deleteBill(id:string):Promise<SpenzaData>
}

export class LocalSpenzaRepository implements SpenzaRepository {
  async getSnapshot(){return loadData()}
  async replaceSnapshot(data:SpenzaData){await saveData(data)}

  async upsertWallet(wallet:Wallet){
    let data=await loadData();const stamp=now();const existing=data.wallets.find(w=>w.id===wallet.id)
    const next:Wallet={...wallet,createdAt:existing?.createdAt||wallet.createdAt||stamp,updatedAt:stamp}
    data={...data,wallets:existing?data.wallets.map(w=>w.id===wallet.id?next:w):[...data.wallets,next]}
    data=withoutTombstone(data,'wallet',wallet.id);await saveData(data);return data
  }

  async upsertWalletAndTransactions(wallet:Wallet,transactions:Transaction[]){
    let data=await loadData();const stamp=now();const existing=data.wallets.find(w=>w.id===wallet.id)
    const nextWallet:Wallet={...wallet,createdAt:existing?.createdAt||wallet.createdAt||stamp,updatedAt:stamp}
    const incoming=new Map(transactions.map(t=>[t.id,t]))
    const nextTransactions=data.transactions.map(current=>{const candidate=incoming.get(current.id);if(!candidate)return current;incoming.delete(current.id);return {...candidate,createdAt:current.createdAt||candidate.createdAt||stamp,updatedAt:stamp}})
    for(const candidate of incoming.values())nextTransactions.unshift({...candidate,createdAt:candidate.createdAt||stamp,updatedAt:stamp})
    data={...data,wallets:existing?data.wallets.map(w=>w.id===wallet.id?nextWallet:w):[...data.wallets,nextWallet],transactions:nextTransactions}
    data=withoutTombstone(data,'wallet',wallet.id)
    for(const transaction of transactions)data=withoutTombstone(data,'transaction',transaction.id)
    await saveData(data);return data
  }

  async deleteWallet(id:string){
    let data=await loadData();const stamp=now()
    const transactionIds=data.transactions.filter(t=>t.walletId===id||t.toWalletId===id).map(t=>t.id)
    const billIds=data.bills.filter(b=>b.walletId===id).map(b=>b.id)
    data={...data,wallets:data.wallets.filter(w=>w.id!==id),transactions:data.transactions.filter(t=>t.walletId!==id&&t.toWalletId!==id),bills:data.bills.filter(b=>b.walletId!==id)}
    data=withTombstone(data,'wallet',id,stamp)
    for(const txId of transactionIds)data=withTombstone(data,'transaction',txId,stamp)
    for(const billId of billIds)data=withTombstone(data,'bill',billId,stamp)
    await saveData(data);return data
  }

  async upsertTransaction(transaction:Transaction){
    let data=await loadData();const stamp=now();const existing=data.transactions.find(t=>t.id===transaction.id)
    const next:Transaction={...transaction,createdAt:existing?.createdAt||transaction.createdAt||stamp,updatedAt:stamp}
    data={...data,transactions:existing?data.transactions.map(t=>t.id===transaction.id?next:t):[next,...data.transactions]}
    data=withoutTombstone(data,'transaction',transaction.id);await saveData(data);return data
  }

  async deleteTransaction(id:string){
    let data=await loadData();data={...data,transactions:data.transactions.filter(t=>t.id!==id)};data=withTombstone(data,'transaction',id);await saveData(data);return data
  }

  async upsertBill(bill:Bill){
    let data=await loadData();const stamp=now();const existing=data.bills.find(b=>b.id===bill.id)
    const next:Bill={...bill,createdAt:existing?.createdAt||bill.createdAt||stamp,updatedAt:stamp}
    data={...data,bills:existing?data.bills.map(b=>b.id===bill.id?next:b):[...data.bills,next]}
    data=withoutTombstone(data,'bill',bill.id);await saveData(data);return data
  }

  async deleteBill(id:string){
    let data=await loadData();data={...data,bills:data.bills.filter(b=>b.id!==id)};data=withTombstone(data,'bill',id);await saveData(data);return data
  }
}

export const localRepository:SpenzaRepository=new LocalSpenzaRepository()

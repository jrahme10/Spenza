import { Bill, loadData, saveData, SpenzaData, SyncChange, SyncEntityType, SyncOperation, SyncTombstone, Transaction, Wallet } from './db'

function now(){return new Date().toISOString()}
function syncKey(entityType:SyncEntityType,entityId:string){return `${entityType}:${entityId}`}

function withoutTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string):SpenzaData{
  return {...data,sync:{...data.sync,tombstones:data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId))}}
}

function withTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string,deletedAt=now()):SpenzaData{
  const tombstone:SyncTombstone={entityType,entityId,deletedAt}
  const others=data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId))
  return {...data,sync:{...data.sync,tombstones:[tombstone,...others]}}
}

function withPendingChange(data:SpenzaData,entityType:SyncEntityType,entityId:string,operation:SyncOperation,changedAt=now()):SpenzaData{
  const change:SyncChange={entityType,entityId,operation,changedAt}
  const key=syncKey(entityType,entityId)
  const others=data.sync.pendingChanges.filter(c=>syncKey(c.entityType,c.entityId)!==key)
  return {...data,sync:{...data.sync,pendingChanges:[...others,change].sort((a,b)=>a.changedAt.localeCompare(b.changedAt))}}
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
    data=withoutTombstone(data,'wallet',wallet.id)
    data=withPendingChange(data,'wallet',wallet.id,'upsert',stamp)
    await saveData(data);return data
  }

  async upsertWalletAndTransactions(wallet:Wallet,transactions:Transaction[]){
    let data=await loadData();const stamp=now();const existing=data.wallets.find(w=>w.id===wallet.id)
    const nextWallet:Wallet={...wallet,createdAt:existing?.createdAt||wallet.createdAt||stamp,updatedAt:stamp}
    const incoming=new Map(transactions.map(t=>[t.id,t]))
    const nextTransactions=data.transactions.map(current=>{const candidate=incoming.get(current.id);if(!candidate)return current;incoming.delete(current.id);return {...candidate,createdAt:current.createdAt||candidate.createdAt||stamp,updatedAt:stamp}})
    for(const candidate of incoming.values())nextTransactions.unshift({...candidate,createdAt:candidate.createdAt||stamp,updatedAt:stamp})
    data={...data,wallets:existing?data.wallets.map(w=>w.id===wallet.id?nextWallet:w):[...data.wallets,nextWallet],transactions:nextTransactions}
    data=withoutTombstone(data,'wallet',wallet.id)
    data=withPendingChange(data,'wallet',wallet.id,'upsert',stamp)
    for(const transaction of transactions){data=withoutTombstone(data,'transaction',transaction.id);data=withPendingChange(data,'transaction',transaction.id,'upsert',stamp)}
    await saveData(data);return data
  }

  async deleteWallet(id:string){
    let data=await loadData();const stamp=now()
    const transactionIds=data.transactions.filter(t=>t.walletId===id||t.toWalletId===id).map(t=>t.id)
    const billIds=data.bills.filter(b=>b.walletId===id).map(b=>b.id)
    data={...data,wallets:data.wallets.filter(w=>w.id!==id),transactions:data.transactions.filter(t=>t.walletId!==id&&t.toWalletId!==id),bills:data.bills.filter(b=>b.walletId!==id)}
    data=withTombstone(data,'wallet',id,stamp);data=withPendingChange(data,'wallet',id,'delete',stamp)
    for(const txId of transactionIds){data=withTombstone(data,'transaction',txId,stamp);data=withPendingChange(data,'transaction',txId,'delete',stamp)}
    for(const billId of billIds){data=withTombstone(data,'bill',billId,stamp);data=withPendingChange(data,'bill',billId,'delete',stamp)}
    await saveData(data);return data
  }

  async upsertTransaction(transaction:Transaction){
    let data=await loadData();const stamp=now();const existing=data.transactions.find(t=>t.id===transaction.id)
    const next:Transaction={...transaction,createdAt:existing?.createdAt||transaction.createdAt||stamp,updatedAt:stamp}
    data={...data,transactions:existing?data.transactions.map(t=>t.id===transaction.id?next:t):[next,...data.transactions]}
    data=withoutTombstone(data,'transaction',transaction.id)
    data=withPendingChange(data,'transaction',transaction.id,'upsert',stamp)
    await saveData(data);return data
  }

  async deleteTransaction(id:string){
    let data=await loadData();const stamp=now();data={...data,transactions:data.transactions.filter(t=>t.id!==id)}
    data=withTombstone(data,'transaction',id,stamp);data=withPendingChange(data,'transaction',id,'delete',stamp)
    await saveData(data);return data
  }

  async upsertBill(bill:Bill){
    let data=await loadData();const stamp=now();const existing=data.bills.find(b=>b.id===bill.id)
    const next:Bill={...bill,createdAt:existing?.createdAt||bill.createdAt||stamp,updatedAt:stamp}
    data={...data,bills:existing?data.bills.map(b=>b.id===bill.id?next:b):[...data.bills,next]}
    data=withoutTombstone(data,'bill',bill.id)
    data=withPendingChange(data,'bill',bill.id,'upsert',stamp)
    await saveData(data);return data
  }

  async deleteBill(id:string){
    let data=await loadData();const stamp=now();data={...data,bills:data.bills.filter(b=>b.id!==id)}
    data=withTombstone(data,'bill',id,stamp);data=withPendingChange(data,'bill',id,'delete',stamp)
    await saveData(data);return data
  }
}

export const localRepository:SpenzaRepository=new LocalSpenzaRepository()

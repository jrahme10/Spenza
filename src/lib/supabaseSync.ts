import { Bill, SpenzaData, SyncEntityType, Transaction, Wallet } from './db'
import { localRepository } from './repository'
import { acknowledgeChanges, resolveConflict } from './syncEngine'
import { deserializeRemoteRecord, RemotePayload, serializePendingChanges } from './syncMapper'
import { RemoteSyncRecord } from './remoteSyncProvider'
import { getSupabaseClient, getSupabaseUserId, isSupabaseConfigured } from './supabaseClient'
import { SupabaseSyncProvider } from './supabaseSyncProvider'

export type SupabaseSyncResult={status:'disabled'|'signed-out'|'synced'|'error';data?:SpenzaData;error?:string;rejected?:number}

const syncKey=(entityType:SyncEntityType,entityId:string)=>`${entityType}:${entityId}`

function removePending(data:SpenzaData,entityType:SyncEntityType,entityId:string){
  const key=syncKey(entityType,entityId)
  return {...data,sync:{...data.sync,pendingChanges:data.sync.pendingChanges.filter(change=>syncKey(change.entityType,change.entityId)!==key)}}
}

function removeTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string){
  return {...data,sync:{...data.sync,tombstones:data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId))}}
}

function addTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string,deletedAt:string){
  const others=data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId))
  return {...data,sync:{...data.sync,tombstones:[{entityType,entityId,deletedAt},...others]}}
}

function localVersion(data:SpenzaData,record:RemoteSyncRecord){
  const tombstone=data.sync.tombstones.find(t=>t.entityType===record.entityType&&t.entityId===record.entityId)
  if(tombstone)return {deletedAt:tombstone.deletedAt}
  const item=record.entityType==='wallet'?data.wallets.find(w=>w.id===record.entityId):record.entityType==='transaction'?data.transactions.find(t=>t.id===record.entityId):data.bills.find(b=>b.id===record.entityId)
  return {updatedAt:item?.updatedAt}
}

function applyRemote(data:SpenzaData,raw:RemoteSyncRecord):SpenzaData{
  const record=deserializeRemoteRecord(raw)
  const remoteVersion=record.operation==='delete'?{deletedAt:record.changedAt}:{updatedAt:record.changedAt}
  const resolution=resolveConflict(localVersion(data,record),remoteVersion)
  if(resolution!=='remote')return data

  data=removePending(data,record.entityType,record.entityId)
  if(record.operation==='delete'){
    if(record.entityType==='wallet')data={...data,wallets:data.wallets.filter(w=>w.id!==record.entityId),transactions:data.transactions.filter(t=>t.walletId!==record.entityId&&t.toWalletId!==record.entityId),bills:data.bills.filter(b=>b.walletId!==record.entityId)}
    else if(record.entityType==='transaction')data={...data,transactions:data.transactions.filter(t=>t.id!==record.entityId)}
    else data={...data,bills:data.bills.filter(b=>b.id!==record.entityId)}
    return addTombstone(data,record.entityType,record.entityId,record.changedAt)
  }

  data=removeTombstone(data,record.entityType,record.entityId)
  const payload=record.payload as RemotePayload
  if(record.entityType==='wallet'){
    const wallet=payload as Wallet
    const next:Wallet={...wallet,id:record.entityId,updatedAt:record.changedAt,createdAt:wallet.createdAt||record.changedAt}
    return {...data,wallets:data.wallets.some(w=>w.id===record.entityId)?data.wallets.map(w=>w.id===record.entityId?next:w):[...data.wallets,next]}
  }
  if(record.entityType==='transaction'){
    const transaction=payload as Transaction
    const next:Transaction={...transaction,id:record.entityId,updatedAt:record.changedAt,createdAt:transaction.createdAt||record.changedAt}
    return {...data,transactions:data.transactions.some(t=>t.id===record.entityId)?data.transactions.map(t=>t.id===record.entityId?next:t):[next,...data.transactions]}
  }
  const bill=payload as Bill
  const next:Bill={...bill,id:record.entityId,updatedAt:record.changedAt,createdAt:bill.createdAt||record.changedAt}
  return {...data,bills:data.bills.some(b=>b.id===record.entityId)?data.bills.map(b=>b.id===record.entityId?next:b):[...data.bills,next]}
}

export async function syncSupabaseIfAuthenticated():Promise<SupabaseSyncResult>{
  if(!isSupabaseConfigured())return {status:'disabled'}
  const supabase=getSupabaseClient()
  if(!supabase)return {status:'disabled'}
  try{
    const userId=await getSupabaseUserId()
    if(!userId)return {status:'signed-out'}
    const provider=new SupabaseSyncProvider(supabase,userId)
    let data=await localRepository.getSnapshot()
    const pending=serializePendingChanges(data)
    let rejected=0
    if(pending.length){
      const pushed=await provider.pushChanges(pending)
      rejected=pushed.rejected.length
      data=acknowledgeChanges(data,pushed.accepted,pushed.serverTime)
    }

    let cursor: string|undefined
    let serverTime=data.sync.lastSyncAt||new Date(0).toISOString()
    for(let page=0;page<20;page++){
      const pulled=await provider.pullChanges({since:data.sync.lastSyncAt,limit:500,cursor})
      for(const change of pulled.changes)data=applyRemote(data,change)
      serverTime=pulled.serverTime
      if(!pulled.hasMore||!pulled.cursor)break
      cursor=pulled.cursor
    }
    data={...data,sync:{...data.sync,lastSyncAt:serverTime}}
    await localRepository.replaceSnapshot(data)
    return {status:'synced',data,rejected}
  }catch(error){
    return {status:'error',error:error instanceof Error?error.message:String(error)}
  }
}

import { Bill, SpenzaData, SyncEntityType, Transaction, Wallet } from './db'
import { localRepository } from './repository'
import { acknowledgeChanges, resolveConflict } from './syncEngine'
import { deserializeRemoteRecord, RemotePayload, serializePendingChanges } from './syncMapper'
import { RemoteSyncRecord } from './remoteSyncProvider'
import { getSupabaseClient, getSupabaseUserId, isSupabaseConfigured } from './supabaseClient'
import { SupabaseSyncProvider } from './supabaseSyncProvider'

export type RestoreCounts={wallets:number;transactions:number;bills:number}
export type SupabaseSyncResult={status:'disabled'|'signed-out'|'synced'|'error';data?:SpenzaData;error?:string;rejected?:number;restored?:RestoreCounts}
const syncKey=(entityType:SyncEntityType,entityId:string)=>`${entityType}:${entityId}`
const epoch='1970-01-01T00:00:00.000Z'
const hasFinancialData=(data:SpenzaData)=>data.wallets.length>0||data.transactions.length>0||data.bills.length>0

function removePending(data:SpenzaData,entityType:SyncEntityType,entityId:string){const key=syncKey(entityType,entityId);return {...data,sync:{...data.sync,pendingChanges:data.sync.pendingChanges.filter(change=>syncKey(change.entityType,change.entityId)!==key)}}}
function removeTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string){return {...data,sync:{...data.sync,tombstones:data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId))}}}
function addTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string,deletedAt:string){const others=data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId));return {...data,sync:{...data.sync,tombstones:[{entityType,entityId,deletedAt},...others]}}}
function localVersion(data:SpenzaData,record:RemoteSyncRecord){const tombstone=data.sync.tombstones.find(t=>t.entityType===record.entityType&&t.entityId===record.entityId);if(tombstone)return {deletedAt:tombstone.deletedAt};const item=record.entityType==='wallet'?data.wallets.find(w=>w.id===record.entityId):record.entityType==='transaction'?data.transactions.find(t=>t.id===record.entityId):data.bills.find(b=>b.id===record.entityId);return {updatedAt:item?.updatedAt}}
function applyRemote(data:SpenzaData,raw:RemoteSyncRecord):SpenzaData{const record=deserializeRemoteRecord(raw);const remoteVersion=record.operation==='delete'?{deletedAt:record.changedAt}:{updatedAt:record.changedAt};if(resolveConflict(localVersion(data,record),remoteVersion)!=='remote')return data;data=removePending(data,record.entityType,record.entityId);if(record.operation==='delete'){if(record.entityType==='wallet')data={...data,wallets:data.wallets.filter(w=>w.id!==record.entityId),transactions:data.transactions.filter(t=>t.walletId!==record.entityId&&t.toWalletId!==record.entityId),bills:data.bills.filter(b=>b.walletId!==record.entityId)};else if(record.entityType==='transaction')data={...data,transactions:data.transactions.filter(t=>t.id!==record.entityId)};else data={...data,bills:data.bills.filter(b=>b.id!==record.entityId)};return addTombstone(data,record.entityType,record.entityId,record.changedAt)}data=removeTombstone(data,record.entityType,record.entityId);const payload=record.payload as RemotePayload;if(record.entityType==='wallet'){const wallet=payload as Wallet;const next:Wallet={...wallet,id:record.entityId,updatedAt:record.changedAt,createdAt:wallet.createdAt||record.changedAt};return {...data,wallets:data.wallets.some(w=>w.id===record.entityId)?data.wallets.map(w=>w.id===record.entityId?next:w):[...data.wallets,next]}}if(record.entityType==='transaction'){const transaction=payload as Transaction;const next:Transaction={...transaction,id:record.entityId,updatedAt:record.changedAt,createdAt:transaction.createdAt||record.changedAt};return {...data,transactions:data.transactions.some(t=>t.id===record.entityId)?data.transactions.map(t=>t.id===record.entityId?next:t):[next,...data.transactions]}}const bill=payload as Bill;const next:Bill={...bill,id:record.entityId,updatedAt:record.changedAt,createdAt:bill.createdAt||record.changedAt};return {...data,bills:data.bills.some(b=>b.id===record.entityId)?data.bills.map(b=>b.id===record.entityId?next:b):[...data.bills,next]}}
function bootstrapRecords(data:SpenzaData):RemoteSyncRecord<RemotePayload>[]{const fallback=new Date().toISOString();return [...data.wallets.map(wallet=>({entityType:'wallet' as const,entityId:wallet.id,operation:'upsert' as const,changedAt:wallet.updatedAt||wallet.createdAt||fallback,payload:wallet})),...data.transactions.map(transaction=>({entityType:'transaction' as const,entityId:transaction.id,operation:'upsert' as const,changedAt:transaction.updatedAt||transaction.createdAt||fallback,payload:transaction})),...data.bills.map(bill=>({entityType:'bill' as const,entityId:bill.id,operation:'upsert' as const,changedAt:bill.updatedAt||bill.createdAt||fallback,payload:bill}))]}
function rejectionError(label:string,rejected:Array<{reason:string}>){const reasons=[...new Set(rejected.map(r=>r.reason).filter(Boolean))];return `${label} failed: ${rejected.length} change${rejected.length===1?' was':'s were'} rejected${reasons.length?`. ${reasons.slice(0,2).join(' | ')}`:''}`}

async function restoreFullCloudSnapshot(provider:SupabaseSyncProvider,local:SpenzaData):Promise<{data:SpenzaData;counts:RestoreCounts;serverTime:string}> {
  const records:RemoteSyncRecord[]=[]
  let cursor:string|undefined
  let serverTime=epoch
  for(let page=0;page<20;page++){
    const pulled=await provider.pullChanges({since:epoch,limit:500,cursor})
    records.push(...pulled.changes)
    serverTime=pulled.serverTime
    if(!pulled.hasMore||!pulled.cursor)break
    cursor=pulled.cursor
  }

  const wallets=new Map<string,Wallet>()
  const transactions=new Map<string,Transaction>()
  const bills=new Map<string,Bill>()
  const tombstones:SpenzaData['sync']['tombstones']=[]

  for(const raw of records){
    const record=deserializeRemoteRecord(raw)
    if(record.operation==='delete'){
      tombstones.push({entityType:record.entityType,entityId:record.entityId,deletedAt:record.changedAt})
      if(record.entityType==='wallet'){
        wallets.delete(record.entityId)
        for(const [id,transaction] of transactions)if(transaction.walletId===record.entityId||transaction.toWalletId===record.entityId)transactions.delete(id)
        for(const [id,bill] of bills)if(bill.walletId===record.entityId)bills.delete(id)
      }else if(record.entityType==='transaction')transactions.delete(record.entityId)
      else bills.delete(record.entityId)
      continue
    }
    const payload=record.payload as RemotePayload
    if(record.entityType==='wallet'){
      const wallet=payload as Wallet
      wallets.set(record.entityId,{...wallet,id:record.entityId,createdAt:wallet.createdAt||record.changedAt,updatedAt:record.changedAt})
    }else if(record.entityType==='transaction'){
      const transaction=payload as Transaction
      transactions.set(record.entityId,{...transaction,id:record.entityId,createdAt:transaction.createdAt||record.changedAt,updatedAt:record.changedAt})
    }else{
      const bill=payload as Bill
      bills.set(record.entityId,{...bill,id:record.entityId,createdAt:bill.createdAt||record.changedAt,updatedAt:record.changedAt})
    }
  }

  const restored:SpenzaData={
    ...local,
    wallets:[...wallets.values()],
    transactions:[...transactions.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt)),
    bills:[...bills.values()],
    sync:{tombstones,pendingChanges:[],lastSyncAt:serverTime},
  }
  await localRepository.replaceSnapshot(restored)
  return {data:restored,counts:{wallets:restored.wallets.length,transactions:restored.transactions.length,bills:restored.bills.length},serverTime}
}

export async function syncSupabaseIfAuthenticated():Promise<SupabaseSyncResult>{
  if(!isSupabaseConfigured())return {status:'disabled'}
  const supabase=getSupabaseClient();if(!supabase)return {status:'disabled'}
  try{
    const userId=await getSupabaseUserId();if(!userId)return {status:'signed-out'}
    const provider=new SupabaseSyncProvider(supabase,userId)
    let data=await localRepository.getSnapshot()

    // Empty/new/reset devices always perform a complete restore. Do not trust an old
    // lastSyncAt cursor here: a device can be empty while still carrying sync metadata.
    if(!hasFinancialData(data)){
      const restored=await restoreFullCloudSnapshot(provider,data)
      return {status:'synced',data:restored.data,rejected:0,restored:restored.counts}
    }

    const remoteProbe=await provider.pullChanges({since:epoch,limit:1})
    if(remoteProbe.changes.length===0){
      const bootstrap=bootstrapRecords(data)
      if(bootstrap.length){
        const pushed=await provider.pushChanges(bootstrap)
        if(pushed.rejected.length)return {status:'error',data,error:rejectionError('Initial cloud backup',pushed.rejected),rejected:pushed.rejected.length}
      }
    }

    const pending=serializePendingChanges(data)
    if(pending.length){
      const pushed=await provider.pushChanges(pending)
      if(pushed.rejected.length)return {status:'error',data,error:rejectionError('Cloud sync',pushed.rejected),rejected:pushed.rejected.length}
      data=acknowledgeChanges(data,pushed.accepted,pushed.serverTime)
    }

    let cursor:string|undefined
    let serverTime=data.sync.lastSyncAt||epoch
    for(let page=0;page<20;page++){
      const pulled=await provider.pullChanges({since:data.sync.lastSyncAt,limit:500,cursor})
      for(const change of pulled.changes)data=applyRemote(data,change)
      serverTime=pulled.serverTime
      if(!pulled.hasMore||!pulled.cursor)break
      cursor=pulled.cursor
    }
    data={...data,sync:{...data.sync,lastSyncAt:serverTime}}
    await localRepository.replaceSnapshot(data)
    return {status:'synced',data,rejected:0}
  }catch(error){return {status:'error',error:error instanceof Error?error.message:String(error)}}
}

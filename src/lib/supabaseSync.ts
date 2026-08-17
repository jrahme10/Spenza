import { Bill, SpenzaData, SyncEntityType, Transaction, Wallet } from './db'
import { localRepository } from './repository'
import { acknowledgeChanges, resolveConflict } from './syncEngine'
import { deserializeRemoteRecord, RemotePayload, serializePendingChanges } from './syncMapper'
import { RemoteSyncRecord } from './remoteSyncProvider'
import { getSupabaseClient, getSupabaseUserId, isSupabaseConfigured } from './supabaseClient'
import { SupabaseSyncProvider } from './supabaseSyncProvider'

export type RestoreCounts={wallets:number;transactions:number;bills:number}
export type SyncPhase='checking'|'uploading'|'downloading'|'saving'|'complete'|'cancelled'
export type SyncProgress={phase:SyncPhase;processed?:number;total?:number;remaining?:number;message:string}
export type SupabaseSyncResult={status:'disabled'|'signed-out'|'synced'|'error'|'cancelled';data?:SpenzaData;error?:string;rejected?:number;restored?:RestoreCounts}
export type SyncOptions={onProgress?:(progress:SyncProgress)=>void;signal?:AbortSignal}
const syncKey=(entityType:SyncEntityType,entityId:string)=>`${entityType}:${entityId}`
const epoch='1970-01-01T00:00:00.000Z'
const hasFinancialData=(data:SpenzaData)=>data.wallets.length>0||data.transactions.length>0||data.bills.length>0
const throwIfCancelled=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Sync cancelled','AbortError')}
const isAbortError=(error:unknown)=>error instanceof DOMException&&error.name==='AbortError'

function removePending(data:SpenzaData,entityType:SyncEntityType,entityId:string){const key=syncKey(entityType,entityId);return {...data,sync:{...data.sync,pendingChanges:data.sync.pendingChanges.filter(change=>syncKey(change.entityType,change.entityId)!==key)}}}
function removeTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string){return {...data,sync:{...data.sync,tombstones:data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId))}}}
function addTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string,deletedAt:string){const others=data.sync.tombstones.filter(t=>!(t.entityType===entityType&&t.entityId===entityId));return {...data,sync:{...data.sync,tombstones:[{entityType,entityId,deletedAt},...others]}}}
function localVersion(data:SpenzaData,record:RemoteSyncRecord){const tombstone=data.sync.tombstones.find(t=>t.entityType===record.entityType&&t.entityId===record.entityId);if(tombstone)return {deletedAt:tombstone.deletedAt};const item=record.entityType==='wallet'?data.wallets.find(w=>w.id===record.entityId):record.entityType==='transaction'?data.transactions.find(t=>t.id===record.entityId):data.bills.find(b=>b.id===record.entityId);return {updatedAt:item?.updatedAt}}
function remoteVersion(record:RemoteSyncRecord){return record.operation==='delete'?{deletedAt:record.changedAt}:{updatedAt:record.changedAt}}
function applyRemote(data:SpenzaData,raw:RemoteSyncRecord):SpenzaData{const record=deserializeRemoteRecord(raw);if(resolveConflict(localVersion(data,record),remoteVersion(record))!=='remote')return data;data=removePending(data,record.entityType,record.entityId);if(record.operation==='delete'){if(record.entityType==='wallet')data={...data,wallets:data.wallets.filter(w=>w.id!==record.entityId),transactions:data.transactions.filter(t=>t.walletId!==record.entityId&&t.toWalletId!==record.entityId),bills:data.bills.filter(b=>b.walletId!==record.entityId)};else if(record.entityType==='transaction')data={...data,transactions:data.transactions.filter(t=>t.id!==record.entityId)};else data={...data,bills:data.bills.filter(b=>b.id!==record.entityId)};return addTombstone(data,record.entityType,record.entityId,record.changedAt)}data=removeTombstone(data,record.entityType,record.entityId);const payload=record.payload as RemotePayload;if(record.entityType==='wallet'){const wallet=payload as Wallet;const next:Wallet={...wallet,id:record.entityId,updatedAt:record.changedAt,createdAt:wallet.createdAt||record.changedAt};return {...data,wallets:data.wallets.some(w=>w.id===record.entityId)?data.wallets.map(w=>w.id===record.entityId?next:w):[...data.wallets,next]}}if(record.entityType==='transaction'){const transaction=payload as Transaction;const next:Transaction={...transaction,id:record.entityId,updatedAt:record.changedAt,createdAt:transaction.createdAt||record.changedAt};return {...data,transactions:data.transactions.some(t=>t.id===record.entityId)?data.transactions.map(t=>t.id===record.entityId?next:t):[next,...data.transactions]}}const bill=payload as Bill;const next:Bill={...bill,id:record.entityId,updatedAt:record.changedAt,createdAt:bill.createdAt||record.changedAt};return {...data,bills:data.bills.some(b=>b.id===record.entityId)?data.bills.map(b=>b.id===record.entityId?next:b):[...data.bills,next]}}
function bootstrapRecords(data:SpenzaData):RemoteSyncRecord<RemotePayload>[]{const fallback=new Date().toISOString();return [...data.wallets.map(wallet=>({entityType:'wallet' as const,entityId:wallet.id,operation:'upsert' as const,changedAt:wallet.updatedAt||wallet.createdAt||fallback,payload:wallet})),...data.transactions.map(transaction=>({entityType:'transaction' as const,entityId:transaction.id,operation:'upsert' as const,changedAt:transaction.updatedAt||transaction.createdAt||fallback,payload:transaction})),...data.bills.map(bill=>({entityType:'bill' as const,entityId:bill.id,operation:'upsert' as const,changedAt:bill.updatedAt||bill.createdAt||fallback,payload:bill}))]}
function rejectionError(label:string,rejected:Array<{reason:string}>){const reasons=[...new Set(rejected.map(r=>r.reason).filter(Boolean))];return `${label} failed: ${rejected.length} change${rejected.length===1?' was':'s were'} rejected${reasons.length?`. ${reasons.slice(0,2).join(' | ')}`:''}`}
function ensureCursorAdvanced(current:string|undefined,next:string|undefined,seen:Set<string>){if(!next)throw new Error('Cloud pagination stopped without a continuation cursor.');if(next===current||seen.has(next))throw new Error('Cloud pagination cursor did not advance safely.');seen.add(next);return next}

async function reconcileRejected(provider:SupabaseSyncProvider,data:SpenzaData,rejected:Array<{change:RemoteSyncRecord;reason:string}>,progress?:SyncOptions['onProgress'],signal?:AbortSignal){
  if(!rejected.length)return {data,unresolved:rejected}
  throwIfCancelled(signal)
  progress?.({phase:'downloading',processed:0,total:rejected.length,remaining:rejected.length,message:`Resolving ${rejected.length} cloud conflict${rejected.length===1?'':'s'}…`})
  const remoteRecords=await provider.pullCurrentRecords(rejected.map(item=>({entityType:item.change.entityType,entityId:item.change.entityId})),signal)
  throwIfCancelled(signal)
  const byKey=new Map(remoteRecords.map(record=>[syncKey(record.entityType,record.entityId),record]))
  const unresolved:Array<{change:RemoteSyncRecord;reason:string}>=[]
  let processed=0
  for(const item of rejected){
    throwIfCancelled(signal)
    const key=syncKey(item.change.entityType,item.change.entityId)
    const remote=byKey.get(key)
    if(!remote){unresolved.push({...item,reason:'Cloud conflict could not be loaded for resolution'})}
    else{
      data=applyRemote(data,remote)
      const resolution=resolveConflict(localVersion(data,remote),remoteVersion(remote))
      const stalePending=data.sync.pendingChanges.some(change=>syncKey(change.entityType,change.entityId)===key&&change.changedAt<=item.change.changedAt)
      if(resolution==='local'||stalePending)unresolved.push(item)
    }
    processed+=1
    progress?.({phase:'downloading',processed,total:rejected.length,remaining:rejected.length-processed,message:`Resolved ${processed} of ${rejected.length} cloud conflict${rejected.length===1?'':'s'}…`})
  }
  return {data,unresolved}
}

async function restoreFullCloudSnapshot(provider:SupabaseSyncProvider,local:SpenzaData,onProgress?:SyncOptions['onProgress'],signal?:AbortSignal):Promise<{data:SpenzaData;counts:RestoreCounts;serverTime:string}>{
  const records:RemoteSyncRecord[]=[];let cursor:string|undefined;let serverTime=epoch;const seenCursors=new Set<string>()
  onProgress?.({phase:'downloading',processed:0,message:'Downloading cloud data…'})
  while(true){throwIfCancelled(signal);const pulled=await provider.pullChanges({since:epoch,limit:500,cursor},signal);throwIfCancelled(signal);records.push(...pulled.changes);serverTime=pulled.serverTime;onProgress?.({phase:'downloading',processed:records.length,message:`Downloaded ${records.length} cloud item${records.length===1?'':'s'}…`});if(!pulled.hasMore)break;cursor=ensureCursorAdvanced(cursor,pulled.cursor,seenCursors)}
  throwIfCancelled(signal)
  const wallets=new Map<string,Wallet>();const transactions=new Map<string,Transaction>();const bills=new Map<string,Bill>();const tombstones:SpenzaData['sync']['tombstones']=[]
  for(const raw of records){throwIfCancelled(signal);const record=deserializeRemoteRecord(raw);if(record.operation==='delete'){tombstones.push({entityType:record.entityType,entityId:record.entityId,deletedAt:record.changedAt});if(record.entityType==='wallet'){wallets.delete(record.entityId);for(const [id,transaction] of transactions)if(transaction.walletId===record.entityId||transaction.toWalletId===record.entityId)transactions.delete(id);for(const [id,bill] of bills)if(bill.walletId===record.entityId)bills.delete(id)}else if(record.entityType==='transaction')transactions.delete(record.entityId);else bills.delete(record.entityId);continue}const payload=record.payload as RemotePayload;if(record.entityType==='wallet'){const wallet=payload as Wallet;wallets.set(record.entityId,{...wallet,id:record.entityId,createdAt:wallet.createdAt||record.changedAt,updatedAt:record.changedAt})}else if(record.entityType==='transaction'){const transaction=payload as Transaction;transactions.set(record.entityId,{...transaction,id:record.entityId,createdAt:transaction.createdAt||record.changedAt,updatedAt:record.changedAt})}else{const bill=payload as Bill;bills.set(record.entityId,{...bill,id:record.entityId,createdAt:bill.createdAt||record.changedAt,updatedAt:record.changedAt})}}
  const restored:SpenzaData={...local,wallets:[...wallets.values()],transactions:[...transactions.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt)),bills:[...bills.values()],sync:{tombstones,pendingChanges:[],lastSyncAt:serverTime}}
  throwIfCancelled(signal);onProgress?.({phase:'saving',message:'Saving cloud data on this device…'});await localRepository.replaceSnapshot(restored);throwIfCancelled(signal)
  return {data:restored,counts:{wallets:restored.wallets.length,transactions:restored.transactions.length,bills:restored.bills.length},serverTime}
}

export async function syncSupabaseIfAuthenticated(options:SyncOptions={}):Promise<SupabaseSyncResult>{
  const progress=options.onProgress;const signal=options.signal
  if(!isSupabaseConfigured())return {status:'disabled'}
  const supabase=getSupabaseClient();if(!supabase)return {status:'disabled'}
  try{
    throwIfCancelled(signal);progress?.({phase:'checking',message:'Checking cloud account…'})
    const userId=await getSupabaseUserId();throwIfCancelled(signal);if(!userId)return {status:'signed-out'}
    const provider=new SupabaseSyncProvider(supabase,userId);let data=await localRepository.getSnapshot();throwIfCancelled(signal)
    if(!hasFinancialData(data)){const restored=await restoreFullCloudSnapshot(provider,data,progress,signal);throwIfCancelled(signal);progress?.({phase:'complete',processed:restored.counts.wallets+restored.counts.transactions+restored.counts.bills,total:restored.counts.wallets+restored.counts.transactions+restored.counts.bills,remaining:0,message:'Cloud restore complete.'});return {status:'synced',data:restored.data,rejected:0,restored:restored.counts}}
    const remoteProbe=await provider.pullChanges({since:epoch,limit:1},signal);throwIfCancelled(signal)
    if(remoteProbe.changes.length===0){const bootstrap=bootstrapRecords(data);if(bootstrap.length){progress?.({phase:'uploading',processed:0,total:bootstrap.length,remaining:bootstrap.length,message:`Uploading ${bootstrap.length} local item${bootstrap.length===1?'':'s'}…`});const pushed=await provider.pushChanges(bootstrap,(processed,total)=>progress?.({phase:'uploading',processed,total,remaining:Math.max(0,total-processed),message:`Uploading ${processed} of ${total} · ${Math.max(0,total-processed)} remaining`}),signal);throwIfCancelled(signal);if(pushed.rejected.length){const reconciled=await reconcileRejected(provider,data,pushed.rejected,progress,signal);data=reconciled.data;if(reconciled.unresolved.length)return {status:'error',data,error:rejectionError('Initial cloud backup',reconciled.unresolved),rejected:reconciled.unresolved.length}}}}
    const pending=serializePendingChanges(data)
    if(pending.length){
      const pullSince=data.sync.lastSyncAt
      progress?.({phase:'uploading',processed:0,total:pending.length,remaining:pending.length,message:`Uploading ${pending.length} pending change${pending.length===1?'':'s'}…`})
      const pushed=await provider.pushChanges(pending,(processed,total)=>progress?.({phase:'uploading',processed,total,remaining:Math.max(0,total-processed),message:`Uploading ${processed} of ${total} · ${Math.max(0,total-processed)} remaining`}),signal)
      throwIfCancelled(signal)
      data=acknowledgeChanges(data,pushed.accepted,pushed.serverTime)
      data={...data,sync:{...data.sync,lastSyncAt:pullSince}}
      if(pushed.rejected.length){const reconciled=await reconcileRejected(provider,data,pushed.rejected,progress,signal);data=reconciled.data;if(reconciled.unresolved.length)return {status:'error',data,error:rejectionError('Cloud sync',reconciled.unresolved),rejected:reconciled.unresolved.length}}
    }
    let cursor:string|undefined;let serverTime=data.sync.lastSyncAt||epoch;let downloaded=0;const seenCursors=new Set<string>();progress?.({phase:'downloading',processed:0,message:'Checking for cloud updates…'})
    while(true){throwIfCancelled(signal);const pulled=await provider.pullChanges({since:data.sync.lastSyncAt,limit:500,cursor},signal);throwIfCancelled(signal);downloaded+=pulled.changes.length;for(const change of pulled.changes){throwIfCancelled(signal);data=applyRemote(data,change)}serverTime=pulled.serverTime;progress?.({phase:'downloading',processed:downloaded,message:downloaded?`Downloaded ${downloaded} cloud update${downloaded===1?'':'s'}…`:'No newer cloud changes.'});if(!pulled.hasMore)break;cursor=ensureCursorAdvanced(cursor,pulled.cursor,seenCursors)}
    throwIfCancelled(signal);data={...data,sync:{...data.sync,lastSyncAt:serverTime}};progress?.({phase:'saving',message:'Saving synchronized data…'});await localRepository.replaceSnapshot(data);throwIfCancelled(signal);progress?.({phase:'complete',processed:pending.length,total:pending.length,remaining:0,message:'Everything is up to date.'});return {status:'synced',data,rejected:0}
  }catch(error){if(isAbortError(error)||signal?.aborted){progress?.({phase:'cancelled',message:'Sync cancelled.'});return {status:'cancelled'}}return {status:'error',error:error instanceof Error?error.message:String(error)}}
}

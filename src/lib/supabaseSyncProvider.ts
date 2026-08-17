import type { SupabaseClient } from '@supabase/supabase-js'
import { PullRemoteChangesRequest, PullRemoteChangesResult, PushRemoteChangesResult, RemoteSyncProvider, RemoteSyncRecord } from './remoteSyncProvider'

type EntityTable='spenza_wallets'|'spenza_transactions'|'spenza_bills'
type EntityRow={id:string;payload:unknown;changed_at:string}
type TombstoneRow={entity_type:'wallet'|'transaction'|'bill';entity_id:string;deleted_at:string}
type PullRow={entity_type:'wallet'|'transaction'|'bill';entity_id:string;operation:'upsert'|'delete';changed_at:string;payload:unknown|null}
type PullCursor={changedAt:string;entityType:RemoteSyncRecord['entityType'];entityId:string}
type BatchResult={index:number;accepted:boolean;reason?:string|null}
type BatchResponse={results?:BatchResult[];serverTime?:string}
export type PushProgress=(processed:number,total:number,change:RemoteSyncRecord)=>void
export type SyncTarget=Pick<RemoteSyncRecord,'entityType'|'entityId'>

const BATCH_SIZE=200
const LOOKUP_CHUNK_SIZE=100
const EPOCH='1970-01-01T00:00:00.000Z'
const throwIfCancelled=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Sync cancelled','AbortError')}

function toRemoteEntity(entityType:RemoteSyncRecord['entityType'],row:EntityRow):RemoteSyncRecord{return {entityType,entityId:row.id,operation:'upsert',changedAt:row.changed_at,payload:row.payload}}
function toRemoteDelete(row:TombstoneRow):RemoteSyncRecord{return {entityType:row.entity_type,entityId:row.entity_id,operation:'delete',changedAt:row.deleted_at}}
function toRemotePull(row:PullRow):RemoteSyncRecord{return {entityType:row.entity_type,entityId:row.entity_id,operation:row.operation,changedAt:row.changed_at,payload:row.operation==='upsert'?(row.payload??{}):undefined}}
function syncRank(change:RemoteSyncRecord){return change.operation==='upsert'?(change.entityType==='wallet'?0:change.entityType==='transaction'?1:2):(change.entityType==='wallet'?5:change.entityType==='transaction'?3:4)}
function tableFor(entityType:RemoteSyncRecord['entityType']):EntityTable{return entityType==='wallet'?'spenza_wallets':entityType==='transaction'?'spenza_transactions':'spenza_bills'}
function shouldReplaceCurrent(current:RemoteSyncRecord|undefined,next:RemoteSyncRecord){if(!current)return true;if(next.changedAt>current.changedAt)return true;if(next.changedAt<current.changedAt)return false;return next.operation==='delete'&&current.operation!=='delete'}
function encodeCursor(record:RemoteSyncRecord){return JSON.stringify({changedAt:record.changedAt,entityType:record.entityType,entityId:record.entityId} satisfies PullCursor)}
function decodeCursor(value?:string):PullCursor|undefined{if(!value)return undefined;try{const parsed=JSON.parse(value) as Partial<PullCursor>;if(typeof parsed.changedAt==='string'&&['wallet','transaction','bill'].includes(String(parsed.entityType))&&typeof parsed.entityId==='string')return parsed as PullCursor}catch{}return undefined}

export class SupabaseSyncProvider implements RemoteSyncProvider{
  constructor(private supabase:SupabaseClient,private userId:string){}
  private async serverTime(signal?:AbortSignal){throwIfCancelled(signal);const {data,error}=await this.supabase.rpc('spenza_server_time');throwIfCancelled(signal);if(error)throw error;return typeof data==='string'?data:new Date().toISOString()}
  async pullChanges(request:PullRemoteChangesRequest,signal?:AbortSignal):Promise<PullRemoteChangesResult>{
    throwIfCancelled(signal)
    const since=request.since||EPOCH
    const limit=Math.min(Math.max(request.limit||500,1),2000)
    const cursor=decodeCursor(request.cursor)
    const {data,error}=await this.supabase.rpc('spenza_pull_changes',{
      p_since:since,
      p_cursor_changed_at:cursor?.changedAt??null,
      p_cursor_entity_type:cursor?.entityType??null,
      p_cursor_entity_id:cursor?.entityId??null,
      p_limit:limit+1,
    })
    throwIfCancelled(signal)
    if(error)throw error
    const rows=(data||[]) as PullRow[]
    const hasMore=rows.length>limit
    const changes=rows.slice(0,limit).map(toRemotePull)
    const last=changes[changes.length-1]
    return {changes,cursor:hasMore&&last?encodeCursor(last):undefined,hasMore,serverTime:await this.serverTime(signal)}
  }
  async pullCurrentRecords(targets:SyncTarget[],signal?:AbortSignal):Promise<RemoteSyncRecord[]>{
    throwIfCancelled(signal)
    const wanted=new Map<string,SyncTarget>()
    for(const target of targets)wanted.set(`${target.entityType}:${target.entityId}`,target)
    const current=new Map<string,RemoteSyncRecord>()
    for(const entityType of ['wallet','transaction','bill'] as const){
      const ids=[...wanted.values()].filter(target=>target.entityType===entityType).map(target=>target.entityId)
      for(let start=0;start<ids.length;start+=LOOKUP_CHUNK_SIZE){
        throwIfCancelled(signal)
        const chunk=ids.slice(start,start+LOOKUP_CHUNK_SIZE)
        const [{data:entities,error:entityError},{data:tombstones,error:tombstoneError}]=await Promise.all([
          this.supabase.from(tableFor(entityType)).select('id,payload,changed_at').eq('owner_id',this.userId).in('id',chunk),
          this.supabase.from('spenza_tombstones').select('entity_type,entity_id,deleted_at').eq('owner_id',this.userId).eq('entity_type',entityType).in('entity_id',chunk),
        ])
        throwIfCancelled(signal)
        if(entityError)throw entityError
        if(tombstoneError)throw tombstoneError
        for(const row of (entities||[]) as EntityRow[]){const record=toRemoteEntity(entityType,row);const key=`${record.entityType}:${record.entityId}`;if(shouldReplaceCurrent(current.get(key),record))current.set(key,record)}
        for(const row of (tombstones||[]) as TombstoneRow[]){const record=toRemoteDelete(row);const key=`${record.entityType}:${record.entityId}`;if(shouldReplaceCurrent(current.get(key),record))current.set(key,record)}
      }
    }
    return [...current.values()]
  }
  async pushChanges(changes:RemoteSyncRecord[],onProgress?:PushProgress,signal?:AbortSignal):Promise<PushRemoteChangesResult>{
    const accepted:RemoteSyncRecord[]=[];const rejected:Array<{change:RemoteSyncRecord;reason:string}>=[]
    const ordered=[...changes].sort((a,b)=>syncRank(a)-syncRank(b)||a.changedAt.localeCompare(b.changedAt))
    let processed=0
    let latestServerTime:string|undefined
    for(let start=0;start<ordered.length;start+=BATCH_SIZE){
      throwIfCancelled(signal)
      const batch=ordered.slice(start,start+BATCH_SIZE)
      const payload=batch.map(change=>({entityType:change.entityType,entityId:change.entityId,operation:change.operation,changedAt:change.changedAt,payload:change.operation==='upsert'?(change.payload??{}):null}))
      const {data,error}=await this.supabase.rpc('spenza_apply_changes_batch',{p_changes:payload})
      throwIfCancelled(signal)
      if(error)throw error
      const response=(data||{}) as BatchResponse
      latestServerTime=response.serverTime||latestServerTime
      const results=Array.isArray(response.results)?response.results:[]
      const byIndex=new Map(results.map(result=>[result.index,result]))
      for(let index=0;index<batch.length;index++){
        const change=batch[index]
        const result=byIndex.get(index)
        if(result?.accepted)accepted.push(change)
        else rejected.push({change,reason:result?.reason||'Cloud batch did not return a result for this change'})
        processed+=1
        onProgress?.(processed,ordered.length,change)
      }
    }
    return {accepted,rejected,serverTime:latestServerTime||await this.serverTime(signal)}
  }
}

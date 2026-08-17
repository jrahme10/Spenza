import type { SupabaseClient } from '@supabase/supabase-js'
import { PullRemoteChangesRequest, PullRemoteChangesResult, PushRemoteChangesResult, RemoteSyncProvider, RemoteSyncRecord } from './remoteSyncProvider'

type EntityTable='spenza_wallets'|'spenza_transactions'|'spenza_bills'
type EntityRow={id:string;payload:unknown;changed_at:string}
type TombstoneRow={entity_type:'wallet'|'transaction'|'bill';entity_id:string;deleted_at:string}
type BatchResult={index:number;accepted:boolean;reason?:string|null}
type BatchResponse={results?:BatchResult[];serverTime?:string}
export type PushProgress=(processed:number,total:number,change:RemoteSyncRecord)=>void

const BATCH_SIZE=200
const throwIfCancelled=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Sync cancelled','AbortError')}

function toRemoteEntity(entityType:RemoteSyncRecord['entityType'],row:EntityRow):RemoteSyncRecord{return {entityType,entityId:row.id,operation:'upsert',changedAt:row.changed_at,payload:row.payload}}
function toRemoteDelete(row:TombstoneRow):RemoteSyncRecord{return {entityType:row.entity_type,entityId:row.entity_id,operation:'delete',changedAt:row.deleted_at}}
function syncRank(change:RemoteSyncRecord){return change.operation==='upsert'?(change.entityType==='wallet'?0:change.entityType==='transaction'?1:2):(change.entityType==='wallet'?5:change.entityType==='transaction'?3:4)}

export class SupabaseSyncProvider implements RemoteSyncProvider{
  constructor(private supabase:SupabaseClient,private userId:string){}
  private async serverTime(signal?:AbortSignal){throwIfCancelled(signal);const {data,error}=await this.supabase.rpc('spenza_server_time');throwIfCancelled(signal);if(error)throw error;return typeof data==='string'?data:new Date().toISOString()}
  async pullChanges(request:PullRemoteChangesRequest,signal?:AbortSignal):Promise<PullRemoteChangesResult>{
    throwIfCancelled(signal)
    const since=request.cursor||request.since||'1970-01-01T00:00:00.000Z';const limit=Math.min(Math.max(request.limit||500,1),2000);const records:RemoteSyncRecord[]=[]
    const readEntity=async(table:EntityTable,entityType:RemoteSyncRecord['entityType'])=>{throwIfCancelled(signal);const {data,error}=await this.supabase.from(table).select('id,payload,changed_at').eq('owner_id',this.userId).gt('changed_at',since).order('changed_at',{ascending:true}).limit(limit);throwIfCancelled(signal);if(error)throw error;for(const row of (data||[]) as EntityRow[])records.push(toRemoteEntity(entityType,row))}
    await Promise.all([readEntity('spenza_wallets','wallet'),readEntity('spenza_transactions','transaction'),readEntity('spenza_bills','bill')])
    throwIfCancelled(signal)
    const {data:tombstones,error:tombstoneError}=await this.supabase.from('spenza_tombstones').select('entity_type,entity_id,deleted_at').eq('owner_id',this.userId).gt('deleted_at',since).order('deleted_at',{ascending:true}).limit(limit);throwIfCancelled(signal);if(tombstoneError)throw tombstoneError
    for(const row of (tombstones||[]) as TombstoneRow[])records.push(toRemoteDelete(row));records.sort((a,b)=>a.changedAt.localeCompare(b.changedAt)||a.entityType.localeCompare(b.entityType)||a.entityId.localeCompare(b.entityId));const selected=records.slice(0,limit)
    return {changes:selected,cursor:selected.length===limit?selected[selected.length-1]?.changedAt:undefined,hasMore:records.length>limit,serverTime:await this.serverTime(signal)}
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

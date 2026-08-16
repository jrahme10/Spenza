import type { SupabaseClient } from '@supabase/supabase-js'
import { PullRemoteChangesRequest, PullRemoteChangesResult, PushRemoteChangesResult, RemoteSyncProvider, RemoteSyncRecord } from './remoteSyncProvider'

type EntityTable='spenza_wallets'|'spenza_transactions'|'spenza_bills'
type EntityRow={id:string;payload:unknown;changed_at:string}
type TombstoneRow={entity_type:'wallet'|'transaction'|'bill';entity_id:string;deleted_at:string}
export type PushProgress=(processed:number,total:number,change:RemoteSyncRecord)=>void

const tableFor=(entityType:RemoteSyncRecord['entityType']):EntityTable=>entityType==='wallet'?'spenza_wallets':entityType==='transaction'?'spenza_transactions':'spenza_bills'

function toRemoteEntity(entityType:RemoteSyncRecord['entityType'],row:EntityRow):RemoteSyncRecord{return {entityType,entityId:row.id,operation:'upsert',changedAt:row.changed_at,payload:row.payload}}
function toRemoteDelete(row:TombstoneRow):RemoteSyncRecord{return {entityType:row.entity_type,entityId:row.entity_id,operation:'delete',changedAt:row.deleted_at}}

export class SupabaseSyncProvider implements RemoteSyncProvider{
  constructor(private supabase:SupabaseClient,private userId:string){}
  private async serverTime(){const {data,error}=await this.supabase.rpc('spenza_server_time');if(error)throw error;return typeof data==='string'?data:new Date().toISOString()}
  async pullChanges(request:PullRemoteChangesRequest):Promise<PullRemoteChangesResult>{
    const since=request.cursor||request.since||'1970-01-01T00:00:00.000Z';const limit=Math.min(Math.max(request.limit||500,1),2000);const records:RemoteSyncRecord[]=[]
    const readEntity=async(table:EntityTable,entityType:RemoteSyncRecord['entityType'])=>{const {data,error}=await this.supabase.from(table).select('id,payload,changed_at').eq('owner_id',this.userId).gt('changed_at',since).order('changed_at',{ascending:true}).limit(limit);if(error)throw error;for(const row of (data||[]) as EntityRow[])records.push(toRemoteEntity(entityType,row))}
    await Promise.all([readEntity('spenza_wallets','wallet'),readEntity('spenza_transactions','transaction'),readEntity('spenza_bills','bill')])
    const {data:tombstones,error:tombstoneError}=await this.supabase.from('spenza_tombstones').select('entity_type,entity_id,deleted_at').eq('owner_id',this.userId).gt('deleted_at',since).order('deleted_at',{ascending:true}).limit(limit);if(tombstoneError)throw tombstoneError
    for(const row of (tombstones||[]) as TombstoneRow[])records.push(toRemoteDelete(row));records.sort((a,b)=>a.changedAt.localeCompare(b.changedAt)||a.entityType.localeCompare(b.entityType)||a.entityId.localeCompare(b.entityId));const selected=records.slice(0,limit)
    return {changes:selected,cursor:selected.length===limit?selected[selected.length-1]?.changedAt:undefined,hasMore:records.length>limit,serverTime:await this.serverTime()}
  }
  async pushChanges(changes:RemoteSyncRecord[],onProgress?:PushProgress):Promise<PushRemoteChangesResult>{
    const accepted:RemoteSyncRecord[]=[];const rejected:Array<{change:RemoteSyncRecord;reason:string}>=[]
    const ordered=[...changes].sort((a,b)=>{const rank=(x:RemoteSyncRecord)=>x.operation==='upsert'?(x.entityType==='wallet'?0:x.entityType==='transaction'?1:2):(x.entityType==='wallet'?5:x.entityType==='transaction'?3:4);return rank(a)-rank(b)||a.changedAt.localeCompare(b.changedAt)})
    let processed=0
    for(const change of ordered){const {data,error}=await this.supabase.rpc('spenza_apply_change',{p_entity_type:change.entityType,p_entity_id:change.entityId,p_operation:change.operation,p_changed_at:change.changedAt,p_payload:change.operation==='upsert'?(change.payload??{}):null});if(error)rejected.push({change,reason:error.message});else if(data===true)accepted.push(change);else rejected.push({change,reason:'A newer remote version already exists'});processed+=1;onProgress?.(processed,ordered.length,change)}
    return {accepted,rejected,serverTime:await this.serverTime()}
  }
}

import { syncSupabaseIfAuthenticated, SupabaseSyncResult, SyncProgress } from './supabaseSync'

export type GlobalSyncState={
  status:'idle'|'syncing'|'synced'|'error'|'signed-out'
  progress?:SyncProgress
  error?:string
  lastResult?:SupabaseSyncResult
  startedAt?:number
  finishedAt?:number
}

type Listener=(state:GlobalSyncState)=>void
let state:GlobalSyncState={status:'idle'}
let active:Promise<SupabaseSyncResult>|null=null
const listeners=new Set<Listener>()

const emit=(next:GlobalSyncState)=>{state=next;for(const listener of listeners)listener(state)}

export const syncManager={
  getState:()=>state,
  subscribe(listener:Listener){listeners.add(listener);listener(state);return()=>listeners.delete(listener)},
  async run():Promise<SupabaseSyncResult>{
    if(active)return active
    const startedAt=Date.now()
    emit({status:'syncing',startedAt,progress:{phase:'checking',message:'Starting sync…'}})
    active=syncSupabaseIfAuthenticated({onProgress:progress=>emit({status:'syncing',startedAt,progress})})
      .then(result=>{
        if(result.status==='synced')emit({status:'synced',startedAt,finishedAt:Date.now(),lastResult:result,progress:{phase:'complete',remaining:0,message:result.restored?`Restored ${result.restored.wallets} accounts and ${result.restored.transactions} transactions.`:'Everything is up to date.'}})
        else if(result.status==='signed-out')emit({status:'signed-out',startedAt,finishedAt:Date.now(),lastResult:result})
        else if(result.status==='error')emit({status:'error',startedAt,finishedAt:Date.now(),lastResult:result,error:result.error||'Cloud sync failed.'})
        else emit({status:'idle',startedAt,finishedAt:Date.now(),lastResult:result})
        return result
      })
      .catch(error=>{const message=error instanceof Error?error.message:String(error);emit({status:'error',startedAt,finishedAt:Date.now(),error:message});return {status:'error',error:message}})
      .finally(()=>{active=null})
    return active
  },
}

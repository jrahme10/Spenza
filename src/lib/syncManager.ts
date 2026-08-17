import { syncSupabaseIfAuthenticated, SupabaseSyncResult, SyncErrorKind, SyncProgress } from './supabaseSync'

export type GlobalSyncState={
  status:'idle'|'syncing'|'synced'|'error'|'signed-out'|'cancelled'
  progress?:SyncProgress
  error?:string
  errorKind?:SyncErrorKind
  retryable?:boolean
  lastResult?:SupabaseSyncResult
  startedAt?:number
  finishedAt?:number
}

type Listener=(state:GlobalSyncState)=>void
let state:GlobalSyncState={status:'idle'}
let active:Promise<SupabaseSyncResult>|null=null
let activeController:AbortController|null=null
const listeners=new Set<Listener>()
const emit=(next:GlobalSyncState)=>{state=next;for(const listener of listeners)listener(state)}

export const syncManager={
  getState:()=>state,
  subscribe(listener:Listener){listeners.add(listener);listener(state);return()=>{listeners.delete(listener)}},
  cancel(){if(!activeController||!active)return false;activeController.abort();return true},
  run():Promise<SupabaseSyncResult>{
    if(active)return active
    const startedAt=Date.now()
    const controller=new AbortController()
    activeController=controller
    emit({status:'syncing',startedAt,progress:{phase:'checking',message:'Starting sync…'}})
    const task:Promise<SupabaseSyncResult>=syncSupabaseIfAuthenticated({signal:controller.signal,onProgress:progress=>{if(!controller.signal.aborted||progress.phase==='cancelled')emit({status:progress.phase==='cancelled'?'cancelled':'syncing',startedAt,finishedAt:progress.phase==='cancelled'?Date.now():undefined,progress})}})
      .then(result=>{
        if(result.status==='cancelled')emit({status:'cancelled',startedAt,finishedAt:Date.now(),lastResult:result,progress:{phase:'cancelled',message:'Sync cancelled.'}})
        else if(result.status==='synced')emit({status:'synced',startedAt,finishedAt:Date.now(),lastResult:result,progress:{phase:'complete',remaining:0,message:result.restored?`Restored ${result.restored.wallets} accounts and ${result.restored.transactions} transactions.`:'Everything is up to date.'}})
        else if(result.status==='signed-out')emit({status:'signed-out',startedAt,finishedAt:Date.now(),lastResult:result,error:result.error,errorKind:result.errorKind,retryable:false})
        else if(result.status==='error')emit({status:'error',startedAt,finishedAt:Date.now(),lastResult:result,error:result.error||'Cloud sync failed.',errorKind:result.errorKind||'unknown',retryable:result.retryable??true})
        else emit({status:'idle',startedAt,finishedAt:Date.now(),lastResult:result})
        return result
      })
      .catch((error):SupabaseSyncResult=>{if(controller.signal.aborted){const result:SupabaseSyncResult={status:'cancelled'};emit({status:'cancelled',startedAt,finishedAt:Date.now(),lastResult:result,progress:{phase:'cancelled',message:'Sync cancelled.'}});return result}const message=error instanceof Error?error.message:String(error);const result:SupabaseSyncResult={status:'error',error:message,errorKind:'unknown',retryable:true};emit({status:'error',startedAt,finishedAt:Date.now(),error:message,errorKind:'unknown',retryable:true,lastResult:result});return result})
    active=task
    void task.finally(()=>{if(active===task){active=null;activeController=null}})
    return task
  },
}

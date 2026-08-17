import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Cloud, LoaderCircle, XCircle } from 'lucide-react'
import { GlobalSyncState, syncManager } from '../lib/syncManager'

export default function SyncStatusPill(){
  const [state,setState]=useState<GlobalSyncState>(syncManager.getState())
  const [visible,setVisible]=useState(false)
  useEffect(()=>syncManager.subscribe(next=>{setState(next);if(next.status==='syncing'||next.status==='error')setVisible(true);else if(next.status==='synced'||next.status==='cancelled'){setVisible(true);window.setTimeout(()=>setVisible(false),2400)}}),[])
  if(!visible||state.status==='idle'||state.status==='signed-out')return null
  const syncing=state.status==='syncing'
  const error=state.status==='error'
  const cancelled=state.status==='cancelled'
  const text=error?(state.error||'Sync failed'):state.progress?.message||(syncing?'Syncing…':cancelled?'Sync cancelled':'Up to date')
  return <div className={`globalSyncPill ${error?'error':state.status==='synced'?'success':cancelled?'cancelled':''}`} role="status" aria-live="polite">
    {error?<AlertCircle size={16}/>:syncing?<LoaderCircle className="spin" size={16}/>:cancelled?<XCircle size={16}/>:state.status==='synced'?<CheckCircle2 size={16}/>:<Cloud size={16}/>}
    <span>{text}</span>
  </div>
}

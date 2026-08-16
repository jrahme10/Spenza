import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Cloud, LoaderCircle } from 'lucide-react'
import { GlobalSyncState, syncManager } from '../lib/syncManager'

export default function SyncStatusPill(){
  const [state,setState]=useState<GlobalSyncState>(syncManager.getState())
  const [visible,setVisible]=useState(false)
  useEffect(()=>syncManager.subscribe(next=>{setState(next);if(next.status==='syncing'||next.status==='error')setVisible(true);else if(next.status==='synced'){setVisible(true);window.setTimeout(()=>setVisible(false),2400)}}),[])
  if(!visible||state.status==='idle'||state.status==='signed-out')return null
  const syncing=state.status==='syncing'
  const error=state.status==='error'
  const text=error?(state.error||'Sync failed'):state.progress?.message||(syncing?'Syncing…':'Up to date')
  return <div className={`globalSyncPill ${error?'error':state.status==='synced'?'success':''}`} role="status" aria-live="polite">
    {error?<AlertCircle size={16}/>:syncing?<LoaderCircle className="spin" size={16}/>:state.status==='synced'?<CheckCircle2 size={16}/>:<Cloud size={16}/>}
    <span>{text}</span>
  </div>
}

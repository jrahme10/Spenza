import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Cloud, LoaderCircle, XCircle } from 'lucide-react'
import { GlobalSyncState, syncManager } from '../lib/syncManager'

export default function SyncStatusPill(){
  const [state,setState]=useState<GlobalSyncState>(syncManager.getState())
  const [visible,setVisible]=useState(false)
  const hideTimer=useRef<number|undefined>(undefined)
  useEffect(()=>{
    const clearHideTimer=()=>{if(hideTimer.current!==undefined){window.clearTimeout(hideTimer.current);hideTimer.current=undefined}}
    const scheduleHide=(ms:number)=>{clearHideTimer();hideTimer.current=window.setTimeout(()=>{setVisible(false);hideTimer.current=undefined},ms)}
    const unsubscribe=syncManager.subscribe(next=>{
      clearHideTimer()
      setState(next)
      if(next.status==='syncing')setVisible(true)
      else if(next.status==='error'){setVisible(true);scheduleHide(5000)}
      else if(next.status==='synced'||next.status==='cancelled'){setVisible(true);scheduleHide(2400)}
      else setVisible(false)
    })
    return()=>{clearHideTimer();unsubscribe()}
  },[])
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

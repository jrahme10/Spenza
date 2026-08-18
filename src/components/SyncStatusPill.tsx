import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
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
      // Normal background sync is intentionally silent. Only surface real errors.
      if(next.status==='error'){setVisible(true);scheduleHide(5000)}
      else setVisible(false)
    })
    return()=>{clearHideTimer();unsubscribe()}
  },[])
  if(!visible||state.status!=='error')return null
  const text=state.error||'Sync failed'
  return <div className="globalSyncPill error" role="alert" aria-live="assertive">
    <AlertCircle size={16}/>
    <span>{text}</span>
  </div>
}

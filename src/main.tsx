import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import SyncStatusPill from './components/SyncStatusPill'
import { initTheme } from './components/ThemeControl'
import { initDynamicGreeting } from './dynamic-greeting'
import './styles.css'
import './transaction-polish.css'
import './exchange.css'
import './backup.css'
import './spenza-design.css'
import './theme-settings.css'
import './spenza-layout.css'
import './bills.css'
import './reset-danger.css'
import './center-add.css'
import './mobile-safe.css'
import './security-notifications.css'
import './cloud-sync.css'
import { registerPwa } from './lib/pwa'
import { loadData } from './lib/db'
import { syncManager } from './lib/syncManager'

function financialFingerprint(data:Awaited<ReturnType<typeof loadData>>){return JSON.stringify({wallets:data.wallets,transactions:data.transactions,bills:data.bills})}

function installReconnectSync(){
  let retryTimer:number|undefined
  let lastAttemptAt=0
  const syncPending=async(force=false)=>{
    const now=Date.now();if(!force&&now-lastAttemptAt<3000)return
    const before=await loadData();const hasPending=before.sync.pendingChanges.length>0;if(!force&&!hasPending)return
    lastAttemptAt=now;const beforeFingerprint=financialFingerprint(before);const result=await syncManager.run()
    if(result.status==='synced'&&result.data&&beforeFingerprint!==financialFingerprint(result.data))window.location.reload()
  }
  const scheduleSync=(force=false,delay=600)=>{if(retryTimer)window.clearTimeout(retryTimer);retryTimer=window.setTimeout(()=>{void syncPending(force)},delay)}
  const onOnline=()=>scheduleSync(true,500)
  const onFocus=()=>scheduleSync(false,350)
  const onPageShow=()=>scheduleSync(false,350)
  const onVisibility=()=>{if(document.visibilityState==='visible')scheduleSync(false,350)}
  window.addEventListener('online',onOnline);window.addEventListener('focus',onFocus);window.addEventListener('pageshow',onPageShow);document.addEventListener('visibilitychange',onVisibility)
  window.setInterval(()=>{if(document.visibilityState==='visible')void syncPending(false)},15000)
}

function bootstrap(){
  initTheme()

  // Always render local IndexedDB data immediately. Cloud sync must never block
  // startup: after a large import there may be hundreds of queued records to upload.
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App/>
      <SyncStatusPill/>
    </React.StrictMode>,
  )

  installReconnectSync()
  initDynamicGreeting()
  registerPwa()

  // Start the cloud reconciliation only after the app is visible. Imported data
  // therefore remains usable while its queued changes upload in the background.
  void (async()=>{
    try{
      const before=await loadData()
      const beforeFingerprint=financialFingerprint(before)
      const result=await syncManager.run()
      if(result.status==='synced'&&result.data&&beforeFingerprint!==financialFingerprint(result.data))window.location.reload()
    }catch{
      // The global sync manager exposes the failure state; local app startup stays usable.
    }
  })()
}

bootstrap()

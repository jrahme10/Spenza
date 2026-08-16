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
  const onFocus=()=>scheduleSync(true,250)
  const onPageShow=()=>scheduleSync(true,250)
  const onVisibility=()=>{if(document.visibilityState==='visible')scheduleSync(true,250)}
  const onResume=()=>scheduleSync(true,250)
  window.addEventListener('online',onOnline)
  window.addEventListener('focus',onFocus)
  window.addEventListener('pageshow',onPageShow)
  window.addEventListener('resume',onResume)
  document.addEventListener('visibilitychange',onVisibility)
  window.setInterval(()=>{if(document.visibilityState==='visible')void syncPending(false)},15000)
}

function bootstrap(){
  initTheme()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App/>
      <SyncStatusPill/>
    </React.StrictMode>,
  )
  installReconnectSync()
  initDynamicGreeting()
  registerPwa()
  void (async()=>{
    try{
      const before=await loadData()
      const beforeFingerprint=financialFingerprint(before)
      const result=await syncManager.run()
      if(result.status==='synced'&&result.data&&beforeFingerprint!==financialFingerprint(result.data))window.location.reload()
    }catch{
      // Sync state is exposed globally; local data stays available.
    }
  })()
}

bootstrap()

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
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
import { syncSupabaseIfAuthenticated } from './lib/supabaseSync'

function financialFingerprint(data:Awaited<ReturnType<typeof loadData>>){
  return JSON.stringify({wallets:data.wallets,transactions:data.transactions,bills:data.bills})
}

function installReconnectSync(){
  let syncing=false
  let retryTimer:number|undefined
  let lastAttemptAt=0

  const syncPending=async(force=false)=>{
    if(syncing)return
    const now=Date.now()
    if(!force&&now-lastAttemptAt<3000)return

    const before=await loadData()
    const hasPending=before.sync.pendingChanges.length>0
    if(!force&&!hasPending)return

    lastAttemptAt=now
    syncing=true
    window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'syncing',pending:before.sync.pendingChanges.length}}))
    try{
      const beforeFingerprint=financialFingerprint(before)
      const result=await syncSupabaseIfAuthenticated()
      if(result.status==='synced'&&result.data){
        const afterFingerprint=financialFingerprint(result.data)
        const financialDataChanged=beforeFingerprint!==afterFingerprint
        window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'synced',pending:result.data.sync.pendingChanges.length}}))
        if(financialDataChanged)window.location.reload()
      }else if(result.status==='signed-out'){
        window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'signed-out'}}))
      }else if(result.status==='error'){
        window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'error',message:result.error,pending:before.sync.pendingChanges.length}}))
      }
    }catch(error){
      window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'error',message:error instanceof Error?error.message:String(error),pending:before.sync.pendingChanges.length}}))
    }finally{
      syncing=false
    }
  }

  const scheduleSync=(force=false,delay=600)=>{
    if(retryTimer)window.clearTimeout(retryTimer)
    retryTimer=window.setTimeout(()=>{void syncPending(force)},delay)
  }

  const onOnline=()=>{
    window.dispatchEvent(new CustomEvent('spenza-network-status',{detail:{online:true}}))
    scheduleSync(true,500)
  }
  const onOffline=()=>window.dispatchEvent(new CustomEvent('spenza-network-status',{detail:{online:false}}))
  const onFocus=()=>scheduleSync(false,350)
  const onPageShow=()=>scheduleSync(false,350)
  const onVisibility=()=>{if(document.visibilityState==='visible')scheduleSync(false,350)}

  window.addEventListener('online',onOnline)
  window.addEventListener('offline',onOffline)
  window.addEventListener('focus',onFocus)
  window.addEventListener('pageshow',onPageShow)
  document.addEventListener('visibilitychange',onVisibility)

  // iOS can miss the online event while a standalone PWA is backgrounded.
  // While Spenza is visible, retry only when local pending changes exist.
  window.setInterval(()=>{
    if(document.visibilityState==='visible')void syncPending(false)
  },15000)
}

async function bootstrap(){
  initTheme()
  // Cloud sync is optional. Missing config, signed-out users, or network failures
  // never prevent the local IndexedDB app from starting.
  await syncSupabaseIfAuthenticated().catch(()=>undefined)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  installReconnectSync()
  initDynamicGreeting()
  registerPwa()
}

void bootstrap()

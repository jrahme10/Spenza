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
  let reconnectTimer:number|undefined

  const syncAfterReconnect=async()=>{
    if(syncing||!navigator.onLine)return
    syncing=true
    window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'syncing'}}))
    try{
      const before=await loadData()
      const beforeFingerprint=financialFingerprint(before)
      const result=await syncSupabaseIfAuthenticated()
      if(result.status==='synced'&&result.data){
        const afterFingerprint=financialFingerprint(result.data)
        const financialDataChanged=beforeFingerprint!==afterFingerprint
        window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'synced',pending:result.data.sync.pendingChanges.length}}))
        // Local-only edits are already reflected in the open UI. Reload only when
        // the cloud pull changed financial data, so remote updates appear immediately.
        if(financialDataChanged)window.location.reload()
      }else if(result.status==='signed-out'){
        window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'signed-out'}}))
      }else if(result.status==='error'){
        window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'error',message:result.error}}))
      }
    }catch(error){
      window.dispatchEvent(new CustomEvent('spenza-sync-status',{detail:{status:'error',message:error instanceof Error?error.message:String(error)}}))
    }finally{
      syncing=false
    }
  }

  const onOnline=()=>{
    window.dispatchEvent(new CustomEvent('spenza-network-status',{detail:{online:true}}))
    if(reconnectTimer)window.clearTimeout(reconnectTimer)
    reconnectTimer=window.setTimeout(()=>{void syncAfterReconnect()},800)
  }
  const onOffline=()=>window.dispatchEvent(new CustomEvent('spenza-network-status',{detail:{online:false}}))

  window.addEventListener('online',onOnline)
  window.addEventListener('offline',onOffline)
}

async function bootstrap(){
  initTheme()
  // Cloud sync is optional. Missing config, signed-out users, or network failures
  // never prevent the local IndexedDB app from starting.
  if(navigator.onLine)await syncSupabaseIfAuthenticated().catch(()=>undefined)

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

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
import './note-suggestions.css'
import { registerPwa } from './lib/pwa'
import { loadData } from './lib/db'
import { syncManager } from './lib/syncManager'
import { initNoteSuggestions } from './lib/noteSuggestions'

function financialFingerprint(data:Awaited<ReturnType<typeof loadData>>){return JSON.stringify({wallets:data.wallets,transactions:data.transactions,bills:data.bills})}

function localToday(){
  const now=new Date()
  const year=now.getFullYear()
  const month=String(now.getMonth()+1).padStart(2,'0')
  const day=String(now.getDate()).padStart(2,'0')
  return `${year}-${month}-${day}`
}

function resetDateFiltersToToday(){
  const value=localToday()
  localStorage.setItem('spenza-home-date',value)
  localStorage.setItem('spenza-activity-date',value)
  localStorage.setItem('spenza-insight-date',value)
}

function installPendingSync(){
  let retryTimer:number|undefined
  let lastAttemptAt=0
  let automaticSyncBlocked=false
  syncManager.subscribe(state=>{
    if(state.status==='error'||state.status==='cancelled')automaticSyncBlocked=true
    else if(state.status==='synced')automaticSyncBlocked=false
  })
  const syncPending=async()=>{
    if(automaticSyncBlocked)return
    const now=Date.now()
    if(now-lastAttemptAt<3000)return
    const before=await loadData()
    if(before.sync.pendingChanges.length===0)return
    lastAttemptAt=now
    const beforeFingerprint=financialFingerprint(before)
    const result=await syncManager.run()
    if(result.status==='error'||result.status==='cancelled'){automaticSyncBlocked=true;return}
    if(result.status==='synced'&&result.data&&beforeFingerprint!==financialFingerprint(result.data))window.location.reload()
  }
  const scheduleSync=(delay=600)=>{
    if(automaticSyncBlocked)return
    if(retryTimer)window.clearTimeout(retryTimer)
    retryTimer=window.setTimeout(()=>{void syncPending()},delay)
  }
  const onOnline=()=>scheduleSync(500)
  const onFocus=()=>scheduleSync(250)
  const onPageShow=()=>scheduleSync(250)
  const onVisibility=()=>{if(document.visibilityState==='visible')scheduleSync(250)}
  const onResume=()=>scheduleSync(250)
  window.addEventListener('online',onOnline)
  window.addEventListener('focus',onFocus)
  window.addEventListener('pageshow',onPageShow)
  window.addEventListener('resume',onResume)
  document.addEventListener('visibilitychange',onVisibility)
  scheduleSync(800)
}

function bootstrap(){
  resetDateFiltersToToday()
  initTheme()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App/>
      <SyncStatusPill/>
    </React.StrictMode>,
  )
  installPendingSync()
  initDynamicGreeting()
  initNoteSuggestions()
  registerPwa()
}

bootstrap()

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
import './home-summary.css'
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

function financialFingerprint(data:Awaited<ReturnType<typeof loadData>>){return JSON.stringify({wallets:data.wallets,transactions:data.transactions,bills:data.bills,categories:data.categories,usdToLbpRate:data.usdToLbpRate})}

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

function installPopupScrollLock(){
  const popupSelector='.overlay,.dialogOverlay,.calendarOverlay,.notificationOverlay,.notificationPanel,.securityOverlay,.lockOverlay,.cloudDataChoice'
  let locked=false
  let scrollY=0

  const lock=()=>{
    if(locked)return
    locked=true
    scrollY=window.scrollY
    document.documentElement.classList.add('popup-scroll-locked')
    document.body.classList.add('popup-scroll-locked')
    document.body.style.position='fixed'
    document.body.style.top=`-${scrollY}px`
    document.body.style.left='0'
    document.body.style.right='0'
    document.body.style.width='100%'
  }

  const unlock=()=>{
    if(!locked)return
    locked=false
    document.documentElement.classList.remove('popup-scroll-locked')
    document.body.classList.remove('popup-scroll-locked')
    document.body.style.position=''
    document.body.style.top=''
    document.body.style.left=''
    document.body.style.right=''
    document.body.style.width=''
    window.scrollTo(0,scrollY)
  }

  const refresh=()=>{document.querySelector(popupSelector)?lock():unlock()}
  const observer=new MutationObserver(refresh)
  observer.observe(document.body,{childList:true,subtree:true})
  refresh()
}

function installAutomaticSync(){
  let syncTimer:number|undefined
  let lastAttemptAt=0
  const MIN_SYNC_GAP_MS=3000
  const FOREGROUND_REFRESH_MS=30000

  const runSync=async()=>{
    const now=Date.now()
    if(now-lastAttemptAt<MIN_SYNC_GAP_MS)return
    if(typeof navigator!=='undefined'&&!navigator.onLine)return
    lastAttemptAt=now
    const before=await loadData()
    const beforeFingerprint=financialFingerprint(before)
    const result=await syncManager.run()
    if(result.status==='synced'&&result.data&&beforeFingerprint!==financialFingerprint(result.data))window.location.reload()
  }

  const scheduleSync=(delay=250)=>{
    if(syncTimer)window.clearTimeout(syncTimer)
    syncTimer=window.setTimeout(()=>{void runSync()},delay)
  }

  const onOnline=()=>scheduleSync(250)
  const onFocus=()=>scheduleSync(150)
  const onPageShow=()=>scheduleSync(150)
  const onVisibility=()=>{if(document.visibilityState==='visible')scheduleSync(150)}
  const onResume=()=>scheduleSync(150)
  window.addEventListener('online',onOnline)
  window.addEventListener('focus',onFocus)
  window.addEventListener('pageshow',onPageShow)
  window.addEventListener('resume',onResume)
  document.addEventListener('visibilitychange',onVisibility)

  // Always check the cloud at startup, even when this device has no local
  // pending changes. This is what lets a second device download changes
  // created on the first device.
  scheduleSync(800)

  // While Spenza stays open, periodically pull remote changes so another
  // signed-in device is reflected without requiring a manual Sync now.
  window.setInterval(()=>{if(document.visibilityState==='visible')void runSync()},FOREGROUND_REFRESH_MS)
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
  installPopupScrollLock()
  installAutomaticSync()
  initDynamicGreeting()
  initNoteSuggestions()
  registerPwa()
}

bootstrap()

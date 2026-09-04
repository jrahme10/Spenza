import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import SyncStatusPill from './components/SyncStatusPill'
import PwaUpdateBanner from './components/PwaUpdateBanner'
import TransactionFieldFlow from './components/TransactionFieldFlow'
import InsightsTransactionEditor from './components/InsightsTransactionEditor'
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
import './home-toolbar.css'
import './bills.css'
import './reset-danger.css'
import './center-add.css'
import './mobile-safe.css'
import './security-notifications.css'
import './cloud-sync.css'
import './note-suggestions.css'
import './popup-scroll-lock.css'
import './category-sheet.css'
import './account-grid.css'
import './transaction-date-picker.css'
import './transaction-field-flow.css'
import './pwa-update.css'
import './budgets.css'
import './budget-planner.css'
import './smart-money.css'
import './home-smart-insight.css'
import './family.css'
import './no-bottom-gap.css'
import './default-wallet.css'
import './recent-transactions.css'
import './insights-search.css'
import { registerPwa } from './lib/pwa'
import { loadData } from './lib/db'
import { syncManager } from './lib/syncManager'
import { initNoteSuggestions } from './lib/noteSuggestions'
import { initTransactionFormKeyboard } from './lib/transactionFormKeyboard'
import { initTransactionDatePicker } from './lib/transactionDatePicker'
import { initDefaultWallet } from './lib/defaultWallet'
import { initInsightsSearch } from './lib/insightsSearch'

function financialFingerprint(data: Awaited<ReturnType<typeof loadData>>) {
  return JSON.stringify({
    wallets: data.wallets,
    transactions: data.transactions,
    bills: data.bills,
    categories: data.categories,
    usdToLbpRate: data.usdToLbpRate,
  })
}
function localToday() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function resetDateFiltersToToday() {
  const value = localToday()
  localStorage.setItem('spenza-home-date', value)
  localStorage.setItem('spenza-activity-date', value)
  localStorage.setItem('spenza-insight-date', value)
}
function installAutomaticSync() {
  let syncTimer: number | undefined
  let lastAttemptAt = 0
  const MIN_SYNC_GAP_MS = 3000
  const FOREGROUND_REFRESH_MS = 30000
  const runSync = async () => {
    const now = Date.now()
    if (now - lastAttemptAt < MIN_SYNC_GAP_MS) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    lastAttemptAt = now
    const before = await loadData()
    const beforeFingerprint = financialFingerprint(before)
    const result = await syncManager.run()
    if (
      result.status === 'synced' &&
      result.data &&
      beforeFingerprint !== financialFingerprint(result.data)
    )
      window.location.reload()
  }
  const scheduleSync = (delay = 250) => {
    if (syncTimer) window.clearTimeout(syncTimer)
    syncTimer = window.setTimeout(() => {
      void runSync()
    }, delay)
  }
  const onOnline = () => scheduleSync(250)
  const onFocus = () => scheduleSync(150)
  const onPageShow = () => scheduleSync(150)
  const onVisibility = () => {
    if (document.visibilityState === 'visible') scheduleSync(150)
  }
  const onResume = () => scheduleSync(150)
  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onFocus)
  window.addEventListener('pageshow', onPageShow)
  window.addEventListener('resume', onResume)
  document.addEventListener('visibilitychange', onVisibility)
  scheduleSync(800)
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void runSync()
  }, FOREGROUND_REFRESH_MS)
}
function bootstrap() {
  resetDateFiltersToToday()
  initTheme()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
      <InsightsTransactionEditor />
      <TransactionFieldFlow />
      <SyncStatusPill />
      <PwaUpdateBanner />
    </React.StrictMode>,
  )
  installAutomaticSync()
  initDynamicGreeting()
  initNoteSuggestions()
  initTransactionFormKeyboard()
  initTransactionDatePicker()
  initDefaultWallet()
  initInsightsSearch()
  registerPwa()
}
bootstrap()

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarClock,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  Pencil,
  Plus,
  Settings,
  Trash2,
  WalletCards,
  X,
  CalendarDays,
  CalendarRange,
} from 'lucide-react'
import ReceiptScanner from './components/ReceiptScanner'
import HomeSmartInsight from './components/HomeSmartInsight'
import NotePhotoPicker from './components/NotePhotoPicker'
import BackupManager from './components/BackupManager'
import ThemeControl from './components/ThemeControl'
import BillsManager from './components/BillsManager'
import SecuritySettings from './components/SecuritySettings'
import CloudSyncSettings from './components/CloudSyncSettings'
import PwaUpdateSettings from './components/PwaUpdateSettings'
import FamilyManager from './components/FamilyManager'
import AppLockGate from './components/AppLockGate'
import NotificationCenter, { NotificationBell } from './components/NotificationCenter'
import TransactionCalendar from './components/TransactionCalendar'
import BudgetPlanner from './components/BudgetPlanner'
import SmartMoneyHub from './components/SmartMoneyHub'
import TransactionCategoryPicker from './components/TransactionCategoryPicker'
import {
  Currency,
  defaultData,
  loadData,
  saveData,
  SpenzaData,
  Transaction,
  TransactionType,
  uid,
  Wallet,
} from './lib/db'
import { localRepository } from './lib/repository'
import { syncManager } from './lib/syncManager'

const money = (n: number, c: Currency | 'USD' = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: c,
    maximumFractionDigits: c === 'LBP' ? 0 : 2,
  }).format(n)
const today = () => new Date().toISOString().slice(0, 10)
type Dialog = {
  title: string
  message: string
  kind?: 'danger' | 'info'
  confirmLabel?: string
  onConfirm?: () => void
}
type WalletForm = {
  id?: string
  name: string
  currency: Currency
  openingBalance: string
  originalCurrency?: Currency
}
type ReceiptSource = { amount: number; currency?: Currency }
type InsightPeriod = 'daily' | 'monthly' | 'yearly'
type HomePeriod = InsightPeriod | 'custom'
const palette = ['#22d3ae', '#7650ea', '#2d94ee', '#17a9a5', '#a150e3']

export default function App() {
  const [data, setData] = useState<SpenzaData>(defaultData)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState('Home')
  const [activityWalletId, setActivityWalletId] = useState<string | null>(null)
  const [activityTypeFilter, setActivityTypeFilter] = useState<'all' | TransactionType>(() => {
    const v = localStorage.getItem('spenza-activity-type') as ('all' | TransactionType) | null
    return v && ['all', 'income', 'expense', 'transfer'].includes(v) ? v : 'all'
  })
  const [activityPeriod, setActivityPeriod] = useState<HomePeriod>(() => {
    const v = localStorage.getItem('spenza-activity-period') as HomePeriod | null
    return v && ['daily', 'monthly', 'yearly', 'custom'].includes(v) ? v : 'daily'
  })
  const [activityDate, setActivityDate] = useState(
    () => localStorage.getItem('spenza-activity-date') || today(),
  )
  const [insightWalletId, setInsightWalletId] = useState(
    () => localStorage.getItem('spenza-insight-wallet-id') || '',
  )
  const [insightCategory, setInsightCategory] = useState(
    () => localStorage.getItem('spenza-insight-category') || 'all',
  )
  const [insightPeriod, setInsightPeriod] = useState<InsightPeriod>(() => {
    const v = localStorage.getItem('spenza-insight-period') as InsightPeriod | null
    return v && ['daily', 'monthly', 'yearly'].includes(v) ? v : 'daily'
  })
  const [insightDate, setInsightDate] = useState(
    () => localStorage.getItem('spenza-insight-date') || today(),
  )
  const [homeWalletId, setHomeWalletId] = useState(
    () => localStorage.getItem('spenza-home-wallet-id') || '',
  )
  const [homePeriod, setHomePeriod] = useState<HomePeriod>(() => {
    const v = localStorage.getItem('spenza-home-period')
    return v === 'todate' || v === 'yearly'
      ? 'daily'
      : v && ['daily', 'monthly', 'custom'].includes(v)
        ? (v as HomePeriod)
        : 'daily'
  })
  const [homeDate, setHomeDate] = useState(
    () => localStorage.getItem('spenza-home-date') || today(),
  )
  const [rateInput, setRateInput] = useState(String(defaultData.usdToLbpRate || 89500))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogBusy, setDialogBusy] = useState(false)
  const [walletForm, setWalletForm] = useState<WalletForm | null>(null)
  const [receiptSource, setReceiptSource] = useState<ReceiptSource | null>(null)
  const [type, setType] = useState<TransactionType>('expense')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [walletId, setWalletId] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [noteImages, setNoteImages] = useState<string[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [homeCalendarOpen, setHomeCalendarOpen] = useState(false)
  const [activityCalendarOpen, setActivityCalendarOpen] = useState(false)
  const [collapsedActivityGroups, setCollapsedActivityGroups] = useState<Set<string>>(
    () => new Set(),
  )
  const [homeRecentLimit, setHomeRecentLimit] = useState<number>(12)
  const [activitySearch, setActivitySearch] = useState('')
  const [activityAccountFilter, setActivityAccountFilter] = useState(
    () => localStorage.getItem('spenza-activity-account') || 'all',
  )
  const [activityCategoryFilter, setActivityCategoryFilter] = useState(
    () => localStorage.getItem('spenza-activity-category') || 'all',
  )
  useEffect(() => {
    loadData()
      .then((d) => {
        setData(d)
        setRateInput(String(d.usdToLbpRate || 89500))
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [])
  useEffect(() => {
    if (ready) saveData(data)
  }, [data, ready])
  useEffect(() => {
    if (!ready || !data.sync.pendingChanges.length) return
    const timer = window.setTimeout(() => {
      void syncManager.run().then((result) => {
        if (result.status === 'synced' && result.data) setData(result.data)
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [ready, data.sync.pendingChanges])
  useEffect(() => {
    if (!ready) return
    const sync = () => {
      if (document.visibilityState === 'hidden') return
      void syncManager.run().then((result) => {
        if (result.status === 'synced' && result.data) setData(result.data)
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync()
    }
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(sync, 15000)
    sync()
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [ready])
  useEffect(() => {
    if (!ready) return
    if (!insightWalletId && data.wallets[0]) setInsightWalletId(data.wallets[0].id)
    if (insightWalletId && !data.wallets.some((w) => w.id === insightWalletId))
      setInsightWalletId(data.wallets[0]?.id || '')
  }, [data.wallets, insightWalletId, ready])
  useEffect(() => {
    if (!ready) return
    if (!homeWalletId && data.wallets[0]) {
      setHomeWalletId(data.wallets[0].id)
      return
    }
    if (homeWalletId && !data.wallets.some((w) => w.id === homeWalletId)) {
      const fallback = data.wallets[0]?.id || ''
      setHomeWalletId(fallback)
      if (fallback) localStorage.setItem('spenza-home-wallet-id', fallback)
      else localStorage.removeItem('spenza-home-wallet-id')
    }
  }, [data.wallets, homeWalletId, ready])
  useEffect(() => {
    if (homeWalletId) localStorage.setItem('spenza-home-wallet-id', homeWalletId)
    else localStorage.removeItem('spenza-home-wallet-id')
  }, [homeWalletId])
  useEffect(() => {
    localStorage.setItem('spenza-home-period', homePeriod)
    localStorage.setItem('spenza-home-date', homeDate)
  }, [homePeriod, homeDate])
  useEffect(() => {
    localStorage.setItem('spenza-activity-period', activityPeriod)
    localStorage.setItem('spenza-activity-date', activityDate)
  }, [activityPeriod, activityDate])
  useEffect(() => {
    localStorage.setItem('spenza-insight-period', insightPeriod)
    localStorage.setItem('spenza-insight-date', insightDate)
  }, [insightPeriod, insightDate])
  useEffect(() => {
    localStorage.setItem('spenza-activity-type', activityTypeFilter)
  }, [activityTypeFilter])
  useEffect(() => {
    localStorage.setItem('spenza-activity-account', activityAccountFilter)
  }, [activityAccountFilter])
  useEffect(() => {
    localStorage.setItem('spenza-activity-category', activityCategoryFilter)
  }, [activityCategoryFilter])
  useEffect(() => {
    if (insightWalletId) localStorage.setItem('spenza-insight-wallet-id', insightWalletId)
    else localStorage.removeItem('spenza-insight-wallet-id')
  }, [insightWalletId])
  useEffect(() => {
    localStorage.setItem('spenza-insight-category', insightCategory)
  }, [insightCategory])
  useEffect(() => {
    const spenzaInfiniteScroll = () => {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 420) return
      if (tab === 'Home') setHomeRecentLimit((v) => v + 12)
    }
    window.addEventListener('scroll', spenzaInfiniteScroll, { passive: true })
    return () => window.removeEventListener('scroll', spenzaInfiniteScroll)
  }, [tab])
  const defaultWalletId = localStorage.getItem('spenza-default-wallet-id') || ''
  const setDefaultWalletId = (id: string) => {
    if (id) localStorage.setItem('spenza-default-wallet-id', id)
    else localStorage.removeItem('spenza-default-wallet-id')
    if (id) {
      setHomeWalletId(id)
      setInsightWalletId(id)
    }
  }
  const rate = data.usdToLbpRate || 89500
  const convert = (value: number, from: Currency, to: Currency) =>
    from === to ? value : from === 'USD' ? value * rate : value / rate
  const normalize = (value: number, currency: Currency) =>
    currency === 'LBP' ? Math.round(value) : Math.round(value * 100) / 100
  const pairRate = (from: Currency, to: Currency) =>
    from === to ? 1 : from === 'USD' ? rate : 1 / rate
  const walletBalance = (id: string) => {
    const w = data.wallets.find((x) => x.id === id)
    if (!w) return 0
    return data.transactions.reduce((b, t) => {
      if (t.type === 'income' && t.walletId === id) return b + t.amount
      if (t.type === 'expense' && t.walletId === id) return b - t.amount
      if (t.type === 'transfer') {
        if (t.walletId === id) return b - t.amount
        if (t.toWalletId === id) return b + (t.exchangeRate ? t.amount * t.exchangeRate : t.amount)
      }
      return b
    }, w.openingBalance)
  }
  const walletUsed = (id: string) =>
    data.transactions.some((t) => t.walletId === id || t.toWalletId === id)
  const resetForm = () => {
    const defaultWallet =
      data.wallets.find((w) => w.id === localStorage.getItem('spenza-default-wallet-id')) ||
      data.wallets[0]
    setEditing(null)
    setType('expense')
    setTitle('')
    setAmount('')
    setCategory(data.categories[0] || 'Other')
    setWalletId(defaultWallet?.id || '')
    setToWalletId(
      data.wallets.find((w) => w.id !== defaultWallet?.id)?.id || defaultWallet?.id || '',
    )
    setDate(today())
    setNote('')
    setNoteImages([])
    setReceiptSource(null)
  }
  const showAdd = () => {
    resetForm()
    setOpen(true)
  }
  const edit = (t: Transaction) => {
    setEditing(t.id)
    setType(t.type)
    setTitle(t.title)
    setAmount(String(t.amount))
    setCategory(t.category)
    setWalletId(t.walletId)
    setToWalletId(t.toWalletId || '')
    setDate(t.date)
    setNote(t.note || '')
    setNoteImages(t.noteImages || [])
    setReceiptSource(null)
    setOpen(true)
  }
  const applyReceiptAmount = (source: ReceiptSource, targetWalletId: string) => {
    const wallet = data.wallets.find((w) => w.id === targetWalletId)
    if (!wallet || !source.currency) {
      setAmount(String(source.amount))
      return
    }
    const converted = convert(source.amount, source.currency, wallet.currency)
    setAmount(wallet.currency === 'LBP' ? String(Math.round(converted)) : converted.toFixed(2))
  }
  useEffect(() => {
    if (receiptSource) applyReceiptAmount(receiptSource, walletId)
  }, [walletId, data.usdToLbpRate])
  const handleReceipt = (result: {
    amount: number
    currency?: Currency
    merchant?: string
    rawText: string
  }) => {
    setType('expense')
    const source = { amount: result.amount, currency: result.currency }
    setReceiptSource(source)
    applyReceiptAmount(source, walletId)
    setTitle('')
    const merchant = (result.merchant || '').trim()
    if (merchant) {
      const normalized = merchant.toLowerCase()
      const learned = data.transactions
        .filter((t) => t.type === 'expense' && t.category)
        .find((t) => {
          const hay = (t.title + ' ' + (t.note || '')).toLowerCase()
          return hay.includes(normalized) || normalized.includes(t.title.toLowerCase())
        })
      if (learned) setCategory(learned.category)
    }
    setNote(
      merchant
        ? `Receipt · ${merchant}${result.currency ? ` · ${result.currency}` : ''}`
        : result.currency
          ? `Receipt scanned in ${result.currency}`
          : 'Added from scanned receipt',
    )
  }
  const transferRate = () => {
    const from = data.wallets.find((w) => w.id === walletId)
    const to = data.wallets.find((w) => w.id === toWalletId)
    if (!from || !to) return 1
    return pairRate(from.currency, to.currency)
  }
  const addCategory = (raw?: string) => {
    const name = raw?.trim()
    if (!name) return
    const existing = data.categories.find((c) => c.toLowerCase() === name.toLowerCase())
    if (existing) {
      setCategory(existing)
      return
    }
    setData((d) => ({ ...d, categories: [...d.categories, name] }))
    setCategory(name)
  }
  const editCategory = (oldValue: string, newValue: string) => {
    const oldName = oldValue.trim()
    const nextName = newValue.trim()
    if (!oldName || !nextName || oldName === nextName) return
    const isParent = !oldName.includes(' > ')
    const rename = (value: string) =>
      value === oldName
        ? nextName
        : isParent && value.startsWith(oldName + ' > ')
          ? nextName + value.slice(oldName.length)
          : value
    setData((d) => ({
      ...d,
      categories: d.categories
        .map(rename)
        .filter((c, i, a) => a.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i),
      transactions: d.transactions.map((t) => {
        const changed = rename(t.category)
        return changed !== t.category
          ? { ...t, category: changed, updatedAt: new Date().toISOString() }
          : t
      }),
      bills: d.bills.map((b) => {
        const changed = rename(b.category)
        return changed !== b.category
          ? { ...b, category: changed, updatedAt: new Date().toISOString() }
          : b
      }),
    }))
    setCategory((c) => rename(c))
  }
  const deleteCategory = (value: string) => {
    const target = value.trim()
    if (!target) return
    const isParent = !target.includes(' > ')
    const matches = (item: string) =>
      item === target || (isParent && item.startsWith(target + ' > '))
    const remaining = data.categories.filter((c) => !matches(c))
    setData((d) => ({ ...d, categories: d.categories.filter((c) => !matches(c)) }))
    setCategory((current) => (matches(current) ? remaining[0] || 'Other' : current))
  }
  const submit = async () => {
    const n = Number(amount)
    if (!n || n <= 0) return
    if (!walletId) {
      setDialog({
        title: 'Create a wallet first',
        message: 'Add at least one wallet before saving a transaction.',
        kind: 'info',
      })
      return
    }
    if (type === 'transfer' && !toWalletId) {
      setDialog({
        title: 'Choose a destination wallet',
        message: 'Transfers need both a source wallet and a destination wallet.',
        kind: 'info',
      })
      return
    }
    if (type === 'transfer' && walletId === toWalletId) {
      setDialog({
        title: 'Choose a different account',
        message: 'The source and destination accounts must be different for a transfer.',
        kind: 'info',
      })
      return
    }
    const now = new Date().toISOString()
    const old = data.transactions.find((t) => t.id === editing)
    const displayTitle = title.trim() || (type === 'expense' ? category : 'Transaction')
    const tx: Transaction = {
      id: editing || uid(),
      type,
      title: displayTitle,
      category: type === 'transfer' ? 'Transfer' : category,
      amount: n,
      walletId,
      toWalletId: type === 'transfer' ? toWalletId : undefined,
      exchangeRate: type === 'transfer' ? transferRate() : undefined,
      date,
      note: note.trim() || undefined,
      noteImages: noteImages.length ? noteImages : undefined,
      createdAt: old?.createdAt || now,
      updatedAt: now,
    }
    const next = await localRepository.upsertTransaction(tx)
    setData(next)
    setOpen(false)
    resetForm()
  }
  const remove = (id: string) => {
    const tx = data.transactions.find((t) => t.id === id)
    setDialog({
      title: 'Delete transaction?',
      message: `${tx?.title || 'This transaction'} will be permanently removed from your activity and balances.`,
      kind: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const next = await localRepository.deleteTransaction(id)
        setData(next)
      },
    })
  }
  const addWallet = () =>
    setWalletForm({ name: '', currency: 'USD', openingBalance: '0', originalCurrency: 'USD' })
  const editWallet = (w: Wallet) =>
    setWalletForm({
      id: w.id,
      name: w.name,
      currency: w.currency,
      openingBalance: String(w.openingBalance),
      originalCurrency: w.currency,
    })
  const changeWalletCurrency = (next: Currency) => {
    if (!walletForm || walletForm.currency === next) return
    const current = walletForm.currency
    const opening = Number(walletForm.openingBalance)
    setWalletForm({
      ...walletForm,
      currency: next,
      openingBalance: Number.isNaN(opening)
        ? walletForm.openingBalance
        : String(normalize(convert(opening, current, next), next)),
    })
  }
  const saveWallet = async () => {
    if (!walletForm) return
    const name = walletForm.name.trim()
    const opening = Number(walletForm.openingBalance)
    if (!name || Number.isNaN(opening)) return
    if (walletForm.id) {
      const existing = data.wallets.find((w) => w.id === walletForm.id)
      if (!existing) return
      const newCurrency = walletForm.currency
      const oldCurrency = existing.currency
      const now = new Date().toISOString()
      const currencyFor = (id?: string) => {
        if (!id) return undefined
        if (id === existing.id) return newCurrency
        return data.wallets.find((w) => w.id === id)?.currency
      }
      const transactions = data.transactions
        .filter((t) => t.walletId === existing.id || t.toWalletId === existing.id)
        .map((t) => {
          if (t.type !== 'transfer') {
            return {
              ...t,
              amount: normalize(convert(t.amount, oldCurrency, newCurrency), newCurrency),
              updatedAt: now,
            }
          }
          const sourceBefore =
            t.walletId === existing.id ? oldCurrency : currencyFor(t.walletId) || oldCurrency
          const sourceAfter = t.walletId === existing.id ? newCurrency : sourceBefore
          const destinationAfter =
            t.toWalletId === existing.id ? newCurrency : currencyFor(t.toWalletId) || sourceAfter
          const convertedAmount =
            t.walletId === existing.id
              ? normalize(convert(t.amount, oldCurrency, newCurrency), newCurrency)
              : t.amount
          return {
            ...t,
            amount: convertedAmount,
            exchangeRate: pairRate(sourceAfter, destinationAfter),
            updatedAt: now,
          }
        })
      const wallet: Wallet = {
        ...existing,
        name,
        currency: newCurrency,
        openingBalance: opening,
        updatedAt: now,
      }
      const next = await localRepository.upsertWalletAndTransactions(wallet, transactions)
      setData(next)
    } else {
      const id = uid()
      const wallet: Wallet = { id, name, currency: walletForm.currency, openingBalance: opening }
      const next = await localRepository.upsertWallet(wallet)
      setData(next)
      if (!walletId) setWalletId(id)
    }
    setWalletForm(null)
  }
  const deleteWallet = (id: string) => {
    const wallet = data.wallets.find((w) => w.id === id)
    if (!wallet) return
    const transactionCount = data.transactions.filter(
      (t) => t.walletId === id || t.toWalletId === id,
    ).length
    const billCount = data.bills.filter((b) => b.walletId === id).length
    const detail = [
      transactionCount ? `${transactionCount} transaction${transactionCount === 1 ? '' : 's'}` : '',
      billCount ? `${billCount} bill${billCount === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(' and ')
    setDialog({
      title: 'Delete account?',
      message: `${wallet.name} will be permanently deleted${detail ? ` together with ${detail}` : ''}.`,
      kind: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const next = await localRepository.deleteWallet(id)
        if (localStorage.getItem('spenza-default-wallet-id') === id)
          localStorage.removeItem('spenza-default-wallet-id')
        setData(next)
      },
    })
  }
  const resetAll = () =>
    setDialog({
      title: 'Reset Spenza?',
      message:
        'All local wallets and transactions will be permanently cleared. This cannot be undone.',
      kind: 'danger',
      confirmLabel: 'Reset data',
      onConfirm: () => {
        setData(defaultData)
        setRateInput(String(defaultData.usdToLbpRate || 89500))
      },
    })
  const confirmDialog = async () => {
    const action = dialog?.onConfirm
    if (!action || dialogBusy) return
    setDialogBusy(true)
    try {
      await action()
      setDialog((current) => (current?.onConfirm === action ? null : current))
    } finally {
      setDialogBusy(false)
    }
  }
  const commitRate = () => {
    const n = Number(rateInput)
    if (n > 0) {
      localStorage.setItem('spenza-usd-to-lbp-rate', String(n))
      setData((d) => ({ ...d, usdToLbpRate: n }))
      setRateInput(String(n))
    } else setRateInput(String(rate))
  }
  const openWalletActivity = (id: string) => {
    setHomeWalletId(id)
    setHomeRecentLimit(12)
    setTab('Home')
  }
  const openAllActivity = () => {
    setTab('Home')
  }
  const inInsightPeriod = (txDate: string) => {
    if (insightPeriod === 'daily') return txDate === insightDate
    if (insightPeriod === 'monthly') return txDate.slice(0, 7) === insightDate.slice(0, 7)
    return txDate.slice(0, 4) === insightDate.slice(0, 4)
  }
  const inActivityPeriod = (txDate: string) =>
    activityPeriod === 'daily' || activityPeriod === 'custom' ? txDate === activityDate : true
  const TxRow = ({ t, recent = false }: { t: Transaction; recent?: boolean }) => {
    const w = data.wallets.find((x) => x.id === t.walletId)
    const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '−'
    const photos = t.noteImages?.length || 0
    const description =
      t.title && t.title !== t.category && t.title !== 'Transaction' ? t.title : ''
    return (
      <div className={`tx ${t.type}`}>
        <div className={`txIcon ${t.type}`}>
          {t.type === 'income' ? (
            <ArrowDownLeft />
          ) : t.type === 'transfer' ? (
            <ArrowLeftRight />
          ) : (
            <ArrowUpRight />
          )}
        </div>
        <div className="txMain">
          <b>{recent ? t.category : t.title}</b>
          <span>
            {recent ? (
              `${w?.name || 'No wallet'}${description ? ` - ${description}` : ''}`
            ) : (
              <>
                {t.note ? `${t.note} · ` : ''}
                {w?.name || 'No wallet'}
                {photos ? ` · 📷 ${photos}` : ''}
              </>
            )}
          </span>
        </div>
        <div className="txAmount">
          <strong className={t.type === 'income' ? 'positive' : ''}>
            {sign}
            {money(t.amount, w?.currency || 'USD')}
          </strong>
          <small>{t.date}</small>
        </div>
        <div className="txActions">
          <button onClick={() => edit(t)}>
            <Pencil />
          </button>
          <button onClick={() => remove(t.id)}>
            <Trash2 />
          </button>
        </div>
      </div>
    )
  }
  const selectedWallet = data.wallets.find((w) => w.id === walletId)
  const activityWallet = activityWalletId
    ? data.wallets.find((w) => w.id === activityWalletId)
    : undefined
  const newestTransactionFirst = (a: Transaction, b: Transaction) =>
    b.date.localeCompare(a.date) ||
    String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''))
  const activitySearchNormalized = activitySearch.trim().toLowerCase()
  const activityTransactions = (
    activityWalletId
      ? data.transactions.filter(
          (t) => t.walletId === activityWalletId || t.toWalletId === activityWalletId,
        )
      : data.transactions
  )
    .filter((t) => {
      const wallet = data.wallets.find((w) => w.id === t.walletId)
      const toWallet = data.wallets.find((w) => w.id === t.toWalletId)
      const matchesSearch =
        !activitySearchNormalized ||
        [t.title, t.category, t.note, wallet?.name, toWallet?.name, String(t.amount)].some((v) =>
          String(v || '')
            .toLowerCase()
            .includes(activitySearchNormalized),
        )
      const matchesAccount =
        activityAccountFilter === 'all' ||
        t.walletId === activityAccountFilter ||
        t.toWalletId === activityAccountFilter
      const matchesCategory =
        activityCategoryFilter === 'all' || t.category === activityCategoryFilter
      return (
        (activityTypeFilter === 'all' || t.type === activityTypeFilter) &&
        inActivityPeriod(t.date) &&
        matchesAccount &&
        matchesCategory &&
        matchesSearch
      )
    })
    .slice()
    .sort(newestTransactionFirst)
  const activityDisplayCurrency: Currency =
    (activityAccountFilter !== 'all'
      ? data.wallets.find((w) => w.id === activityAccountFilter)
      : activityWallet
    )?.currency || 'USD'
  const activityAmountInDisplayCurrency = (t: Transaction) => {
    const source =
      data.wallets.find((w) => w.id === t.walletId)?.currency || activityDisplayCurrency
    return convert(t.amount, source, activityDisplayCurrency)
  }
  const activityIncome = activityTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + activityAmountInDisplayCurrency(t), 0)
  const activityExpense = activityTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + activityAmountInDisplayCurrency(t), 0)
  const activityNet = activityIncome - activityExpense
  const insightWallet = data.wallets.find((w) => w.id === insightWalletId)
  const insightTransactions = data.transactions.filter(
    (t) =>
      t.walletId === insightWalletId &&
      inInsightPeriod(t.date) &&
      (insightCategory === 'all' || t.category === insightCategory),
  )
  const insightExpenses = insightTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  const insightIncome = insightTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const insightTransfers = insightTransactions
    .filter((t) => t.type === 'transfer')
    .reduce((sum, t) => sum + t.amount, 0)
  const insightPeriodLabel =
    insightPeriod === 'daily'
      ? insightDate
      : insightPeriod === 'monthly'
        ? new Date(`${insightDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })
        : insightDate.slice(0, 4)
  const conversionLabel =
    receiptSource?.currency && selectedWallet && receiptSource.currency !== selectedWallet.currency
      ? `${money(receiptSource.amount, receiptSource.currency)} → ${money(Number(amount) || 0, selectedWallet.currency)} at 1 USD = ${rate.toLocaleString()} LBP`
      : null
  const inHomePeriod = (txDate: string) => {
    if (homePeriod === 'custom') return txDate === homeDate
    if (homePeriod === 'daily') return txDate.slice(0, 7) === homeDate.slice(0, 7)
    return txDate.slice(0, 4) === homeDate.slice(0, 4)
  }
  const shiftHomePeriod = (direction: number) => {
    const d = new Date(`${homeDate}T12:00:00`)
    if (homePeriod === 'custom') d.setDate(d.getDate() + direction)
    else if (homePeriod === 'daily') d.setMonth(d.getMonth() + direction)
    else d.setFullYear(d.getFullYear() + direction)
    setHomeDate(d.toISOString().slice(0, 10))
  }
  const homePeriodLabel =
    homePeriod === 'custom'
      ? new Date(`${homeDate}T12:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : homePeriod === 'daily'
        ? new Date(`${homeDate.slice(0, 7)}-01T12:00:00`).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })
        : homeDate.slice(0, 4)
  const homeWallet =
    data.wallets.find((w) => w.id === homeWalletId) ||
    data.wallets.find((w) => w.id === defaultWalletId) ||
    data.wallets[0]
  const homeCalendarDates = new Set(
    homeWallet
      ? data.transactions
          .filter((t) => t.walletId === homeWallet.id || t.toWalletId === homeWallet.id)
          .map((t) => t.date)
      : [],
  )
  const activityCalendarDates = new Set(
    (activityWalletId
      ? data.transactions.filter(
          (t) => t.walletId === activityWalletId || t.toWalletId === activityWalletId,
        )
      : data.transactions
    )
      .filter((t) => activityTypeFilter === 'all' || t.type === activityTypeFilter)
      .map((t) => t.date),
  )
  const homePeriodTx = homeWallet
    ? data.transactions
        .filter(
          (t) =>
            (t.walletId === homeWallet.id || t.toWalletId === homeWallet.id) &&
            inHomePeriod(t.date),
        )
        .slice()
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            String(b.createdAt || b.updatedAt || '').localeCompare(
              String(a.createdAt || a.updatedAt || ''),
            ),
        )
    : []
  const homeIncome = homePeriodTx
    .filter((t) => t.type === 'income' && t.walletId === homeWallet?.id)
    .reduce((s, t) => s + t.amount, 0)
  const homeExpense = homePeriodTx
    .filter((t) => t.type === 'expense' && t.walletId === homeWallet?.id)
    .reduce((s, t) => s + t.amount, 0)
  const homeTransferOut = homePeriodTx
    .filter((t) => t.type === 'transfer' && t.walletId === homeWallet?.id)
    .reduce((s, t) => s + t.amount, 0)
  const homeTransferIn = homePeriodTx
    .filter((t) => t.type === 'transfer' && t.toWalletId === homeWallet?.id)
    .reduce((s, t) => s + (t.exchangeRate ? t.amount * t.exchangeRate : t.amount), 0)
  const homeNet = homeIncome - homeExpense - homeTransferOut + homeTransferIn
  const homeAvailableIncome = homeWallet
    ? data.transactions
        .filter((t) => t.type === 'income' && t.walletId === homeWallet.id)
        .reduce((s, t) => s + t.amount, 0)
    : 0
  const homeAvailableExpense = homeWallet
    ? data.transactions
        .filter((t) => t.type === 'expense' && t.walletId === homeWallet.id)
        .reduce((s, t) => s + t.amount, 0)
    : 0
  const homeAvailable = homeAvailableIncome - homeAvailableExpense
  const categoryTotals = data.categories
    .map((c) => ({
      name: c,
      value: homePeriodTx
        .filter((t) => t.type === 'expense' && t.walletId === homeWallet?.id && t.category === c)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
  const categoryTotal = categoryTotals.reduce((s, x) => s + x.value, 0)
  let running = 0
  const gradientParts = categoryTotals.slice(0, 5).map((x, i) => {
    const start = categoryTotal ? (running / categoryTotal) * 100 : 0
    running += x.value
    const end = categoryTotal ? (running / categoryTotal) * 100 : 0
    return `${palette[i % palette.length]} ${start}% ${end}%`
  })
  const donutBackground = gradientParts.length
    ? `conic-gradient(${gradientParts.join(',')})`
    : 'conic-gradient(var(--surface3) 0 100%)'
  const activityGroups = activityTransactions.reduce<Record<string, Transaction[]>>((acc, t) => {
    ;(acc[t.date] ??= []).push(t)
    return acc
  }, {})
  const activityMonthGroups = activityTransactions.reduce<Record<string, Transaction[]>>(
    (acc, t) => {
      const key = t.date.slice(0, 7)
      ;(acc[key] ??= []).push(t)
      return acc
    },
    {},
  )
  const activityYearGroups = activityTransactions.reduce<
    Record<string, Record<string, Transaction[]>>
  >((years, t) => {
    const year = t.date.slice(0, 4)
    const month = t.date.slice(0, 7)
    ;((years[year] ??= {})[month] ??= []).push(t)
    return years
  }, {})
  const toggleActivityGroup = (key: string) =>
    setCollapsedActivityGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const monthLabel = (key: string) =>
    new Date(`${key}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const renderActivityRows = (items: Transaction[]) =>
    items
      .slice()
      .sort(newestTransactionFirst)
      .map((t) => <TxRow t={t} key={t.id} />)
  const renderMonthlyGroups = () =>
    Object.entries(activityMonthGroups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, items]) => {
        const key = `month:${month}`
        const open = !collapsedActivityGroups.has(key)
        return (
          <section className="activityPeriodGroup monthGroup" key={month}>
            <button
              className="activityGroupHeader"
              onClick={() => toggleActivityGroup(key)}
              aria-expanded={open}
            >
              <span>
                <b>{monthLabel(month)}</b>
                <small>
                  {items.length} transaction{items.length === 1 ? '' : 's'}
                </small>
              </span>
              <ChevronRight className={open ? 'expanded' : ''} />
            </button>
            <div className={`activityGroupBody ${open ? 'expanded' : ''}`}>
              <div>{renderActivityRows(items)}</div>
            </div>
          </section>
        )
      })
  const renderYearlyGroups = () =>
    Object.entries(activityYearGroups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, months]) => {
        const yearKey = `year:${year}`
        const yearOpen = !collapsedActivityGroups.has(yearKey)
        return (
          <section className="activityPeriodGroup yearGroup" key={year}>
            <button
              className="activityGroupHeader yearHeader"
              onClick={() => toggleActivityGroup(yearKey)}
              aria-expanded={yearOpen}
            >
              <span>
                <b>{year}</b>
                <small>
                  {Object.values(months).reduce((sum, items) => sum + items.length, 0)} transactions
                </small>
              </span>
              <ChevronRight className={yearOpen ? 'expanded' : ''} />
            </button>
            <div className={`activityGroupBody ${yearOpen ? 'expanded' : ''}`}>
              <div>
                {Object.entries(months)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([month, items]) => {
                    const monthKey = `year-month:${month}`
                    const monthOpen = !collapsedActivityGroups.has(monthKey)
                    return (
                      <section className="nestedMonthGroup" key={month}>
                        <button
                          className="activityGroupHeader monthHeader"
                          onClick={() => toggleActivityGroup(monthKey)}
                          aria-expanded={monthOpen}
                        >
                          <span>
                            <b>
                              {new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', {
                                month: 'long',
                              })}
                            </b>
                            <small>
                              {items.length} transaction{items.length === 1 ? '' : 's'}
                            </small>
                          </span>
                          <ChevronRight className={monthOpen ? 'expanded' : ''} />
                        </button>
                        <div className={`activityGroupBody ${monthOpen ? 'expanded' : ''}`}>
                          <div>{renderActivityRows(items)}</div>
                        </div>
                      </section>
                    )
                  })}
              </div>
            </div>
          </section>
        )
      })
  if (!ready)
    return (
      <div className="shell">
        <main className="phone reference-layout">
          <div className="empty">Loading Spenza…</div>
        </main>
      </div>
    )
  return (
    <div className="shell">
      <main className="phone reference-layout">
        {tab === 'Home' && (
          <section className="homeScreen">
            <header className="refHeader">
              <div>
                <span className="eyebrow">SPENZA</span>
                <h1>Good Morning! 👋</h1>
              </div>
              <NotificationBell data={data} onClick={() => setNotificationsOpen(true)} />
            </header>
            {data.wallets.length ? (
              <div className="insightSelectors homeAccountSelector compactHomeAccount">
                <label>
                  Account
                  <select
                    value={homeWallet?.id || ''}
                    onChange={(e) => {
                      setHomeWalletId(e.target.value)
                      setHomeRecentLimit(12)
                    }}
                  >
                    {data.wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.currency})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="homeAccountsIcon"
                  aria-label="Open accounts"
                  title="Accounts"
                  onClick={() => setTab('Wallets')}
                >
                  <WalletCards />
                </button>
                <div className="filters refFilters periodFilters homePeriodFilters">
                  <button
                    className={homePeriod === 'daily' ? 'selected' : ''}
                    onClick={() => {
                      setHomePeriod('daily')
                      setHomeRecentLimit(12)
                    }}
                  >
                    <CalendarDays size={15} />
                    <span>Daily</span>
                  </button>
                  <button
                    className={homePeriod === 'monthly' ? 'selected' : ''}
                    onClick={() => {
                      setHomePeriod('monthly')
                      setHomeRecentLimit(12)
                    }}
                  >
                    <CalendarRange size={15} />
                    <span>Monthly</span>
                  </button>
                  <button
                    className={`calendarFilterButton ${homePeriod === 'custom' ? 'selected' : ''}`}
                    onClick={() => setHomeCalendarOpen(true)}
                  >
                    <CalendarClock size={15} />
                    <span>Calendar</span>
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="homeEmptyWalletCta" onClick={addWallet}>
                <span className="homeEmptyWalletIcon">
                  <Plus size={22} />
                </span>
                <span>
                  <b>Add your first wallet</b>
                  <small>Create an account to start tracking income and expenses.</small>
                </span>
              </button>
            )}
            <section className="monthCard">
              <button onClick={() => shiftHomePeriod(-1)} aria-label="Previous period">
                <ChevronLeft />
              </button>
              <div>
                <b>{homePeriodLabel}</b>
                <span>
                  {homeWallet
                    ? `${homeWallet.name} · ${homePeriod === 'custom' ? 'calendar' : homePeriod} net`
                    : `${homePeriod} overview`}
                </span>
                <strong>{homeWallet ? money(homeNet, homeWallet.currency) : '—'}</strong>
              </div>
              <button onClick={() => shiftHomePeriod(1)} aria-label="Next period">
                <ChevronRight />
              </button>
            </section>
            <HomeSmartInsight
              wallet={homeWallet}
              transactions={data.transactions}
              date={homeDate}
            />
            <div className="activitySummary homeCashflowSummary">
              <article>
                <span>Income</span>
                <strong style={{ color: '#4aa8ff' }}>
                  {homeWallet ? money(homeIncome, homeWallet.currency) : '—'}
                </strong>
              </article>
              <article>
                <span>Exp.</span>
                <strong style={{ color: '#ff5f68' }}>
                  {homeWallet ? money(homeExpense, homeWallet.currency) : '—'}
                </strong>
              </article>
              <article>
                <span>Total</span>
                <strong>
                  {homeWallet ? money(homeIncome - homeExpense, homeWallet.currency) : '—'}
                </strong>
              </article>
            </div>
            <section className="activity homeActivity">
              <div className="refSectionHead">
                <h2>Recent Transactions</h2>
              </div>
              {homePeriodTx.length ? (
                <>
                  {homePeriod === 'daily'
                    ? Object.entries(
                        homePeriodTx.slice(0, homeRecentLimit).reduce(
                          (groups, tx) => {
                            ;(groups[tx.date] ??= []).push(tx)
                            return groups
                          },
                          {} as Record<string, Transaction[]>,
                        ),
                      )
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([day, items]) => (
                          <section className="homeDayGroup" key={day}>
                            <div className="homeDayHeader">
                              {new Date(day + 'T12:00:00').toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                            {items.map((t) => (
                              <TxRow t={t} recent key={t.id} />
                            ))}
                          </section>
                        ))
                    : homePeriodTx
                        .slice(0, homeRecentLimit)
                        .map((t) => <TxRow t={t} recent key={t.id} />)}
                </>
              ) : (
                <div className="empty compact">No transactions for this account and period.</div>
              )}
            </section>
          </section>
        )}
        {tab === 'Wallets' && (
          <section className="page refPage">
            <div className="centerPageHead withAction">
              <h1>Accounts</h1>
              <button className="iconAdd" onClick={addWallet}>
                <Plus />
              </button>
            </div>
            {data.wallets.length ? (
              <div className="walletGrid refWalletGrid">
                {data.wallets.map((w, i) => (
                  <article className={`accountTone${i % 4}`} key={w.id}>
                    <div className="walletCardTop">
                      <span>{w.currency}</span>
                      <div className="walletActions">
                        <button
                          className="walletEdit"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            editWallet(w)
                          }}
                        >
                          <Pencil />
                        </button>
                        <button
                          className="walletDelete"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteWallet(w.id)
                          }}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                    <h2 onClick={() => openWalletActivity(w.id)}>
                      {w.name}
                      {defaultWalletId === w.id && <em className="defaultWalletBadge">Default</em>}
                    </h2>
                    <strong onClick={() => openWalletActivity(w.id)}>
                      {money(walletBalance(w.id), w.currency)}
                    </strong>
                    <small>Opening {money(w.openingBalance, w.currency)}</small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">No accounts yet.</div>
            )}
          </section>
        )}
        {tab === 'Insights' && (
          <section className="page refPage">
            <div className="centerPageHead">
              <h1>Insights</h1>
            </div>
            {data.wallets.length ? (
              <>
                <div className="filters refFilters periodFilters">
                  {(['monthly', 'yearly'] as InsightPeriod[]).map((p) => (
                    <button
                      key={p}
                      className={
                        (p === 'monthly' && insightPeriod === 'monthly') ||
                        (p === 'yearly' && insightPeriod === 'yearly')
                          ? 'selected'
                          : ''
                      }
                      onClick={() => setInsightPeriod(p)}
                    >
                      {p === 'monthly' ? 'daily' : 'monthly'}
                    </button>
                  ))}
                  <button
                    className={`calendarFilterButton ${insightPeriod === 'daily' ? 'selected' : ''}`}
                    onClick={() => setInsightPeriod('daily')}
                  >
                    <span>Calendar</span>
                  </button>
                </div>
                <div className="insightNavigator">
                  <ChevronLeft />
                  <label>
                    <span>{insightPeriodLabel}</span>
                    <input
                      type="date"
                      value={insightDate}
                      onChange={(e) => setInsightDate(e.target.value)}
                    />
                  </label>
                  <ChevronRight />
                </div>
                <div className="insightSelectors">
                  <label>
                    Account
                    <select
                      value={insightWalletId}
                      onChange={(e) => setInsightWalletId(e.target.value)}
                    >
                      {data.wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.currency})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Category
                    <select
                      value={insightCategory}
                      onChange={(e) => setInsightCategory(e.target.value)}
                    >
                      <option value="all">All categories</option>
                      {data.categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <BudgetPlanner
                  wallet={insightWallet}
                  transactions={data.transactions}
                  categories={data.categories}
                  date={insightDate}
                />
                <SmartMoneyHub
                  wallet={insightWallet}
                  transactions={data.transactions}
                  date={insightDate}
                />
                {insightWallet && (
                  <>
                    <article className="categoryPanel">
                      <div className="refSectionHead compact">
                        <h2>Expenses by Category</h2>
                      </div>
                      {data.categories.map((c) => {
                        const value = data.transactions
                          .filter(
                            (t) =>
                              t.type === 'expense' &&
                              t.walletId === insightWallet.id &&
                              inInsightPeriod(t.date) &&
                              t.category === c &&
                              (insightCategory === 'all' || c === insightCategory),
                          )
                          .reduce((sum, t) => sum + t.amount, 0)
                        if (!value) return null
                        const pct = insightExpenses
                          ? Math.min(100, (value / insightExpenses) * 100)
                          : 0
                        return (
                          <div className="categoryRow" key={c}>
                            <span>{c}</span>
                            <div>
                              <i style={{ width: `${pct}%` }} />
                            </div>
                            <b>{money(value, insightWallet.currency)}</b>
                          </div>
                        )
                      })}
                      {!insightExpenses && (
                        <div className="empty compact">No expense data for this period.</div>
                      )}
                    </article>
                  </>
                )}
              </>
            ) : (
              <div className="empty">Create an account to see insights.</div>
            )}
          </section>
        )}
        {tab === 'Bills' && <BillsManager data={data} setData={setData} />}
        {tab === 'Settings' && (
          <section className="page refPage settingsPage">
            <div className="centerPageHead">
              <h1>Settings</h1>
            </div>
            <h3 className="settingsGroupTitle">Preferences</h3>
            <section className="settingsList">
              <div className="settingsRow">
                <div>
                  <span>Currency Rate</span>
                  <small>USD / LBP conversion</small>
                </div>
                <label className="inlineRate">
                  LBP{' '}
                  <input
                    type="number"
                    inputMode="decimal"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    onBlur={commitRate}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
                    }}
                    placeholder="89500"
                  />
                </label>
              </div>
              <div className="settingsRow defaultWalletSetting">
                <div>
                  <span>Default Account</span>
                  <small>Used automatically for new transactions and bills</small>
                </div>
                <select
                  className="defaultWalletSelect"
                  value={defaultWalletId}
                  onChange={(e) => setDefaultWalletId(e.target.value)}
                >
                  <option value="">None</option>
                  {data.wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency})
                    </option>
                  ))}
                </select>
              </div>
              <ThemeControl />
              <div className="settingsRow">
                <div>
                  <span>Data Storage</span>
                  <small>Stored locally on this device</small>
                </div>
                <b>Local Only</b>
              </div>
            </section>
            <h3 className="settingsGroupTitle">Cloud Sync</h3>
            <CloudSyncSettings data={data} setData={setData} />
            <h3 className="settingsGroupTitle">Family & Shared</h3>
            <FamilyManager />
            <PwaUpdateSettings />
            <h3 className="settingsGroupTitle">Security</h3>
            <section className="settingsList">
              <SecuritySettings data={data} setData={setData} />
            </section>
            <h3 className="settingsGroupTitle">Backup & Restore</h3>
            <BackupManager />
            <h3 className="settingsGroupTitle">Data</h3>
            <button className="danger settingsDanger" onClick={resetAll}>
              Reset local data
            </button>
          </section>
        )}
        {homeCalendarOpen && (
          <TransactionCalendar
            title={homeWallet ? `${homeWallet.name} transactions` : 'Transactions'}
            value={homeDate}
            markedDates={homeCalendarDates}
            onSelect={(d) => {
              setHomeDate(d)
              setHomePeriod('custom')
              setHomeCalendarOpen(false)
            }}
            onClose={() => setHomeCalendarOpen(false)}
          />
        )}
        {activityCalendarOpen && (
          <TransactionCalendar
            title={activityWallet ? `${activityWallet.name} transactions` : 'Transactions'}
            value={activityDate}
            markedDates={activityCalendarDates}
            onSelect={(d) => {
              setActivityDate(d)
              setActivityPeriod('custom')
              setActivityCalendarOpen(false)
            }}
            onClose={() => setActivityCalendarOpen(false)}
          />
        )}
        <nav>
          {[
            ['Home', Home],
            ['Bills', CalendarClock],
            ['Add', Plus],
            ['Insights', BarChart3],
            ['Settings', Settings],
          ].map(([label, Icon]: any) => (
            <button
              key={label}
              className={tab === label ? 'active' : label === 'Add' ? 'addNav' : ''}
              onClick={() => {
                if (label === 'Add') showAdd()
                else {
                  setTab(label)
                }
              }}
            >
              <Icon size={20} />
              <span>{label === 'Activity' ? 'Transactions' : label}</span>
            </button>
          ))}
        </nav>
        {open && (
          <div className="overlay" onClick={() => setOpen(false)}>
            <div className="sheet refSheet" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
              <div className="sheetTop">
                <div>
                  <span className="eyebrow">{editing ? 'EDIT' : 'ADD'}</span>
                  <h2>{editing ? 'Edit Transaction' : 'Add Transaction'}</h2>
                </div>
                <button className="close" onClick={() => setOpen(false)}>
                  <X />
                </button>
              </div>
              <div className="typeTabs refTypeTabs">
                {(['expense', 'income', 'transfer'] as TransactionType[]).map((v) => (
                  <button
                    className={type === v ? 'selected' : ''}
                    onClick={() => {
                      setType(v)
                      if (v !== 'expense') setReceiptSource(null)
                    }}
                    key={v}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {type === 'expense' && <ReceiptScanner onResult={handleReceipt} />}
              <label>
                Date
                <input
                  className="transactionDateInput"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    const sheet = e.currentTarget.closest('.sheet') as HTMLElement | null
                    const description = sheet?.querySelector(
                      '.transactionDescriptionInput',
                    ) as HTMLInputElement | null
                    if (description) {
                      description.disabled = true
                      description.blur()
                    }
                    e.currentTarget.blur()
                    sheet?.focus({ preventScroll: true })
                    requestAnimationFrame(() => sheet?.focus({ preventScroll: true }))
                    window.setTimeout(() => sheet?.focus({ preventScroll: true }), 80)
                    window.setTimeout(() => {
                      sheet?.focus({ preventScroll: true })
                      if (description?.isConnected) description.disabled = false
                    }, 320)
                  }}
                />
              </label>
              <label>
                Account
                <select
                  className="transactionAccountSelect"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                >
                  <option value="">Select Account</option>
                  {data.wallets.map((w) => (
                    <option value={w.id} key={w.id}>
                      {w.name} ({w.currency})
                    </option>
                  ))}
                </select>
              </label>
              {type === 'transfer' && (
                <label>
                  To Account
                  <select value={toWalletId} onChange={(e) => setToWalletId(e.target.value)}>
                    <option value="">Select Account</option>
                    {data.wallets
                      .filter((w) => w.id !== walletId)
                      .map((w) => (
                        <option value={w.id} key={w.id}>
                          {w.name} ({w.currency})
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Amount
                {selectedWallet && (
                  <small className="fieldHint">Saved in {selectedWallet.currency}</small>
                )}
                <input
                  className="amountInput"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  placeholder="$ 0.00"
                />
              </label>
              {conversionLabel && (
                <div className="conversionNotice">
                  <b>Converted receipt total</b>
                  <span>{conversionLabel}</span>
                </div>
              )}
              <TransactionCategoryPicker
                categories={data.categories}
                value={type === 'transfer' ? 'Transfer' : category}
                disabled={type === 'transfer'}
                onSelect={setCategory}
                onAddCategory={addCategory}
                onEditCategory={editCategory}
                onDeleteCategory={deleteCategory}
              />
              <div className="descriptionPhotoRow">
                <label>
                  Description <small className="fieldHint">Optional</small>
                  <input
                    className="transactionDescriptionInput"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="sentences"
                    spellCheck={false}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    enterKeyHint="done"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                        const sheet = e.currentTarget.closest('.sheet') as HTMLElement | null
                        sheet?.focus({ preventScroll: true })
                      }
                    }}
                  />
                </label>
                <NotePhotoPicker images={noteImages} onChange={setNoteImages} />
              </div>
              <label>
                Note <small className="fieldHint">Optional</small>
                <input
                  className="transactionNoteInput"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.currentTarget.blur()
                    }
                  }}
                />
              </label>
              <button className="primary" onClick={submit}>
                {editing ? 'Save Changes' : 'Save Transaction'}
              </button>
            </div>
          </div>
        )}
        {walletForm && (
          <div className="overlay" onClick={() => setWalletForm(null)}>
            <div className="sheet walletSheet refSheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheetTop">
                <div>
                  <span className="eyebrow">{walletForm.id ? 'EDIT' : 'NEW'} ACCOUNT</span>
                  <h2>{walletForm.id ? 'Edit Account' : 'Add Account'}</h2>
                </div>
                <button className="close" onClick={() => setWalletForm(null)}>
                  <X />
                </button>
              </div>
              <label>
                Account name
                <input
                  value={walletForm.name}
                  onChange={(e) => setWalletForm({ ...walletForm, name: e.target.value })}
                  placeholder="e.g. Main account"
                  autoFocus
                />
              </label>
              <label>
                Currency
                <select
                  value={walletForm.currency}
                  onChange={(e) => changeWalletCurrency(e.target.value as Currency)}
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="LBP">LBP — Lebanese Pound</option>
                </select>
              </label>
              <label>
                Opening balance
                <input
                  type="number"
                  inputMode="decimal"
                  value={walletForm.openingBalance}
                  onChange={(e) => setWalletForm({ ...walletForm, openingBalance: e.target.value })}
                />
              </label>
              {walletForm.id &&
                walletForm.originalCurrency &&
                walletForm.originalCurrency !== walletForm.currency && (
                  <div className="conversionNotice">
                    <b>Currency conversion</b>
                    <span>
                      Existing wallet history will be converted from {walletForm.originalCurrency}{' '}
                      to {walletForm.currency} using 1 USD = {rate.toLocaleString()} LBP.
                    </span>
                  </div>
                )}
              <button className="primary" onClick={saveWallet}>
                {walletForm.id ? 'Save Account' : 'Create Account'}
              </button>
            </div>
          </div>
        )}
        <NotificationCenter
          data={data}
          setData={setData}
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
        <AppLockGate data={data} />
        {dialog && (
          <div
            className="dialogOverlay"
            onClick={() => {
              if (!dialogBusy) setDialog(null)
            }}
          >
            <div className="dialogCard" onClick={(e) => e.stopPropagation()}>
              <div className={`dialogIcon ${dialog.kind === 'danger' ? 'dangerIcon' : 'infoIcon'}`}>
                {dialog.kind === 'danger' ? <AlertTriangle /> : <Check />}
              </div>
              <h2>{dialogBusy ? 'Deleting…' : dialog.title}</h2>
              <p>{dialog.message}</p>
              <div className="dialogActions">
                <button
                  className="dialogCancel"
                  disabled={dialogBusy}
                  onClick={() => setDialog(null)}
                >
                  {dialog.onConfirm ? 'Cancel' : 'Got it'}
                </button>
                {dialog.onConfirm && (
                  <button className="dialogConfirm" disabled={dialogBusy} onClick={confirmDialog}>
                    {dialogBusy ? 'Deleting…' : dialog.confirmLabel || 'Confirm'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

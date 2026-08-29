import { DataStore, IndexedDbDataStore, StoredEnvelope } from './storage'

export type Currency = 'USD' | 'LBP'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type BillRecurrence = 'once' | 'monthly' | 'yearly'
export type BillReminder = 0 | 1 | 3 | 7
export type SyncEntityType = 'wallet' | 'transaction' | 'bill'
export type SyncOperation = 'upsert' | 'delete'

export type SyncTombstone = {
  entityType: SyncEntityType
  entityId: string
  deletedAt: string
}

export type SyncChange = {
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  changedAt: string
}

export type SyncState = {
  tombstones: SyncTombstone[]
  pendingChanges: SyncChange[]
  lastSyncAt?: string
}

export type Wallet = {
  id: string
  name: string
  currency: Currency
  openingBalance: number
  createdAt?: string
  updatedAt?: string
}

export type Transaction = {
  id: string
  type: TransactionType
  title: string
  category: string
  amount: number
  walletId: string
  toWalletId?: string
  exchangeRate?: number
  date: string
  note?: string
  noteImages?: string[]
  createdAt: string
  updatedAt: string
}

export type Bill = {
  id: string
  name: string
  amount: number
  walletId: string
  category: string
  dueDate: string
  recurrence: BillRecurrence
  reminderDays: BillReminder
  note?: string
  lastPaidDate?: string
  createdAt: string
  updatedAt: string
}

export type AppSecuritySettings = {
  enabled: boolean
  pinHash?: string
  salt?: string
  timeoutMinutes: number
  biometricEnabled?: boolean
  biometricCredentialId?: string
}

export type SpenzaData = {
  wallets: Wallet[]
  transactions: Transaction[]
  bills: Bill[]
  categories: string[]
  usdToLbpRate: number
  security: AppSecuritySettings
  notificationReadIds: string[]
  notificationDismissedIds: string[]
  sync: SyncState
}

export const DATA_SCHEMA_VERSION = 4
export const defaultCategories = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Coffee',
  'Entertainment',
  'Health',
  'Education',
  'Travel',
  'Salary',
  'Other',
]
export const DEFAULT_USD_TO_LBP_RATE = 89500
const RATE_STORAGE_KEY = 'spenza-usd-to-lbp-rate'

export const defaultData: SpenzaData = {
  wallets: [],
  categories: defaultCategories,
  transactions: [],
  bills: [],
  usdToLbpRate: DEFAULT_USD_TO_LBP_RATE,
  security: { enabled: false, timeoutMinutes: 0, biometricEnabled: false },
  notificationReadIds: [],
  notificationDismissedIds: [],
  sync: { tombstones: [], pendingChanges: [] },
}

export const localDataStore: DataStore<SpenzaData> = new IndexedDbDataStore<SpenzaData>()

function readPersistedRate() {
  if (typeof localStorage === 'undefined') return undefined
  const value = Number(localStorage.getItem(RATE_STORAGE_KEY))
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function persistRate(value: number) {
  if (typeof localStorage === 'undefined' || !Number.isFinite(value) || value <= 0) return
  localStorage.setItem(RATE_STORAGE_KEY, String(value))
}

function isStoredEnvelope(value: unknown): value is StoredEnvelope<SpenzaData> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StoredEnvelope<SpenzaData>>
  return (
    typeof candidate.schemaVersion === 'number' &&
    !!candidate.data &&
    typeof candidate.data === 'object'
  )
}

function dateFallback(date?: string) {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T12:00:00.000Z`
  return new Date().toISOString()
}

function normalizeTombstones(value: unknown): SyncTombstone[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SyncTombstone => {
    if (!item || typeof item !== 'object') return false
    const tombstone = item as Partial<SyncTombstone>
    return (
      ['wallet', 'transaction', 'bill'].includes(String(tombstone.entityType)) &&
      typeof tombstone.entityId === 'string' &&
      !!tombstone.entityId &&
      typeof tombstone.deletedAt === 'string' &&
      !!tombstone.deletedAt
    )
  })
}

function normalizePendingChanges(value: unknown): SyncChange[] {
  if (!Array.isArray(value)) return []
  const newest = new Map<string, SyncChange>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const change = item as Partial<SyncChange>
    if (!['wallet', 'transaction', 'bill'].includes(String(change.entityType))) continue
    if (!['upsert', 'delete'].includes(String(change.operation))) continue
    if (
      typeof change.entityId !== 'string' ||
      !change.entityId ||
      typeof change.changedAt !== 'string' ||
      !change.changedAt
    )
      continue
    const normalized = change as SyncChange
    const key = `${normalized.entityType}:${normalized.entityId}`
    const current = newest.get(key)
    if (!current || normalized.changedAt >= current.changedAt) newest.set(key, normalized)
  }
  return [...newest.values()].sort((a, b) => a.changedAt.localeCompare(b.changedAt))
}

function normalizeData(stored?: Partial<SpenzaData>): SpenzaData {
  const now = new Date().toISOString()
  const wallets = (stored?.wallets ?? []).map((wallet) => {
    const createdAt = wallet.createdAt || wallet.updatedAt || now
    return { ...wallet, createdAt, updatedAt: wallet.updatedAt || createdAt }
  })
  const transactions = (stored?.transactions ?? []).map((transaction) => {
    const createdAt =
      transaction.createdAt || transaction.updatedAt || dateFallback(transaction.date)
    return { ...transaction, createdAt, updatedAt: transaction.updatedAt || createdAt }
  })
  const bills = (stored?.bills ?? []).map((bill) => {
    const createdAt = bill.createdAt || bill.updatedAt || dateFallback(bill.dueDate)
    return { ...bill, createdAt, updatedAt: bill.updatedAt || createdAt }
  })
  const savedCategories = stored?.categories ?? defaultCategories
  const usedTransactionCategories = transactions
    .map((transaction) => transaction.category?.trim())
    .filter((category): category is string => !!category)
  const categories = [
    ...new Map(
      [...savedCategories, ...usedTransactionCategories].map((category) => [
        category.toLowerCase(),
        category,
      ]),
    ).values(),
  ]
  const persistedRate = readPersistedRate()

  return {
    wallets,
    categories,
    transactions,
    bills,
    usdToLbpRate: persistedRate ?? stored?.usdToLbpRate ?? DEFAULT_USD_TO_LBP_RATE,
    security: {
      enabled: stored?.security?.enabled ?? false,
      pinHash: stored?.security?.pinHash,
      salt: stored?.security?.salt,
      timeoutMinutes: stored?.security?.timeoutMinutes ?? 0,
      biometricEnabled: stored?.security?.biometricEnabled ?? false,
      biometricCredentialId: stored?.security?.biometricCredentialId,
    },
    notificationReadIds: stored?.notificationReadIds ?? [],
    notificationDismissedIds: stored?.notificationDismissedIds ?? [],
    sync: {
      tombstones: normalizeTombstones(stored?.sync?.tombstones),
      pendingChanges: normalizePendingChanges(stored?.sync?.pendingChanges),
      lastSyncAt: typeof stored?.sync?.lastSyncAt === 'string' ? stored.sync.lastSyncAt : undefined,
    },
  }
}

function envelope(data: SpenzaData): StoredEnvelope<SpenzaData> {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    data: normalizeData(data),
  }
}

export async function loadData(): Promise<SpenzaData> {
  const stored = await localDataStore.load()
  if (!stored) return normalizeData(defaultData)

  if (isStoredEnvelope(stored)) {
    const data = normalizeData(stored.data)
    if (stored.schemaVersion !== DATA_SCHEMA_VERSION) await localDataStore.save(envelope(data))
    return data
  }

  const data = normalizeData(stored as Partial<SpenzaData>)
  await localDataStore.save(envelope(data))
  return data
}

export async function saveData(data: SpenzaData): Promise<void> {
  persistRate(data.usdToLbpRate)
  await localDataStore.save(envelope(data))
}

export function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

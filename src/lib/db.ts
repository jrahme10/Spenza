export type Currency = 'USD' | 'LBP'
export type TransactionType = 'expense' | 'income' | 'transfer'

export type Wallet = {
  id: string
  name: string
  currency: Currency
  openingBalance: number
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
  createdAt: string
  updatedAt: string
}

export type SpenzaData = {
  wallets: Wallet[]
  transactions: Transaction[]
  categories: string[]
  usdToLbpRate: number
}

const DB_NAME = 'spenza-db'
const STORE = 'app-data'
const KEY = 'spenza'

export const defaultCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Coffee', 'Entertainment', 'Health', 'Education', 'Travel', 'Salary', 'Other']
export const DEFAULT_USD_TO_LBP_RATE = 89500

export const defaultData: SpenzaData = {
  wallets: [],
  categories: defaultCategories,
  transactions: [],
  usdToLbpRate: DEFAULT_USD_TO_LBP_RATE,
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadData(): Promise<SpenzaData> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    req.onsuccess = () => {
      const stored = req.result as Partial<SpenzaData> | undefined
      resolve({
        wallets: stored?.wallets ?? [],
        categories: stored?.categories ?? defaultCategories,
        transactions: stored?.transactions ?? [],
        usdToLbpRate: stored?.usdToLbpRate ?? DEFAULT_USD_TO_LBP_RATE,
      })
    }
    req.onerror = () => reject(req.error)
  })
}

export async function saveData(data: SpenzaData): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(data, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export type TransactionType = 'expense' | 'income' | 'transfer'

export type Wallet = {
  id: string
  name: string
  currency: 'USD' | 'LBP'
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
}

const DB_NAME = 'spenza-db'
const STORE = 'app-data'
const KEY = 'spenza'

export const defaultCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Coffee', 'Entertainment', 'Health', 'Education', 'Travel', 'Salary', 'Other']

// A new install and a reset both start with zero financial data.
// Categories remain available because they are app configuration, not user transactions/balances.
export const defaultData: SpenzaData = {
  wallets: [],
  categories: defaultCategories,
  transactions: [],
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
    req.onsuccess = () => resolve(req.result ?? defaultData)
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

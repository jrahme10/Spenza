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

export const defaultData: SpenzaData = {
  wallets: [
    { id: 'wallet-usd', name: 'Cash USD', currency: 'USD', openingBalance: 2850 },
    { id: 'wallet-lbp', name: 'Cash LBP', currency: 'LBP', openingBalance: 176365000 },
  ],
  categories: ['Food', 'Transport', 'Shopping', 'Bills', 'Coffee', 'Entertainment', 'Health', 'Education', 'Travel', 'Salary', 'Other'],
  transactions: [
    { id: 'seed-1', type: 'expense', title: 'Roadster Diner', category: 'Food', amount: 38, walletId: 'wallet-usd', date: new Date().toISOString().slice(0,10), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'seed-2', type: 'expense', title: 'Coffee Factory', category: 'Coffee', amount: 4.5, walletId: 'wallet-usd', date: new Date().toISOString().slice(0,10), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
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

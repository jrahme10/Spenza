export type StoredEnvelope<T> = {
  schemaVersion: number
  savedAt: string
  data: T
}

export interface DataStore<T> {
  load(): Promise<StoredEnvelope<T> | T | undefined>
  save(value: StoredEnvelope<T>): Promise<void>
}

const DB_NAME = 'spenza-db'
const STORE = 'app-data'
const KEY = 'spenza'

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

export class IndexedDbDataStore<T> implements DataStore<T> {
  async load(): Promise<StoredEnvelope<T> | T | undefined> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result as StoredEnvelope<T> | T | undefined)
      req.onerror = () => reject(req.error)
    })
  }

  async save(value: StoredEnvelope<T>): Promise<void> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }
}

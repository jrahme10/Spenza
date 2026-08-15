import { ChangeEvent, useRef, useState } from 'react'
import { Download, Upload, X } from 'lucide-react'
import { loadData, saveData, SpenzaData } from '../lib/db'

type BackupFile = {
  app: 'Spenza'
  version: 1
  exportedAt: string
  data: SpenzaData
}

function isValidBackup(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false
  const backup = value as Partial<BackupFile>
  const data = backup.data as Partial<SpenzaData> | undefined
  return backup.app === 'Spenza' && backup.version === 1 && !!data && Array.isArray(data.wallets) && Array.isArray(data.transactions) && Array.isArray(data.categories)
}

export default function BackupManager() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  const exportBackup = async () => {
    try {
      const data = await loadData()
      const backup: BackupFile = { app: 'Spenza', version: 1, exportedAt: new Date().toISOString(), data }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `spenza-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setMessage('Backup exported successfully.')
    } catch {
      setMessage('Could not export the backup.')
    }
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      if (!isValidBackup(parsed)) {
        setMessage('This is not a valid Spenza backup file.')
        return
      }
      const walletIds = new Set(parsed.data.wallets.map(w => w.id))
      const invalidTransaction = parsed.data.transactions.some(t => !t.id || !t.type || !t.walletId || !walletIds.has(t.walletId))
      if (invalidTransaction) {
        setMessage('The backup contains invalid transaction or wallet references.')
        return
      }
      const ok = window.confirm(`Import this Spenza backup?\n\n${parsed.data.wallets.length} wallets\n${parsed.data.transactions.length} transactions\n\nThis will replace the data currently stored on this device.`)
      if (!ok) return
      await saveData(parsed.data)
      setMessage('Backup imported. Reloading Spenza…')
      setTimeout(() => window.location.reload(), 500)
    } catch {
      setMessage('Could not read this backup file.')
    }
  }

  return <>
    <button className="backup-fab" onClick={() => setOpen(true)} aria-label="Import or export Spenza data">Backup</button>
    {open && <div className="backup-overlay" onClick={() => setOpen(false)}>
      <section className="backup-card" onClick={e => e.stopPropagation()}>
        <div className="backup-head"><div><span>LOCAL DATA</span><h2>Backup & restore</h2></div><button onClick={() => setOpen(false)} aria-label="Close"><X size={18}/></button></div>
        <p>Move your Spenza data between devices or keep a safe copy. Backups include wallets, transactions, categories, notes and attached photos.</p>
        <button className="backup-action" onClick={exportBackup}><Download size={18}/><div><b>Export backup</b><small>Download a Spenza JSON file</small></div></button>
        <button className="backup-action" onClick={() => inputRef.current?.click()}><Upload size={18}/><div><b>Import backup</b><small>Restore a Spenza JSON file</small></div></button>
        <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={importBackup}/>
        {message && <div className="backup-message">{message}</div>}
      </section>
    </div>}
  </>
}

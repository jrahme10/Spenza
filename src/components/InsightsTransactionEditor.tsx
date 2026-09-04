import { useEffect, useState } from 'react'
import NotePhotoPicker from './NotePhotoPicker'
import { loadData, SpenzaData, Transaction, TransactionType } from '../lib/db'
import { localRepository } from '../lib/repository'

type EditEvent = CustomEvent<{ id?: string }>

function pairRate(
  from: SpenzaData['wallets'][number] | undefined,
  to: SpenzaData['wallets'][number] | undefined,
  usdToLbpRate: number,
) {
  if (!from || !to || from.currency === to.currency) return 1
  return from.currency === 'USD' ? usdToLbpRate : 1 / usdToLbpRate
}

export default function InsightsTransactionEditor() {
  const [data, setData] = useState<SpenzaData | null>(null)
  const [original, setOriginal] = useState<Transaction | null>(null)
  const [type, setType] = useState<TransactionType>('expense')
  const [date, setDate] = useState('')
  const [walletId, setWalletId] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Other')
  const [description, setDescription] = useState('')
  const [note, setNote] = useState('')
  const [noteImages, setNoteImages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const open = async (event: Event) => {
      const id = (event as EditEvent).detail?.id
      if (!id) return
      const snapshot = await loadData().catch(() => null)
      const transaction = snapshot?.transactions.find((item) => item.id === id)
      if (!snapshot || !transaction) return

      setData(snapshot)
      setOriginal(transaction)
      setType(transaction.type)
      setDate(transaction.date)
      setWalletId(transaction.walletId)
      setToWalletId(
        transaction.toWalletId || snapshot.wallets.find((wallet) => wallet.id !== transaction.walletId)?.id || '',
      )
      setAmount(String(transaction.amount))
      setCategory(transaction.category || snapshot.categories[0] || 'Other')
      setDescription(transaction.title === transaction.category ? '' : transaction.title)
      setNote(transaction.note || '')
      setNoteImages(transaction.noteImages || [])
      setError('')
      setSaving(false)
    }

    window.addEventListener('spenza:edit-transaction', open)
    return () => window.removeEventListener('spenza:edit-transaction', open)
  }, [])

  if (!data || !original) return null

  const close = () => {
    if (saving) return
    setOriginal(null)
    setData(null)
    setError('')
  }

  const save = async () => {
    const numericAmount = Number(amount)
    if (!walletId || !date || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid account, amount, and date.')
      return
    }
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) {
      setError('Choose a different destination account.')
      return
    }

    const sourceWallet = data.wallets.find((wallet) => wallet.id === walletId)
    const destinationWallet = data.wallets.find((wallet) => wallet.id === toWalletId)
    const nextCategory = type === 'transfer' ? 'Transfer' : category || 'Other'
    const nextTitle = description.trim() || (type === 'expense' ? nextCategory : 'Transaction')
    const updated: Transaction = {
      ...original,
      type,
      date,
      walletId,
      toWalletId: type === 'transfer' ? toWalletId : undefined,
      exchangeRate:
        type === 'transfer'
          ? pairRate(sourceWallet, destinationWallet, data.usdToLbpRate || 89500)
          : undefined,
      amount: numericAmount,
      category: nextCategory,
      title: nextTitle,
      note: note.trim() || undefined,
      noteImages,
      updatedAt: new Date().toISOString(),
    }

    setSaving(true)
    setError('')
    try {
      await localRepository.upsertTransaction(updated)
      window.location.reload()
    } catch {
      setSaving(false)
      setError('Could not save the transaction. Please try again.')
    }
  }

  return (
    <div
      className="overlay insightsEditOverlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="sheet refSheet insightsEditSheet" onPointerDown={(event) => event.stopPropagation()}>
        <div className="sheetTop">
          <div>
            <span className="eyebrow">EDIT</span>
            <h2>Edit Transaction</h2>
          </div>
          <button type="button" className="close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        <div className="typeTabs">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((value) => (
            <button
              type="button"
              className={type === value ? 'selected' : ''}
              onClick={() => setType(value)}
              key={value}
            >
              {value}
            </button>
          ))}
        </div>

        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <label>
          Account
          <select value={walletId} onChange={(event) => setWalletId(event.target.value)}>
            {data.wallets.map((wallet) => (
              <option value={wallet.id} key={wallet.id}>
                {wallet.name} ({wallet.currency})
              </option>
            ))}
          </select>
        </label>

        <label>
          Amount
          <input
            className="amountInput"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>

        {type === 'transfer' && (
          <label>
            To Account
            <select value={toWalletId} onChange={(event) => setToWalletId(event.target.value)}>
              {data.wallets.map((wallet) => (
                <option value={wallet.id} key={wallet.id}>
                  {wallet.name} ({wallet.currency})
                </option>
              ))}
            </select>
          </label>
        )}

        {type !== 'transfer' && (
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {data.categories.map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="descriptionPhotoRow">
          <label className="descriptionField">
            Description
            <input
              type="text"
              autoComplete="off"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <NotePhotoPicker images={noteImages} onChange={setNoteImages} />
        </div>

        <label>
          Note
          <input
            type="text"
            autoComplete="off"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        {error && <div className="insightsEditError">{error}</div>}
        <button type="button" className="primary insightsEditSave" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

import { useRef, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  ReceiptText,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import type { Currency } from '../lib/db'
import { getSupabaseClient } from '../lib/supabaseClient'
import './ReceiptScanner.css'

type ReceiptDraft = {
  amount: number | null
  currency: Currency | null
  date: string | null
  merchant: string
  category: string
  description: string
}

type Props = {
  categories: string[]
  preferredCurrency?: Currency
  onResult: (result: Omit<ReceiptDraft, 'amount' | 'currency' | 'date'> & { amount: number; currency: Currency; date: string }) => void
}

function localToday() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : ''
      const base64 = value.split(',')[1]
      if (!base64) reject(new Error('Could not read this image.'))
      else resolve(base64)
    }
    reader.onerror = () => reject(new Error('Could not read this image.'))
    reader.readAsDataURL(file)
  })
}

function normalizeDraft(value: unknown, categories: string[], preferredCurrency?: Currency): ReceiptDraft {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const amount = Number(raw.amount)
  const currency = raw.currency === 'USD' || raw.currency === 'LBP' ? raw.currency : null
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null
  const merchant = typeof raw.merchant === 'string' ? raw.merchant.trim().slice(0, 100) : ''
  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 240) : ''
  const requestedCategory = typeof raw.category === 'string' ? raw.category.trim() : ''
  const matchedCategory =
    categories.find((item) => item.toLowerCase() === requestedCategory.toLowerCase()) ||
    categories.find((item) => item.toLowerCase() === 'other') ||
    categories[0] ||
    'Other'

  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    currency: currency || preferredCurrency || null,
    date,
    merchant,
    category: matchedCategory,
    description,
  }
}

export default function ReceiptScanner({ categories, preferredCurrency, onResult }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<ReceiptDraft | null>(null)

  const scan = async (file?: File) => {
    if (!file) return
    setDraft(null)
    if (!file.type.startsWith('image/')) {
      setStatus('error')
      setMessage('Please choose an image file.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatus('error')
      setMessage('This image is larger than 8 MB. Choose a smaller photo.')
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      setStatus('error')
      setMessage('Connect Spenza Cloud and sign in before scanning receipts.')
      return
    }

    setStatus('scanning')
    setMessage('Gemini is reading your receipt…')
    try {
      const imageBase64 = await readImage(file)
      const { data, error } = await supabase.functions.invoke('receipt-scan', {
        body: {
          imageBase64,
          mimeType: file.type,
          categories: categories.slice(0, 80),
        },
      })
      if (error) {
        const detail = typeof data?.error === 'string' ? data.error : error.message
        throw new Error(detail || 'Receipt scanning failed.')
      }
      if (data?.error) throw new Error(String(data.error))
      const parsed = normalizeDraft(data?.receipt, categories, preferredCurrency)
      if (parsed.amount == null) {
        setStatus('error')
        setMessage('I could not identify the receipt total confidently. Try a clearer photo.')
        return
      }
      setDraft(parsed)
      setStatus('done')
      setMessage('Receipt details extracted. Review and edit them before using them.')
    } catch (error) {
      console.error('Receipt scan failed', error)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Receipt scanning failed. Please retry.')
    } finally {
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  const updateDraft = (patch: Partial<ReceiptDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  const useDetails = () => {
    if (!draft || draft.amount == null || draft.amount <= 0 || !draft.currency) return
    onResult({ amount: draft.amount, currency: draft.currency, date: draft.date || localToday(), merchant: draft.merchant, category: draft.category, description: draft.description })
    setDraft(null)
    setStatus('idle')
    setMessage('')
  }

  return (
    <div className="receiptScanner">
      <input
        ref={cameraRef}
        className="receiptInput"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void scan(event.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        className="receiptInput"
        type="file"
        accept="image/*"
        onChange={(event) => void scan(event.target.files?.[0])}
      />
      <div className="receiptScannerActions">
        <button
          className="receiptButton"
          type="button"
          disabled={status === 'scanning'}
          onClick={() => cameraRef.current?.click()}
        >
          <span className="receiptIcon">
            {status === 'scanning' ? <LoaderCircle className="spin" /> : <Camera />}
          </span>
          <span>
            <b>{status === 'scanning' ? 'Scanning receipt…' : 'Take receipt photo'}</b>
            <small>Use your camera</small>
          </span>
          <ReceiptText className="receiptSideIcon" />
        </button>
        <button
          className="receiptGalleryButton"
          type="button"
          disabled={status === 'scanning'}
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus size={16} />
          Choose from gallery
        </button>
      </div>

      {status !== 'idle' && <div className={'receiptStatus ' + status}>{message}</div>}

      {draft && (
        <section className="receiptReview" aria-label="Review scanned receipt">
          <div className="receiptReviewHead">
            <span className="receiptReviewIcon"><Sparkles size={16} /></span>
            <div>
              <b>Review extracted details</b>
              <small>Nothing is saved until you press Save Transaction.</small>
            </div>
          </div>
          <div className="receiptReviewGrid">
            <label>
              Amount
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={draft.amount ?? ''}
                onChange={(event) => updateDraft({ amount: event.target.value === '' ? null : Number(event.target.value) })}
              />
            </label>
            <label>
              Currency
              <select
                value={draft.currency || ''}
                onChange={(event) => updateDraft({ currency: event.target.value as Currency })}
              >
                <option value="" disabled>Select</option>
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={draft.date || ''}
                onChange={(event) => updateDraft({ date: event.target.value || null })}
              />
            </label>
            <label>
              Merchant
              <input
                type="text"
                value={draft.merchant}
                maxLength={100}
                onChange={(event) => updateDraft({ merchant: event.target.value })}
                placeholder="Merchant name"
              />
            </label>
            <label>
              Category
              <select
                value={draft.category}
                onChange={(event) => updateDraft({ category: event.target.value })}
              >
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="receiptDescriptionField">
              Description
              <input
                type="text"
                value={draft.description}
                maxLength={240}
                onChange={(event) => updateDraft({ description: event.target.value })}
                placeholder="What was purchased?"
              />
            </label>
          </div>
          <div className="receiptReviewActions">
            <button type="button" className="receiptRetryButton" onClick={() => setDraft(null)}>
              <RotateCcw size={15} /> Scan another
            </button>
            <button
              type="button"
              className="receiptUseButton"
              disabled={draft.amount == null || draft.amount <= 0 || !draft.currency}
              onClick={useDetails}
            >
              <CheckCircle2 size={16} /> Use details
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import { Camera, CheckCircle2, LoaderCircle, ReceiptText } from 'lucide-react'
import { createWorker } from 'tesseract.js'
import type { Currency } from '../lib/db'
import './ReceiptScanner.css'

type Props = {
  preferredCurrency?: Currency
  onResult: (result: { amount: number; currency?: Currency; merchant?: string; rawText: string }) => void
}

function parseNumber(raw: string): number | null {
  let value = raw.replace(/[^0-9.,]/g, '')
  if (!value) return null
  const lastDot = value.lastIndexOf('.')
  const lastComma = value.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ','
    const thousands = decimal === '.' ? ',' : '.'
    value = value.split(thousands).join('')
    if (decimal === ',') value = value.replace(',', '.')
  } else if (lastComma >= 0) {
    const tail = value.length - lastComma - 1
    value = tail === 2 ? value.replace(',', '.') : value.replace(/,/g, '')
  } else if (lastDot >= 0) {
    const tail = value.length - lastDot - 1
    if (tail !== 2) value = value.replace(/\./g, '')
  }
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

const amountToken = '[0-9]{1,3}(?:[.,\\s][0-9]{3})*(?:[.,][0-9]{2})|[0-9]+(?:[.,][0-9]{2})?'

function currencyAmounts(line: string, currency: Currency): number[] {
  const patterns = currency === 'USD'
    ? [new RegExp(`(?:US\\$|USD|\\$)\\s*(${amountToken})`, 'gi'), new RegExp(`(${amountToken})\\s*(?:USD|US\\$)`, 'gi')]
    : [
        new RegExp(`(?:LBP|L\\.?L\\.?|LL|ل\\.?ل\\.?)\\s*(${amountToken})`, 'gi'),
        new RegExp(`(${amountToken})\\s*(?:LBP|L\\.?L\\.?|LL|ل\\.?ل\\.?)`, 'gi'),
      ]
  const values: number[] = []
  for (const pattern of patterns) {
    for (const match of line.matchAll(pattern)) {
      const n = parseNumber(match[1])
      if (n !== null) values.push(n)
    }
  }
  return values
}

function findCurrencyTotals(text: string): Partial<Record<Currency, number>> {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const priority = lines.filter(line => /\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|net\s*total|total)\b/i.test(line) && !/subtotal|tax|vat|change|tender/i.test(line))
  const source = priority.length ? priority : lines
  const totals: Partial<Record<Currency, number>> = {}

  for (const currency of ['USD', 'LBP'] as Currency[]) {
    const candidates = source.flatMap(line => currencyAmounts(line, currency))
    if (candidates.length) {
      // A receipt may repeat the payable total. The largest same-currency value on total lines
      // is generally the final amount, but USD and LBP are never compared with each other.
      totals[currency] = Math.max(...candidates)
    }
  }
  return totals
}

function findUnlabelledTotal(text: string): number | null {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const priority = lines.filter(line => /\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|net\s*total|total)\b/i.test(line) && !/subtotal|tax|vat|change|tender/i.test(line))
  const values: number[] = []
  for (const line of priority) {
    for (const match of line.matchAll(new RegExp(`(${amountToken})`, 'g'))) {
      const n = parseNumber(match[1])
      if (n !== null) values.push(n)
    }
  }
  return values.length ? Math.max(...values) : null
}

function findMerchant(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  return lines.find(line => /[A-Za-z]{3}/.test(line) && line.length >= 3 && line.length <= 48 && !/receipt|invoice|tax|vat|date|time|tel|phone|total/i.test(line))
}

export default function ReceiptScanner({ preferredCurrency, onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle'|'scanning'|'done'|'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')

  const scan = async (file?: File) => {
    if (!file) return
    setStatus('scanning')
    setProgress(0)
    setMessage('Reading receipt…')
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null
    try {
      worker = await createWorker('eng', 1, {
        logger: event => {
          if (event.status === 'recognizing text') setProgress(Math.round((event.progress || 0) * 100))
        },
      })
      const result = await worker.recognize(file)
      const rawText = result.data.text || ''
      const totals = findCurrencyTotals(rawText)

      let currency: Currency | undefined
      let total: number | null = null
      if (preferredCurrency && totals[preferredCurrency]) {
        currency = preferredCurrency
        total = totals[preferredCurrency]!
      } else if (totals.USD) {
        currency = 'USD'
        total = totals.USD
      } else if (totals.LBP) {
        currency = 'LBP'
        total = totals.LBP
      } else {
        total = findUnlabelledTotal(rawText)
      }

      if (!total) {
        setStatus('error')
        setMessage('I could not confidently find the total. Try a clearer photo or enter the amount manually.')
        return
      }

      const merchant = findMerchant(rawText)
      onResult({ amount: total, currency, merchant, rawText })
      setStatus('done')
      setProgress(100)
      const label = currency ? `${currency} ${total.toLocaleString()}` : total.toLocaleString()
      setMessage(`Found total: ${label}. Please review it before saving.`)
    } catch (error) {
      console.error('Receipt scan failed', error)
      setStatus('error')
      setMessage('Receipt scanning failed. You can retry or enter the expense manually.')
    } finally {
      await worker?.terminate()
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return <div className="receiptScanner">
    <input ref={inputRef} className="receiptInput" type="file" accept="image/*" capture="environment" onChange={e => scan(e.target.files?.[0])}/>
    <button className="receiptButton" type="button" disabled={status==='scanning'} onClick={() => inputRef.current?.click()}>
      <span className="receiptIcon">{status==='scanning'?<LoaderCircle className="spin"/>:status==='done'?<CheckCircle2/>:<Camera/>}</span>
      <span><b>{status==='scanning'?'Scanning receipt…':'Scan receipt'}</b><small>{status==='scanning'?`${progress}% complete`:preferredCurrency?`Prefer ${preferredCurrency} total for selected wallet`:'Take a photo or choose an image'}</small></span>
      <ReceiptText className="receiptSideIcon"/>
    </button>
    {status!=='idle'&&<div className={`receiptStatus ${status}`}>{message}</div>}
  </div>
}

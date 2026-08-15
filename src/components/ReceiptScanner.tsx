import { useRef, useState } from 'react'
import { Camera, CheckCircle2, LoaderCircle, ReceiptText } from 'lucide-react'
import { createWorker } from 'tesseract.js'
import type { Currency } from '../lib/db'
import './ReceiptScanner.css'

type Props = {
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

function findTotal(text: string): number | null {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const amountPattern = /(?:USD|LBP|US\$|\$)?\s*([0-9]{1,3}(?:[.,\s][0-9]{3})*(?:[.,][0-9]{2})|[0-9]+(?:[.,][0-9]{2})?)/gi
  const priority = lines.filter(line => /\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|net\s*total|total)\b/i.test(line) && !/subtotal|tax|vat|change|tender/i.test(line))
  const amountsFrom = (source: string[]) => source.flatMap(line => {
    const values: number[] = []
    for (const match of line.matchAll(amountPattern)) {
      const n = parseNumber(match[1])
      if (n !== null) values.push(n)
    }
    return values
  })
  const preferred = amountsFrom(priority)
  if (preferred.length) return Math.max(...preferred)
  const currencyLines = lines.filter(line => /USD|LBP|US\$|\$/i.test(line))
  const currencyAmounts = amountsFrom(currencyLines)
  if (currencyAmounts.length) return Math.max(...currencyAmounts)
  const all = amountsFrom(lines).filter(n => n < 1_000_000_000)
  return all.length ? Math.max(...all) : null
}

function findCurrency(text: string): Currency | undefined {
  const upper = text.toUpperCase()
  if (/\bLBP\b|L\.L\.|L\.L|LEBANESE\s+POUND|ل\.ل/.test(upper)) return 'LBP'
  if (/\bUSD\b|US\$|\$|US DOLLAR/.test(upper)) return 'USD'
  return undefined
}

function findMerchant(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  return lines.find(line => /[A-Za-z]{3}/.test(line) && line.length >= 3 && line.length <= 48 && !/receipt|invoice|tax|vat|date|time|tel|phone|total/i.test(line))
}

export default function ReceiptScanner({ onResult }: Props) {
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
      const total = findTotal(rawText)
      if (!total) {
        setStatus('error')
        setMessage('I could not confidently find the total. Try a clearer photo or enter the amount manually.')
        return
      }
      const currency = findCurrency(rawText)
      const merchant = findMerchant(rawText)
      onResult({ amount: total, currency, merchant, rawText })
      setStatus('done')
      setProgress(100)
      setMessage(`Found ${currency ?? 'receipt'} total: ${total.toLocaleString()}. Please review it before saving.`)
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
      <span><b>{status==='scanning'?'Scanning receipt…':'Scan receipt'}</b><small>{status==='scanning'?`${progress}% complete`:'Take a photo or choose an image'}</small></span>
      <ReceiptText className="receiptSideIcon"/>
    </button>
    {status!=='idle'&&<div className={`receiptStatus ${status}`}>{message}</div>}
  </div>
}

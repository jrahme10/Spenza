import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Sparkles } from 'lucide-react'
import type { Currency, Transaction, Wallet } from '../lib/db'
type Props = { wallets: Wallet[]; transactions: Transaction[]; date: string; rate: number }
type Budget = { monthly: number; categories: Record<string, number> }
const fmt = (n: number, c: 'USD' | 'LBP') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: c,
    maximumFractionDigits: c === 'LBP' ? 0 : 2,
  }).format(n)
export default function HomeSmartInsight({ wallets, transactions, date, rate }: Props) {
  const currency: Currency = 'USD'
  const amountInUsd = (t: Transaction) =>
    (wallets.find((w) => w.id === t.walletId)?.currency || 'USD') === 'LBP'
      ? t.amount / rate
      : t.amount
  const [budget, setBudget] = useState<Budget | null>(null)
  useEffect(() => {
    if (!wallets.length) {
      setBudget(null)
      return
    }
    try {
      const raw = localStorage.getItem('spenza-budget:all')
      setBudget(raw ? JSON.parse(raw) : null)
    } catch {
      setBudget(null)
    }
  }, [wallets.length, date])
  const spent = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense' && t.date.slice(0, 7) === date.slice(0, 7))
        .reduce((s, t) => s + amountInUsd(t), 0),
    [wallets, transactions, date, rate],
  )
  if (!wallets.length || !budget?.monthly) return null
  const remaining = budget.monthly - spent,
    pct = Math.round((spent / budget.monthly) * 100)
  return (
    <article className={`homeSmartInsight ${remaining < 0 ? 'over' : ''}`}>
      <div>
        {remaining < 0 ? <AlertTriangle /> : <Sparkles />}
        <span>
          <b>
            {remaining < 0
              ? `${fmt(Math.abs(remaining), currency)} over budget`
              : `${fmt(remaining, currency)} left this month`}
          </b>
          <small>
            {pct}% of your {fmt(budget.monthly, currency)} budget used
          </small>
        </span>
      </div>
      <div className="homeBudgetBar">
        <i style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </article>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Sparkles } from 'lucide-react'
import type { Transaction, Wallet } from '../lib/db'
type Props = { wallet?: Wallet; transactions: Transaction[]; date: string }
type Budget = { monthly: number; categories: Record<string, number> }
const fmt = (n: number, c: 'USD' | 'LBP') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: c,
    maximumFractionDigits: c === 'LBP' ? 0 : 2,
  }).format(n)
export default function HomeSmartInsight({ wallet, transactions, date }: Props) {
  const [budget, setBudget] = useState<Budget | null>(null)
  useEffect(() => {
    if (!wallet) {
      setBudget(null)
      return
    }
    try {
      const raw = localStorage.getItem(`spenza-budget:${wallet.id}`)
      setBudget(raw ? JSON.parse(raw) : null)
    } catch {
      setBudget(null)
    }
  }, [wallet?.id, date])
  const spent = useMemo(
    () =>
      wallet
        ? transactions
            .filter(
              (t) =>
                t.walletId === wallet.id &&
                t.type === 'expense' &&
                t.date.slice(0, 7) === date.slice(0, 7),
            )
            .reduce((s, t) => s + t.amount, 0)
        : 0,
    [wallet, transactions, date],
  )
  if (!wallet || !budget?.monthly) return null
  const remaining = budget.monthly - spent,
    pct = Math.round((spent / budget.monthly) * 100)
  return (
    <article className={`homeSmartInsight ${remaining < 0 ? 'over' : ''}`}>
      <div>
        {remaining < 0 ? <AlertTriangle /> : <Sparkles />}
        <span>
          <b>
            {remaining < 0
              ? `${fmt(Math.abs(remaining), wallet.currency)} over budget`
              : `${fmt(remaining, wallet.currency)} left this month`}
          </b>
          <small>
            {pct}% of your {fmt(budget.monthly, wallet.currency)} budget used
          </small>
        </span>
      </div>
      <div className="homeBudgetBar">
        <i style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </article>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Pencil, Target, X } from 'lucide-react'
import type { Currency, Transaction, Wallet } from '../lib/db'
import { getSupabaseClient } from '../lib/supabaseClient'

type Props = { wallets: Wallet[]; transactions: Transaction[]; categories: string[]; date: string; rate: number }
type BudgetState = { monthly: number; categories: Record<string, number> }
type BudgetPayload = BudgetState & { walletId: string; updatedAt: string }
const key = (walletId: string) => `spenza-budget:${walletId}`
const empty: BudgetState = { monthly: 0, categories: {} }
const money = (n: number, c: Currency) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: c,
    maximumFractionDigits: c === 'LBP' ? 0 : 2,
  }).format(n)
const normalize = (value: any): BudgetState => {
  const entries: Array<[string, number]> = Object.entries(value?.categories || {}).map(([k, v]) => [
    k,
    Math.max(0, Number(v) || 0),
  ])
  return {
    monthly: Math.max(0, Number(value?.monthly) || 0),
    categories: Object.fromEntries(entries.filter(([, v]) => v > 0)),
  }
}

export default function BudgetPlanner({ wallets, transactions, categories, date, rate }: Props) {
  const budgetId = 'all'
  const currency: Currency = 'USD'
  const convertToUsd = (amount: number, walletId: string) => {
    const source = wallets.find((w) => w.id === walletId)?.currency || 'USD'
    return source === 'LBP' ? amount / rate : amount
  }
  const [budget, setBudget] = useState<BudgetState>(empty)
  const [editing, setEditing] = useState(false)
  const [monthly, setMonthly] = useState('')
  const [categoryValues, setCategoryValues] = useState<Record<string, string>>({})
  const [syncLabel, setSyncLabel] = useState('')
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!wallets.length) {
        setBudget(empty)
        return
      }
      let local = empty
      try {
        const raw = localStorage.getItem(key(budgetId))
        local = normalize(raw ? JSON.parse(raw) : empty)
      } catch {}
      setBudget(local)
      const supabase = getSupabaseClient()
      if (!supabase) return
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const { data, error } = await supabase
        .from('spenza_budgets')
        .select('payload')
        .eq('owner_id', session.user.id)
        .eq('id', budgetId)
        .maybeSingle()
      if (error || cancelled) return
      if (data?.payload) {
        const remote = normalize(data.payload)
        localStorage.setItem(key(budgetId), JSON.stringify(remote))
        setBudget(remote)
        setSyncLabel('Synced')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [wallets.length])
  const month = date.slice(0, 7)
  const expenses = useMemo(
    () =>
      transactions.filter(
        (t) => t.type === 'expense' && t.date.slice(0, 7) === month,
      ),
    [transactions, month],
  )
  const spent = expenses.reduce((sum, t) => sum + convertToUsd(t.amount, t.walletId), 0)
  const remaining = Math.max(0, budget.monthly - spent)
  const pct = budget.monthly ? Math.min(100, (spent / budget.monthly) * 100) : 0
  const categorySpent = (name: string) =>
    expenses.filter((t) => t.category === name).reduce((sum, t) => sum + convertToUsd(t.amount, t.walletId), 0)
  const open = () => {
    setMonthly(budget.monthly ? String(budget.monthly) : '')
    setCategoryValues(
      Object.fromEntries(
        categories.map((c) => [c, budget.categories[c] ? String(budget.categories[c]) : '']),
      ),
    )
    setEditing(true)
  }
  const save = async () => {
    if (!wallets.length) return
    const categoryEntries: Array<[string, number]> = categories.map((c) => [
      c,
      Math.max(0, Number(categoryValues[c]) || 0),
    ])
    const next: BudgetState = {
      monthly: Math.max(0, Number(monthly) || 0),
      categories: Object.fromEntries(categoryEntries.filter(([, v]) => v > 0)),
    }
    localStorage.setItem(key(budgetId), JSON.stringify(next))
    setBudget(next)
    setEditing(false)
    setSyncLabel('Saved')
    const supabase = getSupabaseClient()
    if (!supabase) return
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return
      const updatedAt = new Date().toISOString()
      const payload: BudgetPayload = { ...next, walletId: budgetId, updatedAt }
      const { error } = await supabase
        .from('spenza_budgets')
        .upsert(
          { owner_id: session.user.id, id: budgetId, payload, changed_at: updatedAt },
          { onConflict: 'owner_id,id' },
        )
      if (error) throw error
      setSyncLabel('Synced')
    } catch {
      setSyncLabel('Saved on device')
    }
  }
  if (!wallets.length) return null
  return (
    <>
      <section className="budgetCard">
        <div className="budgetHead">
          <div>
            <span className="budgetEyebrow">
              <Target size={15} />
              Monthly Budget
            </span>
            <h2>{budget.monthly ? money(budget.monthly, currency) : 'Not set'}</h2>
            <small>
              {wallet.name} ·{' '}
              {new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
              {syncLabel ? ` · ${syncLabel}` : ''}
            </small>
          </div>
          <button onClick={open} aria-label="Edit budget">
            <Pencil size={17} />
          </button>
        </div>
        {budget.monthly ? (
          <>
            <div className="budgetNumbers">
              <span>
                <small>Spent</small>
                <b>{money(spent, currency)}</b>
              </span>
              <span>
                <small>Remaining</small>
                <b>{money(remaining, currency)}</b>
              </span>
              <strong>{Math.round(pct)}%</strong>
            </div>
            <div className="budgetProgress">
              <i style={{ width: `${pct}%` }} />
            </div>
            {Object.entries(budget.categories)
              .filter(([, limit]) => limit > 0)
              .slice(0, 4)
              .map(([name, limit]) => {
                const used = categorySpent(name)
                const cpct = Math.min(100, (used / limit) * 100)
                return (
                  <div className="budgetCategory" key={name}>
                    <div>
                      <span>{name}</span>
                      <small>
                        {money(used, currency)} / {money(limit, currency)}
                      </small>
                    </div>
                    <div>
                      <i style={{ width: `${cpct}%` }} />
                    </div>
                  </div>
                )
              })}
          </>
        ) : (
          <button className="budgetSetup" onClick={open}>
            Set a monthly budget
          </button>
        )}
      </section>
      {editing && (
        <div className="budgetBackdrop" onClick={() => setEditing(false)}>
          <section className="budgetSheet" onClick={(e) => e.stopPropagation()}>
            <div className="budgetHandle" />
            <div className="budgetSheetHead">
              <div>
                <h2>Budget</h2>
                <small>
                  All accounts · USD
                </small>
              </div>
              <button onClick={() => setEditing(false)}>
                <X />
              </button>
            </div>
            <label className="budgetMainInput">
              <span>Monthly spending limit</span>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="0"
              />
            </label>
            <h3>
              Category limits <small>Optional</small>
            </h3>
            <div className="budgetCategoryInputs">
              {categories.map((c) => (
                <label key={c}>
                  <span>{c}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={categoryValues[c] || ''}
                    onChange={(e) => setCategoryValues((v) => ({ ...v, [c]: e.target.value }))}
                    placeholder="No limit"
                  />
                </label>
              ))}
            </div>
            <button className="budgetSave" onClick={() => void save()}>
              Save Budget
            </button>
          </section>
        </div>
      )}
    </>
  )
}

import { Currency } from '../lib/db'

const money = (n: number, c: Currency | 'USD' = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: c,
    maximumFractionDigits: c === 'LBP' ? 0 : 2,
  }).format(n)

type Props = {
  currency?: Currency
  income: number
  expense: number
  available: number
}

export default function HomeCashflowSummary({ currency, income, expense, available }: Props) {
  return (
    <>
      <div className="activitySummary homeCashflowSummary">
        <article>
          <span>Income</span>
          <strong style={{ color: '#4aa8ff' }}>{currency ? money(income, currency) : '—'}</strong>
        </article>
        <article>
          <span>Exp.</span>
          <strong style={{ color: '#ff5f68' }}>{currency ? money(expense, currency) : '—'}</strong>
        </article>
        <article>
          <span>Total</span>
          <strong>{currency ? money(income - expense, currency) : '—'}</strong>
        </article>
      </div>
      <div className="accountSummary homeAvailableAmount">
        <span>Available Amount</span>
        <strong>{currency ? money(available, currency) : '—'}</strong>
      </div>
    </>
  )
}

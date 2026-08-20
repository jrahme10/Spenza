import { CalendarClock } from 'lucide-react'

export type HomePeriod = 'daily' | 'monthly' | 'yearly' | 'custom'

type Props = {
  value: HomePeriod
  onChange: (period: Exclude<HomePeriod, 'custom'>) => void
  onCalendar: () => void
}

export default function HomePeriodFilters({ value, onChange, onCalendar }: Props) {
  return (
    <div className="filters refFilters periodFilters homePeriodFilters">
      {(['daily', 'monthly', 'yearly'] as const).map(period => (
        <button
          key={period}
          className={value === period ? 'selected' : ''}
          onClick={() => onChange(period)}
        >
          {period}
        </button>
      ))}
      <button
        className={`calendarFilterButton ${value === 'custom' ? 'selected' : ''}`}
        onClick={onCalendar}
      >
        <CalendarClock size={12} />
        Calendar
      </button>
    </div>
  )
}

import { CalendarClock } from 'lucide-react'

export type HomePeriod = 'daily' | 'monthly' | 'custom'

export type HomePeriodFilterProps = {
  value: HomePeriod
  onChange: (period: Exclude<HomePeriod, 'custom'>) => void
  onCalendar: () => void
}

const periodOptions: Array<{ value: Exclude<HomePeriod, 'custom'>; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
]

export default function HomePeriodFilters({ value, onChange, onCalendar }: HomePeriodFilterProps) {
  return (
    <div className="filters refFilters periodFilters homePeriodFilters">
      {periodOptions.map((period) => (
        <button
          key={period.value}
          className={value === period.value ? 'selected' : ''}
          onClick={() => onChange(period.value)}
        >
          {period.label}
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

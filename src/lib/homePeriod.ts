export type HomePeriod = 'daily' | 'monthly' | 'custom'

export const isInHomePeriod = (txDate: string, period: HomePeriod, selectedDate: string) => {
  if (period === 'custom') return txDate === selectedDate
  if (period === 'daily') return txDate.slice(0, 7) === selectedDate.slice(0, 7)
  return txDate.slice(0, 4) === selectedDate.slice(0, 4)
}

export const shiftHomePeriodDate = (selectedDate: string, period: HomePeriod, direction: number) => {
  const date = new Date(`${selectedDate}T12:00:00`)
  if (period === 'custom') date.setDate(date.getDate() + direction)
  else if (period === 'daily') date.setMonth(date.getMonth() + direction)
  else date.setFullYear(date.getFullYear() + direction)
  return date.toISOString().slice(0, 10)
}

export const getHomePeriodLabel = (selectedDate: string, period: HomePeriod) => {
  if (period === 'custom') {
    return new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  if (period === 'daily') {
    return new Date(`${selectedDate.slice(0, 7)}-01T12:00:00`).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }
  return selectedDate.slice(0, 4)
}

export const homePeriodToInsightPeriod = (period: HomePeriod): 'daily' | 'monthly' | 'yearly' => {
  if (period === 'custom') return 'daily'
  if (period === 'daily') return 'monthly'
  return 'yearly'
}

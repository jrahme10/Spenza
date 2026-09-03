import { loadData, Transaction } from './db'

let renderToken = 0

function getInsightsPage() {
  return Array.from(document.querySelectorAll<HTMLElement>('.page.refPage')).find(
    (page) => page.querySelector('h1')?.textContent?.trim() === 'Insights',
  )
}

function getPeriod(page: HTMLElement): 'daily' | 'monthly' | 'yearly' {
  const selected = page.querySelector<HTMLButtonElement>('.periodFilters button.selected')
  const text = selected?.textContent?.trim().toLowerCase() || ''
  if (text.includes('calendar')) return 'daily'
  if (text === 'daily') return 'monthly'
  return 'yearly'
}

function inPeriod(date: string, selectedDate: string, period: 'daily' | 'monthly' | 'yearly') {
  if (period === 'daily') return date === selectedDate
  if (period === 'monthly') return date.slice(0, 7) === selectedDate.slice(0, 7)
  return date.slice(0, 4) === selectedDate.slice(0, 4)
}

function searchableText(
  transaction: Transaction,
  accountName: string,
  destinationName: string,
) {
  return [
    transaction.title,
    transaction.category,
    transaction.note,
    transaction.type,
    transaction.amount,
    transaction.date,
    accountName,
    destinationName,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(' ')
    .toLowerCase()
}

function money(value: number, currency: 'USD' | 'LBP') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'LBP' ? 0 : 2,
  }).format(value)
}

async function renderResults(page: HTMLElement, host: HTMLElement, input: HTMLInputElement) {
  const token = ++renderToken
  const data = await loadData().catch(() => null)
  if (!data || token !== renderToken || !host.isConnected) return

  const selectors = page.querySelectorAll<HTMLSelectElement>('.insightSelectors select')
  const accountId = selectors[0]?.value || ''
  const category = selectors[1]?.value || 'all'
  const selectedDate = page.querySelector<HTMLInputElement>('.insightNavigator input[type="date"]')?.value || ''
  const period = getPeriod(page)
  const query = input.value.trim().toLowerCase()

  const walletById = new Map(data.wallets.map((wallet) => [wallet.id, wallet]))
  const matches = data.transactions
    .filter((transaction) => {
      const belongsToAccount =
        transaction.walletId === accountId || transaction.toWalletId === accountId
      if (!belongsToAccount) return false
      if (selectedDate && !inPeriod(transaction.date, selectedDate, period)) return false
      if (category !== 'all' && transaction.category !== category) return false
      if (!query) return true
      const source = walletById.get(transaction.walletId)?.name || ''
      const destination = walletById.get(transaction.toWalletId || '')?.name || ''
      return searchableText(transaction, source, destination).includes(query)
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || '')),
    )

  const results = host.querySelector<HTMLElement>('.insightsSearchResults')
  if (!results) return
  results.replaceChildren()

  if (!query) {
    results.hidden = true
    return
  }

  results.hidden = false
  const heading = document.createElement('div')
  heading.className = 'insightsSearchSummary'
  heading.textContent = `${matches.length} matching transaction${matches.length === 1 ? '' : 's'}`
  results.appendChild(heading)

  if (!matches.length) {
    const empty = document.createElement('div')
    empty.className = 'insightsSearchEmpty'
    empty.textContent = 'No transactions match your search.'
    results.appendChild(empty)
    return
  }

  for (const transaction of matches.slice(0, 50)) {
    const source = walletById.get(transaction.walletId)
    const destination = walletById.get(transaction.toWalletId || '')
    const row = document.createElement('article')
    row.className = `insightsSearchRow ${transaction.type}`

    const main = document.createElement('div')
    main.className = 'insightsSearchMain'
    const title = document.createElement('b')
    title.textContent = transaction.category || transaction.title || 'Transaction'
    const meta = document.createElement('span')
    const description = transaction.title && transaction.title !== transaction.category ? transaction.title : ''
    const accountText = transaction.type === 'transfer' && destination
      ? `${source?.name || 'Account'} → ${destination.name}`
      : source?.name || 'Account'
    meta.textContent = [accountText, description, transaction.note].filter(Boolean).join(' · ')
    main.append(title, meta)

    const amount = document.createElement('div')
    amount.className = 'insightsSearchAmount'
    const value = document.createElement('strong')
    const sign = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : '↔ '
    value.textContent = `${sign}${money(transaction.amount, source?.currency || 'USD')}`
    const date = document.createElement('small')
    date.textContent = transaction.date
    amount.append(value, date)

    row.append(main, amount)
    results.appendChild(row)
  }
}

function install(page: HTMLElement) {
  if (page.querySelector('.insightsTransactionSearch')) return
  const selectors = page.querySelector<HTMLElement>('.insightSelectors')
  if (!selectors) return

  const host = document.createElement('section')
  host.className = 'insightsTransactionSearch'
  host.innerHTML = `
    <label class="insightsSearchField">
      <span class="insightsSearchIcon" aria-hidden="true">⌕</span>
      <input type="search" inputmode="search" autocomplete="off" placeholder="Search category, description, note, account, amount…" aria-label="Search Insight transactions" />
      <button type="button" class="insightsSearchClear" aria-label="Clear search">×</button>
    </label>
    <div class="insightsSearchResults" hidden></div>
  `
  selectors.insertAdjacentElement('afterend', host)

  const input = host.querySelector<HTMLInputElement>('input')!
  const clear = host.querySelector<HTMLButtonElement>('.insightsSearchClear')!
  let timer: number | undefined
  const refresh = () => {
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => void renderResults(page, host, input), 80)
  }
  input.addEventListener('input', refresh)
  clear.addEventListener('click', () => {
    input.value = ''
    input.focus()
    refresh()
  })
  page.addEventListener('change', refresh)
  page.addEventListener('click', (event) => {
    if ((event.target as Element).closest('.periodFilters button')) window.setTimeout(refresh, 0)
  })
}

export function initInsightsSearch() {
  const run = () => {
    const page = getInsightsPage()
    if (page) install(page)
  }
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true })
  run()
}

import { loadData, Transaction, TransactionType, Wallet } from './db'
import { localRepository } from './repository'

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

function money(value: number, currency: 'USD' | 'LBP') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'LBP' ? 0 : 2,
  }).format(value)
}

function searchableText(transaction: Transaction, source?: Wallet, destination?: Wallet) {
  const sourceCurrency = source?.currency || ''
  const formattedAmount = sourceCurrency
    ? money(transaction.amount, sourceCurrency)
    : String(transaction.amount)
  const destinationAmount =
    transaction.type === 'transfer' && destination && transaction.exchangeRate
      ? transaction.amount * transaction.exchangeRate
      : undefined
  const formattedDestinationAmount =
    destinationAmount !== undefined && destination
      ? money(destinationAmount, destination.currency)
      : undefined

  return [
    transaction.title,
    transaction.category,
    transaction.note,
    transaction.type,
    transaction.type === 'expense' ? 'expense spent spending purchase payment' : '',
    transaction.type === 'income' ? 'income received earning salary deposit' : '',
    transaction.type === 'transfer' ? 'transfer moved sent received' : '',
    transaction.amount,
    formattedAmount,
    transaction.date,
    transaction.exchangeRate,
    source?.name,
    source?.currency,
    destination?.name,
    destination?.currency,
    destinationAmount,
    formattedDestinationAmount,
    transaction.createdAt,
    transaction.updatedAt,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .join(' ')
    .toLowerCase()
}

function matchesQuery(text: string, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return terms.every((term) => text.includes(term))
}

function pairRate(from: Wallet | undefined, to: Wallet | undefined, usdToLbpRate: number) {
  if (!from || !to || from.currency === to.currency) return 1
  return from.currency === 'USD' ? usdToLbpRate : 1 / usdToLbpRate
}

async function openInsightsEditor(transactionId: string) {
  document.querySelector('.insightsEditOverlay')?.remove()
  const data = await loadData().catch(() => null)
  const transaction = data?.transactions.find((item) => item.id === transactionId)
  if (!data || !transaction) return

  const overlay = document.createElement('div')
  overlay.className = 'overlay insightsEditOverlay'
  const sheet = document.createElement('div')
  sheet.className = 'sheet refSheet insightsEditSheet'
  sheet.innerHTML = `
    <div class="sheetTop">
      <div><span class="eyebrow">EDIT</span><h2>Edit Transaction</h2></div>
      <button type="button" class="close insightsEditClose" aria-label="Close">×</button>
    </div>
    <label>Type<select class="insightsEditType"></select></label>
    <label>Date<input class="insightsEditDate" type="date" /></label>
    <label>Account<select class="insightsEditAccount"></select></label>
    <label class="insightsEditToAccountLabel">To Account<select class="insightsEditToAccount"></select></label>
    <label>Amount<input class="insightsEditAmount" type="number" inputmode="decimal" /></label>
    <label class="insightsEditCategoryLabel">Category<select class="insightsEditCategory"></select></label>
    <label>Description<input class="insightsEditDescription" type="text" autocomplete="off" /></label>
    <label>Note<input class="insightsEditNote" type="text" autocomplete="off" /></label>
    <div class="insightsEditError" hidden></div>
    <button type="button" class="primary insightsEditSave">Save Changes</button>
  `
  overlay.appendChild(sheet)
  document.body.appendChild(overlay)

  const typeSelect = sheet.querySelector<HTMLSelectElement>('.insightsEditType')!
  const dateInput = sheet.querySelector<HTMLInputElement>('.insightsEditDate')!
  const accountSelect = sheet.querySelector<HTMLSelectElement>('.insightsEditAccount')!
  const toAccountSelect = sheet.querySelector<HTMLSelectElement>('.insightsEditToAccount')!
  const toAccountLabel = sheet.querySelector<HTMLElement>('.insightsEditToAccountLabel')!
  const amountInput = sheet.querySelector<HTMLInputElement>('.insightsEditAmount')!
  const categorySelect = sheet.querySelector<HTMLSelectElement>('.insightsEditCategory')!
  const categoryLabel = sheet.querySelector<HTMLElement>('.insightsEditCategoryLabel')!
  const descriptionInput = sheet.querySelector<HTMLInputElement>('.insightsEditDescription')!
  const noteInput = sheet.querySelector<HTMLInputElement>('.insightsEditNote')!
  const error = sheet.querySelector<HTMLElement>('.insightsEditError')!
  const save = sheet.querySelector<HTMLButtonElement>('.insightsEditSave')!

  for (const value of ['expense', 'income', 'transfer'] as TransactionType[]) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value[0].toUpperCase() + value.slice(1)
    typeSelect.appendChild(option)
  }
  for (const wallet of data.wallets) {
    const option = document.createElement('option')
    option.value = wallet.id
    option.textContent = `${wallet.name} (${wallet.currency})`
    accountSelect.appendChild(option)
    toAccountSelect.appendChild(option.cloneNode(true))
  }
  for (const category of data.categories) {
    const option = document.createElement('option')
    option.value = category
    option.textContent = category
    categorySelect.appendChild(option)
  }

  typeSelect.value = transaction.type
  dateInput.value = transaction.date
  accountSelect.value = transaction.walletId
  toAccountSelect.value = transaction.toWalletId || data.wallets.find((w) => w.id !== transaction.walletId)?.id || ''
  amountInput.value = String(transaction.amount)
  categorySelect.value = transaction.category
  descriptionInput.value = transaction.title === transaction.category ? '' : transaction.title
  noteInput.value = transaction.note || ''

  const syncTypeFields = () => {
    const isTransfer = typeSelect.value === 'transfer'
    toAccountLabel.hidden = !isTransfer
    categoryLabel.hidden = isTransfer
  }
  syncTypeFields()
  typeSelect.addEventListener('change', syncTypeFields)

  const close = () => overlay.remove()
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })
  sheet.querySelector('.insightsEditClose')?.addEventListener('click', close)

  save.addEventListener('click', async () => {
    const amount = Number(amountInput.value)
    const type = typeSelect.value as TransactionType
    const walletId = accountSelect.value
    const toWalletId = type === 'transfer' ? toAccountSelect.value : undefined
    error.hidden = true
    if (!walletId || !amount || amount <= 0 || !dateInput.value) {
      error.textContent = 'Please enter a valid account, amount, and date.'
      error.hidden = false
      return
    }
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) {
      error.textContent = 'Choose a different destination account.'
      error.hidden = false
      return
    }

    const sourceWallet = data.wallets.find((w) => w.id === walletId)
    const destinationWallet = data.wallets.find((w) => w.id === toWalletId)
    const category = type === 'transfer' ? 'Transfer' : categorySelect.value || 'Other'
    const title = descriptionInput.value.trim() || (type === 'expense' ? category : 'Transaction')
    const updated: Transaction = {
      ...transaction,
      type,
      walletId,
      toWalletId,
      exchangeRate:
        type === 'transfer'
          ? pairRate(sourceWallet, destinationWallet, data.usdToLbpRate || 89500)
          : undefined,
      amount,
      date: dateInput.value,
      category,
      title,
      note: noteInput.value.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }

    save.disabled = true
    save.textContent = 'Saving…'
    try {
      await localRepository.upsertTransaction(updated)
      window.location.reload()
    } catch {
      save.disabled = false
      save.textContent = 'Save Changes'
      error.textContent = 'Could not save the transaction. Please try again.'
      error.hidden = false
    }
  })
}

async function renderResults(page: HTMLElement, host: HTMLElement, input: HTMLInputElement) {
  const token = ++renderToken
  const data = await loadData().catch(() => null)
  if (!data || token !== renderToken || !host.isConnected) return

  const selectors = page.querySelectorAll<HTMLSelectElement>('.insightSelectors select')
  const accountId = selectors[0]?.value || ''
  const category = selectors[1]?.value || 'all'
  const selectedDate =
    page.querySelector<HTMLInputElement>('.insightNavigator input[type="date"]')?.value || ''
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
      const source = walletById.get(transaction.walletId)
      const destination = walletById.get(transaction.toWalletId || '')
      return matchesQuery(searchableText(transaction, source, destination), query)
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
    const description =
      transaction.title && transaction.title !== transaction.category ? transaction.title : ''
    const accountText =
      transaction.type === 'transfer' && destination
        ? `${source?.name || 'Account'} → ${destination.name}`
        : source?.name || 'Account'
    meta.textContent = [accountText, description, transaction.note].filter(Boolean).join(' · ')
    main.append(title, meta)

    const amount = document.createElement('div')
    amount.className = 'insightsSearchAmount'
    const value = document.createElement('strong')
    const sign =
      transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : '↔ '
    value.textContent = `${sign}${money(transaction.amount, source?.currency || 'USD')}`
    const date = document.createElement('small')
    date.textContent = transaction.date
    amount.append(value, date)

    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'insightsSearchEdit'
    edit.setAttribute('aria-label', `Edit ${transaction.title || transaction.category || 'transaction'}`)
    edit.title = 'Edit transaction'
    edit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'
    edit.addEventListener('click', () => void openInsightsEditor(transaction.id))

    row.append(main, amount, edit)
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
      <input type="search" inputmode="search" autocomplete="off" placeholder="Search category, description, note, account, amount, date…" aria-label="Search Insight transactions" />
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

const transactionSheetSelector = '.sheet.refSheet'
const editableSelector = 'input:not([type="hidden"]):not([type="file"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)'

function isTransactionSheet(sheet: Element) {
  return sheet.querySelector('h2')?.textContent?.includes('Transaction') ?? false
}

function visibleEditableFields(sheet: Element) {
  return Array.from(sheet.querySelectorAll<HTMLElement>(editableSelector)).filter(field => {
    const style = window.getComputedStyle(field)
    return style.display !== 'none' && style.visibility !== 'hidden' && field.getClientRects().length > 0
  })
}

function revealField(field: HTMLElement) {
  window.setTimeout(() => {
    field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, 120)
}

function focusAndReveal(field: HTMLElement, selectValue = false) {
  field.focus({ preventScroll: true })
  if (selectValue && field instanceof HTMLInputElement) field.select()
  revealField(field)
}

function focusAmount(sheet: Element) {
  const amount = sheet.querySelector<HTMLInputElement>('input.amountInput')
  if (!amount) return
  window.setTimeout(() => focusAndReveal(amount, true), 80)
}

export function initTransactionFormKeyboard() {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target instanceof HTMLTextAreaElement) return
    const sheet = target.closest(transactionSheetSelector)
    if (!sheet || !isTransactionSheet(sheet)) return

    const fields = visibleEditableFields(sheet)
    const index = fields.indexOf(target)
    if (index < 0) return

    event.preventDefault()
    const next = fields[index + 1]
    if (next) {
      focusAndReveal(next)
      return
    }

    const save = Array.from(sheet.querySelectorAll<HTMLButtonElement>('button.primary')).find(button => !button.disabled)
    save?.click()
  })

  const observer = new MutationObserver(() => {
    const sheets = Array.from(document.querySelectorAll(transactionSheetSelector)).filter(isTransactionSheet)
    for (const sheet of sheets) {
      if (sheet.getAttribute('data-keyboard-ready') === 'true') continue
      sheet.setAttribute('data-keyboard-ready', 'true')
      focusAmount(sheet)
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

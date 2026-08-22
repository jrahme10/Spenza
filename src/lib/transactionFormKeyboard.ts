const transactionSheetSelector = '.sheet.refSheet'
const editableSelector = 'input:not([type="hidden"]):not([type="file"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)'
let amountPadCleanup:(()=>void)|null=null

function isTransactionSheet(sheet: Element) {
  return sheet.querySelector('h2')?.textContent?.includes('Transaction') ?? false
}

function visibleEditableFields(sheet: Element) {
  return Array.from(sheet.querySelectorAll<HTMLElement>(editableSelector)).filter(field => {
    const style = window.getComputedStyle(field)
    return style.display !== 'none' && style.visibility !== 'hidden' && field.getClientRects().length > 0 && !field.classList.contains('amountInput')
  })
}

function revealField(field: HTMLElement) {
  window.setTimeout(() => field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), 100)
}

function focusAndReveal(field: HTMLElement, selectValue = false) {
  field.focus({ preventScroll: true })
  if (selectValue && field instanceof HTMLInputElement) field.select()
  revealField(field)
}

function nextAfterAmount(sheet: Element) {
  const amount = sheet.querySelector<HTMLInputElement>('input.amountInput')
  if (!amount) return
  const all = Array.from(sheet.querySelectorAll<HTMLElement>(editableSelector)).filter(field => {
    const style = window.getComputedStyle(field)
    return style.display !== 'none' && style.visibility !== 'hidden' && field.getClientRects().length > 0
  })
  const index = all.indexOf(amount)
  const next = all.slice(index + 1).find(field => !field.classList.contains('amountInput'))
  if (next) focusAndReveal(next)
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function openAmountKeypad(input: HTMLInputElement, sheet: Element) {
  amountPadCleanup?.()
  input.blur()
  let draftValue = input.value || ''
  const pad = document.createElement('div')
  pad.className = 'spenzaAmountKeypad'
  pad.innerHTML = `<div class="amountKeypadHandle"></div><div class="amountKeypadDisplay">${draftValue || '0'}</div><div class="amountKeypadGrid"><button data-key="1">1</button><button data-key="2">2</button><button data-key="3">3</button><button data-key="4">4</button><button data-key="5">5</button><button data-key="6">6</button><button data-key="7">7</button><button data-key="8">8</button><button data-key="9">9</button><button data-key=".">.</button><button data-key="0">0</button><button data-key="back" aria-label="Delete">⌫</button></div><button class="amountKeypadOk">OK</button>`
  document.body.appendChild(pad)
  const onOutside=(event:PointerEvent)=>{const target=event.target as Node|null;if(!target||pad.contains(target)||input.contains(target))return;closePad()}
  const closePad=()=>{document.removeEventListener('pointerdown',onOutside,true);if(pad.isConnected)pad.remove();if(amountPadCleanup===closePad)amountPadCleanup=null}
  amountPadCleanup=closePad
  window.setTimeout(()=>{if(pad.isConnected)document.addEventListener('pointerdown',onOutside,true)},0)
  const display = pad.querySelector<HTMLElement>('.amountKeypadDisplay')!
  const commitDraft = () => {
    const normalized = draftValue.endsWith('.') ? draftValue.slice(0, -1) : draftValue
    setReactInputValue(input, normalized)
  }
  const updateDisplay = () => { display.textContent = draftValue || '0' }
  pad.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.key || ''
    if (key === 'back') draftValue = draftValue.slice(0, -1)
    else if (key === '.') {
      if (!draftValue.includes('.')) draftValue = draftValue ? `${draftValue}.` : '0.'
    } else draftValue = draftValue === '0' ? key : draftValue + key

    updateDisplay()
    if (!draftValue.endsWith('.')) commitDraft()
    else if (!draftValue) setReactInputValue(input, '')
  }))
  pad.querySelector<HTMLButtonElement>('.amountKeypadOk')?.addEventListener('click', () => {
    commitDraft()
    closePad()
    nextAfterAmount(sheet)
  })
}

function prepareAmount(sheet: Element) {
  const amount = sheet.querySelector<HTMLInputElement>('input.amountInput')
  if (!amount || amount.dataset.customKeypad === 'true') return
  amount.dataset.customKeypad = 'true'
  amount.setAttribute('inputmode', 'none')
  amount.setAttribute('readonly', 'true')
  amount.addEventListener('click', () => openAmountKeypad(amount, sheet))
  amount.addEventListener('focus', () => openAmountKeypad(amount, sheet))
  window.setTimeout(() => { amount.focus({ preventScroll: true }); revealField(amount) }, 80)
}

export function initTransactionFormKeyboard() {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target
    if (!(target instanceof HTMLElement) || target instanceof HTMLTextAreaElement) return
    const sheet = target.closest(transactionSheetSelector)
    if (!sheet || !isTransactionSheet(sheet) || target.classList.contains('amountInput')) return
    const fields = visibleEditableFields(sheet)
    const index = fields.indexOf(target)
    if (index < 0) return
    event.preventDefault()
    const next = fields[index + 1]
    if (next) focusAndReveal(next)
    else Array.from(sheet.querySelectorAll<HTMLButtonElement>('button.primary')).find(button => !button.disabled)?.click()
  })

  const observer = new MutationObserver(() => {
    const sheets = Array.from(document.querySelectorAll(transactionSheetSelector)).filter(isTransactionSheet)
    if(!sheets.length)amountPadCleanup?.()
    for (const sheet of sheets) {
      if (sheet.getAttribute('data-keyboard-ready') === 'true') continue
      sheet.setAttribute('data-keyboard-ready', 'true')
      prepareAmount(sheet)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

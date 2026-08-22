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

function evaluateAmountExpression(source:string):number|null {
  const text=source.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'')
  if(!text||!/^[0-9.+\-*/()]+$/.test(text))return null
  let index=0
  const peek=()=>text[index]
  const consume=(value?:string)=>{if(value&&peek()!==value)throw new Error('Unexpected token');return text[index++]}
  const number=()=>{const start=index;let dots=0;while(index<text.length&&/[0-9.]/.test(peek())){if(peek()==='.'&&++dots>1)throw new Error('Invalid number');index++}if(start===index)throw new Error('Number expected');const value=Number(text.slice(start,index));if(!Number.isFinite(value))throw new Error('Invalid number');return value}
  const factor=():number=>{if(peek()==='+'){consume('+');return factor()}if(peek()==='-'){consume('-');return-factor()}if(peek()==='('){consume('(');const value=expression();consume(')');return value}return number()}
  const term=():number=>{let value=factor();while(peek()==='*'||peek()==='/'){const op=consume();const right=factor();if(op==='/'&&right===0)throw new Error('Divide by zero');value=op==='*'?value*right:value/right}return value}
  const expression=():number=>{let value=term();while(peek()==='+'||peek()==='-'){const op=consume();const right=term();value=op==='+'?value+right:value-right}return value}
  try{const result=expression();if(index!==text.length||!Number.isFinite(result))return null;return Math.round((result+Number.EPSILON)*100000000)/100000000}catch{return null}
}

function openAmountKeypad(input: HTMLInputElement, sheet: Element) {
  amountPadCleanup?.()
  input.blur()
  let draftValue = input.value || ''
  const pad = document.createElement('div')
  pad.className = 'spenzaAmountKeypad'
  pad.innerHTML = `<div class="amountKeypadHandle"></div><div class="amountKeypadDisplay"><span class="amountExpression">${draftValue || '0'}</span><small class="amountEquationResult"></small></div><div class="amountKeypadGrid"><button data-key="7">7</button><button data-key="8">8</button><button data-key="9">9</button><button data-key="/" class="amountOperator">÷</button><button data-key="4">4</button><button data-key="5">5</button><button data-key="6">6</button><button data-key="*" class="amountOperator">×</button><button data-key="1">1</button><button data-key="2">2</button><button data-key="3">3</button><button data-key="-" class="amountOperator">−</button><button data-key=".">.</button><button data-key="0">0</button><button data-key="back" aria-label="Delete">⌫</button><button data-key="+" class="amountOperator">+</button><button data-key="(" class="amountOperator">(</button><button data-key=")" class="amountOperator">)</button><button data-key="clear" class="amountOperator">C</button><button data-key="equals" class="amountEquals">=</button></div><button class="amountKeypadOk">Use Amount</button>`
  document.body.appendChild(pad)
  const onOutside=(event:PointerEvent)=>{const target=event.target as Node|null;if(!target||pad.contains(target)||input.contains(target))return;closePad()}
  const closePad=()=>{document.removeEventListener('pointerdown',onOutside,true);if(pad.isConnected)pad.remove();if(amountPadCleanup===closePad)amountPadCleanup=null}
  amountPadCleanup=closePad
  window.setTimeout(()=>{if(pad.isConnected)document.addEventListener('pointerdown',onOutside,true)},0)
  const expressionEl = pad.querySelector<HTMLElement>('.amountExpression')!
  const resultEl = pad.querySelector<HTMLElement>('.amountEquationResult')!
  const showPreview=()=>{
    expressionEl.textContent=draftValue||'0'
    const hasOperator=/[+\-*/()]/.test(draftValue.slice(1))||/[*/()]/.test(draftValue)
    const result=hasOperator?evaluateAmountExpression(draftValue):null
    resultEl.textContent=result===null?'':`= ${result}`
    resultEl.classList.remove('error')
  }
  const calculate=()=>{
    const result=evaluateAmountExpression(draftValue)
    if(result===null){resultEl.textContent='Invalid equation';resultEl.classList.add('error');return null}
    draftValue=String(result)
    setReactInputValue(input,draftValue)
    showPreview()
    return result
  }
  pad.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.key || ''
    if(key==='equals'){calculate();return}
    if(key==='clear'){draftValue='';setReactInputValue(input,'');showPreview();return}
    if(key==='back'){draftValue=draftValue.slice(0,-1);showPreview();return}
    if(key==='.'){
      const current=draftValue.split(/[+\-*/()]/).pop()||''
      if(!current.includes('.'))draftValue+=current?' .'.trim(): '0.'
      showPreview();return
    }
    if(/[+\-*/]/.test(key)){
      if(!draftValue&&key!=='-')return
      if(/[+\-*/.]$/.test(draftValue)&&!(key==='-'&&/[*/+(]$/.test(draftValue)))draftValue=draftValue.slice(0,-1)+key
      else draftValue+=key
      showPreview();return
    }
    if(key==='('||key===')'){draftValue+=key;showPreview();return}
    draftValue=draftValue==='0'?key:draftValue+key
    showPreview()
  }))
  pad.querySelector<HTMLButtonElement>('.amountKeypadOk')?.addEventListener('click', () => {
    if(calculate()===null)return
    closePad()
    nextAfterAmount(sheet)
  })
  showPreview()
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

import { loadData, Currency } from './db'

const transactionSheetSelector = '.sheet.refSheet'
let amountPadCleanup:(()=>void)|null=null
let usdToLbpRate=89500

function isTransactionSheet(sheet: Element) {
  return sheet.querySelector('h2')?.textContent?.includes('Transaction') ?? false
}

function revealField(field: HTMLElement) {
  const scroll=()=>{
    if(!field.isConnected)return
    field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }
  requestAnimationFrame(scroll)
  window.setTimeout(scroll,120)
  window.setTimeout(scroll,320)
  window.setTimeout(scroll,560)
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function accountSelect(sheet:Element){
  const accountLabel=Array.from(sheet.querySelectorAll('label')).find(label=>label.textContent?.trim().startsWith('Account'))
  return accountLabel?.querySelector<HTMLSelectElement>('select')||null
}

function accountCurrency(sheet:Element):Currency{
  const select=accountSelect(sheet)
  const text=select?.selectedOptions[0]?.textContent||''
  return /\bLBP\b/i.test(text)?'LBP':'USD'
}

function amountPlaceholder(currency:Currency){
  return currency==='LBP'?'LBP 0':'$ 0.00'
}

function convertAmount(value:number,from:Currency,to:Currency){
  if(from===to)return to==='LBP'?Math.round(value):Math.round(value*100)/100
  const converted=from==='USD'?value*usdToLbpRate:value/usdToLbpRate
  return to==='LBP'?Math.round(converted):Math.round(converted*100)/100
}

function formatAmount(value:number,currency:Currency){
  return currency==='LBP'?`${Math.round(value).toLocaleString()} LBP`:`$${value.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2})}`
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
  const walletCurrency=accountCurrency(sheet)
  let entryCurrency:Currency=walletCurrency
  let draftValue = input.value || ''
  const pad = document.createElement('div')
  pad.className = 'spenzaAmountKeypad'
  pad.innerHTML = `<div class="amountKeypadHandle"></div><div class="amountCurrencyRow"><span>Enter amount in</span><div class="amountCurrencyToggle"><button type="button" data-currency="USD">USD $</button><button type="button" data-currency="LBP">LBP</button></div></div><div class="amountKeypadDisplay"><span class="amountExpression">${draftValue || '0'}</span><small class="amountEquationResult"></small><small class="amountCurrencyConversion"></small></div><div class="amountKeypadGrid"><button data-key="7">7</button><button data-key="8">8</button><button data-key="9">9</button><button data-key="/" class="amountOperator">÷</button><button data-key="4">4</button><button data-key="5">5</button><button data-key="6">6</button><button data-key="*" class="amountOperator">×</button><button data-key="1">1</button><button data-key="2">2</button><button data-key="3">3</button><button data-key="-" class="amountOperator">−</button><button data-key=".">.</button><button data-key="0">0</button><button data-key="back" aria-label="Delete">⌫</button><button data-key="+" class="amountOperator">+</button><button data-key="(" class="amountOperator">(</button><button data-key=")" class="amountOperator">)</button><button data-key="clear" class="amountOperator">C</button><button data-key="equals" class="amountEquals">=</button></div><button class="amountKeypadOk">Use Amount</button>`
  document.body.appendChild(pad)
  const onOutside=(event:PointerEvent)=>{const target=event.target as Node|null;if(!target||pad.contains(target)||input.contains(target))return;closePad()}
  const closePad=()=>{document.removeEventListener('pointerdown',onOutside,true);if(pad.isConnected)pad.remove();if(amountPadCleanup===closePad)amountPadCleanup=null}
  amountPadCleanup=closePad
  window.setTimeout(()=>{if(pad.isConnected)document.addEventListener('pointerdown',onOutside,true)},0)
  const expressionEl = pad.querySelector<HTMLElement>('.amountExpression')!
  const resultEl = pad.querySelector<HTMLElement>('.amountEquationResult')!
  const conversionEl = pad.querySelector<HTMLElement>('.amountCurrencyConversion')!
  const currencyButtons=Array.from(pad.querySelectorAll<HTMLButtonElement>('[data-currency]'))
  const syncCurrencyButtons=()=>currencyButtons.forEach(button=>button.classList.toggle('selected',button.dataset.currency===entryCurrency))
  const showPreview=()=>{
    expressionEl.textContent=draftValue||'0'
    const hasOperator=/[+\-*/()]/.test(draftValue.slice(1))||/[*/()]/.test(draftValue)
    const result=evaluateAmountExpression(draftValue)
    resultEl.textContent=hasOperator&&result!==null?`= ${formatAmount(result,entryCurrency)}`:''
    resultEl.classList.remove('error')
    if(result!==null&&entryCurrency!==walletCurrency){const converted=convertAmount(result,entryCurrency,walletCurrency);conversionEl.textContent=`Saved as ${formatAmount(converted,walletCurrency)} · 1 USD = ${usdToLbpRate.toLocaleString()} LBP`}
    else conversionEl.textContent=walletCurrency===entryCurrency?`Account currency: ${walletCurrency}`:''
  }
  const calculate=(commitToInput=true)=>{
    const result=evaluateAmountExpression(draftValue)
    if(result===null){resultEl.textContent='Invalid equation';resultEl.classList.add('error');return null}
    draftValue=String(result)
    if(commitToInput){const converted=convertAmount(result,entryCurrency,walletCurrency);setReactInputValue(input,String(converted))}
    showPreview()
    return result
  }
  currencyButtons.forEach(button=>button.addEventListener('click',()=>{
    const next=button.dataset.currency as Currency
    if(next===entryCurrency)return
    entryCurrency=next
    syncCurrencyButtons()
    showPreview()
  }))
  pad.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.key || ''
    if(key==='equals'){calculate(false);return}
    if(key==='clear'){draftValue='';setReactInputValue(input,'');showPreview();return}
    if(key==='back'){draftValue=draftValue.slice(0,-1);showPreview();return}
    if(key==='.'){
      const current=draftValue.split(/[+\-*/()]/).pop()||''
      if(!current.includes('.'))draftValue+=current?'.':'0.'
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
    if(calculate(true)===null)return
    closePad()
  })
  syncCurrencyButtons()
  showPreview()
}

function prepareAmount(sheet: Element) {
  const amount = sheet.querySelector<HTMLInputElement>('input.amountInput')
  if (!amount || amount.dataset.customKeypad === 'true') return
  amount.dataset.customKeypad = 'true'
  amount.setAttribute('inputmode', 'none')
  amount.setAttribute('readonly', 'true')

  let currentCurrency=accountCurrency(sheet)
  const syncAccountAmount=()=>{
    const nextCurrency=accountCurrency(sheet)
    amount.placeholder=amountPlaceholder(nextCurrency)
    if(nextCurrency!==currentCurrency){
      const currentAmount=Number(amount.value)
      if(amount.value.trim()!==''&&Number.isFinite(currentAmount)){
        setReactInputValue(amount,String(convertAmount(currentAmount,currentCurrency,nextCurrency)))
      }
      currentCurrency=nextCurrency
    }
  }
  syncAccountAmount()
  const select=accountSelect(sheet)
  select?.addEventListener('change',()=>window.setTimeout(syncAccountAmount,0))

  sheet.addEventListener('focusin',event=>{
    const target=event.target
    if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement){
      revealField(target)
    }
  })

  amount.addEventListener('click', () => openAmountKeypad(amount, sheet))
  amount.addEventListener('focus', () => openAmountKeypad(amount, sheet))
  window.setTimeout(() => { syncAccountAmount(); amount.focus({ preventScroll: true }); revealField(amount) }, 80)
}

export function initTransactionFormKeyboard() {
  void loadData().then(data=>{usdToLbpRate=data.usdToLbpRate||89500}).catch(()=>{})

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

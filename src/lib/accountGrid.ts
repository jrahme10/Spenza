const SHEET='.sheet.refSheet'

function transactionSheet(el:Element){return el.querySelector('h2')?.textContent?.includes('Transaction')??false}
function findAccountSelect(sheet:Element){return Array.from(sheet.querySelectorAll<HTMLSelectElement>('select')).find(select=>select.closest('label')?.childNodes[0]?.textContent?.trim()==='Account')}
function setSelectValue(select:HTMLSelectElement,value:string){const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;setter?.call(select,value);select.dispatchEvent(new Event('change',{bubbles:true}))}
function optionLabel(option?:HTMLOptionElement|null){if(!option||!option.value)return '';return option.textContent?.trim()||''}
function syncInput(select:HTMLSelectElement,input:HTMLInputElement){input.value=optionLabel(select.selectedOptions[0])}

function openAccountPanel(select:HTMLSelectElement,input:HTMLInputElement){
 document.querySelector('.spenzaAccountSheet')?.remove()
 input.blur()
 const root=document.createElement('div')
 root.className='spenzaAccountSheet'
 const handle=document.createElement('div');handle.className='accountSheetHandle'
 const head=document.createElement('div');head.className='accountSheetHead'
 const left=document.createElement('span')
 const title=document.createElement('b');title.textContent='Account'
 const close=document.createElement('button');close.type='button';close.className='accountSheetClose';close.setAttribute('aria-label','Close account picker');close.textContent='×'
 head.append(left,title,close)
 const options=document.createElement('div');options.className='accountOptions'
 const accountOptions=Array.from(select.options).filter(option=>option.value)
 if(!accountOptions.length){const empty=document.createElement('div');empty.className='accountEmpty';empty.textContent='No accounts available.';options.appendChild(empty)}
 for(const option of accountOptions){
  const button=document.createElement('button');button.type='button';button.dataset.value=option.value
  const match=option.textContent?.match(/^(.*?)\s*\((.*?)\)\s*$/)
  const name=match?.[1]?.trim()||option.textContent?.trim()||'Account'
  const currency=match?.[2]?.trim()||''
  const nameEl=document.createElement('span');nameEl.textContent=name
  button.appendChild(nameEl)
  if(currency){const currencyEl=document.createElement('small');currencyEl.textContent=currency;button.appendChild(currencyEl)}
  button.classList.toggle('selected',option.value===select.value)
  button.addEventListener('click',()=>{setSelectValue(select,option.value);syncInput(select,input);root.remove();document.dispatchEvent(new CustomEvent('spenza-account-selected',{detail:{select}}))})
  options.appendChild(button)
 }
 close.addEventListener('click',()=>root.remove())
 root.append(handle,head,options)
 document.body.appendChild(root)
}

function prepare(){
 document.querySelectorAll(SHEET).forEach(sheet=>{
  if(!transactionSheet(sheet))return
  const select=findAccountSelect(sheet)
  if(!select||select.dataset.accountPanel==='1')return
  select.dataset.accountPanel='1'
  const label=select.closest('label')!
  label.classList.add('spenzaAccountField')
  const input=document.createElement('input')
  input.type='text'
  input.className='spenzaAccountInput'
  input.readOnly=true
  input.inputMode='none'
  input.placeholder='Select Account'
  input.setAttribute('aria-label','Select Account')
  syncInput(select,input)
  select.insertAdjacentElement('beforebegin',input)
  const open=()=>openAccountPanel(select,input)
  input.addEventListener('click',open)
  input.addEventListener('focus',()=>{input.blur();open()})
  select.addEventListener('change',()=>syncInput(select,input))
 })
}

export function initAccountGrid(){new MutationObserver(prepare).observe(document.body,{childList:true,subtree:true});prepare()}

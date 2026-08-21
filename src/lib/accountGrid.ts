const SHEET='.sheet.refSheet'

function transactionSheet(el:Element){return el.querySelector('h2')?.textContent?.includes('Transaction')??false}
function findAccountSelect(sheet:Element){return Array.from(sheet.querySelectorAll<HTMLSelectElement>('select')).find(select=>select.closest('label')?.childNodes[0]?.textContent?.trim()==='Account')}
function setSelectValue(select:HTMLSelectElement,value:string){const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;setter?.call(select,value);select.dispatchEvent(new Event('change',{bubbles:true}))}
function optionLabel(select:HTMLSelectElement){const option=Array.from(select.options).find(x=>x.value===select.value);return option?.value?option.textContent?.trim()||'':'Select Account'}
function closePicker(){document.querySelector('.spenzaAccountSheet')?.remove()}

function openPicker(select:HTMLSelectElement,input:HTMLInputElement){
 closePicker()
 input.blur()
 const options=Array.from(select.options).filter(option=>option.value)
 const root=document.createElement('div')
 root.className='spenzaAccountSheet'
 root.innerHTML='<div class="accountSheetHandle"></div><div class="accountSheetHead"><span></span><b>Select Account</b><button class="accountSheetClose" type="button" aria-label="Close">×</button></div><div class="accountOptions"></div>'
 document.body.appendChild(root)
 const list=root.querySelector<HTMLElement>('.accountOptions')!
 for(const option of options){
  const button=document.createElement('button')
  button.type='button'
  button.dataset.value=option.value
  const match=option.textContent?.match(/^(.*?)\s*\((.*?)\)\s*$/)
  const name=match?.[1]?.trim()||option.textContent?.trim()||'Account'
  const currency=match?.[2]?.trim()||''
  button.className=option.value===select.value?'selected':''
  button.innerHTML=`<span>${name}</span>${currency?`<small>${currency}</small>`:''}`
  button.onclick=()=>{
   setSelectValue(select,option.value)
   input.value=option.textContent?.trim()||name
   closePicker()
  }
  list.appendChild(button)
 }
 if(!options.length){list.innerHTML='<div class="accountEmpty">No accounts available.</div>'}
 root.querySelector<HTMLButtonElement>('.accountSheetClose')!.onclick=closePicker
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
  input.value=optionLabel(select)||'Select Account'
  input.setAttribute('aria-label','Account')
  select.insertAdjacentElement('afterend',input)
  select.addEventListener('change',()=>{input.value=optionLabel(select)||'Select Account'})
  const open=()=>openPicker(select,input)
  input.addEventListener('click',open)
  input.addEventListener('focus',open)
 })
}

export function initAccountGrid(){new MutationObserver(prepare).observe(document.body,{childList:true,subtree:true});prepare()}

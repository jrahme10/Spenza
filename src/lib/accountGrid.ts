const SHEET='.sheet.refSheet'

function transactionSheet(el:Element){return el.querySelector('h2')?.textContent?.includes('Transaction')??false}
function findAccountSelect(sheet:Element){return Array.from(sheet.querySelectorAll<HTMLSelectElement>('select')).find(select=>select.closest('label')?.childNodes[0]?.textContent?.trim()==='Account')}
function setSelectValue(select:HTMLSelectElement,value:string){const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;setter?.call(select,value);select.dispatchEvent(new Event('change',{bubbles:true}))}
function syncGrid(select:HTMLSelectElement,grid:HTMLElement){grid.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.classList.toggle('selected',button.dataset.value===select.value))}

function prepare(){
 document.querySelectorAll(SHEET).forEach(sheet=>{
  if(!transactionSheet(sheet))return
  const select=findAccountSelect(sheet)
  if(!select||select.dataset.accountGrid==='1')return
  select.dataset.accountGrid='1'
  const label=select.closest('label')!
  label.classList.add('spenzaAccountField')
  const grid=document.createElement('div')
  grid.className='spenzaAccountGrid'
  Array.from(select.options).filter(option=>option.value).forEach(option=>{
   const button=document.createElement('button')
   button.type='button'
   button.dataset.value=option.value
   const match=option.textContent?.match(/^(.*?)\s*\((.*?)\)\s*$/)
   const name=match?.[1]?.trim()||option.textContent||'Account'
   const currency=match?.[2]?.trim()||''
   button.innerHTML=`<span>${name}</span>${currency?`<small>${currency}</small>`:''}`
   button.onclick=()=>{setSelectValue(select,option.value);syncGrid(select,grid)}
   grid.appendChild(button)
  })
  select.insertAdjacentElement('afterend',grid)
  select.addEventListener('change',()=>syncGrid(select,grid))
  syncGrid(select,grid)
 })
}

export function initAccountGrid(){new MutationObserver(prepare).observe(document.body,{childList:true,subtree:true});prepare()}

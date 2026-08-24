const SHEET='.sheet.refSheet'
let datePickerCleanup:(()=>void)|null=null

function transactionSheet(el:Element){return el.querySelector('h2')?.textContent?.includes('Transaction')??false}
function findDateInput(sheet:Element){return Array.from(sheet.querySelectorAll<HTMLInputElement>('input[type="date"]')).find(input=>input.closest('label')?.textContent?.trim().startsWith('Date'))}
function setInputValue(input:HTMLInputElement,value:string){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}
function monthKey(date:string){return date?.slice(0,7)||new Date().toISOString().slice(0,7)}
function daysInMonth(year:number,month:number){return new Date(year,month,0).getDate()}

function clearFieldFocus(sheet:Element,input:HTMLInputElement){
 input.blur()
 const active=document.activeElement
 if(active instanceof HTMLElement&&sheet.contains(active))active.blur()
 const sheetEl=sheet as HTMLElement
 if(!sheetEl.hasAttribute('tabindex'))sheetEl.tabIndex=-1
 requestAnimationFrame(()=>sheetEl.focus({preventScroll:true}))
}

function openDatePicker(input:HTMLInputElement,sheet:Element){
 datePickerCleanup?.()
 input.blur()
 let viewMonth=monthKey(input.value)
 const root=document.createElement('div')
 root.className='spenzaTransactionDatePicker'
 root.innerHTML='<div class="transactionDateHandle"></div><div class="transactionDateHead"><button type="button" class="transactionDatePrev">‹</button><b class="transactionDateTitle"></b><button type="button" class="transactionDateNext">›</button></div><div class="transactionDateWeekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="transactionDateGrid"></div><button type="button" class="transactionDateClose">Close</button>'
 document.body.appendChild(root)
 const onOutside=(event:PointerEvent)=>{const target=event.target as Node|null;if(!target||root.contains(target)||input.contains(target))return;closePicker()}
 const closePicker=()=>{document.removeEventListener('pointerdown',onOutside,true);if(root.isConnected)root.remove();if(datePickerCleanup===closePicker)datePickerCleanup=null;clearFieldFocus(sheet,input)}
 datePickerCleanup=closePicker
 window.setTimeout(()=>{if(root.isConnected)document.addEventListener('pointerdown',onOutside,true)},0)
 const title=root.querySelector<HTMLElement>('.transactionDateTitle')!
 const grid=root.querySelector<HTMLElement>('.transactionDateGrid')!
 const render=()=>{
  const [year,month]=viewMonth.split('-').map(Number)
  title.textContent=new Date(year,month-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})
  grid.innerHTML=''
  const firstDay=new Date(year,month-1,1).getDay()
  for(let i=0;i<firstDay;i++){const spacer=document.createElement('span');spacer.className='transactionDateEmpty';grid.appendChild(spacer)}
  for(let day=1;day<=daysInMonth(year,month);day++){
   const value=`${viewMonth}-${String(day).padStart(2,'0')}`
   const button=document.createElement('button')
   button.type='button';button.textContent=String(day)
   if(value===input.value)button.classList.add('selected')
   button.onclick=()=>{setInputValue(input,value);closePicker()}
   grid.appendChild(button)
  }
 }
 const shift=(delta:number)=>{const [year,month]=viewMonth.split('-').map(Number);const d=new Date(year,month-1+delta,1);viewMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;render()}
 root.querySelector<HTMLButtonElement>('.transactionDatePrev')!.onclick=()=>shift(-1)
 root.querySelector<HTMLButtonElement>('.transactionDateNext')!.onclick=()=>shift(1)
 root.querySelector<HTMLButtonElement>('.transactionDateClose')!.onclick=closePicker
 render()
}

function prepare(){document.querySelectorAll(SHEET).forEach(sheet=>{if(!transactionSheet(sheet))return;const input=findDateInput(sheet);if(!input||input.dataset.transactionDatePicker==='1')return;input.dataset.transactionDatePicker='1';input.readOnly=true;input.inputMode='none';const open=()=>openDatePicker(input,sheet);input.addEventListener('click',open);input.addEventListener('focus',()=>{input.blur();open()})})}

export function initTransactionDatePicker(){
 new MutationObserver(()=>{prepare();if(!Array.from(document.querySelectorAll(SHEET)).some(transactionSheet))datePickerCleanup?.()}).observe(document.body,{childList:true,subtree:true});prepare()
}

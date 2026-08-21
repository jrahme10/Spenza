const SHEET='.sheet.refSheet'

function transactionSheet(el:Element){return el.querySelector('h2')?.textContent?.includes('Transaction')??false}
function findDateInput(sheet:Element){return Array.from(sheet.querySelectorAll<HTMLInputElement>('input[type="date"]')).find(input=>input.closest('label')?.textContent?.trim().startsWith('Date'))}
function setInputValue(input:HTMLInputElement,value:string){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}
function nextInput(sheet:Element,dateInput:HTMLInputElement){const fields=Array.from(sheet.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([type="file"]),textarea,select')).filter(x=>x.getClientRects().length);const index=fields.indexOf(dateInput);return fields.slice(index+1).find(x=>!x.hasAttribute('disabled'))}
function monthKey(date:string){return date?.slice(0,7)||new Date().toISOString().slice(0,7)}
function daysInMonth(year:number,month:number){return new Date(year,month,0).getDate()}

function openDatePicker(input:HTMLInputElement,sheet:Element){
 document.querySelector('.spenzaTransactionDatePicker')?.remove()
 input.blur()
 let viewMonth=monthKey(input.value)
 const root=document.createElement('div')
 root.className='spenzaTransactionDatePicker'
 root.innerHTML='<div class="transactionDateHandle"></div><div class="transactionDateHead"><button type="button" class="transactionDatePrev">‹</button><b class="transactionDateTitle"></b><button type="button" class="transactionDateNext">›</button></div><div class="transactionDateWeekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="transactionDateGrid"></div><button type="button" class="transactionDateClose">Close</button>'
 document.body.appendChild(root)
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
   button.onclick=()=>{setInputValue(input,value);root.remove();const next=nextInput(sheet,input);if(next){setTimeout(()=>{next.focus({preventScroll:true});next.scrollIntoView({behavior:'smooth',block:'center'})},80)}}
   grid.appendChild(button)
  }
 }
 const shift=(delta:number)=>{const [year,month]=viewMonth.split('-').map(Number);const d=new Date(year,month-1+delta,1);viewMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;render()}
 root.querySelector<HTMLButtonElement>('.transactionDatePrev')!.onclick=()=>shift(-1)
 root.querySelector<HTMLButtonElement>('.transactionDateNext')!.onclick=()=>shift(1)
 root.querySelector<HTMLButtonElement>('.transactionDateClose')!.onclick=()=>root.remove()
 render()
}

function prepare(){document.querySelectorAll(SHEET).forEach(sheet=>{if(!transactionSheet(sheet))return;const input=findDateInput(sheet);if(!input||input.dataset.transactionDatePicker==='1')return;input.dataset.transactionDatePicker='1';input.readOnly=true;input.inputMode='none';const open=()=>openDatePicker(input,sheet);input.addEventListener('click',open);input.addEventListener('focus',()=>{input.blur();open()})})}

export function initTransactionDatePicker(){
 new MutationObserver(prepare).observe(document.body,{childList:true,subtree:true});prepare()
 document.addEventListener('spenza-account-selected',(event)=>{const sheet=(event as CustomEvent<{sheet?:Element}>).detail?.sheet;if(!sheet)return;const input=findDateInput(sheet);if(!input)return;setTimeout(()=>{input.focus({preventScroll:true});openDatePicker(input,sheet)},100)})
}

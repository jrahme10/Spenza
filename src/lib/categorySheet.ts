const SHEET='.sheet.refSheet'

function transactionSheet(el:Element){return el.querySelector('h2')?.textContent?.includes('Transaction')??false}
function findCategorySelect(sheet:Element){return Array.from(sheet.querySelectorAll<HTMLSelectElement>('select')).find(select=>select.closest('label')?.childNodes[0]?.textContent?.trim()==='Category')}
function optionLabel(option?:HTMLOptionElement|null){return option?.textContent?.trim()||''}
function setSelectValue(select:HTMLSelectElement,value:string){const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;setter?.call(select,value);select.dispatchEvent(new Event('change',{bubbles:true}))}
function syncInput(select:HTMLSelectElement,input:HTMLInputElement){input.value=optionLabel(select.selectedOptions[0])}
function groups(values:string[]){const map=new Map<string,string[]>();for(const raw of values){const [main,...rest]=raw.split('>').map(v=>v.trim());if(!main)continue;const sub=rest.join(' > ')||'General';const list=map.get(main)||[];if(!list.includes(sub))list.push(sub);map.set(main,list)}return map}

function openAccountNext(sheet:Element){
 window.setTimeout(()=>{
  const accountInput=sheet.querySelector<HTMLInputElement>('input.spenzaAccountInput')
  if(accountInput){accountInput.focus({preventScroll:true});accountInput.scrollIntoView({behavior:'smooth',block:'center'});document.dispatchEvent(new CustomEvent('spenza-open-account-picker',{detail:{input:accountInput}}));return}
  document.dispatchEvent(new CustomEvent('spenza-open-account-picker',{detail:{sheet}}))
 },100)
}

function openPicker(select:HTMLSelectElement,input:HTMLInputElement,sheet:Element){
 document.querySelector('.spenzaCategorySheet')?.remove();input.blur()
 const values=Array.from(select.options).filter(o=>o.value).map(o=>o.value)
 const all=groups(values)
 const root=document.createElement('div');root.className='spenzaCategorySheet';root.innerHTML='<div class="categorySheetHandle"></div><div class="categorySheetViewport"><div class="categorySheetTrack"><section class="categoryStep categoryMainStep"><div class="categorySheetHead"><span></span><b>Category</b><button class="categoryClose" type="button">×</button></div><div class="categoryOptions categoryMainOptions"></div></section><section class="categoryStep categorySubStep"><div class="categorySheetHead"><button class="categoryBack" type="button">‹ Back</button><b>Subcategory</b><span></span></div><div class="categoryOptions categorySubOptions"></div></section></div></div>';document.body.appendChild(root)
 const track=root.querySelector<HTMLElement>('.categorySheetTrack')!;const mains=root.querySelector<HTMLElement>('.categoryMainOptions')!;const subs=root.querySelector<HTMLElement>('.categorySubOptions')!
 const finish=(value:string)=>{setSelectValue(select,value);syncInput(select,input);root.remove();openAccountNext(sheet)}
 const showSubs=(main:string,items:string[])=>{subs.innerHTML='';for(const name of items.filter(x=>x!=='General')){const button=document.createElement('button');button.type='button';button.textContent=name;button.onclick=()=>finish(`${main} > ${name}`);subs.appendChild(button)}track.style.transform='translateX(-50%)'}
 for(const [main,items] of all){const button=document.createElement('button');button.type='button';button.textContent=main;button.classList.toggle('selected',select.value===main||select.value.startsWith(`${main} > `));button.onclick=()=>{const real=items.filter(x=>x!=='General');if(real.length)showSubs(main,items);else finish(main)};mains.appendChild(button)}
 root.querySelector<HTMLButtonElement>('.categoryBack')!.onclick=()=>{track.style.transform='translateX(0)'}
 root.querySelector<HTMLButtonElement>('.categoryClose')!.onclick=()=>root.remove()
}

function prepare(){
 document.querySelectorAll(SHEET).forEach(sheet=>{
  if(!transactionSheet(sheet))return
  const select=findCategorySelect(sheet)
  if(!select||select.dataset.categoryPanel==='1')return
  select.dataset.categoryPanel='1'
  if(select.disabled)return
  const control=select.parentElement
  if(!control)return
  const input=document.createElement('input')
  input.type='text';input.className='spenzaCategoryInput';input.readOnly=true;input.inputMode='none';input.placeholder='Select category';input.setAttribute('aria-label','Select category');syncInput(select,input)
  select.insertAdjacentElement('beforebegin',input)
  const open=()=>openPicker(select,input,sheet)
  input.addEventListener('click',open)
  input.addEventListener('focus',()=>{input.blur();open()})
  select.addEventListener('change',()=>syncInput(select,input))
 })
}

export function initCategorySheet(){new MutationObserver(prepare).observe(document.body,{childList:true,subtree:true});prepare()}

const SHEET='.sheet.refSheet'
const FIELD='input.spenzaCategoryInput'

function transactionSheet(el:Element){return el.querySelector('h2')?.textContent?.includes('Transaction')??false}
function groups(values:string[]){
 const map=new Map<string,string[]>()
 for(const raw of values){const [main,...rest]=raw.split('>').map(v=>v.trim());if(!main)continue;const sub=rest.join(' > ')||'General';const list=map.get(main)||[];if(!list.includes(sub))list.push(sub);map.set(main,list)}
 return map
}
function setValue(input:HTMLInputElement,value:string){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))}
function openAccountNext(sheet:Element){
 window.setTimeout(()=>{
  const accountInput=sheet.querySelector<HTMLInputElement>('input.spenzaAccountInput')
  if(accountInput){
   accountInput.scrollIntoView({behavior:'smooth',block:'center'})
   document.dispatchEvent(new CustomEvent('spenza-open-account-picker',{detail:{input:accountInput}}))
   return
  }
  document.dispatchEvent(new CustomEvent('spenza-open-account-picker',{detail:{sheet}}))
 },120)
}

function openPicker(input:HTMLInputElement,sheet:Element,values:string[]){
 document.querySelector('.spenzaCategorySheet')?.remove();input.blur();const all=groups(values)
 const root=document.createElement('div');root.className='spenzaCategorySheet';root.innerHTML='<div class="categorySheetHandle"></div><div class="categorySheetViewport"><div class="categorySheetTrack"><section class="categoryStep categoryMainStep"><div class="categorySheetHead"><span></span><b>Category</b><button class="categoryClose" type="button">×</button></div><div class="categoryOptions categoryMainOptions"></div></section><section class="categoryStep categorySubStep"><div class="categorySheetHead"><button class="categoryBack" type="button">‹ Back</button><b>Subcategory</b><span></span></div><div class="categoryOptions categorySubOptions"></div></section></div></div>';document.body.appendChild(root)
 const track=root.querySelector<HTMLElement>('.categorySheetTrack')!;const mains=root.querySelector<HTMLElement>('.categoryMainOptions')!;const subs=root.querySelector<HTMLElement>('.categorySubOptions')!
 const finish=(value:string)=>{setValue(input,value);root.remove();openAccountNext(sheet)}
 const showSubs=(main:string,items:string[])=>{subs.innerHTML='';const real=items.filter(x=>x!=='General');for(const name of real){const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=()=>finish(`${main} > ${name}`);subs.appendChild(b)};track.style.transform='translateX(-50%)'}
 for(const [main,items] of all){const b=document.createElement('button');b.type='button';b.textContent=main;b.onclick=()=>{const real=items.filter(x=>x!=='General');if(real.length)showSubs(main,items);else finish(main)};mains.appendChild(b)}
 root.querySelector<HTMLButtonElement>('.categoryBack')!.onclick=()=>{track.style.transform='translateX(0)'}
 root.querySelector<HTMLButtonElement>('.categoryClose')!.onclick=()=>root.remove()
}

export function initCategorySheet(){
 const prepare=()=>document.querySelectorAll(SHEET).forEach(sheet=>{if(!transactionSheet(sheet))return;const input=sheet.querySelector<HTMLInputElement>(FIELD);if(!input||input.dataset.categorySheet==='1')return;input.dataset.categorySheet='1';input.readOnly=true;input.inputMode='none';const open=()=>{const values=(input.dataset.categories||'').split('\u001f').filter(Boolean);openPicker(input,sheet,values)};input.addEventListener('click',open);input.addEventListener('focus',()=>{input.blur();open()})})
 new MutationObserver(prepare).observe(document.body,{childList:true,subtree:true});prepare()
}

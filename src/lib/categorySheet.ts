const SHEET='.sheet.refSheet'
const FIELD='input.spenzaCategoryInput'

function transactionSheet(el:Element){return el.querySelector('h2')?.textContent?.includes('Transaction')??false}
function groups(values:string[]){
 const map=new Map<string,string[]>()
 for(const raw of values){const [main,...rest]=raw.split('>').map(v=>v.trim());if(!main)continue;const sub=rest.join(' > ')||'General';const list=map.get(main)||[];if(!list.includes(sub))list.push(sub);map.set(main,list)}
 return map
}
function setValue(input:HTMLInputElement,value:string){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))}
function focusNext(sheet:Element,input:HTMLElement){const fields=Array.from(sheet.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([type="file"]),select,textarea')).filter(x=>x.getClientRects().length&&x!==input);const account=fields.find(x=>x.closest('label')?.textContent?.trim().startsWith('Account'));if(account){account.focus({preventScroll:true});setTimeout(()=>account.scrollIntoView({behavior:'smooth',block:'center'}),80)}}

function openPicker(input:HTMLInputElement,sheet:Element,values:string[]){
 document.querySelector('.spenzaCategorySheet')?.remove();input.blur();const all=groups(values);let main=(input.value.split('>')[0]||'').trim();if(!all.has(main))main='';let sub='';let step=0
 const root=document.createElement('div');root.className='spenzaCategorySheet';root.innerHTML='<div class="categorySheetHandle"></div><div class="categorySheetViewport"><div class="categorySheetTrack"><section class="categoryStep categoryMainStep"><div class="categorySheetHead"><b>Category</b><button class="categoryClose" type="button">×</button></div><div class="categoryOptions categoryMainOptions"></div><button class="categoryNext" type="button" disabled>Next</button></section><section class="categoryStep categorySubStep"><div class="categorySheetHead"><button class="categoryBack" type="button">‹ Back</button><b>Subcategory</b><span></span></div><div class="categoryOptions categorySubOptions"></div><button class="categoryDone" type="button" disabled>OK</button></section></div></div>';document.body.appendChild(root)
 const track=root.querySelector<HTMLElement>('.categorySheetTrack')!;const mains=root.querySelector<HTMLElement>('.categoryMainOptions')!;const subs=root.querySelector<HTMLElement>('.categorySubOptions')!;const next=root.querySelector<HTMLButtonElement>('.categoryNext')!;const done=root.querySelector<HTMLButtonElement>('.categoryDone')!
 const selectMain=(name:string)=>{main=name;sub='';mains.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.textContent===name));next.disabled=false}
 for(const name of all.keys()){const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=()=>selectMain(name);mains.appendChild(b)}
 if(main)selectMain(main)
 const showSubs=()=>{subs.innerHTML='';sub='';for(const name of all.get(main)||['General']){const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=()=>{sub=name;subs.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));done.disabled=false};subs.appendChild(b)};step=1;track.style.transform='translateX(-50%)'}
 next.onclick=showSubs;root.querySelector<HTMLButtonElement>('.categoryBack')!.onclick=()=>{step=0;track.style.transform='translateX(0)'};root.querySelector<HTMLButtonElement>('.categoryClose')!.onclick=()=>root.remove();done.onclick=()=>{if(!main||!sub)return;setValue(input,sub==='General'?main:`${main} > ${sub}`);root.remove();focusNext(sheet,input)}
}

export function initCategorySheet(){
 const prepare=()=>document.querySelectorAll(SHEET).forEach(sheet=>{if(!transactionSheet(sheet))return;const input=sheet.querySelector<HTMLInputElement>(FIELD);if(!input||input.dataset.categorySheet==='1')return;input.dataset.categorySheet='1';input.readOnly=true;input.inputMode='none';input.addEventListener('click',()=>{const values=(input.dataset.categories||'').split('\u001f').filter(Boolean);openPicker(input,sheet,values)});input.addEventListener('focus',()=>{input.blur();const values=(input.dataset.categories||'').split('\u001f').filter(Boolean);openPicker(input,sheet,values)})})
 new MutationObserver(prepare).observe(document.body,{childList:true,subtree:true});prepare()
}

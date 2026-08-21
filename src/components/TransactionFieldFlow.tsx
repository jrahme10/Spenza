import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Targets={sheet:HTMLElement;categorySelect:HTMLSelectElement;categoryHost:HTMLElement;accountSelect:HTMLSelectElement;accountHost:HTMLElement}

function isTransactionSheet(el:Element){return el.querySelector('h2')?.textContent?.includes('Transaction')??false}
function selectByLabel(sheet:HTMLElement,labelName:string){
 const label=Array.from(sheet.querySelectorAll('label')).find(x=>x.textContent?.trim().startsWith(labelName))
 return label?.querySelector<HTMLSelectElement>('select')||null
}
function findTargets():Targets|null{
 const sheet=Array.from(document.querySelectorAll<HTMLElement>('.sheet.refSheet')).find(isTransactionSheet)
 if(!sheet)return null
 const categorySelect=selectByLabel(sheet,'Category')
 const accountSelect=selectByLabel(sheet,'Account')
 if(!categorySelect||!accountSelect)return null
 const categoryHost=categorySelect.parentElement
 const accountHost=accountSelect.closest('label') as HTMLElement|null
 if(!categoryHost||!accountHost)return null
 return {sheet,categorySelect,categoryHost,accountSelect,accountHost}
}
function nativeSetSelect(select:HTMLSelectElement,value:string){
 const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set
 setter?.call(select,value)
 select.dispatchEvent(new Event('change',{bubbles:true}))
}
function optionText(select:HTMLSelectElement){return select.selectedOptions[0]?.textContent?.trim()||''}
function categoryGroups(select:HTMLSelectElement){
 const map=new Map<string,{raw:string;child:string}[]>()
 for(const option of Array.from(select.options)){
  if(!option.value)continue
  const raw=option.value
  const [parent,...rest]=raw.split('>').map(v=>v.trim()).filter(Boolean)
  if(!parent)continue
  const child=rest.join(' > ')
  const items=map.get(parent)||[]
  items.push({raw,child})
  map.set(parent,items)
 }
 return map
}

export default function TransactionFieldFlow(){
 const [targets,setTargets]=useState<Targets|null>(null)
 const [categoryOpen,setCategoryOpen]=useState(false)
 const [accountOpen,setAccountOpen]=useState(false)
 const [expanded,setExpanded]=useState('')
 const [version,setVersion]=useState(0)
 const accountInputRef=useRef<HTMLInputElement|null>(null)

 useEffect(()=>{
  const refresh=()=>setTargets(findTargets())
  const observer=new MutationObserver(refresh)
  observer.observe(document.body,{childList:true,subtree:true})
  refresh()
  return()=>observer.disconnect()
 },[])

 useEffect(()=>{
  if(!targets)return
  targets.categorySelect.dataset.categoryPanel='1'
  targets.accountSelect.dataset.accountPanel='1'
  targets.accountHost.classList.add('spenzaAccountField','spenzaFirstTransactionField')

  // Keep Account as the first form field, directly below the transaction type controls.
  // The original select remains React-controlled; only its label is repositioned visually.
  const firstField=Array.from(targets.sheet.children).find(el=>el.tagName==='LABEL')
  if(firstField&&firstField!==targets.accountHost)targets.sheet.insertBefore(targets.accountHost,firstField)

  return()=>{
   targets.categorySelect.removeAttribute('data-category-panel')
   targets.accountSelect.removeAttribute('data-account-panel')
   targets.accountHost.classList.remove('spenzaAccountField','spenzaFirstTransactionField')
  }
 },[targets])

 useEffect(()=>{
  if(!accountOpen||!targets)return
  const input=accountInputRef.current
  input?.scrollIntoView({behavior:'smooth',block:'center'})
  requestAnimationFrame(()=>input?.focus({preventScroll:true}))
 },[accountOpen,targets])

 const groups=useMemo(()=>targets?categoryGroups(targets.categorySelect):new Map<string,{raw:string;child:string}[]>(),[targets,version])
 if(!targets)return null

 const categoryValue=targets.categorySelect.value
 const accountValue=targets.accountSelect.value
 const chooseCategory=(raw:string)=>{
  nativeSetSelect(targets.categorySelect,raw)
  setVersion(v=>v+1)
  setExpanded('')
  setCategoryOpen(false)
  setAccountOpen(true)
 }
 const chooseParent=(parent:string,items:{raw:string;child:string}[])=>{
  const children=items.filter(x=>x.child)
  if(children.length){setExpanded(v=>v===parent?'':parent);return}
  chooseCategory(items[0]?.raw||parent)
 }
 const chooseAccount=(value:string)=>{
  nativeSetSelect(targets.accountSelect,value)
  setVersion(v=>v+1)
  setAccountOpen(false)
 }

 const categoryInput=createPortal(
  <input className="spenzaCategoryInput" value={optionText(targets.categorySelect)} readOnly inputMode="none" placeholder="Select category" aria-label="Select category" onClick={()=>{if(!targets.categorySelect.disabled){setAccountOpen(false);setExpanded('');setCategoryOpen(true)}}} onFocus={e=>{e.currentTarget.blur();if(!targets.categorySelect.disabled){setAccountOpen(false);setExpanded('');setCategoryOpen(true)}}}/>,
  targets.categoryHost
 )
 const accountInput=createPortal(
  <input ref={accountInputRef} className="spenzaAccountInput" value={optionText(targets.accountSelect)} readOnly inputMode="none" placeholder="Select Account" aria-label="Select Account" onClick={()=>{setCategoryOpen(false);setAccountOpen(true)}} onFocus={e=>{e.currentTarget.blur();setCategoryOpen(false);setAccountOpen(true)}}/>,
  targets.accountHost
 )

 return <>
  {categoryInput}
  {accountInput}
  {categoryOpen&&createPortal(<div className="spenzaCategorySheet" role="dialog" aria-modal="true" aria-label="Select category">
   <div className="categorySheetHandle"/>
   <div className="categorySheetHead"><span/><b>Category</b><button className="categoryClose" type="button" onClick={()=>{setCategoryOpen(false);setExpanded('')}}>×</button></div>
   <div className="categoryOptions">{Array.from(groups.entries()).map(([parent,items])=><div className="reactCategoryGroup" key={parent}>
    <button type="button" className={categoryValue===parent||categoryValue.startsWith(`${parent} > `)?'selected':''} onClick={()=>chooseParent(parent,items)}>{parent}</button>
    {expanded===parent&&items.filter(x=>x.child).length>0&&<div className="reactSubcategoryGrid">{items.filter(x=>x.child).map(item=><button type="button" className={categoryValue===item.raw?'selected':''} key={item.raw} onClick={()=>chooseCategory(item.raw)}>{item.child}</button>)}</div>}
   </div>)}</div>
  </div>,document.body)}
  {accountOpen&&createPortal(<div className="spenzaAccountSheet" role="dialog" aria-modal="true" aria-label="Select account">
   <div className="accountSheetHandle"/>
   <div className="accountSheetHead"><span/><b>Account</b><button className="accountSheetClose" type="button" onClick={()=>setAccountOpen(false)}>×</button></div>
   <div className="accountOptions">{Array.from(targets.accountSelect.options).filter(o=>o.value).map(option=>{const match=option.textContent?.match(/^(.*?)\s*\((.*?)\)\s*$/);const name=match?.[1]?.trim()||option.textContent?.trim()||'Account';const currency=match?.[2]?.trim()||'';return <button type="button" className={accountValue===option.value?'selected':''} key={option.value} onClick={()=>chooseAccount(option.value)}><span>{name}</span>{currency&&<small>{currency}</small>}</button>})}{!Array.from(targets.accountSelect.options).some(o=>o.value)&&<div className="accountEmpty">No accounts available.</div>}</div>
  </div>,document.body)}
 </>
}

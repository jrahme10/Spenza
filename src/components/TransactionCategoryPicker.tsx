import { useMemo, useState } from 'react'
import { ChevronLeft, Plus, X } from 'lucide-react'
import './TransactionCategoryPicker.css'

type Props={categories:string[];value:string;disabled?:boolean;onSelect:(value:string)=>void;onAddCategory:(value:string)=>void;onAdvance:()=>void}

const splitCategory=(value:string)=>{const parts=value.split(' > ').map(v=>v.trim()).filter(Boolean);return {parent:parts[0]||value,child:parts.slice(1).join(' > ')}}

export default function TransactionCategoryPicker({categories,value,disabled,onSelect,onAddCategory,onAdvance}:Props){
 const [open,setOpen]=useState(false)
 const [step,setStep]=useState<'category'|'subcategory'>('category')
 const [activeParent,setActiveParent]=useState('')
 const [addOpen,setAddOpen]=useState(false)
 const [addType,setAddType]=useState<'category'|'subcategory'>('category')
 const [addName,setAddName]=useState('')
 const [addParent,setAddParent]=useState('')
 const parsed=useMemo(()=>categories.map(raw=>({raw,...splitCategory(raw)})),[categories])
 const parents=useMemo(()=>Array.from(new Set(parsed.map(x=>x.parent).filter(Boolean))),[parsed])
 const childrenFor=(parent:string)=>parsed.filter(x=>x.parent===parent&&x.child)
 const directFor=(parent:string)=>parsed.find(x=>x.parent===parent&&!x.child)
 const finish=(next:string)=>{onSelect(next);setOpen(false);setStep('category');setActiveParent('');window.setTimeout(onAdvance,80)}
 const chooseParent=(parent:string)=>{const children=childrenFor(parent);if(children.length){setActiveParent(parent);setStep('subcategory');return}finish(directFor(parent)?.raw||parent)}
 const close=()=>{setOpen(false);setStep('category');setActiveParent('')}
 const closeCreator=()=>{setAddOpen(false);setAddName('');setAddParent('')}
 const openPanel=()=>{if(disabled)return;setStep('category');setActiveParent('');setOpen(true)}
 const selected=splitCategory(value)
 const subcategories=activeParent?childrenFor(activeParent):[]
 const direct=activeParent?directFor(activeParent):undefined
 const openCreator=()=>{setOpen(false);setAddType('category');setAddName('');setAddParent(parents[0]||'');setAddOpen(true)}
 const saveNewCategory=()=>{const name=addName.trim();if(!name)return;const next=addType==='subcategory'&&addParent?`${addParent} > ${name}`:name;onAddCategory(next);setAddOpen(false);setAddName('');setAddParent('')}

 if(disabled)return <label className="transactionCategoryField"><span>Category</span><input className="transactionCategoryInput" value="Transfer" readOnly disabled/></label>
 return <>
  <label className="transactionCategoryField"><span>Category</span><div className="transactionCategoryInputRow"><input className="transactionCategoryInput" value={value} readOnly inputMode="none" onClick={openPanel} onFocus={e=>{e.currentTarget.blur();openPanel()}} placeholder="Select category"/><button type="button" className="transactionCategoryAdd" onClick={openCreator} aria-label="Add category"><Plus size={16}/></button></div></label>
  {open&&<div className="transactionCategoryBackdrop" onPointerDown={close}>
   <div className="transactionCategorySheet" role="dialog" aria-modal="true" aria-label="Select category" onPointerDown={e=>e.stopPropagation()}>
    <div className="transactionCategoryHandle"/>
    <div className="transactionCategoryViewport"><div className={`transactionCategoryTrack ${step==='subcategory'?'showSubcategories':''}`}>
     <section className="transactionCategoryPanel"><div className="transactionCategorySheetHead"><span/><b>Category</b><button type="button" onClick={close} aria-label="Close"><X size={20}/></button></div><div className="transactionCategoryOptions">{parents.map(parent=><button type="button" className={selected.parent===parent?'selected':''} key={parent} onClick={()=>chooseParent(parent)}>{parent}</button>)}</div></section>
     <section className="transactionCategoryPanel"><div className="transactionCategorySheetHead"><button type="button" onClick={()=>setStep('category')}><ChevronLeft size={18}/> Back</button><b>{activeParent||'Subcategory'}</b><span/></div><div className="transactionCategoryOptions">{direct&&<button type="button" className={!selected.child&&selected.parent===activeParent?'selected':''} onClick={()=>finish(direct.raw)}>General</button>}{subcategories.map(item=><button type="button" className={value===item.raw?'selected':''} key={item.raw} onClick={()=>finish(item.raw)}>{item.child}</button>)}</div></section>
    </div></div>
   </div>
  </div>}
  {addOpen&&<div className="transactionCategoryBackdrop" onPointerDown={closeCreator}>
   <div className="transactionCategorySheet categoryCreatorSheet" role="dialog" aria-modal="true" aria-label="Add category" onPointerDown={e=>e.stopPropagation()}>
    <div className="transactionCategoryHandle"/><div className="categoryCreatorHead"><b>Add Category</b><button type="button" onClick={closeCreator} aria-label="Close"><X size={20}/></button></div>
    <div className="categoryCreatorTabs"><button type="button" className={addType==='category'?'selected':''} onClick={()=>setAddType('category')}>Category</button><button type="button" className={addType==='subcategory'?'selected':''} onClick={()=>{setAddType('subcategory');if(!addParent)setAddParent(parents[0]||'')}} disabled={!parents.length}>Subcategory</button></div>
    {addType==='subcategory'&&<label className="categoryCreatorField"><span>Parent category</span><select value={addParent} onChange={e=>setAddParent(e.target.value)}>{parents.map(parent=><option key={parent} value={parent}>{parent}</option>)}</select></label>}
    <label className="categoryCreatorField"><span>{addType==='subcategory'?'Subcategory name':'Category name'}</span><input autoFocus value={addName} onChange={e=>setAddName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveNewCategory()}} placeholder={addType==='subcategory'?'e.g. Restaurant':'e.g. Food'}/></label>
    <button type="button" className="categoryCreatorSave" onClick={saveNewCategory} disabled={!addName.trim()||(addType==='subcategory'&&!addParent)}>Add {addType==='subcategory'?'Subcategory':'Category'}</button>
   </div>
  </div>}
 </>
}

import { useMemo, useState } from 'react'
import { ChevronLeft, Plus, X } from 'lucide-react'
import './TransactionCategoryPicker.css'

type Props={categories:string[];value:string;disabled?:boolean;onSelect:(value:string)=>void;onAddCategory:(value:string)=>void;onEditCategory:(oldValue:string,newValue:string)=>void;onAdvance:()=>void}

type CreatorMode='category'|'subcategory'|'edit'
const splitCategory=(value:string)=>{const parts=value.split(' > ').map(v=>v.trim()).filter(Boolean);return {parent:parts[0]||value,child:parts.slice(1).join(' > ')}}

export default function TransactionCategoryPicker({categories,value,disabled,onSelect,onAddCategory,onEditCategory,onAdvance}:Props){
 const [open,setOpen]=useState(false)
 const [step,setStep]=useState<'category'|'subcategory'>('category')
 const [activeParent,setActiveParent]=useState('')
 const [addOpen,setAddOpen]=useState(false)
 const [creatorMode,setCreatorMode]=useState<CreatorMode>('category')
 const [addName,setAddName]=useState('')
 const [addParent,setAddParent]=useState('')
 const [editValue,setEditValue]=useState('')
 const parsed=useMemo(()=>categories.map(raw=>({raw,...splitCategory(raw)})),[categories])
 const parents=useMemo(()=>Array.from(new Set(parsed.map(x=>x.parent).filter(Boolean))),[parsed])
 const editableSubcategories=useMemo(()=>parsed.filter(x=>x.child),[parsed])
 const childrenFor=(parent:string)=>parsed.filter(x=>x.parent===parent&&x.child)
 const directFor=(parent:string)=>parsed.find(x=>x.parent===parent&&!x.child)
 const finish=(next:string)=>{onSelect(next);setOpen(false);setStep('category');setActiveParent('');window.setTimeout(onAdvance,80)}
 const chooseParent=(parent:string)=>{const children=childrenFor(parent);if(children.length){setActiveParent(parent);setStep('subcategory');return}finish(directFor(parent)?.raw||parent)}
 const close=()=>{setOpen(false);setStep('category');setActiveParent('')}
 const closeCreator=()=>{setAddOpen(false);setAddName('');setAddParent('');setEditValue('');setCreatorMode('category')}
 const openPanel=()=>{if(disabled)return;setStep('category');setActiveParent('');setOpen(true)}
 const selected=splitCategory(value)
 const subcategories=activeParent?childrenFor(activeParent):[]
 const openCreator=()=>{setOpen(false);setCreatorMode('category');setAddName('');setAddParent(parents[0]||'');setEditValue(editableSubcategories[0]?.raw||'');setAddOpen(true)}
 const selectEditValue=(raw:string)=>{setEditValue(raw);const item=splitCategory(raw);setAddParent(item.parent);setAddName(item.child)}
 const saveCreator=()=>{
   const name=addName.trim()
   if(!name)return
   if(creatorMode==='edit'){
     if(!editValue||!addParent)return
     const next=`${addParent} > ${name}`
     onEditCategory(editValue,next)
     if(value===editValue)onSelect(next)
     closeCreator()
     return
   }
   const next=creatorMode==='subcategory'&&addParent?`${addParent} > ${name}`:name
   onAddCategory(next)
   closeCreator()
 }
 const setMode=(mode:CreatorMode)=>{
   setCreatorMode(mode)
   if(mode==='subcategory'){setAddParent(parents[0]||'');setAddName('')}
   if(mode==='category'){setAddName('');setAddParent('')}
   if(mode==='edit')selectEditValue(editableSubcategories[0]?.raw||'')
 }

 if(disabled)return <label className="transactionCategoryField"><span>Category</span><input className="transactionCategoryInput" value="Transfer" readOnly disabled/></label>
 return <>
  <label className="transactionCategoryField"><span>Category</span><div className="transactionCategoryInputRow"><input className="transactionCategoryInput" value={value} readOnly inputMode="none" onClick={openPanel} onFocus={e=>{e.currentTarget.blur();openPanel()}} placeholder="Select category"/><button type="button" className="transactionCategoryAdd" onClick={openCreator} aria-label="Manage categories"><Plus size={16}/></button></div></label>
  {open&&<div className="transactionCategoryBackdrop" onPointerDown={e=>{if(e.target===e.currentTarget)close()}}><div className="transactionCategorySheet" role="dialog" aria-modal="true" aria-label="Select category" onPointerDown={e=>e.stopPropagation()}>
   <div className="transactionCategoryHandle"/>
   <div className="transactionCategoryViewport"><div className={`transactionCategoryTrack ${step==='subcategory'?'showSubcategories':''}`}>
    <section className="transactionCategoryPanel">
     <div className="transactionCategorySheetHead"><span/><b>Category</b><button type="button" onClick={close} aria-label="Close"><X size={20}/></button></div>
     <div className="transactionCategoryOptions">{parents.map(parent=><button type="button" className={selected.parent===parent?'selected':''} key={parent} onClick={()=>chooseParent(parent)}>{parent}</button>)}</div>
    </section>
    <section className="transactionCategoryPanel">
     <div className="transactionCategorySheetHead"><button type="button" onClick={()=>setStep('category')}><ChevronLeft size={18}/> Back</button><b>{activeParent||'Subcategory'}</b><span/></div>
     <div className="transactionCategoryOptions">{subcategories.map(item=><button type="button" className={value===item.raw?'selected':''} key={item.raw} onClick={()=>finish(item.raw)}>{item.child}</button>)}</div>
    </section>
   </div></div>
  </div></div>}
  {addOpen&&<div className="transactionCategoryBackdrop" onPointerDown={e=>{if(e.target===e.currentTarget)closeCreator()}}><div className="transactionCategorySheet categoryCreatorSheet" role="dialog" aria-modal="true" aria-label="Manage categories" onPointerDown={e=>e.stopPropagation()}>
    <div className="transactionCategoryHandle"/>
    <div className="categoryCreatorHead"><b>Manage Categories</b><button type="button" onClick={closeCreator} aria-label="Close"><X size={20}/></button></div>
    <div className="categoryCreatorTabs"><button type="button" className={creatorMode==='category'?'selected':''} onClick={()=>setMode('category')}>Category</button><button type="button" className={creatorMode==='subcategory'?'selected':''} onClick={()=>setMode('subcategory')} disabled={!parents.length}>Subcategory</button><button type="button" className={creatorMode==='edit'?'selected':''} onClick={()=>setMode('edit')} disabled={!editableSubcategories.length}>Edit</button></div>
    {creatorMode==='edit'&&<label className="categoryCreatorField"><span>Subcategory</span><select value={editValue} onChange={e=>selectEditValue(e.target.value)}>{editableSubcategories.map(item=><option key={item.raw} value={item.raw}>{item.parent} — {item.child}</option>)}</select></label>}
    {(creatorMode==='subcategory'||creatorMode==='edit')&&<label className="categoryCreatorField"><span>Parent category</span><select value={addParent} onChange={e=>setAddParent(e.target.value)}>{parents.map(parent=><option key={parent} value={parent}>{parent}</option>)}</select></label>}
    <label className="categoryCreatorField"><span>{creatorMode==='category'?'Category name':'Subcategory name'}</span><input autoFocus value={addName} onChange={e=>setAddName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveCreator()}} placeholder={creatorMode==='category'?'e.g. Food':'e.g. Restaurant'}/></label>
    <button type="button" className="categoryCreatorSave" onClick={saveCreator} disabled={!addName.trim()||((creatorMode==='subcategory'||creatorMode==='edit')&&!addParent)||(creatorMode==='edit'&&!editValue)}>{creatorMode==='edit'?'Save Subcategory':`Add ${creatorMode==='subcategory'?'Subcategory':'Category'}`}</button>
  </div></div>}
 </>
}

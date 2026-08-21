import { Plus } from 'lucide-react'
import './TransactionCategoryPicker.css'

type Props={categories:string[];value:string;disabled?:boolean;onSelect:(value:string)=>void;onAddCategory:()=>void;onAdvance:()=>void}

const splitCategory=(value:string)=>{const parts=value.split(' > ').map(v=>v.trim()).filter(Boolean);return {parent:parts[0]||value,child:parts.slice(1).join(' > ')}}

export default function TransactionCategoryPicker({categories,value,disabled,onSelect,onAddCategory,onAdvance}:Props){
 const parsed=categories.map(raw=>({raw,...splitCategory(raw)}))
 const parents=Array.from(new Set(parsed.map(x=>x.parent)))
 const selected=splitCategory(value)
 const activeParent=parents.includes(selected.parent)?selected.parent:(parents[0]||'')
 const children=parsed.filter(x=>x.parent===activeParent&&x.child)
 const direct=parsed.find(x=>x.parent===activeParent&&!x.child)
 const choose=(next:string)=>{onSelect(next);window.setTimeout(onAdvance,80)}
 if(disabled)return <div className="transactionCategoryPicker disabled"><div className="categoryPickerValue">Transfer</div></div>
 return <div className="transactionCategoryPicker">
   <div className="categoryPickerTop"><span>Category</span><button type="button" onClick={onAddCategory} aria-label="Add category"><Plus size={15}/></button></div>
   <div className="categoryTabs" role="tablist" aria-label="Categories">{parents.map(parent=><button type="button" role="tab" aria-selected={activeParent===parent} className={activeParent===parent?'active':''} key={parent} onClick={()=>{const first=parsed.find(x=>x.parent===parent);if(first)onSelect(first.raw)}}>{parent}</button>)}</div>
   {activeParent&&<div className="subcategoryHolder"><div className="subcategoryTitle">Subcategory</div><div className="subcategoryScroller">{direct&&<button type="button" className={value===direct.raw?'selected':''} onClick={()=>choose(direct.raw)}>General</button>}{children.map(item=><button type="button" className={value===item.raw?'selected':''} key={item.raw} onClick={()=>choose(item.raw)}>{item.child}</button>)}{!direct&&!children.length&&<button type="button" onClick={()=>choose(activeParent)}>General</button>}</div></div>}
 </div>
}

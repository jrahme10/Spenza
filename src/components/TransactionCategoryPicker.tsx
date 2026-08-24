import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronUp, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import './TransactionCategoryPicker.css'
import './TransactionCategoryDelete.css'

type Props={categories:string[];value:string;disabled?:boolean;onSelect:(value:string)=>void;onAddCategory:(value:string)=>void;onEditCategory:(oldValue:string,newValue:string)=>void;onDeleteCategory:(value:string)=>void;onAdvance?:()=>void}
type EditorState={kind:'category'|'subcategory';mode:'add'|'edit';oldValue?:string;parent:string;name:string}|null
const splitCategory=(value:string)=>{const parts=value.split(' > ').map(v=>v.trim()).filter(Boolean);return {parent:parts[0]||value,child:parts.slice(1).join(' > ')}}

export default function TransactionCategoryPicker({categories,value,disabled,onSelect,onAddCategory,onEditCategory,onDeleteCategory,onAdvance}:Props){
 const [open,setOpen]=useState(false)
 const [expanded,setExpanded]=useState('')
 const [manageOpen,setManageOpen]=useState(false)
 const [manageExpanded,setManageExpanded]=useState('')
 const [search,setSearch]=useState('')
 const [editor,setEditor]=useState<EditorState>(null)
 const parsed=useMemo(()=>categories.map(raw=>({raw,...splitCategory(raw)})),[categories])
 const parents=useMemo(()=>Array.from(new Set(parsed.map(x=>x.parent).filter(Boolean))),[parsed])
 const childrenFor=(parent:string)=>parsed.filter(x=>x.parent===parent&&x.child)
 const directFor=(parent:string)=>parsed.find(x=>x.parent===parent&&!x.child)
 const selected=splitCategory(value)
 const filteredParents=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return parents;return parents.filter(parent=>parent.toLowerCase().includes(q)||childrenFor(parent).some(item=>item.child.toLowerCase().includes(q)))},[search,parents,parsed])
 const finish=(next:string)=>{onSelect(next);setOpen(false);setExpanded('');if(onAdvance)window.setTimeout(onAdvance,80)}
 const chooseParent=(parent:string)=>{const children=childrenFor(parent);if(children.length){setExpanded(v=>v===parent?'':parent);return}finish(directFor(parent)?.raw||parent)}
 const close=()=>{setOpen(false);setExpanded('')}
 const openPanel=()=>{if(disabled)return;setExpanded(selected.child?selected.parent:'');setOpen(true)}
 const closeManager=()=>{setManageOpen(false);setManageExpanded('');setSearch('');setEditor(null)}
 const openManager=()=>{setOpen(false);setSearch('');setManageExpanded(selected.parent||'');setEditor(null);setManageOpen(true)}
 const addCategory=()=>setEditor({kind:'category',mode:'add',parent:'',name:''})
 const addSubcategory=(parent:string)=>setEditor({kind:'subcategory',mode:'add',parent,name:''})
 const editCategory=(parent:string)=>setEditor({kind:'category',mode:'edit',oldValue:parent,parent:'',name:parent})
 const editSubcategory=(raw:string)=>{const item=splitCategory(raw);setEditor({kind:'subcategory',mode:'edit',oldValue:raw,parent:item.parent,name:item.child})
 const saveEditor=()=>{if(!editor)return;const name=editor.name.trim();if(!name)return;if(editor.kind==='category'){if(editor.mode==='add')onAddCategory(name);else if(editor.oldValue)onEditCategory(editor.oldValue,name)}else{if(!editor.parent)return;const next=`${editor.parent} > ${name}`;if(editor.mode==='add')onAddCategory(next);else if(editor.oldValue)onEditCategory(editor.oldValue,next)}setManageExpanded(editor.kind==='subcategory'?editor.parent:name);setEditor(null)}
 const deleteValue=(target:string,label:string,isParent:boolean)=>{const count=isParent?childrenFor(target).length:0;const extra=count?` This will also remove ${count} subcategor${count===1?'y':'ies'}.`:'';if(!window.confirm(`Delete ${label}?${extra}`))return;onDeleteCategory(target);if(isParent&&manageExpanded===target)setManageExpanded('');if(editor?.oldValue===target)setEditor(null)}
 if(disabled)return <label className="transactionCategoryField"><span>Category</span><input className="transactionCategoryInput" value="Transfer" readOnly disabled/></label>
 return <>
  <label className="transactionCategoryField"><span>Category</span><div className="transactionCategoryInputRow"><input className="transactionCategoryInput" value={value} readOnly inputMode="none" onClick={openPanel} onFocus={e=>{e.currentTarget.blur();openPanel()}} placeholder="Select category"/><button type="button" className="transactionCategoryAdd" onClick={openManager} aria-label="Manage categories"><Pencil size={16}/></button></div></label>
  {open&&<div className="transactionCategoryBackdrop" onPointerDown={e=>{if(e.target===e.currentTarget)close()}}><div className="transactionCategorySheet expandableCategorySheet" role="dialog" aria-modal="true" aria-label="Select category" onPointerDown={e=>e.stopPropagation()}>
   <div className="transactionCategoryHandle"/>
   <div className="expandableCategoryHead"><b>Category</b><div><button type="button" onClick={openManager} aria-label="Manage categories"><Pencil size={19}/></button><button type="button" onClick={close} aria-label="Close"><X size={22}/></button></div></div>
   <div className="expandableCategoryGrid">{parents.map(parent=>{const children=childrenFor(parent);const isExpanded=expanded===parent;return <div className={`expandableCategoryGroup ${isExpanded?'expanded':''}`} key={parent}>
    <button type="button" className={`expandableCategoryMain ${selected.parent===parent?'selected':''}`} onClick={()=>chooseParent(parent)}><span>{parent}</span>{children.length?(isExpanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>):null}</button>
    {isExpanded&&children.length>0&&<div className="expandableSubcategoryGrid">{children.map(item=><button type="button" className={value===item.raw?'selected':''} key={item.raw} onClick={()=>finish(item.raw)}>{item.child}</button>)}</div>}
   </div>})}<button type="button" className="expandableCategoryMain addCategoryTile" onClick={openManager}><Plus size={17}/><span>Manage</span></button></div>
  </div></div>}
  {manageOpen&&<div className="transactionCategoryBackdrop" onPointerDown={e=>{if(e.target===e.currentTarget)closeManager()}}><div className="transactionCategorySheet categoryManagerSheet" role="dialog" aria-modal="true" aria-label="Manage categories" onPointerDown={e=>e.stopPropagation()}>
   <div className="transactionCategoryHandle"/>
   {!editor?<>
    <div className="categoryManagerHead"><div><b>Manage Categories</b><span>Tap a category to view its subcategories</span></div><button type="button" onClick={closeManager} aria-label="Close"><X size={21}/></button></div>
    <div className="categoryManagerToolbar"><div className="categoryManagerSearch"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search categories"/></div><button type="button" className="categoryManagerAddTop" onClick={addCategory}><Plus size={17}/> Add</button></div>
    <div className="categoryManagerList">{filteredParents.map(parent=>{const children=childrenFor(parent);const isExpanded=manageExpanded===parent;return <div className="categoryManagerCard" key={parent}>
      <div className="categoryManagerRow"><button type="button" className="categoryManagerExpand" onClick={()=>setManageExpanded(v=>v===parent?'':parent)}><span className="categoryManagerName"><strong>{parent}</strong><small>{children.length?`${children.length} subcategor${children.length===1?'y':'ies'}`:'No subcategories'}</small></span>{children.length?(isExpanded?<ChevronUp size={18}/>:<ChevronDown size={18}/>):null}</button><button type="button" className="categoryManagerEdit" onClick={()=>editCategory(parent)} aria-label={`Edit ${parent}`}><Pencil size={17}/></button><button type="button" className="categoryManagerDelete" onClick={()=>deleteValue(parent,parent,true)} aria-label={`Delete ${parent}`}><Trash2 size={17}/></button></div>
      {isExpanded&&<div className="categoryManagerChildren">{children.map(item=><div className="categoryManagerChild" key={item.raw}><span>{item.child}</span><button type="button" onClick={()=>editSubcategory(item.raw)} aria-label={`Edit ${item.child}`}><Pencil size={15}/></button><button type="button" className="categoryManagerDelete" onClick={()=>deleteValue(item.raw,item.child,false)} aria-label={`Delete ${item.child}`}><Trash2 size={15}/></button></div>)}<button type="button" className="categoryManagerAddSub" onClick={()=>addSubcategory(parent)}><Plus size={15}/> Add Subcategory</button></div>}
     </div>})}{!filteredParents.length&&<div className="categoryManagerEmpty">No categories found.</div>}</div>
    <button type="button" className="categoryManagerPrimary" onClick={addCategory}><Plus size={18}/> Add Category</button>
   </>:<>
    <div className="categoryEditorHead"><button type="button" onClick={()=>setEditor(null)}><ChevronLeft size={19}/> Back</button><b>{editor.mode==='add'?'Add':'Edit'} {editor.kind==='category'?'Category':'Subcategory'}</b><span/></div>
    <div className="categoryEditorBody">{editor.kind==='subcategory'&&<label className="categoryCreatorField"><span>Parent category</span><select value={editor.parent} onChange={e=>setEditor({...editor,parent:e.target.value})}>{parents.map(parent=><option value={parent} key={parent}>{parent}</option>)}</select></label>}<label className="categoryCreatorField"><span>{editor.kind==='category'?'Category name':'Subcategory name'}</span><input autoFocus value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})} onKeyDown={e=>{if(e.key==='Enter')saveEditor()}} placeholder={editor.kind==='category'?'e.g. Food':'e.g. Restaurant'}/></label><div className="categoryEditorActions"><button type="button" className="categoryEditorCancel" onClick={()=>setEditor(null)}>Cancel</button><button type="button" className="categoryCreatorSave" onClick={saveEditor} disabled={!editor.name.trim()||(editor.kind==='subcategory'&&!editor.parent)}>Save</button></div>{editor.mode==='edit'&&editor.oldValue&&<button type="button" className="categoryEditorDelete" onClick={()=>deleteValue(editor.oldValue!,editor.kind==='category'?editor.oldValue!:editor.name,editor.kind==='category')}><Trash2 size={16}/> Delete {editor.kind==='category'?'Category':'Subcategory'}</button>}</div>
   </>}
  </div></div>}
 </>
}

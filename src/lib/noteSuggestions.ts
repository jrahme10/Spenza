import { loadData } from './db'
import { getSupabaseUserId } from './supabaseClient'

const MAX_SUGGESTIONS=8
type SuggestionKind='note'|'description'
let activeInput:HTMLInputElement|null=null
let activeKind:SuggestionKind|null=null
let suggestions:string[]=[]
let dropdown:HTMLDivElement|null=null
let requestToken=0

function suggestionOwnerKey(kind:SuggestionKind,ownerId?:string){return `spenza-${kind}-suggestions:${ownerId||'local-device'}`}

function cleanNote(value?:string){
  const note=(value||'').trim()
  if(!note)return ''
  if(note==='Added from scanned receipt'||/^Receipt scanned in (USD|LBP)$/i.test(note)||note==='Paid from Bills')return ''
  return note.endsWith(' · Paid from Bills')?note.slice(0,-' · Paid from Bills'.length).trim():note
}

function cleanDescription(value?:string){return (value||'').trim()}

function uniqueRecent(values:string[],cleaner:(value?:string)=>string){
  const seen=new Set<string>()
  const result:string[]=[]
  for(const value of values){
    const clean=cleaner(value)
    const key=clean.toLocaleLowerCase()
    if(!clean||seen.has(key))continue
    seen.add(key)
    result.push(clean)
  }
  return result
}

function suggestionInputKind(target:EventTarget|null):SuggestionKind|null{
  if(!(target instanceof HTMLInputElement))return null
  const label=target.closest('label')
  if(!label||!target.closest('.refSheet'))return null
  const labelText=(label.childNodes[0]?.textContent||'').trim().toLocaleLowerCase()
  if(labelText==='note')return 'note'
  if(labelText==='description')return 'description'
  return null
}

function ensureDropdown(){
  if(dropdown)return dropdown
  dropdown=document.createElement('div')
  dropdown.className='noteSuggestionsDropdown'
  dropdown.setAttribute('role','listbox')
  return dropdown
}

function hide(){
  dropdown?.remove()
  activeInput?.closest('label')?.classList.remove('noteSuggestionField')
  activeInput=null
  activeKind=null
}

function setReactInputValue(input:HTMLInputElement,value:string){
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set
  if(setter)setter.call(input,value)
  else input.value=value
  input.dispatchEvent(new Event('input',{bubbles:true}))
  input.dispatchEvent(new Event('change',{bubbles:true}))
}

function render(){
  if(!activeInput)return
  const query=activeInput.value.trim().toLocaleLowerCase()
  const filtered=suggestions.filter(value=>!query||value.toLocaleLowerCase().includes(query)).slice(0,MAX_SUGGESTIONS)
  const menu=ensureDropdown()
  menu.replaceChildren()
  if(!filtered.length){menu.remove();return}
  for(const value of filtered){
    const button=document.createElement('button')
    button.type='button'
    button.className='noteSuggestionOption'
    button.setAttribute('role','option')
    button.textContent=value
    button.addEventListener('pointerdown',event=>event.preventDefault())
    button.addEventListener('click',()=>{
      if(!activeInput)return
      const input=activeInput
      setReactInputValue(input,value)
      hide()
      input.focus()
    })
    menu.appendChild(button)
  }
  const label=activeInput.closest('label')
  if(!label)return
  label.classList.add('noteSuggestionField')
  label.appendChild(menu)
}

async function loadSuggestions(input:HTMLInputElement,kind:SuggestionKind){
  const token=++requestToken
  try{
    const [data,ownerId]=await Promise.all([loadData(),getSupabaseUserId().catch(()=>undefined)])
    if(token!==requestToken||activeInput!==input||activeKind!==kind)return
    const sortedTransactions=data.transactions
      .slice()
      .sort((a,b)=>String(b.updatedAt||b.createdAt||b.date).localeCompare(String(a.updatedAt||a.createdAt||a.date)))
    const storageKey=suggestionOwnerKey(kind,ownerId)
    let remembered:string[]=[]
    try{remembered=JSON.parse(localStorage.getItem(storageKey)||'[]')}catch{remembered=[]}
    if(kind==='description'){
      const descriptions=sortedTransactions.map(item=>{
        const title=cleanDescription(item.title)
        if(!title)return ''
        if(title.toLocaleLowerCase()==='transaction')return ''
        if(item.type==='expense'&&title.toLocaleLowerCase()===cleanDescription(item.category).toLocaleLowerCase())return ''
        return title
      })
      suggestions=uniqueRecent([...descriptions,...remembered],cleanDescription)
    }else{
      const transactionNotes=sortedTransactions.map(item=>item.note||'')
      const billNotes=data.bills
        .slice()
        .sort((a,b)=>String(b.updatedAt||b.createdAt||b.dueDate).localeCompare(String(a.updatedAt||a.createdAt||a.dueDate)))
        .map(item=>item.note||'')
      suggestions=uniqueRecent([...transactionNotes,...billNotes,...remembered],cleanNote)
    }
    try{localStorage.setItem(storageKey,JSON.stringify(suggestions.slice(0,100)))}catch{}
    render()
  }catch{
    suggestions=[]
    render()
  }
}

export function initNoteSuggestions(){
  document.addEventListener('focusin',event=>{
    const kind=suggestionInputKind(event.target)
    if(!kind)return
    activeInput=event.target as HTMLInputElement
    activeKind=kind
    void loadSuggestions(activeInput,kind)
  })
  document.addEventListener('input',event=>{
    if(event.target===activeInput)render()
  })
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&event.target===activeInput)hide()
  })
  document.addEventListener('focusout',event=>{
    if(event.target!==activeInput)return
    window.setTimeout(()=>{
      if(dropdown?.contains(document.activeElement))return
      hide()
    },120)
  })
}

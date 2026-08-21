import { readFileSync, writeFileSync } from 'node:fs'

const path=new URL('../src/App.tsx',import.meta.url)
let source=readFileSync(path,'utf8')

const oldCategory=`<label>Category<div className="categoryControl"><select value={category} onChange={e=>setCategory(e.target.value)} disabled={type==='transfer'}>{type==='transfer'?<option>Transfer</option>:data.categories.map(c=><option key={c}>{c}</option>)}</select>{type!=='transfer'&&<button type="button" onClick={addCategory}><Plus size={15}/></button>}</div></label>`
const newCategory=`<label>Category<div className="categoryInputRow"><input className="spenzaCategoryInput" value={type==='transfer'?'Transfer':category} data-categories={data.categories.join('\\u001f')} onChange={e=>setCategory(e.target.value)} readOnly disabled={type==='transfer'} placeholder="Select category"/>{type!=='transfer'&&<button type="button" className="categoryAddButton" onClick={addCategory} aria-label="Add category"><Plus size={15}/></button>}</div></label>`
if(source.includes(oldCategory))source=source.replace(oldCategory,newCategory)
else if(!source.includes('spenzaCategoryInput'))throw new Error('Category input transform failed: original Category control not found')

const description=`<label>Description <small className="fieldHint">Optional</small><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={type==='income'?'Salary, refund...':type==='transfer'?'Move money...':'Optional description'}/></label>`
const note=`<label>Note<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note (optional)"/></label>`
const photos=`<div className="noteAttachmentLabel">Photos</div><NotePhotoPicker images={noteImages} onChange={setNoteImages}/>`

// Description and Note belong at the end of the form, after Photos.
source=source.replace(description,'')
source=source.replace(note,'')
if(source.includes(photos) && !source.includes(photos+description+note))source=source.replace(photos,photos+description+note)

writeFileSync(path,source)
console.log('Applied Category input bottom-sheet trigger and final Description/Note order')

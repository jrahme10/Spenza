import {readFileSync,writeFileSync} from 'node:fs'
const path=new URL('../src/App.tsx',import.meta.url)
let s=readFileSync(path,'utf8')
if(!s.includes(`import TransactionCategoryPicker from './components/TransactionCategoryPicker'`))s=s.replace(`import TransactionCalendar from './components/TransactionCalendar'`,`import TransactionCalendar from './components/TransactionCalendar'\nimport TransactionCategoryPicker from './components/TransactionCategoryPicker'`)
const start=s.indexOf(`{open&&<div className="overlay"`)
const end=s.indexOf(`\n  {walletForm&&`,start)
if(start<0||end<0)throw new Error('Transaction form transform failed: form not found')
const block=s.slice(start,end)
const amountStart=block.indexOf(`<label>Amount`)
const amountEnd=block.indexOf(`{conversionLabel&&`)
const afterConversion=block.indexOf(`<label>Description`,amountEnd)
const saveStart=block.lastIndexOf(`<button className="primary"`)
if(amountStart<0||amountEnd<0||afterConversion<0||saveStart<0)throw new Error('Transaction form transform failed: anchors not found')
let prefix=block.slice(0,amountStart)
prefix=prefix.replace(`<div className="sheet refSheet" onClick={e=>e.stopPropagation()}>`,`<div className="sheet refSheet" tabIndex={-1} onClick={e=>e.stopPropagation()}>`)
const amountBlock=block.slice(amountStart,afterConversion)
const save=block.slice(saveStart)
const date=`<label>Date<input className="transactionDateInput" type="date" value={date} onChange={e=>{setDate(e.target.value);const sheet=e.currentTarget.closest('.sheet') as HTMLElement|null;const description=sheet?.querySelector('.transactionDescriptionInput') as HTMLInputElement|null;if(description){description.disabled=true;description.blur()}e.currentTarget.blur();sheet?.focus({preventScroll:true});requestAnimationFrame(()=>sheet?.focus({preventScroll:true}));window.setTimeout(()=>sheet?.focus({preventScroll:true}),80);window.setTimeout(()=>{sheet?.focus({preventScroll:true});if(description?.isConnected)description.disabled=false},320)}}/></label>`
const account=`<label>Account<select className="transactionAccountSelect" value={walletId} onChange={e=>setWalletId(e.target.value)}><option value="">Select Account</option>{data.wallets.map(w=><option value={w.id} key={w.id}>{w.name} ({w.currency})</option>)}</select></label>{type==='transfer'&&<label>To Account<select value={toWalletId} onChange={e=>setToWalletId(e.target.value)}><option value="">Select Account</option>{data.wallets.filter(w=>w.id!==walletId).map(w=><option value={w.id} key={w.id}>{w.name} ({w.currency})</option>)}</select></label>}`
const description=`<div className="descriptionPhotoRow"><label>Description <small className="fieldHint">Optional</small><input className="transactionDescriptionInput" type="text" inputMode="text" autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} value={title} onChange={e=>setTitle(e.target.value)} enterKeyHint="done" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();const sheet=e.currentTarget.closest('.sheet') as HTMLElement|null;sheet?.focus({preventScroll:true})}}} placeholder={type==='income'?'Salary, refund...':type==='transfer'?'Move money...':'Optional description'}/></label><NotePhotoPicker images={noteImages} onChange={setNoteImages}/></div>`
const middle=`${date}${account}${amountBlock}<TransactionCategoryPicker categories={data.categories} value={type==='transfer'?'Transfer':category} disabled={type==='transfer'} onSelect={setCategory} onAddCategory={addCategory} onEditCategory={editCategory} onDeleteCategory={deleteCategory}/>${description}<label>Note <small className="fieldHint">Optional</small><input className="transactionNoteInput" type="text" inputMode="text" autoComplete="off" value={note} onChange={e=>setNote(e.target.value)} enterKeyHint="done" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}} placeholder="Add a note"/></label>`
s=s.slice(0,start)+prefix+middle+save+s.slice(end)
writeFileSync(path,s)
console.log('Applied Add Transaction layout: Date, Account, Amount, Category, Description with photo picker, Note')

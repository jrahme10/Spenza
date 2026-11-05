import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Sparkles, X } from 'lucide-react'
import type { Currency, TransactionType } from '../lib/db'
import './voice-transaction.css'
type Draft={type:TransactionType;amount:number;currency:Currency;title:string;category:string;date:string;note:string}
type Props={categories:string[];preferredCurrency:Currency;onResult:(draft:Draft)=>void}
type RecEvent={results:ArrayLike<ArrayLike<{transcript:string}>>}
type Rec={lang:string;continuous:boolean;interimResults:boolean;onresult:((e:RecEvent)=>void)|null;onerror:((e:{error?:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void}
type RecCtor=new()=>Rec
const nums:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90}
const aliases:Record<string,string[]>={Food:['food','restaurant','lunch','dinner','breakfast','groceries','grocery','market','مطعم','اكل'],Transport:['fuel','gas','gasoline','taxi','uber','careem','parking','car','بنزين','تاكسي'],Shopping:['shopping','clothes','shoes','mall','شراء','ملابس'],Bills:['bill','electricity','water','internet','phone','subscription','فاتورة','كهرباء'],Coffee:['coffee','cafe','espresso','قهوة'],Entertainment:['movie','cinema','game','concert','سينما'],Health:['doctor','pharmacy','medicine','hospital','صيدلية','دواء'],Education:['school','course','book','university','مدرسة','جامعة'],Travel:['flight','hotel','trip','travel','سفر','فندق'],Salary:['salary','paycheck','income','راتب']}
function wordAmount(s:string):number|null{let total=0,current=0,found=false;for(const w of s.toLowerCase().replace(/-/g,' ').split(/\s+/)){if(w in nums){current+=nums[w];found=true}else if(w==='hundred'){current=Math.max(1,current)*100;found=true}else if(w==='thousand'){total+=Math.max(1,current)*1000;current=0;found=true}else if(w==='and'&&found)continue;else if(found)break}return found?total+current:null}
function parse(s:string,cats:string[],preferred:Currency):Draft|null{
 const t=s.toLowerCase().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
 const m=t.match(/(\d+(?:[.,]\d{1,2})?)/), amount=m?Number(m[1].replace(',','.')):wordAmount(t)
 if(!amount||!Number.isFinite(amount)||amount<=0)return null
 const currency:Currency=/\b(lbp|lira|lebanese pounds?|lebanese lira)\b|ليرة|لبناني/.test(t)?'LBP':(/\b(usd|dollars?)\b|دولار/.test(t)||t.includes('$'))?'USD':preferred
 const type:TransactionType=/\b(received|earned|salary|income|got paid|payment from)\b|قبضت|استلمت|راتب/.test(t)?'income':'expense'
 const category=cats.find(c=>(aliases[c]||[c.toLowerCase()]).some(a=>t.includes(a.toLowerCase())))||cats.find(c=>c.toLowerCase()===(type==='income'?'salary':'other'))||cats[0]||'Other'
 const phrase=(t.match(/\b(?:at|from|on|for)\s+([a-z][a-z0-9 &'-]{1,35})/)?.[1]||'').split(/\b(?:today|yesterday|this morning|tonight|with|using)\b/)[0].trim()
 const date=/yesterday|مبارح|أمس/.test(t)?new Date(Date.now()-86400000).toISOString().slice(0,10):new Date().toISOString().slice(0,10)
 return{type,amount,currency,title:phrase||category,category,date,note:'Added by voice'}
}
export default function VoiceTransaction({categories,preferredCurrency,onResult}:Props){
 const [transcript,setTranscript]=useState(''),[language,setLanguage]=useState<'en-US'|'ar-LB'>('en-US'),[listening,setListening]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState<Draft|null>(null)
 const rec=useRef<Rec|null>(null)
 const supported=useMemo(()=>{const w=window as Window&{SpeechRecognition?:RecCtor;webkitSpeechRecognition?:RecCtor};return!!(w.SpeechRecognition||w.webkitSpeechRecognition)},[])
 useEffect(()=>()=>rec.current?.stop(),[])
 const listen=()=>{const w=window as Window&{SpeechRecognition?:RecCtor;webkitSpeechRecognition?:RecCtor},Ctor=w.SpeechRecognition||w.webkitSpeechRecognition;if(!Ctor){setError('Speech recognition is unavailable in this browser. Type your transaction below.');return}try{setError('');setDraft(null);setTranscript('');const r=new Ctor();r.lang=language;r.continuous=false;r.interimResults=false;r.onresult=e=>{setTranscript(Array.from(e.results).map(x=>x[0]?.transcript||'').join(' ').trim());setListening(false)};r.onerror=e=>{setListening(false);setError(e.error==='not-allowed'?'Microphone permission denied. Allow microphone access and retry.':'Could not recognize that. Try again or type the transaction.')};r.onend=()=>setListening(false);rec.current=r;setListening(true);r.start()}catch{setListening(false);setError('Could not start the microphone. Please retry.')}}
 const review=()=>{const d=parse(transcript,categories,preferredCurrency);if(!d){setDraft(null);setError('I could not detect a clear amount. Try “I spent 25 dollars on fuel”.')}else{setError('');setDraft(d)}}
 return <section className="voiceTransaction">
  <div className="voiceTransactionTop"><div><span className="voiceTransactionIcon"><Mic size={17}/></span><div><b>Voice transaction</b><small>Speak naturally, review, then save</small></div></div><select aria-label="Speech language" value={language} onChange={e=>setLanguage(e.target.value as 'en-US'|'ar-LB')}><option value="en-US">English</option><option value="ar-LB">Arabic</option></select></div>
  <button type="button" className={listening?'voiceListenButton listening':'voiceListenButton'} onClick={listening?()=>rec.current?.stop():listen}>{listening?<><MicOff size={17}/>Stop listening</>:<><Mic size={17}/>Start speaking</>}</button>
  {!supported&&<p className="voiceTransactionHint">Speech recognition is not supported here. You can type a sentence below.</p>}
  <textarea rows={2} value={transcript} onChange={e=>{setTranscript(e.target.value);setDraft(null)}} placeholder="Example: I spent 25 dollars on fuel today…" aria-label="Voice transaction transcript"/>
  {error&&<p className="voiceTransactionError" role="status">{error}</p>}
  {transcript.trim()&&<button type="button" className="voiceReviewButton" onClick={review}><Sparkles size={15}/>Review transaction</button>}
  {draft&&<div className="voiceDraft"><div className="voiceDraftHead"><b>Review detected details</b><button type="button" onClick={()=>setDraft(null)} aria-label="Close review"><X size={16}/></button></div>
   <div className="voiceDraftGrid">
    <label>Type<select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value as TransactionType})}><option value="expense">Expense</option><option value="income">Income</option></select></label>
    <label>Amount<input type="number" min="0" step="any" value={draft.amount} onChange={e=>setDraft({...draft,amount:Number(e.target.value)})}/></label>
    <label>Currency<select value={draft.currency} onChange={e=>setDraft({...draft,currency:e.target.value as Currency})}><option>USD</option><option>LBP</option></select></label>
    <label>Category<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label className="voiceDraftWide">Description<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <label className="voiceDraftWide">Date<input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
   </div><button type="button" className="voiceUseButton" disabled={!draft.amount||draft.amount<=0||!draft.title.trim()} onClick={()=>{onResult(draft);setDraft(null);setTranscript('')}}>Use details in transaction</button>
  </div>}
 </section>
}

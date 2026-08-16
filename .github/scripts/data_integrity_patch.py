from pathlib import Path

# App.tsx: block same-account transfers and make transaction totals currency-safe.
p=Path('src/App.tsx')
s=p.read_text()
old="if(type==='transfer'&&!toWalletId){setDialog({title:'Choose a destination wallet',message:'Transfers need both a source wallet and a destination wallet.',kind:'info'});return}const now=new Date().toISOString();"
new="if(type==='transfer'&&!toWalletId){setDialog({title:'Choose a destination wallet',message:'Transfers need both a source wallet and a destination wallet.',kind:'info'});return}if(type==='transfer'&&walletId===toWalletId){setDialog({title:'Choose a different account',message:'The source and destination accounts must be different for a transfer.',kind:'info'});return}const now=new Date().toISOString();"
assert old in s, 'transfer validation anchor missing'
s=s.replace(old,new,1)
old=(" const activityDisplayCurrency=(activityAccountFilter!=='all'?data.wallets.find(w=>w.id===activityAccountFilter):activityWallet)?.currency\n"
     " const activityIncome=activityTransactions.filter(t=>t.type==='income').reduce((sum,t)=>sum+t.amount,0)\n"
     " const activityExpense=activityTransactions.filter(t=>t.type==='expense').reduce((sum,t)=>sum+t.amount,0)\n"
     " const activityNet=activityIncome-activityExpense")
new=(" const activityDisplayCurrency:Currency=(activityAccountFilter!=='all'?data.wallets.find(w=>w.id===activityAccountFilter):activityWallet)?.currency||'USD'\n"
     " const activityAmountInDisplayCurrency=(t:Transaction)=>{const source=data.wallets.find(w=>w.id===t.walletId)?.currency||activityDisplayCurrency;return convert(t.amount,source,activityDisplayCurrency)}\n"
     " const activityIncome=activityTransactions.filter(t=>t.type==='income').reduce((sum,t)=>sum+activityAmountInDisplayCurrency(t),0)\n"
     " const activityExpense=activityTransactions.filter(t=>t.type==='expense').reduce((sum,t)=>sum+activityAmountInDisplayCurrency(t),0)\n"
     " const activityNet=activityIncome-activityExpense")
assert old in s, 'activity totals anchor missing'
s=s.replace(old,new,1)
s=s.replace("{activityDisplayCurrency?money(activityIncome,activityDisplayCurrency):activityIncome.toLocaleString()}","{money(activityIncome,activityDisplayCurrency)}")
s=s.replace("{activityDisplayCurrency?money(activityExpense,activityDisplayCurrency):activityExpense.toLocaleString()}","{money(activityExpense,activityDisplayCurrency)}")
s=s.replace("{activityDisplayCurrency?money(activityNet,activityDisplayCurrency):activityNet.toLocaleString()}","{money(activityNet,activityDisplayCurrency)}")
p.write_text(s)

# BackupManager.tsx: validate IDs, references, transaction fields and bills.
p=Path('src/components/BackupManager.tsx')
s=p.read_text()
old="function isValidBackup(value:unknown):value is BackupFile{if(!value||typeof value!=='object')return false;const backup=value as Partial<BackupFile>;const data=backup.data as Partial<SpenzaData>|undefined;return backup.app==='Spenza'&&backup.version===1&&!!data&&Array.isArray(data.wallets)&&Array.isArray(data.transactions)&&Array.isArray(data.categories)}"
new="""function isValidDate(value:unknown){return typeof value==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00`))}
function isValidBackup(value:unknown):value is BackupFile{
 if(!value||typeof value!=='object')return false
 const backup=value as Partial<BackupFile>
 const data=backup.data as Partial<SpenzaData>|undefined
 if(backup.app!=='Spenza'||backup.version!==1||!data||!Array.isArray(data.wallets)||!Array.isArray(data.transactions)||!Array.isArray(data.categories))return false
 const wallets=data.wallets as SpenzaData['wallets'];const transactions=data.transactions as SpenzaData['transactions'];const bills=Array.isArray(data.bills)?data.bills:[]
 if(wallets.some(w=>!w||typeof w.id!=='string'||!w.id||typeof w.name!=='string'||(w.currency!=='USD'&&w.currency!=='LBP')||!Number.isFinite(Number(w.openingBalance))))return false
 const walletIds=new Set(wallets.map(w=>w.id));if(walletIds.size!==wallets.length)return false
 if(data.categories.some(c=>typeof c!=='string'||!c.trim()))return false
 const txIds=new Set<string>()
 for(const t of transactions){if(!t||typeof t.id!=='string'||!t.id||txIds.has(t.id))return false;txIds.add(t.id);if(!['income','expense','transfer'].includes(t.type)||typeof t.title!=='string'||typeof t.category!=='string'||!Number.isFinite(Number(t.amount))||Number(t.amount)<=0||!walletIds.has(t.walletId)||!isValidDate(t.date))return false;if(t.type==='transfer'&&(!t.toWalletId||!walletIds.has(t.toWalletId)||t.toWalletId===t.walletId||!Number.isFinite(Number(t.exchangeRate))||Number(t.exchangeRate)<=0))return false}
 const billIds=new Set<string>()
 for(const b of bills){if(!b||typeof b.id!=='string'||!b.id||billIds.has(b.id))return false;billIds.add(b.id);if(typeof b.name!=='string'||!b.name.trim()||!walletIds.has(b.walletId)||!Number.isFinite(Number(b.amount))||Number(b.amount)<=0||!isValidDate(b.dueDate)||!['once','monthly','yearly'].includes(b.recurrence)||![0,1,3,7].includes(b.reminderDays))return false}
 return true
}"""
assert old in s, 'backup validator anchor missing'
s=s.replace(old,new,1)
old="const walletIds=new Set(parsed.data.wallets.map(w=>w.id));if(parsed.data.transactions.some(t=>!t.id||!t.type||!t.walletId||!walletIds.has(t.walletId))){setMessage('The backup contains invalid transaction or wallet references.');return}"
assert old in s, 'legacy backup validation anchor missing'
s=s.replace(old,"",1)
p.write_text(s)

# BillsManager.tsx: guard Mark Paid against rapid duplicate taps.
p=Path('src/components/BillsManager.tsx')
s=p.read_text()
s=s.replace("import { useMemo, useState } from 'react'","import { useMemo, useRef, useState } from 'react'",1)
anchor="  const [filter,setFilter]=useState<'all'|'upcoming'|'overdue'>('all')"
assert anchor in s, 'bill state anchor missing'
s=s.replace(anchor,anchor+"\n  const payingBills=useRef(new Set<string>())",1)
old="""  const markPaid=(bill:Bill)=>{
    if(!isPayable(bill)) return
    const wallet=data.wallets.find(w=>w.id===bill.walletId)
    if(!wallet) return
    const paidDate=today()
    const now=new Date().toISOString()
    const tx:Transaction={id:uid(),type:'expense',title:bill.name,category:bill.category,amount:bill.amount,walletId:bill.walletId,date:paidDate,note:bill.note?`${bill.note} · Paid from Bills`:'Paid from Bills',createdAt:now,updatedAt:now}
    setData(d=>({...d,transactions:[tx,...d.transactions],bills:d.bills.map(b=>b.id!==bill.id?b:{...b,lastPaidDate:paidDate,dueDate:b.recurrence==='once'?b.dueDate:nextDueDate(b.dueDate,b.recurrence),updatedAt:now})}))
  }"""
new="""  const markPaid=(bill:Bill)=>{
    if(payingBills.current.has(bill.id)||!isPayable(bill)) return
    const wallet=data.wallets.find(w=>w.id===bill.walletId)
    if(!wallet) return
    payingBills.current.add(bill.id)
    const paidDate=today()
    const now=new Date().toISOString()
    const tx:Transaction={id:uid(),type:'expense',title:bill.name,category:bill.category,amount:bill.amount,walletId:bill.walletId,date:paidDate,note:bill.note?`${bill.note} · Paid from Bills`:'Paid from Bills',createdAt:now,updatedAt:now}
    setData(d=>({...d,transactions:[tx,...d.transactions],bills:d.bills.map(b=>b.id!==bill.id?b:{...b,lastPaidDate:paidDate,dueDate:b.recurrence==='once'?b.dueDate:nextDueDate(b.dueDate,b.recurrence),updatedAt:now})}))
    window.setTimeout(()=>payingBills.current.delete(bill.id),750)
  }"""
assert old in s, 'mark paid anchor missing'
s=s.replace(old,new,1)
p.write_text(s)

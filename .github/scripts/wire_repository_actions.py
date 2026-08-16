from pathlib import Path

p=Path('src/App.tsx')
s=p.read_text()

import_anchor="import { Currency, defaultData, loadData, saveData, SpenzaData, Transaction, TransactionType, uid, Wallet } from './lib/db'"
assert import_anchor in s, 'db import anchor missing'
if "from './lib/repository'" not in s:
    s=s.replace(import_anchor,import_anchor+"\nimport { localRepository } from './lib/repository'",1)

lines=s.splitlines()
replacements={
" const submit=":" const submit=async()=>{const n=Number(amount);if(!n||n<=0)return;if(type!=='expense'&&!title.trim())return;if(!walletId){setDialog({title:'Create a wallet first',message:'Add at least one wallet before saving a transaction.',kind:'info'});return}if(type==='transfer'&&!toWalletId){setDialog({title:'Choose a destination wallet',message:'Transfers need both a source wallet and a destination wallet.',kind:'info'});return}if(type==='transfer'&&walletId===toWalletId){setDialog({title:'Choose a different account',message:'The source and destination accounts must be different for a transfer.',kind:'info'});return}const now=new Date().toISOString();const old=data.transactions.find(t=>t.id===editing);const displayTitle=title.trim()||(type==='expense'?category:'Transaction');const tx:Transaction={id:editing||uid(),type,title:displayTitle,category:type==='transfer'?'Transfer':category,amount:n,walletId,toWalletId:type==='transfer'?toWalletId:undefined,exchangeRate:type==='transfer'?transferRate():undefined,date,note:note.trim()||undefined,noteImages:noteImages.length?noteImages:undefined,createdAt:old?.createdAt||now,updatedAt:now};const next=await localRepository.upsertTransaction(tx);setData(next);setOpen(false);resetForm()}",
" const remove=":" const remove=(id:string)=>{const tx=data.transactions.find(t=>t.id===id);setDialog({title:'Delete transaction?',message:`${tx?.title||'This transaction'} will be permanently removed from your activity and balances.`,kind:'danger',confirmLabel:'Delete',onConfirm:async()=>{const next=await localRepository.deleteTransaction(id);setData(next)}})}",
" const saveWallet=":" const saveWallet=async()=>{if(!walletForm)return;const name=walletForm.name.trim();const opening=Number(walletForm.openingBalance);if(!name||Number.isNaN(opening))return;if(walletForm.id){const existing=data.wallets.find(w=>w.id===walletForm.id);if(!existing)return;const newCurrency=walletForm.currency;const oldCurrency=existing.currency;const now=new Date().toISOString();const currencyFor=(id?:string)=>{if(!id)return undefined;if(id===existing.id)return newCurrency;return data.wallets.find(w=>w.id===id)?.currency};const transactions=data.transactions.filter(t=>t.walletId===existing.id||t.toWalletId===existing.id).map(t=>{if(t.type!=='transfer'){return {...t,amount:normalize(convert(t.amount,oldCurrency,newCurrency),newCurrency),updatedAt:now}}const sourceBefore=t.walletId===existing.id?oldCurrency:currencyFor(t.walletId)||oldCurrency;const sourceAfter=t.walletId===existing.id?newCurrency:sourceBefore;const destinationAfter=t.toWalletId===existing.id?newCurrency:(currencyFor(t.toWalletId)||sourceAfter);const convertedAmount=t.walletId===existing.id?normalize(convert(t.amount,oldCurrency,newCurrency),newCurrency):t.amount;return {...t,amount:convertedAmount,exchangeRate:pairRate(sourceAfter,destinationAfter),updatedAt:now}});const wallet:Wallet={...existing,name,currency:newCurrency,openingBalance:opening,updatedAt:now};const next=await localRepository.upsertWalletAndTransactions(wallet,transactions);setData(next)}else{const id=uid();const wallet:Wallet={id,name,currency:walletForm.currency,openingBalance:opening};const next=await localRepository.upsertWallet(wallet);setData(next);if(!walletId)setWalletId(id)}setWalletForm(null)}",
" const deleteWallet=":" const deleteWallet=(id:string)=>{const wallet=data.wallets.find(w=>w.id===id);if(!wallet)return;const transactionCount=data.transactions.filter(t=>t.walletId===id||t.toWalletId===id).length;const billCount=data.bills.filter(b=>b.walletId===id).length;const detail=[transactionCount?`${transactionCount} transaction${transactionCount===1?'':'s'}`:'',billCount?`${billCount} bill${billCount===1?'':'s'}`:''].filter(Boolean).join(' and ');setDialog({title:'Delete account?',message:`${wallet.name} will be permanently deleted${detail?` together with ${detail}`:''}.`,kind:'danger',confirmLabel:'Delete',onConfirm:async()=>{const next=await localRepository.deleteWallet(id);setData(next)}})}",
}

found={k:False for k in replacements}
out=[]
for line in lines:
    replaced=False
    for prefix,newline in replacements.items():
        if line.startswith(prefix):
            out.append(newline);found[prefix]=True;replaced=True;break
    if not replaced: out.append(line)

missing=[k for k,v in found.items() if not v]
assert not missing, f'missing function anchors: {missing}'
p.write_text('\n'.join(out)+'\n')

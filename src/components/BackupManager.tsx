import { ChangeEvent, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { loadData, saveData, SpenzaData, SyncChange } from '../lib/db'

type BackupFile={app:'Spenza';version:1;exportedAt:string;data:SpenzaData}
function isValidDate(value:unknown){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00`))}
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
}

function prepareImportedDataForSync(data:SpenzaData):SpenzaData{
 const changedAt=new Date().toISOString()
 const pendingChanges:SyncChange[]=[
  ...data.wallets.map(wallet=>({entityType:'wallet' as const,entityId:wallet.id,operation:'upsert' as const,changedAt})),
  ...data.transactions.map(transaction=>({entityType:'transaction' as const,entityId:transaction.id,operation:'upsert' as const,changedAt})),
  ...(data.bills||[]).map(bill=>({entityType:'bill' as const,entityId:bill.id,operation:'upsert' as const,changedAt})),
 ]
 return {
  ...data,
  bills:data.bills||[],
  sync:{tombstones:[],pendingChanges,lastSyncAt:undefined},
 }
}

export default function BackupManager(){
 const inputRef=useRef<HTMLInputElement>(null)
 const [message,setMessage]=useState('')
 const exportBackup=async()=>{try{const data=await loadData();const backup:BackupFile={app:'Spenza',version:1,exportedAt:new Date().toISOString(),data};const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`spenza-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);setMessage('Backup exported successfully.')}catch{setMessage('Could not export the backup.')}}
 const importBackup=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{const parsed=JSON.parse(await file.text()) as unknown;if(!isValidBackup(parsed)){setMessage('This is not a valid Spenza backup file.');return}if(!window.confirm(`Import this Spenza backup?\n\n${parsed.data.wallets.length} wallets\n${parsed.data.transactions.length} transactions\n\nThis will replace the data currently stored on this device.`))return;const imported=prepareImportedDataForSync(parsed.data);await saveData(imported);setMessage(`Backup imported. ${imported.sync.pendingChanges.length} cloud change${imported.sync.pendingChanges.length===1?'':'s'} queued. Reloading Spenza…`);setTimeout(()=>window.location.reload(),500)}catch{setMessage('Could not read this backup file.')}}
 return <section className="backup-settings"><div><h2>Backup & restore</h2><p>Export your local Spenza data or restore a backup on this device.</p></div><div className="backup-settings-actions"><button onClick={exportBackup}><Download size={17}/><span><b>Export backup</b><small>Download JSON backup</small></span></button><button onClick={()=>inputRef.current?.click()}><Upload size={17}/><span><b>Import backup</b><small>Restore JSON backup</small></span></button></div><input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={importBackup}/>{message&&<div className="backup-message">{message}</div>}</section>
}

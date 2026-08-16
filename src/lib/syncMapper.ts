import { Bill, SpenzaData, SyncChange, SyncEntityType, Transaction, Wallet } from './db'
import { RemoteSyncRecord } from './remoteSyncProvider'

export type RemoteWallet = {
  id: string
  name: string
  currency: Wallet['currency']
  openingBalance: number
  createdAt?: string
  updatedAt?: string
}

export type RemoteTransaction = Transaction
export type RemoteBill = Bill

export type RemotePayload = RemoteWallet | RemoteTransaction | RemoteBill

function entityPayload(data:SpenzaData,entityType:SyncEntityType,entityId:string):RemotePayload|undefined{
  if(entityType==='wallet')return data.wallets.find(w=>w.id===entityId)
  if(entityType==='transaction')return data.transactions.find(t=>t.id===entityId)
  return data.bills.find(b=>b.id===entityId)
}

export function serializePendingChange(data:SpenzaData,change:SyncChange):RemoteSyncRecord<RemotePayload>{
  if(change.operation==='delete')return {entityType:change.entityType,entityId:change.entityId,operation:'delete',changedAt:change.changedAt}
  const payload=entityPayload(data,change.entityType,change.entityId)
  if(!payload)throw new Error(`Missing local ${change.entityType} ${change.entityId} for pending upsert`)
  return {entityType:change.entityType,entityId:change.entityId,operation:'upsert',changedAt:change.changedAt,payload}
}

export function serializePendingChanges(data:SpenzaData):RemoteSyncRecord<RemotePayload>[] {
  return data.sync.pendingChanges.map(change=>serializePendingChange(data,change))
}

export function deserializeRemoteRecord(record:RemoteSyncRecord):RemoteSyncRecord<RemotePayload>{
  if(record.operation==='delete')return {...record,payload:undefined}
  if(!record.payload||typeof record.payload!=='object')throw new Error(`Remote ${record.entityType} ${record.entityId} is missing payload`)
  return record as RemoteSyncRecord<RemotePayload>
}

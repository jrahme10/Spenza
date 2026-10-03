export type Currency='USD'|'LBP'
export type TransactionType='expense'|'income'|'transfer'
export type BillRecurrence='once'|'monthly'|'yearly'
export type BillReminder=0|1|3|7
export type SyncEntityType='wallet'|'transaction'|'bill'
export type SyncOperation='upsert'|'delete'

export type SyncTombstone={
  entityType:SyncEntityType
  entityId:string
  deletedAt:string
}

export type SyncChange={
  entityType:SyncEntityType
  entityId:string
  operation:SyncOperation
  changedAt:string
}

export type SyncState={
  tombstones:SyncTombstone[]
  pendingChanges:SyncChange[]
  lastSyncAt?:string
}

export type Wallet={
  id:string
  name:string
  currency:Currency
  openingBalance:number
  createdAt?:string
  updatedAt?:string
}

export type Transaction={
  id:string
  type:TransactionType
  title:string
  category:string
  amount:number
  walletId:string
  toWalletId?:string
  exchangeRate?:number
  date:string
  note?:string
  noteImages?:string[]
  createdAt:string
  updatedAt:string
}

export type Bill={
  id:string
  name:string
  amount:number
  walletId:string
  category:string
  dueDate:string
  recurrence:BillRecurrence
  reminderDays:BillReminder
  note?:string
  lastPaidDate?:string
  createdAt:string
  updatedAt:string
}

export type AppSecuritySettings={
  enabled:boolean
  pinHash?:string
  salt?:string
  timeoutMinutes:number
  biometricEnabled?:boolean
  biometricCredentialId?:string
}

export type SpenzaMobileData={
  wallets:Wallet[]
  transactions:Transaction[]
  bills:Bill[]
  categories:string[]
  usdToLbpRate:number
  security:AppSecuritySettings
  notificationReadIds:string[]
  notificationDismissedIds:string[]
  sync:SyncState
  defaultWalletId:string|undefined
}

export const DATA_SCHEMA_VERSION=4
export const defaultCategories=['Food','Transport','Shopping','Bills','Coffee','Entertainment','Health','Education','Travel','Salary','Other']
export const DEFAULT_USD_TO_LBP_RATE=89500
export const defaultData:SpenzaMobileData={
  wallets:[],
  transactions:[],
  bills:[],
  categories:defaultCategories,
  usdToLbpRate:DEFAULT_USD_TO_LBP_RATE,
  security:{enabled:false,timeoutMinutes:0,biometricEnabled:false},
  notificationReadIds:[],
  notificationDismissedIds:[],
  sync:{tombstones:[],pendingChanges:[]},
  defaultWalletId:undefined,
}

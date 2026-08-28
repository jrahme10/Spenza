export type Currency='USD'|'LBP'
export type TransactionType='expense'|'income'|'transfer'
export type BillRecurrence='once'|'monthly'|'yearly'

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
  reminderDays:0|1|3|7
  note?:string
  lastPaidDate?:string
  createdAt:string
  updatedAt:string
}

export type SpenzaMobileData={
  wallets:Wallet[]
  transactions:Transaction[]
  bills:Bill[]
  categories:string[]
  usdToLbpRate:number
  defaultWalletId?:string
}

export const defaultCategories=['Food','Transport','Shopping','Bills','Coffee','Entertainment','Health','Education','Travel','Salary','Other']
export const defaultData:SpenzaMobileData={wallets:[],transactions:[],bills:[],categories:defaultCategories,usdToLbpRate:89500}

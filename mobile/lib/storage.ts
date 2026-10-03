import AsyncStorage from '@react-native-async-storage/async-storage'
import { DATA_SCHEMA_VERSION, defaultData, SpenzaMobileData, SyncChange, SyncTombstone } from './types'

const STORAGE_KEY='spenza-mobile-data-v2'
const LEGACY_STORAGE_KEY='spenza-mobile-data-v1'

type Envelope={schemaVersion:number;savedAt:string;data:SpenzaMobileData}

function normalizeTombstones(value:unknown):SyncTombstone[]{
  if(!Array.isArray(value))return []
  return value.filter((item):item is SyncTombstone=>{
    if(!item||typeof item!=='object')return false
    const t=item as Partial<SyncTombstone>
    return ['wallet','transaction','bill'].includes(String(t.entityType))&&typeof t.entityId==='string'&&!!t.entityId&&typeof t.deletedAt==='string'&&!!t.deletedAt
  })
}

function normalizePendingChanges(value:unknown):SyncChange[]{
  if(!Array.isArray(value))return []
  const newest=new Map<string,SyncChange>()
  for(const item of value){
    if(!item||typeof item!=='object')continue
    const change=item as Partial<SyncChange>
    if(!['wallet','transaction','bill'].includes(String(change.entityType)))continue
    if(!['upsert','delete'].includes(String(change.operation)))continue
    if(typeof change.entityId!=='string'||!change.entityId||typeof change.changedAt!=='string'||!change.changedAt)continue
    const normalized=change as SyncChange
    const key=`${normalized.entityType}:${normalized.entityId}`
    const current=newest.get(key)
    if(!current||normalized.changedAt>=current.changedAt)newest.set(key,normalized)
  }
  return [...newest.values()].sort((a,b)=>a.changedAt.localeCompare(b.changedAt))
}

function normalizeData(stored?:Partial<SpenzaMobileData>):SpenzaMobileData{
  const now=new Date().toISOString()
  const wallets=(stored?.wallets??[]).map(wallet=>{const createdAt=wallet.createdAt||wallet.updatedAt||now;return {...wallet,createdAt,updatedAt:wallet.updatedAt||createdAt}})
  const transactions=(stored?.transactions??[]).map(transaction=>{const createdAt=transaction.createdAt||transaction.updatedAt||`${transaction.date}T12:00:00.000Z`;return {...transaction,createdAt,updatedAt:transaction.updatedAt||createdAt}})
  const bills=(stored?.bills??[]).map(bill=>{const createdAt=bill.createdAt||bill.updatedAt||`${bill.dueDate}T12:00:00.000Z`;return {...bill,createdAt,updatedAt:bill.updatedAt||createdAt}})
  const savedCategories=stored?.categories??defaultData.categories
  const usedCategories=transactions.map(t=>t.category?.trim()).filter((v):v is string=>!!v)
  const categories=[...new Map([...savedCategories,...usedCategories].map(v=>[v.toLowerCase(),v])).values()]
  return {
    wallets,
    transactions,
    bills,
    categories,
    usdToLbpRate:stored?.usdToLbpRate??defaultData.usdToLbpRate,
    security:{
      enabled:stored?.security?.enabled??false,
      pinHash:stored?.security?.pinHash,
      salt:stored?.security?.salt,
      timeoutMinutes:stored?.security?.timeoutMinutes??0,
      biometricEnabled:stored?.security?.biometricEnabled??false,
      biometricCredentialId:stored?.security?.biometricCredentialId,
    },
    notificationReadIds:stored?.notificationReadIds??[],
    notificationDismissedIds:stored?.notificationDismissedIds??[],
    sync:{
      tombstones:normalizeTombstones(stored?.sync?.tombstones),
      pendingChanges:normalizePendingChanges(stored?.sync?.pendingChanges),
      lastSyncAt:typeof stored?.sync?.lastSyncAt==='string'?stored.sync.lastSyncAt:undefined,
    },
    defaultWalletId:stored?.defaultWalletId,
  }
}

function envelope(data:SpenzaMobileData):Envelope{return {schemaVersion:DATA_SCHEMA_VERSION,savedAt:new Date().toISOString(),data:normalizeData(data)}}

export async function loadData():Promise<SpenzaMobileData>{
  const raw=await AsyncStorage.getItem(STORAGE_KEY)??await AsyncStorage.getItem(LEGACY_STORAGE_KEY)
  if(!raw)return normalizeData(defaultData)
  try{
    const parsed=JSON.parse(raw) as Envelope|Partial<SpenzaMobileData>
    const data=('schemaVersion'in parsed&&'data'in parsed)?normalizeData((parsed as Envelope).data):normalizeData(parsed as Partial<SpenzaMobileData>)
    await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(envelope(data)))
    if(await AsyncStorage.getItem(LEGACY_STORAGE_KEY))await AsyncStorage.removeItem(LEGACY_STORAGE_KEY)
    return data
  }catch{
    return normalizeData(defaultData)
  }
}

export async function saveData(data:SpenzaMobileData){
  await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(envelope(data)))
}

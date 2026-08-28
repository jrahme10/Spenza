import type { Bill,SpenzaMobileData,SyncEntityType,Transaction,Wallet } from './types'
import { defaultCategories } from './types'
import { getSupabaseUserId,supabase } from './supabaseClient'

type CloudRow={owner_id:string;id:string;payload:unknown;changed_at:string}
type TombstoneRow={owner_id:string;entity_type:SyncEntityType;entity_id:string;deleted_at:string}

const tableFor=(entityType:SyncEntityType)=>entityType==='wallet'?'spenza_wallets':entityType==='transaction'?'spenza_transactions':'spenza_bills'
const changedAtOf=(value:{updatedAt?:string;createdAt?:string})=>value.updatedAt||value.createdAt||new Date(0).toISOString()

function mergeById<T extends {id:string;updatedAt?:string;createdAt?:string}>(local:T[],remote:T[]){
 const map=new Map<string,T>()
 for(const item of [...local,...remote]){
  const current=map.get(item.id)
  if(!current||changedAtOf(item)>=changedAtOf(current))map.set(item.id,item)
 }
 return [...map.values()]
}

function applyTombstones<T extends {id:string;updatedAt?:string;createdAt?:string}>(items:T[],tombstones:TombstoneRow[],entityType:SyncEntityType){
 const deleted=new Map(tombstones.filter(t=>t.entity_type===entityType).map(t=>[t.entity_id,t.deleted_at]))
 return items.filter(item=>{
  const deletedAt=deleted.get(item.id)
  return !deletedAt||changedAtOf(item)>deletedAt
 })
}

async function fetchRows(table:string,userId:string){
 const {data,error}=await supabase.from(table).select('owner_id,id,payload,changed_at').eq('owner_id',userId)
 if(error)throw error
 return (data||[]) as CloudRow[]
}

async function fetchTombstones(userId:string){
 const {data,error}=await supabase.from('spenza_tombstones').select('owner_id,entity_type,entity_id,deleted_at').eq('owner_id',userId)
 if(error)throw error
 return (data||[]) as TombstoneRow[]
}

export async function pullCloudData(local:SpenzaMobileData):Promise<SpenzaMobileData>{
 const userId=await getSupabaseUserId()
 if(!userId)throw new Error('Sign in before syncing.')
 const [walletRows,transactionRows,billRows,tombstones]=await Promise.all([
  fetchRows('spenza_wallets',userId),fetchRows('spenza_transactions',userId),fetchRows('spenza_bills',userId),fetchTombstones(userId),
 ])
 const wallets=applyTombstones(mergeById(local.wallets,walletRows.map(r=>r.payload as Wallet)),tombstones,'wallet')
 const transactions=applyTombstones(mergeById(local.transactions,transactionRows.map(r=>r.payload as Transaction)),tombstones,'transaction')
 const bills=applyTombstones(mergeById(local.bills,billRows.map(r=>r.payload as Bill)),tombstones,'bill')
 const categories=Array.from(new Set([...defaultCategories,...local.categories,...transactions.map(t=>t.category),...bills.map(b=>b.category)]))
 return {...local,wallets,transactions,bills,categories,sync:{...local.sync,tombstones:tombstones.map(t=>({entityType:t.entity_type,entityId:t.entity_id,deletedAt:t.deleted_at})),lastSyncAt:new Date().toISOString()}}
}

export async function pushPendingChanges(local:SpenzaMobileData):Promise<SpenzaMobileData>{
 const userId=await getSupabaseUserId()
 if(!userId)throw new Error('Sign in before syncing.')
 let next=local
 for(const change of local.sync.pendingChanges){
  const table=tableFor(change.entityType)
  if(change.operation==='delete'){
   const {error:deleteError}=await supabase.from(table).delete().eq('owner_id',userId).eq('id',change.entityId)
   if(deleteError)throw deleteError
   const {error:tombstoneError}=await supabase.from('spenza_tombstones').upsert({owner_id:userId,entity_type:change.entityType,entity_id:change.entityId,deleted_at:change.changedAt},{onConflict:'owner_id,entity_type,entity_id'})
   if(tombstoneError)throw tombstoneError
  }else{
   const payload=change.entityType==='wallet'?local.wallets.find(x=>x.id===change.entityId):change.entityType==='transaction'?local.transactions.find(x=>x.id===change.entityId):local.bills.find(x=>x.id===change.entityId)
   if(!payload)continue
   const {error}=await supabase.from(table).upsert({owner_id:userId,id:change.entityId,payload,changed_at:change.changedAt},{onConflict:'owner_id,id'})
   if(error)throw error
   const {error:tombstoneError}=await supabase.from('spenza_tombstones').delete().eq('owner_id',userId).eq('entity_type',change.entityType).eq('entity_id',change.entityId)
   if(tombstoneError)throw tombstoneError
  }
  next={...next,sync:{...next.sync,pendingChanges:next.sync.pendingChanges.filter(c=>!(c.entityType===change.entityType&&c.entityId===change.entityId))}}
 }
 return {...next,sync:{...next.sync,lastSyncAt:new Date().toISOString()}}
}

export async function syncCloudData(local:SpenzaMobileData){
 const pushed=await pushPendingChanges(local)
 return pullCloudData(pushed)
}

export async function replaceLocalWithCloud(local:SpenzaMobileData){
 const empty:{... never}=undefined as never
 void empty
 const base={...local,wallets:[],transactions:[],bills:[],sync:{...local.sync,pendingChanges:[]}}
 return pullCloudData(base)
}

export async function clearSignedInUsersCloudData(){
 const userId=await getSupabaseUserId()
 if(!userId)throw new Error('Sign in before clearing cloud data.')
 for(const table of ['spenza_transactions','spenza_bills','spenza_tombstones','spenza_wallets'] as const){
  const {error}=await supabase.from(table).delete().eq('owner_id',userId)
  if(error)throw error
 }
}

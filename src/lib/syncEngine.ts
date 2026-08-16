import { SpenzaData, SyncChange, SyncEntityType } from './db'

export type SyncVersion = {
  updatedAt?: string
  deletedAt?: string
}

export type ConflictResolution = 'local' | 'remote' | 'equal'

function versionTimestamp(version:SyncVersion){
  return version.deletedAt || version.updatedAt || ''
}

export function resolveConflict(local:SyncVersion,remote:SyncVersion):ConflictResolution{
  const localStamp=versionTimestamp(local)
  const remoteStamp=versionTimestamp(remote)
  if(localStamp>remoteStamp)return 'local'
  if(remoteStamp>localStamp)return 'remote'
  if(local.deletedAt&&!remote.deletedAt)return 'local'
  if(remote.deletedAt&&!local.deletedAt)return 'remote'
  return 'equal'
}

export function pendingChanges(data:SpenzaData):SyncChange[]{
  return [...data.sync.pendingChanges].sort((a,b)=>a.changedAt.localeCompare(b.changedAt))
}

export function acknowledgeChanges(data:SpenzaData,acknowledged:SyncChange[],syncedAt=new Date().toISOString()):SpenzaData{
  const acked=new Map<string,string>()
  for(const change of acknowledged){
    const key=`${change.entityType}:${change.entityId}`
    const current=acked.get(key)
    if(!current||change.changedAt>current)acked.set(key,change.changedAt)
  }
  const remaining=data.sync.pendingChanges.filter(change=>{
    const acknowledgedAt=acked.get(`${change.entityType}:${change.entityId}`)
    return !acknowledgedAt||change.changedAt>acknowledgedAt
  })
  return {...data,sync:{...data.sync,pendingChanges:remaining,lastSyncAt:syncedAt}}
}

export function markSyncCompleted(data:SpenzaData,syncedAt=new Date().toISOString()):SpenzaData{
  return {...data,sync:{...data.sync,lastSyncAt:syncedAt}}
}

export function findTombstone(data:SpenzaData,entityType:SyncEntityType,entityId:string){
  return data.sync.tombstones.find(t=>t.entityType===entityType&&t.entityId===entityId)
}

import { SyncEntityType, SyncOperation } from './db'

export type RemoteSyncRecord<TPayload = unknown> = {
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  changedAt: string
  payload?: TPayload
}

export type PullRemoteChangesRequest = {
  since?: string
  limit?: number
  cursor?: string
}

export type PullRemoteChangesResult = {
  changes: RemoteSyncRecord[]
  cursor?: string
  hasMore: boolean
  serverTime: string
}

export type PushRemoteChangesResult = {
  accepted: RemoteSyncRecord[]
  rejected: Array<{ change: RemoteSyncRecord; reason: string }>
  serverTime: string
}

export interface RemoteSyncProvider {
  pullChanges(request: PullRemoteChangesRequest): Promise<PullRemoteChangesResult>
  pushChanges(changes: RemoteSyncRecord[]): Promise<PushRemoteChangesResult>
}
